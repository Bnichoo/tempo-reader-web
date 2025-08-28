import { useEffect, useRef } from "react";
import Upload from "lucide-react/dist/esm/icons/upload.js";
import Download from "lucide-react/dist/esm/icons/download.js";
import Loader2 from "lucide-react/dist/esm/icons/loader-2.js";
import Timer from "lucide-react/dist/esm/icons/timer.js";
import ListOrdered from "lucide-react/dist/esm/icons/list-ordered.js";
import Rows from "lucide-react/dist/esm/icons/rows.js";
import Focus from "lucide-react/dist/esm/icons/focus.js";
import Contrast from "lucide-react/dist/esm/icons/contrast.js";
import TypeIcon from "lucide-react/dist/esm/icons/type.js";

type DrawerControlsProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  offset: number;
  wps: number; setWps: (v: number) => void;
  count: number; setCount: (v: number) => void;
  gap: number; setGap: (v: number) => void;
  focusScale: number; setFocusScale: (v: number) => void;
  dimScale: number; setDimScale: (v: number) => void;
  dimBlur: number; setDimBlur: (v: number) => void;
  fontPx: number; setFontPx: (v: number) => void;
  dark: boolean; setDark: (v: boolean) => void;
  isImporting: boolean; onImportJson: (file: File | null) => void;
  isExporting: boolean; doExport: () => void;
};

