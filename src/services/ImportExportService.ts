import type { SettingsV1, Clip } from "../types";
import { exportDataFile, parseImport } from "../lib/storage";

export function exportAll(settings: SettingsV1, clips: Clip[]) {
  exportDataFile({ settings, clips });
}

type SettingsSetters = {
  setWps: (v: number) => void;
  setCount: (v: number) => void;
  setGap: (v: number) => void;
  setFocusScale: (v: number) => void;
  setDimScale: (v: number) => void;
  setDimBlur: (v: number) => void;
  setFontPx: (v: number) => void;
  setDark: (v: boolean) => void;
  setDrawerOpen: (v: boolean) => void;
  setTheme?: (v: SettingsV1['theme']) => void;
};

export async function importFromFile(file: File, setters: SettingsSetters, setClips: (c: Clip[]) => void) {
  const text = await file.text();
  const data = parseImport(text);
  if (data.settings) {
    const s = data.settings as Partial<SettingsV1>;
    if (s.wps != null) setters.setWps(Number(s.wps));
    if (s.count != null) setters.setCount(Number(s.count));
    if (s.gap != null) setters.setGap(Number(s.gap));
    if (s.focusScale != null) setters.setFocusScale(Number(s.focusScale));
    if (s.dimScale != null) setters.setDimScale(Number(s.dimScale));
    if (s.dimBlur != null) setters.setDimBlur(Number(s.dimBlur));
    if (s.fontPx != null) setters.setFontPx(Number(s.fontPx));
    if (s.theme != null && setters.setTheme) setters.setTheme(s.theme);
    if (s.dark != null) setters.setDark(!!s.dark);
    if (s.drawerOpen != null) setters.setDrawerOpen(!!s.drawerOpen);
  }
  if (data.clips) setClips(data.clips);
}

