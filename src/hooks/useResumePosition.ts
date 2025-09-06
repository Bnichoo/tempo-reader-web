import { useEffect, useRef } from "react";

export function useResumePosition(totalWords: number, wIndex: number, setWIndex: (n: number) => void, key = "tr:wIndex:v1") {
  const resumedRef = useRef(false);
  // restore once when word count known
  useEffect(() => {
    if (resumedRef.current) return;
    if (totalWords <= 0) return;
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) {
        const idx = Math.max(0, Math.min(Number(raw) || 0, Math.max(0, totalWords - 1)));
        setWIndex(idx);
      }
    } catch { /* ignore: resume is best-effort */ }
    resumedRef.current = true;
  }, [totalWords, setWIndex, key]);

  // persist on change (debounced)
  const tRef = useRef<number | null>(null);
  useEffect(() => {
    if (tRef.current) window.clearTimeout(tRef.current);
    tRef.current = window.setTimeout(() => {
      try { localStorage.setItem(key, String(wIndex)); } catch { /* ignore: persist is best-effort */ }
    }, 500);
    return () => { if (tRef.current) window.clearTimeout(tRef.current); };
  }, [wIndex, key]);
}
