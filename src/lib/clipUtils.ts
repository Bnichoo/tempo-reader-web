import type { Clip } from "../types";
import { LIMITS } from "./constants";
import { sanitizeHTML } from "./sanitize";

/** Repository-style helpers for clips operations. */
export const clipRepository = {
  migrate(raw: unknown[]): Clip[] {
    const arr = Array.isArray(raw) ? raw : [];
    const nowIso = new Date().toISOString();
    return arr.map((c: unknown, idx: number) => {
      const obj: Record<string, unknown> = c && typeof c === "object" ? (c as Record<string, unknown>) : {};
      const id: string =
        typeof obj.id === "string" && obj.id
          ? (obj.id as string)
          : (crypto?.randomUUID ? crypto.randomUUID() : `${nowIso}-${idx}`);
      const startU = obj["start"];
      const lengthU = obj["length"];
      const start = Math.max(0, typeof startU === "number" ? startU : Number(startU) || 0);
      const length = Math.max(1, typeof lengthU === "number" ? lengthU : Number(lengthU) || 1);
      const snippet = typeof obj.snippet === "string" ? (obj.snippet as string) : "";
      const pinnedU = obj["pinned"];
      const pinned = typeof pinnedU === "boolean" ? pinnedU : Boolean(pinnedU);
      const createdUtc =
        typeof obj.createdUtc === "string" && obj.createdUtc ? (obj.createdUtc as string) : nowIso;
      const noteHtml = typeof obj.noteHtml === "string" && obj.noteHtml
        ? sanitizeHTML(obj.noteHtml as string)
        : undefined;
      const docId = typeof obj.docId === "string" && obj.docId ? (obj.docId as string) : (localStorage.getItem("tr:lastDocId") || "legacy");
      const tagsU = (obj as Record<string, unknown>)["tags"];
      const tags = Array.isArray(tagsU) ? (tagsU as unknown[]).filter((t): t is string => typeof t === 'string') : undefined;
      const categoryU = (obj as Record<string, unknown>)["category"];
      const category = typeof categoryU === 'string' ? categoryU : undefined;
      return { id, start, length, snippet, noteHtml, pinned, createdUtc, docId, tags, category } as Clip;
    });
  },

  prune(clips: Clip[]): Clip[] {
    // Cap based on shared limits
    const MAX = LIMITS.MAX_CLIPS;
    if (clips.length <= MAX) return clips;
    const pinned = clips.filter((c) => c.pinned);
    const rest = clips
      .filter((c) => !c.pinned)
      .sort((a, b) => new Date(b.createdUtc).getTime() - new Date(a.createdUtc).getTime());
    return [...pinned, ...rest].slice(0, MAX);
  },

  serialize(clips: Clip[]): string {
    return JSON.stringify(clips);
  },
};
