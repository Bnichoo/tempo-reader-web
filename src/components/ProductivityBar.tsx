import React, { useEffect, useMemo, useRef, useState } from "react";
import Hourglass from "lucide-react/dist/esm/icons/hourglass.js";
import Play from "lucide-react/dist/esm/icons/play.js";
import Pause from "lucide-react/dist/esm/icons/pause.js";
import Square from "lucide-react/dist/esm/icons/square.js";
import { useReader } from "../contexts/ReaderContext";
import { useSettingsCtx } from "../contexts/SettingsContext";
import { useWordNavigation } from "../hooks/useWordNavigation";
import { metaGet, metaSet } from "../lib/idb";

type Props = {
  tokens: string[];
  drawerOffsetLeft: number;
  docId: string;
};

export const ProductivityBar: React.FC<Props> = ({ tokens, drawerOffsetLeft, docId }) => {
  const { playing, setPlaying, wIndex } = useReader();
  useSettingsCtx(); // ensure theme/vars available
  useWordNavigation(tokens); // ensure consistent indexing hook initialized

  const lastIndexRef = useRef(wIndex);
  const [wordsRead, setWordsRead] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const tRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  // Track words progressed while playing
  useEffect(() => {
    if (!playing) { lastIndexRef.current = wIndex; return; }
    const delta = Math.max(0, wIndex - lastIndexRef.current);
    if (delta > 0) setWordsRead((x) => x + delta);
    lastIndexRef.current = wIndex;
  }, [wIndex, playing]);

  // Track elapsed session time (while playing)
  useEffect(() => {
    if (playing) {
      if (startRef.current == null) startRef.current = performance.now();
      const tick = () => {
        if (startRef.current != null) setElapsedMs((prev) => prev + 100);
        tRef.current = requestAnimationFrame(tick);
      };
      tRef.current = requestAnimationFrame(tick);
      return () => { if (tRef.current) cancelAnimationFrame(tRef.current); tRef.current = null; };
    } else {
      if (tRef.current) cancelAnimationFrame(tRef.current); tRef.current = null;
      if (startRef.current != null) {
        setElapsedMs((ms) => ms);
      }
    }
  }, [playing]);

  const timeStr = useMemo(() => {
    const s = Math.floor(elapsedMs / 1000);
    const hh = Math.floor(s / 3600).toString().padStart(2, '0');
    const mm = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const ss = Math.floor(s % 60).toString().padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }, [elapsedMs]);

  const reset = () => { setWordsRead(0); setElapsedMs(0); startRef.current = null; lastIndexRef.current = wIndex; };

  // Persist per-doc session metrics
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const saved = await metaGet<{ wordsRead?: number; elapsedMs?: number }>(`session:${docId}`);
        if (active && saved) {
          setWordsRead(Math.max(0, saved.wordsRead || 0));
          setElapsedMs(Math.max(0, saved.elapsedMs || 0));
        }
      } catch { /* ignore */ }
    })();
    return () => { active = false; };
  }, [docId]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      try { void metaSet(`session:${docId}`, { wordsRead, elapsedMs }); } catch { /* ignore */ }
    }, 400);
    return () => window.clearTimeout(t);
  }, [wordsRead, elapsedMs, docId]);

  // Do not reset on doc change; metrics persist per document

  return (
    <div className="productivity-bar" style={{ left: `${drawerOffsetLeft}px` }}>
      <div className="inner">
        <div className="left">
          <Hourglass aria-hidden size={16} />
          <span className="label">Session</span>
        </div>
        <div className="stats">
          <span title="Words progressed">{wordsRead} words</span>
          <span title="Elapsed time">{timeStr}</span>
        </div>
        <div className="actions">
          {!playing ? (
            <button className="btn" onClick={() => setPlaying(true)} title="Start">
              <Play aria-hidden size={14} />
            </button>
          ) : (
            <button className="btn" onClick={() => setPlaying(false)} title="Pause">
              <Pause aria-hidden size={14} />
            </button>
          )}
          <button className="btn" onClick={() => { setPlaying(false); reset(); }} title="Stop">
            <Square aria-hidden size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
