import React from "react";
import Download from "lucide-react/dist/esm/icons/download.js";
import X from "lucide-react/dist/esm/icons/x.js";

type Props = {
  clipsCount: number;
  usagePct: number | null;
  queryInput: string;
  setQueryInput: (v: string) => void;
  onExportClick: () => void;
  onCloseDrawer: () => void;
};

export const ClipDrawerHeader: React.FC<Props> = ({ clipsCount, usagePct, queryInput, setQueryInput, onExportClick, onCloseDrawer }) => {
  return (
    <div className="px-4 py-3 border-b border-sepia-200 flex items-center justify-between gap-3">
      <div className="font-medium">
        Clips <span className="text-sepia-700">({clipsCount})</span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {usagePct != null && (
          <div className={`text-xs mr-2 px-2 py-1 rounded-lg border text-sepia-700 border-sepia-200`} title="Browser storage usage">
            Storage: {usagePct}%
          </div>
        )}
        <input
          data-role="clip-search"
          className="px-3 py-1.5 rounded-xl border border-sepia-200 bg-white/70 w-72"
          placeholder="Search clips…"
          value={queryInput}
          onChange={(e) => setQueryInput(e.target.value)}
        />
        <button
          className={`px-2.5 py-1.5 rounded-lg border border-sepia-300 bg-white hover:bg-sepia-50 inline-flex items-center gap-2`}
          onClick={onExportClick}
          title="Export clips"
        >
          <Download aria-hidden size={16} /> <span>Export…</span>
        </button>
        <button
          className="px-2.5 py-1.5 rounded-lg border border-sepia-300 bg-white hover:bg-sepia-50 inline-flex items-center gap-2"
          onClick={onCloseDrawer}
          title="Close clips"
        >
          <X aria-hidden size={16} /> <span>Close</span>
        </button>
      </div>
    </div>
  );
};

export default ClipDrawerHeader;

