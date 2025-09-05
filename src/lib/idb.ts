import type { Clip } from "../types";

const DB_NAME = "tempo-reader";
const DB_VERSION = 2;
const STORE_CLIPS = "clips";
const STORE_META = "meta";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      let clips: IDBObjectStore;
      if (!db.objectStoreNames.contains(STORE_CLIPS)) {
        clips = db.createObjectStore(STORE_CLIPS, { keyPath: "id" });
      } else {
        clips = req.transaction!.objectStore(STORE_CLIPS);
      }
      // Ensure index on docId exists
      try {
        if (!Array.from((clips as any).indexNames || []).includes("docId")) {
          clips.createIndex("docId", "docId", { unique: false });
        }
      } catch {}
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "key" });
      }
    };
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
  return dbPromise;
}

async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => Promise<T> | T): Promise<T> {
  const db = await openDB();
  return await new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let settled = false;
    const finish = (v: T) => { if (!settled) { settled = true; resolve(v); } };
    const fail = (e: unknown) => { if (!settled) { settled = true; reject(e); } };
    t.oncomplete = () => !settled && resolve(undefined as unknown as T);
    t.onerror = () => fail(t.error || new Error("Transaction error"));
    try {
      const out = fn(s);
      if (out instanceof Promise) out.then(finish).catch(fail);
      else finish(out);
    } catch (e) {
      fail(e);
    }
  });
}

export async function clipsGetAll(): Promise<Clip[]> {
  return await tx<Clip[]>(STORE_CLIPS, "readonly", (s) => {
    return new Promise((resolve, reject) => {
      const req = s.getAll();
      req.onsuccess = () => resolve((req.result || []) as Clip[]);
      req.onerror = () => reject(req.error);
    });
  });
}

export async function clipsGetByDoc(docId: string): Promise<Clip[]> {
  const db = await openDB();
  return await new Promise((resolve, reject) => {
    const t = db.transaction(STORE_CLIPS, "readonly");
    const s = t.objectStore(STORE_CLIPS);
    let idx: IDBIndex | null = null;
    try { idx = s.index("docId"); } catch {}
    if (!idx) {
      // Fallback: getAll and filter
      const req = s.getAll();
      req.onsuccess = () => resolve(((req.result || []) as Clip[]).filter(c => (c as any).docId === docId));
      req.onerror = () => reject(req.error);
      return;
    }
    const req = idx.getAll(IDBKeyRange.only(docId));
    req.onsuccess = () => resolve((req.result || []) as Clip[]);
    req.onerror = () => reject(req.error);
  });
}

export async function clipsCountByDoc(docId: string): Promise<number> {
  const db = await openDB();
  return await new Promise((resolve, reject) => {
    const t = db.transaction(STORE_CLIPS, "readonly");
    const s = t.objectStore(STORE_CLIPS);
    let idx: IDBIndex | null = null;
    try { idx = s.index("docId"); } catch {}
    if (!idx) {
      const req = s.getAll();
      req.onsuccess = () => resolve(((req.result || []) as Clip[]).filter(c => (c as any).docId === docId).length);
      req.onerror = () => reject(req.error);
      return;
    }
    const req = idx.count(IDBKeyRange.only(docId));
    req.onsuccess = () => resolve(req.result || 0);
    req.onerror = () => reject(req.error);
  });
}

export async function clipsBulkUpdateDocId(fromDocId: string, toDocId: string): Promise<number> {
  const items = await clipsGetByDoc(fromDocId);
  if (!items.length) return 0;
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE_CLIPS, "readwrite");
    const s = t.objectStore(STORE_CLIPS);
    for (const c of items) { (c as any).docId = toDocId; s.put(c); }
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
  return items.length;
}

export async function recordRecentDoc(docId: string, name: string): Promise<void> {
  try {
    await metaSet('doc:'+docId, { name, ts: Date.now() });
    const list = (await metaGet<string[]>("recentDocs")) || [];
    const next = [docId, ...list.filter(id => id !== docId)].slice(0, 20);
    await metaSet("recentDocs", next);
  } catch {}
}

export async function clipsCount(): Promise<number> {
  return await tx<number>(STORE_CLIPS, "readonly", (s) => {
    return new Promise((resolve, reject) => {
      const req = s.count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => reject(req.error);
    });
  });
}

export async function clipsClear(): Promise<void> {
  await tx<void>(STORE_CLIPS, "readwrite", (s) => {
    return new Promise((resolve, reject) => {
      const req = s.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
}

export async function clipsBulkPut(list: Clip[], chunkSize = 200): Promise<void> {
  if (!list.length) return;
  const db = await openDB();
  let i = 0;
  while (i < list.length) {
    const end = Math.min(i + chunkSize, list.length);
    await new Promise<void>((resolve, reject) => {
      const t = db.transaction(STORE_CLIPS, "readwrite");
      const s = t.objectStore(STORE_CLIPS);
      for (let j = i; j < end; j++) {
        s.put(list[j]);
      }
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error("Transaction aborted"));
    });
    i = end;
  }
}

export async function metaGet<T = unknown>(key: string): Promise<T | undefined> {
  return await tx<T | undefined>(STORE_META, "readonly", (s) => {
    return new Promise((resolve, reject) => {
      const req = s.get(key);
      req.onsuccess = () => resolve(req.result?.value as T | undefined);
      req.onerror = () => reject(req.error);
    });
  });
}

export async function metaSet<T = unknown>(key: string, value: T): Promise<void> {
  await tx<void>(STORE_META, "readwrite", (s) => {
    return new Promise((resolve, reject) => {
      const req = s.put({ key, value });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
}

export async function estimateStorage(): Promise<{ usage?: number; quota?: number }> {
  try {
    const est = await (navigator.storage?.estimate?.() ?? Promise.resolve({} as any));
    return { usage: (est as any).usage, quota: (est as any).quota };
  } catch {
    return {};
  }
}

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    // Some TS DOM lib versions may not include 'persist' typing
    const persist = (navigator.storage as any)?.persist as (() => Promise<boolean>) | undefined;
    if (persist) {
      return await persist();
    }
    return false;
  } catch {
    return false;
  }
}
