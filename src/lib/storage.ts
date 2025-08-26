export type SettingsV1 = {
  wps: number;
  count: number;
  gap: number;
  focusScale: number;
  dimScale: number;
  dimBlur: number;
  fontPx: number;
  dark: boolean;
  drawerOpen: boolean;
};

const K_SETTINGS = "tr:settings:v1";
const K_CLIPS    = "tr:clips:v1";

export function loadSettings(): Partial<SettingsV1> | null {
  try { return JSON.parse(localStorage.getItem(K_SETTINGS) || "null"); }
  catch { return null; }
}

export function saveSettings(s: SettingsV1) {
  try { localStorage.setItem(K_SETTINGS, JSON.stringify(s)); } catch {}
}

export type ClipDTO = { id:string; start:number; length:number; snippet:string; noteHtml?:string; pinned?:boolean; createdUtc:string };

export function loadClips(): ClipDTO[] {
  try { return JSON.parse(localStorage.getItem(K_CLIPS) || "[]"); }
  catch { return []; }
}

export function saveClips(list: ClipDTO[]) {
  try { localStorage.setItem(K_CLIPS, JSON.stringify(list)); } catch {}
}

/** Export clips + settings as a downloadable JSON file. */
export function exportDataFile(payload: { settings: SettingsV1; clips: ClipDTO[] }) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tempo-reader-export-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

/** Parse an imported JSON string. Throws on invalid shape. */
export function parseImport(json: string): { settings?: Partial<SettingsV1>; clips?: ClipDTO[] } {
  const data = JSON.parse(json);
  if (typeof data !== "object" || data === null) throw new Error("Invalid file");
  const out: { settings?: Partial<SettingsV1>; clips?: ClipDTO[] } = {};
  if (data.settings && typeof data.settings === "object") out.settings = data.settings;
  if (Array.isArray(data.clips)) out.clips = data.clips;
  return out;
}
