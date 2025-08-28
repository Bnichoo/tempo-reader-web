import { useEffect, useRef } from "react";

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

  return (
    <>
      <button className={`drawer-toggle-fab ${open ? "open" : ""}`} onClick={() => setOpen(!open)} aria-label="Toggle controls" style={{ left: `${offset}px` }}>
        <span className="fab-icon"><span className="bar" /></span>
        <span className="fab-text">Controls</span>
      </button>

      <aside className={`drawer-left ${open ? "open" : ""}`} ref={drawerRef} style={{ overflowY: "auto", maxHeight: "100vh" }}
        onWheel={(e) => { e.stopPropagation(); }}
        onMouseMove={(e) => { lastMouseY.current = e.clientY; if (!rafRef.current) rafRef.current = requestAnimationFrame(stepAutoScroll); }}
        onMouseEnter={(e) => { lastMouseY.current = e.clientY; if (!rafRef.current) rafRef.current = requestAnimationFrame(stepAutoScroll); }}
        onMouseLeave={() => { if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } }}
      >
        <div className="text-sm font-semibold mb-2">Reader controls</div>

        <div className="my-3">
          <div className="text-xs text-sepia-700 mb-1">⏱ Tempo (words/sec): {wps.toFixed(1)}</div>
          <input type="range" min={0.5} max={3} step={0.1} value={wps} onChange={(e) => setWps(parseFloat(e.target.value))} />
        </div>

        <div className="my-3">
          <div className="text-xs text-sepia-700 mb-1">🔢 Words shown: {count}</div>
          <input type="range" min={1} max={7} step={1} value={count} onChange={(e) => setCount(parseInt(e.target.value, 10))} />
        </div>

        <div className="my-3">
          <div className="text-xs text-sepia-700 mb-1">↔️ Text spacing: {gap.toFixed(2)}em</div>
          <input type="range" min={0.2} max={0.8} step={0.01} value={gap} onChange={(e) => setGap(parseFloat(e.target.value))} />
        </div>

        <div className="my-3">
          <div className="text-xs text-sepia-700 mb-1">🔎 In-focus size: {focusScale.toFixed(2)}</div>
          <input type="range" min={1.0} max={1.6} step={0.01} value={focusScale} onChange={(e) => setFocusScale(parseFloat(e.target.value))} />
        </div>

        <div className="my-3">
          <div className="text-xs text-sepia-700 mb-1">🌫️ Out-of-focus size: {dimScale.toFixed(2)}</div>
          <input type="range" min={0.85} max={1.0} step={0.01} value={dimScale} onChange={(e) => setDimScale(parseFloat(e.target.value))} />
        </div>

        <div className="my-3">
          <div className="text-xs text-sepia-700 mb-1">🌀 Out-of-focus blur: {dimBlur.toFixed(2)}px</div>
          <input type="range" min={0} max={2.5} step={0.1} value={dimBlur} onChange={(e) => setDimBlur(parseFloat(e.target.value))} />
        </div>

        <div className="my-3">
          <div className="text-xs text-sepia-700 mb-1">🅰️ Text size: {fontPx}px</div>
          <input type="range" min={16} max={28} step={1} value={fontPx} onChange={(e) => setFontPx(parseInt(e.target.value, 10))} />
        </div>

        <div className="my-4 border-t border-sepia-200 pt-3">
          <div className="text-sm font-semibold mb-2">Data</div>
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-sepia-200 bg-white/70 hover:bg-white transition cursor-pointer">
            {isImporting ? "⏳" : "📥"} {isImporting ? "Importing..." : "Import Settings"}
            <input type="file" accept="application/json" className="hidden" disabled={isImporting} onChange={(e) => onImportJson(e.target.files?.[0] ?? null)} />
          </label>
          <button className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-sepia-200 bg-white/70 hover:bg-white transition disabled:opacity-50" onClick={doExport} disabled={isExporting} title="Export clips + settings">
            {isExporting ? "⏳" : "📤"} {isExporting ? "Exporting..." : "Export Settings"}
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