export function DrawerControls(props: DrawerControlsProps) {
  const { open, setOpen, offset, wps, setWps, count, setCount, gap, setGap, focusScale, setFocusScale, dimScale, setDimScale, dimBlur, setDimBlur, fontPx, setFontPx, dark, setDark, isImporting, onImportJson, isExporting, doExport } = props;

  const drawerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastMouseY = useRef<number>(0);
  const stepAutoScroll = () => {
    const el = drawerRef.current; if (!el) { rafRef.current = null; return; }
    const rect = el.getBoundingClientRect(); const y = lastMouseY.current;
    const Z = 120, MIN = 0.8, MAX = 3.2; let dy = 0;
    const dTop = y - rect.top, dBottom = rect.bottom - y;
    if (dTop >= 0 && dTop <= Z) { const t = 1 - dTop / Z; dy = -(MIN + (MAX - MIN) * t); }
    else if (dBottom >= 0 && dBottom <= Z) { const t = 1 - dBottom / Z; dy = MIN + (MAX - MIN) * t; }
    if (dy !== 0) { el.scrollTop += dy; rafRef.current = requestAnimationFrame(stepAutoScroll); } else { rafRef.current = null; }
  };

  useEffect(() => {
    if (!open) return; let timer: number | null = null;
    const reset = () => { if (timer) window.clearTimeout(timer); timer = window.setTimeout(() => setOpen(false), 20000); };
    reset(); const el: Document | HTMLDivElement = drawerRef.current || document; const handler = () => reset();
    const events: (keyof DocumentEventMap)[] = ["mousemove", "mousedown", "wheel", "keydown", "touchstart"];
    events.forEach((ev) => el.addEventListener(ev, handler, { passive: true } as any));
    return () => { if (timer) window.clearTimeout(timer); events.forEach((ev) => el.removeEventListener(ev, handler as any)); };
    }, [open, setOpen]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  return (
    <>
      <button className={`drawer-toggle-fab ${open ? "open" : ""}`} onClick={() => setOpen(!open)} aria-label="Toggle controls" aria-expanded={open} aria-controls="reader-controls-drawer" style={{ left: `${offset}px` }}>
        <span className="fab-icon"><span className="bar" /></span>
        <span className="fab-text">Controls</span>
      </button>

      <aside className={`drawer-left ${open ? "open" : ""}`} ref={drawerRef} style={{ overflowY: "auto", maxHeight: "100vh" }} role="region" aria-label="Reader controls" id="reader-controls-drawer"
        onWheel={(e) => { e.stopPropagation(); }}
        onMouseMove={(e) => { lastMouseY.current = e.clientY; if (!rafRef.current) rafRef.current = requestAnimationFrame(stepAutoScroll); }}
        onMouseEnter={(e) => { lastMouseY.current = e.clientY; if (!rafRef.current) rafRef.current = requestAnimationFrame(stepAutoScroll); }}
        onMouseLeave={() => { if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } }}
      >
        <div className="text-sm font-semibold mb-2">Reader controls</div>

        <div className="my-3">
          <label htmlFor="ctl-wps" className="mb-1 flex items-center gap-2 text-sm text-sepia-700">
            <Timer aria-hidden size={16} />
            <span>Tempo (words/sec): {wps.toFixed(1)}</span>
          </label>
          <input id="ctl-wps" className="w-full" type="range" min={0.5} max={3} step={0.1} value={wps} onChange={(e) => setWps(parseFloat(e.target.value))} />
        </div>

        <div className="my-3">
          <label htmlFor="ctl-count" className="mb-1 flex items-center gap-2 text-sm text-sepia-700">
            <ListOrdered aria-hidden size={16} />
            <span>Words shown: {count}</span>
          </label>
          <input id="ctl-count" className="w-full" type="range" min={1} max={7} step={1} value={count} onChange={(e) => setCount(parseInt(e.target.value, 10))} />
        </div>

        <div className="my-3">
          <label htmlFor="ctl-gap" className="mb-1 flex items-center gap-2 text-sm text-sepia-700">
            <Rows aria-hidden size={16} />
            <span>Text spacing (em): {gap.toFixed(2)}</span>
          </label>
          <input id="ctl-gap" className="w-full" type="range" min={0.2} max={0.8} step={0.01} value={gap} onChange={(e) => setGap(parseFloat(e.target.value))} />
        </div>

        <div className="my-3">
          <label htmlFor="ctl-focus" className="mb-1 flex items-center gap-2 text-sm text-sepia-700">
            <Focus aria-hidden size={16} />
            <span>In-focus size: {focusScale.toFixed(2)}</span>
          </label>
          <input id="ctl-focus" className="w-full" type="range" min={1.0} max={1.6} step={0.01} value={focusScale} onChange={(e) => setFocusScale(parseFloat(e.target.value))} />
        </div>

        <div className="my-3">
          <label htmlFor="ctl-dimscale" className="mb-1 flex items-center gap-2 text-sm text-sepia-700">
            <Contrast aria-hidden size={16} />
            <span>Out-of-focus size: {dimScale.toFixed(2)}</span>
          </label>
          <input id="ctl-dimscale" className="w-full" type="range" min={0.85} max={1.0} step={0.01} value={dimScale} onChange={(e) => setDimScale(parseFloat(e.target.value))} />
        </div>

        <div className="my-3">
          <label htmlFor="ctl-dimblur" className="mb-1 flex items-center gap-2 text-sm text-sepia-700">
            <Contrast aria-hidden size={16} />
            <span>Out-of-focus blur (px): {dimBlur.toFixed(2)}</span>
          </label>
          <input id="ctl-dimblur" className="w-full" type="range" min={0} max={2.5} step={0.1} value={dimBlur} onChange={(e) => setDimBlur(parseFloat(e.target.value))} />
        </div>

        <div className="my-3">
          <label htmlFor="ctl-fontpx" className="mb-1 flex items-center gap-2 text-sm text-sepia-700">
            <TypeIcon aria-hidden size={16} />
            <span>Text size (px): {fontPx}</span>
          </label>
          <input id="ctl-fontpx" className="w-full" type="range" min={16} max={28} step={1} value={fontPx} onChange={(e) => setFontPx(parseInt(e.target.value, 10))} />
        </div>

        <div className="my-4 border-t border-sepia-200 pt-3">
          <div className="text-sm font-semibold mb-2">Data</div>
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-sepia-200 bg-white/70 hover:bg-white transition cursor-pointer" aria-busy={isImporting}>
            {isImporting ? <Loader2 className="animate-spin" aria-hidden size={16} /> : <Upload aria-hidden size={16} />}
            <span>{isImporting ? "Importing..." : "Import Settings"}</span>
            <input type="file" accept="application/json" className="hidden" disabled={isImporting} onChange={(e) => onImportJson(e.target.files?.[0] ?? null)} />
          </label>
          <button className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-sepia-200 bg-white/70 hover:bg-white transition disabled:opacity-50" onClick={doExport} disabled={isExporting} title="Export clips + settings" aria-busy={isExporting}>
            {isExporting ? <Loader2 className="animate-spin" aria-hidden size={16} /> : <Download aria-hidden size={16} />}
            <span>{isExporting ? "Exporting..." : "Export Settings"}</span>
          </button>
          <div className="text-xs text-sepia-700 mt-2">Auto-backup on close is always on.</div>
        </div>

        <div className="my-3 flex items-center gap-2">
          <input id="darkmode" type="checkbox" checked={dark} onChange={(e) => setDark(e.target.checked)} />
          <label htmlFor="darkmode" className="text-sm">Dark mode</label>
        </div>

        <div className="mt-4 text-xs text-sepia-700">
          Shortcuts: <kbd>Space</kbd> play/pause, <kbd>C</kbd> add note, <kbd>Alt/Cmd+C</kbd> open/close clips
        </div>
      </aside>
    </>
  );
}
