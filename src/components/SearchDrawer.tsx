import React, { useEffect, useMemo, useRef } from "react";
import type { SearchHit } from "../hooks/useSearchIndex";

type Props = {
  open: boolean;
  query: string;
  hits: SearchHit[];
  onClose: () => void;
  onGoToToken: (ti: number) => void;
  drawerOffsetLeft: number; // to offset main content when left drawer is open
};

export const SearchDrawer: React.FC<Props> = ({ open, query, hits, onClose, onGoToToken, drawerOffsetLeft }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  const list = useMemo(() => (open ? hits.slice(0, 200) : []), [open, hits]);

  const escapeHtml = (s: string) => s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  const escRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const hl = (text: string, q: string) => {
    const term = q.trim(); if (!term) return escapeHtml(text);
    try {
      const rx = new RegExp(escRx(term), "gi");
      return escapeHtml(text).replace(rx, (m) => `<mark class="search-hl">${escapeHtml(m)}</mark>`);
    } catch { return escapeHtml(text); }
  };
  if (!open) return null;

  return (
    <div className="fixed z-40 top-[64px] right-0 bottom-0" style={{ right: 0, left: undefined }}>
      <div className="mx-auto max-w-5xl h-full px-4" style={{ marginRight: `${drawerOffsetLeft}px` }}>
        <div ref={ref} className="rounded-t-2xl border border-sepia-200 bg-white backdrop-blur h-full shadow-lg flex flex-col w-[360px] ml-auto">
          <div className="px-4 py-3 border-b border-sepia-200 flex items-center justify-between gap-3">
            <div className="font-medium">Search results <span className="text-sepia-700">({list.length})</span></div>
            <button className="px-2.5 py-1.5 rounded-lg border border-sepia-300 bg-white hover:bg-sepia-50" onClick={onClose}>Close</button>
          </div>
          <div className="p-3 overflow-auto flex-1">
            {list.length === 0 ? (
              <div className="text-sm text-sepia-700">No matches for “{query}”.</div>
            ) : (
              <ul className="space-y-3" role="list">
                {list.map((h, i) => (
                  <li key={i} className="clip-card-item clip-card p-3 rounded-xl border border-sepia-200 hover:bg-sepia-50 cursor-pointer relative" tabIndex={0} role="listitem"
                    onClick={() => onGoToToken(h.tokenIdx)}
                    onKeyDown={(e) => { if (e.key === 'Enter') onGoToToken(h.tokenIdx); }}
                  >
                    <div className="text-sm pr-10" dangerouslySetInnerHTML={{ __html: `${h.prefix ? '…' : ''}${hl(h.snippet, query)}${h.suffix ? '…' : ''}` }} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchDrawer;
