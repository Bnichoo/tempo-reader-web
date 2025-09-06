import { useEffect, useRef } from "react";
import { useReader } from "../../contexts/ReaderContext";
import { useSettingsCtx } from "../../contexts/SettingsContext";

type Props = { wordCount: number };

export function PlaybackEngine({ wordCount }: Props) {
  const { playing, setWIndex, wIndex } = useReader();
  const { settings } = useSettingsCtx();
  const accRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const idxRef = useRef(wIndex);
  useEffect(() => { idxRef.current = wIndex; }, [wIndex]);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      accRef.current += dt * settings.wps;
      if (accRef.current >= 1) {
        const jump = Math.floor(accRef.current) * settings.count;
        accRef.current = accRef.current % 1;
        const next = Math.min(idxRef.current + jump, Math.max(0, wordCount - 1));
        idxRef.current = next;
        setWIndex(next);
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); rafRef.current = null; };
  }, [playing, settings.wps, settings.count, wordCount, setWIndex]);

  return null;
}
