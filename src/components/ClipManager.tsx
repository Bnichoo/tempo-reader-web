import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Clip, RangeT } from "../types";
import { sanitizeHTML } from "../lib/sanitize";

type ClipManagerProps = {
  clips: Clip[];
  expanded: boolean;
  setExpanded: (v: boolean) => void;
  drawerOffset: number;
  // Reader interactions
  onGoToToken: (tokenIdx: number) => void;
  setHoverRange: (r: RangeT | null) => void;
  // Clip actions
  togglePin: (id: string) => void;
  deleteClip: (id: string) => void;
  // Edit range controls
  editRangeForId: string | null;
  currentSelection: RangeT | null;
  applyEditedRange: () => void;
  cancelEditRange: () => void;
  beginEditRange: (id: string) => void;
  // Notes
  onEditNote: (clipId: string) => void;
};

export function ClipManager(props: ClipManagerProps) {
  const {
    clips,
    expanded,
    setExpanded,
    drawerOffset,
    onGoToToken,
    setHoverRange,
    togglePin,
    deleteClip,
    editRangeForId,
    currentSelection,
    applyEditedRange,
    cancelEditRange,
    beginEditRange,
    onEditNote,
  } = props;

  // Compute chips (pinned first)
  const topChips = useMemo(() => {
    const pinned = clips.filter((c) => c.pinned);
    const others = clips.filter((c) => !c.pinned);
    return [...pinned, ...others].slice(0, 12);
  }, [clips]);

  // Dock strip edge-hover scrolling
  const dockStripRef = useRef<HTMLDivElement>(null);
  const dockScrollRafRef = useRef<number | null>(null);
  const dockLastMouseX = useRef<number>(0);
  const stepDockScroll = () => {
    const el = dockStripRef.current;
    if (!el) {
      dockScrollRafRef.current = null;
      return;
    }
    const rect = el.getBoundingClientRect();
    const x = dockLastMouseX.current;
    const ZONE = 60;
    const MIN = 2;
    const MAX = 8;
    let dx = 0;
    const dLeft = x - rect.left;
    const dRight = rect.right - x;
    if (dLeft >= 0 && dLeft <= ZONE) {
      const t = 1 - dLeft / ZONE;
      dx = -(MIN + (MAX - MIN) * t);
    } else if (dRight >= 0 && dRight <= ZONE) {
      const t = 1 - dRight / ZONE;
      dx = MIN + (MAX - MIN) * t;
    }
    if (dx !== 0) {
      el.scrollLeft += dx;
      dockScrollRafRef.current = requestAnimationFrame(stepDockScroll);
    } else {
      dockScrollRafRef.current = null;
    }
  };

  // Context menu state (local to component)
  const [clipMenu, setClipMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    clipId: string | null;
  }>({ open: false, x: 0, y: 0, clipId: null });

  const openClipMenu = (e: React.MouseEvent, clipId: string) => {
    e.preventDefault();
    const menuHeight = 120;
    const menuWidth = 180;
    let x = e.clientX;
    let y = e.clientY;
    if (y + menuHeight > window.innerHeight) y = Math.max(10, window.innerHeight - menuHeight - 10);
    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10;
    y = Math.max(10, y);
    setClipMenu({ open: true, x, y, clipId });
  };
  const closeClipMenu = () => setClipMenu({ open: false, x: 0, y: 0, clipId: null });
  useEffect(() => {
    if (!clipMenu.open) return;
    const handleClick = () => closeClipMenu();
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeClipMenu();
    };
    window.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleEsc);
    };
  }, [clipMenu.open]);

  const [query, setQuery] = useState("");
  const filteredClips = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? clips.filter(
          (c) =>
            c.snippet.toLowerCase().includes(q) ||
            (c.noteHtml && c.noteHtml.toLowerCase().includes(q))
        )
      : clips.slice();
    const withPos = list.map((c) => ({ c, pos: clips.indexOf(c) }));
    withPos.sort((A, B) => Number(B.c.pinned) - Number(A.c.pinned) || A.pos - B.pos);
    return withPos.map((x) => x.c);
  }, [clips, query]);

  return (
    <>
      {/* Dock */}
      <div
        className="fixed z-30 bottom-0 right-0 left-0"
        style={{ left: `${drawerOffset}px`, height: "64px" }}
      >
        <div className="mx-auto max-w-5xl px-4">
          <div className="rounded-t-2xl border border-sepia-200 bg-white/80 backdrop-blur px-3 py-2 shadow-sm flex items-center gap-3">
            <button
              className="px-3 py-1.5 text-sm rounded-lg border border-sepia-300 bg-white hover:bg-sepia-50 flex-shrink-0"
              onClick={() => {
                setExpanded(true);
              }}
              title="Alt/Cmd+C"
            >
              Clips
            </button>

            {topChips.length === 0 ? (
              <div className="text-xs text-sepia-700">
                No clips yet. Select text → right click → "Add clip".
              </div>
            ) : (
              <div
                ref={dockStripRef}
                className="dock-chips-container relative"
                onMouseMove={(e) => {
                  dockLastMouseX.current = e.clientX;
                  if (!dockScrollRafRef.current) {
                    dockScrollRafRef.current = requestAnimationFrame(stepDockScroll);
                  }
                }}
                onMouseLeave={() => {
                  if (dockScrollRafRef.current) {
                    cancelAnimationFrame(dockScrollRafRef.current);
                    dockScrollRafRef.current = null;
                  }
                }}
              >
                {topChips.map((c) => (
                  <button
                    key={c.id}
                    className="px-2.5 py-1.5 text-xs rounded-xl border border-sepia-300 bg-white hover:bg-sepia-50 flex-shrink-0"
                    onClick={() => {
                      onGoToToken(c.start);
                      setExpanded(false);
                    }}
                    title={c.snippet}
                  >
                    {c.pinned && "📌 "}
                    {c.snippet.slice(0, 48)}
                    {c.snippet.length > 48 ? "…" : ""}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Overlay drawer */}
      {expanded && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-30"
            onClick={() => setExpanded(false)}
          />
          <div
            className="fixed z-40 bottom-0 right-0 left-0"
            style={{ left: `${drawerOffset}px`, height: "60vh" }}
          >
            <div className="mx-auto max-w-5xl h-full px-4">
              <div className="rounded-t-2xl border border-sepia-200 bg-white backdrop-blur h-full shadow-lg flex flex-col">
                <div className="px-4 py-3 border-b border-sepia-200 flex items-center justify-between gap-3">
                  <div className="font-medium">
                    Clips <span className="text-sepia-700">({clips.length})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      className="px-3 py-1.5 rounded-xl border border-sepia-200 bg-white/70 w-72"
                      placeholder="Search clips…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    <button
                      className="px-2.5 py-1.5 rounded-lg border border-sepia-300 bg-white hover:bg-sepia-50"
                      onClick={() => setExpanded(false)}
                    >
                      Close
                    </button>
                  </div>
                </div>

                {editRangeForId && (
                  <div className="px-4 py-2 bg-sepia-50 border-b border-sepia-200 flex items-center gap-3 text-sm">
                    <span>Re-select text in the reader, then click:</span>
                    <button
                      className={
                        "px-3 py-1 rounded-lg border " +
                        (currentSelection ? "border-sepia-400" : "border-sepia-200 opacity-50")
                      }
                      disabled={!currentSelection}
                      onClick={() => {
                        applyEditedRange();
                      }}
                    >
                      Use current selection
                    </button>
                    <button
                      className="px-3 py-1 rounded-lg border border-sepia-200"
                      onClick={() => cancelEditRange()}
                    >
                      Cancel
                    </button>
                  </div>
                )}

                <div className="p-3 overflow-auto flex-1">
                  {(query ? filteredClips : clips).length === 0 ? (
                    <div className="text-sm text-sepia-700">
                      Select text in the reader, right-click, and choose <em>Add clip…</em>.
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {(query ? filteredClips : clips).map((c) => (
                        <li
                          key={c.id}
                          className="clip-card p-3 rounded-xl border border-sepia-200 hover:bg-sepia-50 cursor-pointer relative"
                          onMouseEnter={() => setHoverRange({ start: c.start, length: c.length })}
                          onMouseLeave={() => setHoverRange(null)}
                          onContextMenu={(e) => openClipMenu(e, c.id)}
                          onClick={() => {
                            onGoToToken(c.start);
                            setExpanded(false);
                          }}
                        >
                          {/* Quick action buttons */}
                          <div className="absolute top-3 right-3 flex gap-2">
                            <button
                              className="p-1.5 rounded-lg border border-sepia-200 bg-white hover:bg-sepia-50 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePin(c.id);
                              }}
                              title={c.pinned ? "Unpin" : "Pin"}
                            >
                              {c.pinned ? "📌" : "📍"}
                            </button>
                            <button
                              className="p-1.5 rounded-lg border border-sepia-200 bg-white hover:bg-sepia-50 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm("Delete this clip?")) {
                                  deleteClip(c.id);
                                }
                              }}
                              title="Delete"
                            >
                              Delete
                            </button>
                          </div>

                          <div className="text-sm pr-20">
                            {c.noteHtml ? (
                              <>
                                <span className="font-medium">
                                  <span
                                    dangerouslySetInnerHTML={{
                                      __html: sanitizeHTML(c.noteHtml),
                                    }}
                                  />
                                </span>
                                <div className="text-xs text-sepia-700 mt-1">
                                  From: "{c.snippet.slice(0, 100)}
                                  {c.snippet.length > 100 ? "…" : ""}"
                                </div>
                              </>
                            ) : (
                              <span className="font-medium">
                                {c.snippet.slice(0, 280)}
                                {c.snippet.length > 280 ? "…" : ""}
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-sepia-700 mt-1">
                            {new Date(c.createdUtc).toLocaleString()} · Right-click for more
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Context menu bubble */}
      {clipMenu.open && clipMenu.clipId && (
        <div
          className="ctx-bubble"
          style={{ left: clipMenu.x, top: clipMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              const c = clips.find((clip) => clip.id === clipMenu.clipId);
              if (c) {
                onGoToToken(c.start);
                setExpanded(false);
              }
              closeClipMenu();
            }}
          >
            Go to text
          </button>
          <button
            onClick={() => {
              if (clipMenu.clipId) onEditNote(clipMenu.clipId);
              closeClipMenu();
            }}
          >
            {clips.find((c) => c.id === clipMenu.clipId)?.noteHtml ? "Edit note" : "Add note"}
          </button>
          <button
            onClick={() => {
              if (clipMenu.clipId) beginEditRange(clipMenu.clipId);
              closeClipMenu();
            }}
          >
            Edit range
          </button>
        </div>
      )}
    </>
  );
}
