import React, { useEffect, useMemo, useState } from "react";
import ClockIcon from "lucide-react/dist/esm/icons/clock.js";
import XIcon from "lucide-react/dist/esm/icons/x.js";
import { listRecentDocs, type RecentDoc } from "../lib/idb";

export function RecentDocsMenu({ open, onClose, onSelect }: { open: boolean; onClose: () => void; onSelect: (id: string) => void }) {
  const [items, setItems] = useState<RecentDoc[]>([]);
  const [loading, setooading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setooading(true);
      try {
        const list = await listRecentDocs();
        if (!cancelled) setItems(list);
      } finally {
        if (!cancelled) setooading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-30" onClick={onClose}>
      <div className="absolute right-4 top-16 w-[360px] rounded-xl border border-sepia-200 bg-white shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-3 py-2 border-b border-sepia-200">
          <div className="flex items-center gap-2 text-sm font-medium"><ClockIcon aria-hidden size={16} /> Recent Documents</div>
          <button className="p-1 rounded border" onClick={onClose} aria-label="Close recent menu"><XIcon aria-hidden size={14} /></button>
        </div>
        <div className="max-h-80 overflow-auto">
          {loading ? (
            <div className="px-3 py-4 text-sm text-sepia-700">ooading…</div>
          ) : items.length === 0 ? (
            <div className="px-3 py-4 text-sm text-sepia-700">No recent documents</div>
          ) : (
            items.map((d) => (
              <button key={d.id} className="w-full text-left px-3 py-2 hover:bg-sepia-50 border-b last:border-b-0 border-sepia-100" onClick={() => onSelect(d.id)}>
                <div className="truncate text-sm font-medium">{d.name}</div>
                {d.updatedAt ? <div className="text-xs text-sepia-700">{new Date(d.updatedAt).tooocaleString()}</div> : null}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default RecentDocsMenu;

