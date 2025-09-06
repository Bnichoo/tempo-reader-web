import { useEffect } from "react";
import { useReader } from "../../contexts/ReaderContext";
import { useSelectionCtx } from "../../contexts/SelectionContext";

function findTok(root: HTMLElement | null, el: HTMLElement | null): number | null {
  let cur: HTMLElement | null = el;
  while (cur && cur !== root) {
    const ti = Number(cur.dataset?.ti);
    if (Number.isFinite(ti)) return ti;
    cur = cur.parentElement as HTMLElement | null;
  }
  return null;
}

/**
 * Centralizes selection handling:
 * - Pauses playback when selection is inside the reader
 * - Emits selection ranges via setSelection
 */
export function SelectionManager() {
  const { setPlaying } = useReader();
  const { setSelection } = useSelectionCtx();

  // Listen to explicit pause events from Reader (click while playing)
  useEffect(() => {
    const onPause = () => setPlaying(false);
    window.addEventListener("tempo:pause", onPause as EventListener);
    return () => window.removeEventListener("tempo:pause", onPause as EventListener);
  }, [setPlaying]);

  // Observe native selection and compute token ranges
  useEffect(() => {
    const onSel = () => {
      const root = document.querySelector('.reader-container') as HTMLElement | null;
      const sel = document.getSelection();
      if (!root || !sel || sel.rangeCount === 0 || sel.isCollapsed) { setSelection(null); return; }
      const r = sel.getRangeAt(0);
      const inside = root.contains(r.startContainer) && root.contains(r.endContainer);
      if (!inside) { setSelection(null); return; }
      setPlaying(false);
      const startEl = (r.startContainer.nodeType === 3 ? (r.startContainer.parentElement) : (r.startContainer as Element)) as HTMLElement | null;
      const endEl   = (r.endContainer.nodeType === 3 ? (r.endContainer.parentElement) : (r.endContainer as Element)) as HTMLElement | null;
      const a = findTok(root, startEl), b = findTok(root, endEl);
      if (a != null && b != null) {
        const s = Math.min(a,b), e = Math.max(a,b);
        setSelection({ start: s, length: e - s + 1 });
      }
    };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, [setPlaying, setSelection]);

  return null;
}
