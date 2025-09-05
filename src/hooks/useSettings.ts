import { useEffect, useMemo, useState } from "react";
import type { SettingsV1 } from "../types";
import { loadSettings as loadSettingsStorage, saveSettings as saveSettingsStorage } from "../lib/storage";

function clamp(n: number, min: number, max: number) { return Math.min(max, Math.max(min, n)); }

export type UseSettings = ReturnType<typeof useSettings>;

export function useSettings() {
  const [wps, setWps] = useState(1.5);
  const [count, setCount] = useState(3);
  const [gap, setGap] = useState(0.2);
  const [focusScale, setFocusScale] = useState(1.18);
  const [dimScale, setDimScale] = useState(0.96);
  const [dimBlur, setDimBlur] = useState(0.8);
  const [fontPx, setFontPx] = useState(20);
  const [dark, setDark] = useState<boolean>(() => {
    const saved = localStorage.getItem("theme:dark");
    if (saved != null) return saved === "1";
    return (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  });
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Load settings once
  useEffect(() => {
    const s = loadSettingsStorage() || {};
    const sc = <K extends keyof SettingsV1>(p: Partial<SettingsV1>, k: K, f: (v: SettingsV1[K]) => void) => { if (p[k] != null) f(p[k] as SettingsV1[K]); };
    sc(s, "wps", (v) => setWps(clamp(Number(v), 0.5, 3)));
    sc(s, "count", (v) => setCount(clamp(Number(v), 1, 7)));
    sc(s, "gap", (v) => setGap(clamp(Number(v), 0.2, 0.8)));
    sc(s, "focusScale", (v) => setFocusScale(clamp(Number(v), 1.0, 1.6)));
    sc(s, "dimScale", (v) => setDimScale(clamp(Number(v), 0.85, 1.0)));
    sc(s, "dimBlur", (v) => setDimBlur(clamp(Number(v), 0, 2.5)));
    sc(s, "fontPx", (v) => setFontPx(clamp(Number(v), 16, 28)));
    sc(s, "dark", (v) => setDark(!!v));
    sc(s, "drawerOpen", (v) => setDrawerOpen(!!v));
  }, []);

  // Persist theme side-effect
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    localStorage.setItem("theme:dark", dark ? "1" : "0");
  }, [dark]);

  // Save settings when they change
  useEffect(() => {
    const settings: SettingsV1 = { wps, count, gap, focusScale, dimScale, dimBlur, fontPx, dark, drawerOpen };
    saveSettingsStorage(settings);
  }, [wps, count, gap, focusScale, dimScale, dimBlur, fontPx, dark, drawerOpen]);

  const settings = useMemo(() => ({ wps, count, gap, focusScale, dimScale, dimBlur, fontPx, dark, drawerOpen }), [wps, count, gap, focusScale, dimScale, dimBlur, fontPx, dark, drawerOpen]);
  const setters = { setWps, setCount, setGap, setFocusScale, setDimScale, setDimBlur, setFontPx, setDark, setDrawerOpen };
  return { settings, ...setters } as const;
}

