import type { SettingsV1, Clip } from "../types";
import { clipRepository } from "./clipUtils";
import { clipsBulkPut, clipsGetAll, clipsCount } from "./idb";

const K_SETTINGS = "tr:settings:v1";
const K_CLIPS = "tr:clips:v1"; // legacy localStorage key (pre-IDB)
const K_CLIPS_MIGRATED = "tr:clips:migrated:v1";

export function loadSettings(): Partial<SettingsV1> | null {
  try {
    return JSON.parse(localStorage.getItem(K_SETTINGS) || "null");
  } catch {
    return null;
  }
}

// Debounced writes to reduce IO churn
let tSettings: number | null = null;
let lastSettings: SettingsV1 | null = null;
export function saveSettings(s: SettingsV1) {
  lastSettings = s;
  if (tSettings) clearTimeout(tSettings);
  tSettings = window.setTimeout(() => {
    try {
      localStorage.setItem(K_SETTINGS, JSON.stringify(lastSettings));
    } catch { /* ignore: best-effort persist */ }
  }, 150);
}

// --- Clips: IndexedDB (with migration) ---

let tClips: number | null = null;
let lastClips: Clip[] | null = null;

async function migrateClipsIfNeeded(): Promise<void> {
  try {
    // Avoid re-migrating if flagged
    const flagged = localStorage.getItem(K_CLIPS_MIGRATED) === "1";
    const idbHas = (await clipsCount()) > 0;
    if (flagged || idbHas) return;
    const raw = JSON.parse(localStorage.getItem(K_CLIPS) || "null");
    if (!Array.isArray(raw) || raw.length === 0) {
      localStorage.setItem(K_CLIPS_MIGRATED, "1");
      return;
    }
    const migrated = clipRepository.migrate(raw as unknown[]);
    await clipsBulkPut(migrated);
    // Keep legacy data as a backup, but set a flag to avoid repeat
    localStorage.setItem(K_CLIPS_MIGRATED, "1");
  } catch {
    // swallow; fall back to IDB being empty
  }
}

export async function loadClips(): Promise<Clip[]> {
  await migrateClipsIfNeeded();
  try {
    return await clipsGetAll();
  } catch {
    // Fallback: legacy localStorage (should not happen often)
    try {
      const v = JSON.parse(localStorage.getItem(K_CLIPS) || "[]");
      return Array.isArray(v) ? (v as Clip[]) : [];
    } catch {
      return [] as Clip[];
    }
  }
}

export async function saveClips(list: Clip[]): Promise<void> {
  lastClips = list;
  if (tClips) clearTimeout(tClips);
  await new Promise<void>((resolve) => {
    tClips = window.setTimeout(async () => {
      try {
        if (lastClips) await clipsBulkPut(lastClips);
      } catch {
        // As a last resort, mirror to localStorage
        try { localStorage.setItem(K_CLIPS, JSON.stringify(lastClips || [])); } catch { /* ignore: localStorage may be blocked */ }
      } finally {
        resolve();
      }
    }, 150);
  });
}

/** Export clips + settings as a downloadable JSON file. */
export function exportDataFile(payload: { settings: SettingsV1; clips: Clip[] }) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tempo-reader-export-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

/** Parse an imported JSON string. Throws on invalid shape. */
export function parseImport(json: string): { settings?: Partial<SettingsV1>; clips?: Clip[] } {
  const data = JSON.parse(json);
  if (typeof data !== "object" || data === null) throw new Error("Invalid file");
  const out: { settings?: Partial<SettingsV1>; clips?: Clip[] } = {};
  if (data.settings && typeof data.settings === "object") out.settings = data.settings;
  if (Array.isArray(data.clips)) out.clips = data.clips;
  return out;
}

function flushPending() {
  if (tSettings && lastSettings) {
    try { localStorage.setItem(K_SETTINGS, JSON.stringify(lastSettings)); } catch { /* ignore */ }
    clearTimeout(tSettings); tSettings = null;
  }
  if (tClips && lastClips) {
    // Fire-and-forget; no await
    try { void clipsBulkPut(lastClips); } catch { /* ignore */ }
    clearTimeout(tClips); tClips = null;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushPending);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) flushPending();
  });
}
