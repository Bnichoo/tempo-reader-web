import React from "react";
import type { Clip, RangeT } from "../../types";
import { sanitizeHTML } from "../../lib/sanitize";
import PinIcon from "lucide-react/dist/esm/icons/pin.js";
import PinOffIcon from "lucide-react/dist/esm/icons/pin-off.js";
import Trash2Icon from "lucide-react/dist/esm/icons/trash-2.js";

export type VirtualizedProps = {
  list: Clip[];
  itemH: number;
  overscan: number;
  onGoToToken: (tokenIdx: number) => void;
  setExpanded: (v: boolean) => void;
  setHoverRange: (r: RangeT | null) => void;
  openClipMenu: (e: React.MouseEvent, id: string) => void;
  togglePin: (id: string) => void;
  deleteClip: (id: string) => void;
  onEditNote: (id: string) => void;
};

export function VirtualizedClipList(props: VirtualizedProps) {
  const { list, itemH, overscan, onGoToToken, setExpanded, setHoverRange, openClipMenu, togglePin, deleteClip, onEditNote } = props;
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [viewportH, setViewportH] = React.useState(0);
  React.useEffect(() => {
    const parent = rootRef.current?.parentElement as HTMLDivElement | null;
    if (!parent) return;
    const onScroll = () => setScrollTop(parent.scrollTop);
    parent.addEventListener("scroll", onScroll, { passive: true });
    setViewportH(parent.clientHeight);
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => setViewportH(parent.clientHeight));
      ro.observe(parent);
    }
    return () => { parent.removeEventListener("scroll", onScroll); ro?.disconnect(); };
  }, []);

  const total = list.length;
  const start = Math.max(0, Math.floor(scrollTop / itemH) - overscan);
  const visibleCount = Math.ceil(viewportH / itemH) + overscan * 2;
  const end = Math.min(total, start + visibleCount);
  const topPad = start * itemH;
  const bottomPad = Math.max(0, (total - end) * itemH);
  const slice = list.slice(start, end);

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <div style={{ height: `${topPad}px` }} />
      <ul className="space-y-3">
        {slice.map((c) => (
          <li
            key={c.id}
            className="clip-card-item clip-card p-3 rounded-xl border border-sepia-200 hover:bg-sepia-50 cursor-pointer relative"
            tabIndex={0}
            role="listitem"
            onMouseEnter={() => setHoverRange({ start: c.start, length: c.length })}
            onMouseLeave={() => setHoverRange(null)}
            onContextMenu={(e) => openClipMenu(e, c.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { onGoToToken(c.start); setExpanded(false); }
              else if (e.key.toLowerCase() === 'p') { togglePin(c.id); }
              else if (e.key.toLowerCase() === 'e') { onEditNote(c.id); }
              else if (e.key === 'Delete' || e.key === 'Backspace') { if (window.confirm('Delete this clip?')) deleteClip(c.id); }
            }}
            onClick={() => { onGoToToken(c.start); setExpanded(false); }}
          >
            <div className="absolute top-3 right-3 flex gap-2">
              <button
                className="p-1.5 rounded-lg border border-sepia-200 bg-white hover:bg-sepia-50 text-xs"
                aria-label={c.pinned ? "Unpin clip" : "Pin clip"}
                onClick={(e) => { e.stopPropagation(); togglePin(c.id); }}
                title={c.pinned ? "Unpin" : "Pin"}
              >
                {c.pinned ? (<PinOffIcon aria-hidden size={14} />) : (<PinIcon aria-hidden size={14} />)}
              </button>
              <button
                className="p-1.5 rounded-lg border border-sepia-200 bg-white hover:bg-sepia-50 text-xs"
                aria-label="Delete clip"
                onClick={(e) => { e.stopPropagation(); if (window.confirm("Delete this clip?")) deleteClip(c.id); }}
                title="Delete"
              >
                <Trash2Icon aria-hidden size={14} />
              </button>
            </div>

            <div className="text-sm pr-20">
              {c.noteHtml ? (
                <>
                  <span className="font-medium">
                    <span dangerouslySetInnerHTML={{ __html: sanitizeHTML(c.noteHtml || "") }} />
                  </span>
                  <div className="text-xs text-sepia-700 mt-1">
                    From: "{c.snippet.slice(0, 100)}{c.snippet.length > 100 ? "…" : ""}"
                  </div>
                </>
              ) : (
                <span className="font-medium">
                  {c.snippet.slice(0, 280)}{c.snippet.length > 280 ? "…" : ""}
                </span>
              )}
            </div>

            <div className="text-xs text-sepia-700 mt-1">
              {new Date(c.createdUtc).toLocaleString()} · Right-click for more
            </div>
          </li>
        ))}
      </ul>
      <div style={{ height: `${bottomPad}px` }} />
    </div>
  );
}

export default VirtualizedClipList;

