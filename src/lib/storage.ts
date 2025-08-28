import type { SettingsV1, Clip } from "../types";

const K_SETTINGS = "tr:settings:v1";
const K_CLIPS = "tr:clips:v1";

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
    } catch {}
  }, 150);
}

export function loadClips(): Clip[] {
  try {
    const v = JSON.parse(localStorage.getItem(K_CLIPS) || "[]");
    return Array.isArray(v) ? (v as Clip[]) : [];
  } catch {
    return [] as Clip[];
  }
}

let tClips: number | null = null;
let lastClips: Clip[] | null = null;
export function saveClips(list: Clip[]) {
  lastClips = list;
  if (tClips) clearTimeout(tClips);
  tClips = window.setTimeout(() => {
    try {
      localStorage.setItem(K_CLIPS, JSON.stringify(lastClips));
    } catch {}
  }, 150);
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
    try { localStorage.setItem(K_SETTINGS, JSON.stringify(lastSettings)); } catch {}
    clearTimeout(tSettings); tSettings = null;
  }
  if (tClips && lastClips) {
    try { localStorage.setItem(K_CLIPS, JSON.stringify(lastClips)); } catch {}
    clearTimeout(tClips); tClips = null;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushPending);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) flushPending();
  });
}
