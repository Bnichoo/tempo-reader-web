import React, { useRef } from "react";
import type { Clip } from "../../types";
import { useEdgeScroll } from "../../hooks/useEdgeScroll";
import PinIcon from "lucide-react/dist/esm/icons/pin.js";

type Props = {
  topChips: Clip[];
  drawerOffset: number;
  onOpen: () => void;
  onChipClick: (c: Clip) => void;
};

export const ClipDock: React.FC<Props> = ({ topChips, drawerOffset, onOpen, onChipClick }) => {
  return (
    <div className="fixed z-30 bottom-0 right-0 left-0" style={{ left: `${drawerOffset}px`, height: "64px" }}>
      <div className="mx-auto max-w-5xl px-4">
        <div className="rounded-t-2xl border border-sepia-200 bg-white/80 backdrop-blur px-3 py-2 shadow-sm flex items-center gap-3">
          <button className="px-3 py-1.5 text-sm rounded-lg border border-sepia-300 bg-white hover:bg-sepia-50 flex-shrink-0" onClick={onOpen} title="Alt/Cmd+C">Clips</button>
          <DockChips topChips={topChips} onChipClick={onChipClick} />
        </div>
      </div>
    </div>
  );
};

const DockChips: React.FC<{ topChips: Clip[]; onChipClick: (c: Clip) => void }> = ({ topChips, onChipClick }) => {
  const dockStripRef = useRef<HTMLDivElement>(null);
  const edge = useEdgeScroll(dockStripRef);
  if (topChips.length === 0) {
    return <div className="text-xs text-sepia-700">No clips yet. Select text → right click → "Add clip".</div>;
  }
  return (
    <div ref={dockStripRef} className="dock-chips-container relative" onMouseMove={edge.onMouseMove} onMouseLeave={edge.onMouseLeave}>
      {topChips.map((c) => (
        <button key={c.id} className="px-2.5 py-1.5 text-xs rounded-xl border border-sepia-300 bg-white hover:bg-sepia-50 flex-shrink-0" onClick={() => onChipClick(c)} title={c.snippet}>
          {c.pinned && (<PinIcon aria-hidden size={12} className="inline-block mr-1" />)}
          {c.snippet.slice(0, 48)}{c.snippet.length > 48 ? "…" : ""}
        </button>
      ))}
    </div>
  );
};

export default ClipDock;

