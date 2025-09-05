import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Clip, RangeT } from "../types";
import { sanitizeHTML } from "../lib/sanitize";
import { useEdgeScroll } from "../hooks/useEdgeScroll";
import { useDebouncedValue } from "../hooks/useDebounce";
import { estimateStorage, requestPersistentStorage } from "../lib/idb";
import { exportClipsPdf } from "../lib/exporters";

type VirtualizedProps = {
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

function VirtualizedClipList(props: VirtualizedProps) {
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
            onClick={() => {
              onGoToToken(c.start);
              setExpanded(false);
            }}
          >
            <div className="absolute top-3 right-3 flex gap-2">
              <button
                className="p-1.5 rounded-lg border border-sepia-200 bg-white hover:bg-sepia-50 text-xs"
                aria-label={c.pinned ? "Unpin clip" : "Pin clip"}
                onClick={(e) => {
                  e.stopPropagation();
                  togglePin(c.id);
                }}
                title={c.pinned ? "Unpin" : "Pin"}
              >
                {c.pinned ? "★" : "☆"}
              </button>
              <button
                className="p-1.5 rounded-lg border border-sepia-200 bg-white hover:bg-sepia-50 text-xs"
                aria-label="Delete clip"
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
                        __html: sanitizeHTML(c.noteHtml || ""),
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
      <div style={{ height: `${bottomPad}px` }} />
    </div>
  );
}

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
  const edge = useEdgeScroll(dockStripRef);

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
  // Context menu keyboard nav
  const menuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!clipMenu.open) return;
    const t = window.setTimeout(() => {
      const first = menuRef.current?.querySelector('button') as HTMLButtonElement | null;
      first?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [clipMenu.open]);

  // ESC closes the overlay drawer when expanded
  useEffect(() => {
    if (!expanded) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [expanded, setExpanded]);

  const [queryInput, setQueryInput] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);
  const query = useDebouncedValue(queryInput, 300);
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

  // Storage usage monitor (updates when list size changes)
  const [usagePct, setUsagePct] = useState<number | null>(null);
  useEffect(() => {
    if (expanded) {
      setTimeout(() => searchRef.current?.focus(), 0);
    }
    let active = true;
    (async () => {
      const est = await estimateStorage();
      if (!active) return;
      if (est.usage != null && est.quota != null && est.quota > 0) {
        setUsagePct(Math.min(100, Math.round((est.usage / est.quota) * 100)));
      } else setUsagePct(null);
    })();
    return () => { active = false; };
  }, [clips.length]);

  // Export options bar
  const [exportBar, setExportBar] = useState(false);
  const [exportScope, setExportScope] = useState<"all" | "pinned" | "filtered">("all");
  const [exportNotesOnly, setExportNotesOnly] = useState(true);
  const [exportSort, setExportSort] = useState<"pinned-date-desc" | "date-desc" | "date-asc" | "position">("pinned-date-desc");
  const [copiedName, setCopiedName] = useState(false);
  const [exportFilename, setExportFilename] = useState("");
  const buildExportList = () => {
    let base: Clip[] = [];
    if (exportScope === "pinned") base = clips.filter(c => !!c.pinned);
    else if (exportScope === "filtered") base = (query ? filteredClips : clips);
    else base = clips;
    if (exportNotesOnly) base = base.filter(c => !!c.noteHtml && c.noteHtml.trim().length > 0);
    // sort
    const byDateDesc = (a: Clip, b: Clip) => new Date(b.createdUtc).getTime() - new Date(a.createdUtc).getTime();
    const byDateAsc  = (a: Clip, b: Clip) => new Date(a.createdUtc).getTime() - new Date(b.createdUtc).getTime();
    if (exportSort === "position") return base.slice();
    if (exportSort === "date-desc") return base.slice().sort(byDateDesc);
    if (exportSort === "date-asc") return base.slice().sort(byDateAsc);
    // pinned-date-desc
    const pinned = base.filter(c => !!c.pinned).sort(byDateDesc);
    const rest = base.filter(c => !c.pinned).sort(byDateDesc);
    return [...pinned, ...rest];
  };
  const runExportPdf = () => {
    const list = buildExportList();
    exportClipsPdf(list, { filename: (exportFilename || suggestFilename(false)) });
    setExportBar(false);
  };
  const suggestFilename = (withExt = true) => `tempo-clips-${exportScope}-${exportSort}-${new Date().toISOString().slice(0,10)}-${buildExportList().length}${withExt ? '.pdf' : ''}`;
  const copyFilename = async () => {
    try { await navigator.clipboard.writeText(suggestFilename(true)); setCopiedName(true); setTimeout(() => setCopiedName(false), 1200); }
    catch {}
  };

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
                onMouseMove={edge.onMouseMove}
                onMouseLeave={edge.onMouseLeave}
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
                  <div className="flex items-center gap-2 flex-wrap">
                    {usagePct != null && (
                      <div className={`text-xs mr-2 px-2 py-1 rounded-lg border text-sepia-700 border-sepia-200`} title="Browser storage usage">
                        Storage: {usagePct}%
                      </div>
                    )}
                    <input
                      className="px-3 py-1.5 rounded-xl border border-sepia-200 bg-white/70 w-72"
                      placeholder="Search clips…"
                      ref={searchRef}
                      value={queryInput}
                      onChange={(e) => setQueryInput(e.target.value)}
                    />
                    {(clips.length > 0) && (
                      <button
                        className={`px-2.5 py-1.5 rounded-lg border border-sepia-300 bg-white hover:bg-sepia-50`}
                        onClick={async () => { setExportBar((v) => !v); try { await requestPersistentStorage(); } catch {} }}
                        title="Export clips"
                      >
                        Export…
                      </button>
                    )}
                    <button
                      className="px-2.5 py-1.5 rounded-lg border border-sepia-300 bg-white hover:bg-sepia-50"
                      onClick={() => setExpanded(false)}
                    >
                      Close
                    </button>
                  </div>
                </div>

                {exportBar && (
                  <div className="px-4 py-2 export-bar border-b border-sepia-200 flex items-center gap-3 text-sm flex-wrap">
                    <div className="flex items-center gap-2">
                      <label className="text-sepia-700">Scope:</label>
                      <select className="px-2 py-1 rounded-lg border border-sepia-200 bg-white" value={exportScope} onChange={(e) => setExportScope(e.target.value as any)}>
                        <option value="all">All clips</option>
                        <option value="pinned">Pinned only</option>
                        <option value="filtered">Current filter</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sepia-700">Sort:</label>
                      <select className="px-2 py-1 rounded-lg border border-sepia-200 bg-white" value={exportSort} onChange={(e) => setExportSort(e.target.value as any)}>
                        <option value="pinned-date-desc">Pinned first, date desc</option>
                        <option value="date-desc">Date desc</option>
                        <option value="date-asc">Date asc</option>
                        <option value="position">Position</option>
                      </select>
                    </div>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={exportNotesOnly} onChange={(e) => setExportNotesOnly(e.target.checked)} />
                      <span>Only clips with notes</span>
                    </label>
                    <div className="flex items-center gap-2 text-xs text-sepia-700">
                      <span>Filename:</span>
                      <input className="px-2 py-1 bg-white border border-sepia-200 rounded w-64" value={exportFilename} onChange={(e)=>setExportFilename(e.target.value)} placeholder={suggestFilename(true)} onKeyDown={(e)=>{ if (e.key==='Escape'){ e.stopPropagation(); } }} />
                      <button className="px-2 py-1 rounded border border-sepia-200 bg-white hover:bg-sepia-50" onClick={copyFilename}>{copiedName ? 'Copied' : 'Copy suggested'}</button>
                    </div>
                    <button className="px-3 py-1 rounded-lg border border-sepia-300 bg-white hover:bg-sepia-50" onClick={runExportPdf}>Download PDF</button>
                    <button className="px-3 py-1 rounded-lg border border-sepia-200" onClick={() => setExportBar(false)}>Cancel</button>
                    <div className="text-xs text-sepia-700">Will export {buildExportList().length} clips</div>
                  </div>
                )}

                {editRangeForId && (
                  <div className="px-4 py-2 export-bar border-b border-sepia-200 flex items-center gap-3 text-sm">
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

                <div className="p-3 overflow-auto flex-1" onKeyDown={(e) => {
                  const target = e.target as HTMLElement;
                  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    const items = Array.from((e.currentTarget as HTMLElement).querySelectorAll('li.clip-card-item')) as HTMLElement[];
                    if (!items.length) return;
                    const idx = items.findIndex(el => el === target.closest('li'));
                    let next = idx;
                    if (e.key === 'ArrowDown') next = Math.min(items.length - 1, idx + 1);
                    else next = Math.max(0, idx - 1);
                    const el = items[next]; if (el) { e.preventDefault(); el.focus(); }
                  }
                }}>
                  {(query ? filteredClips : clips).length === 0 ? (
                    <div className="text-sm text-sepia-700">
                      Select text in the reader, right-click, and choose <em>Add clip…</em>.
                    </div>
                  ) : (
                    ((query ? filteredClips : clips).length > 50)
                      ? (
                        <VirtualizedClipList
                          list={query ? filteredClips : clips}
                          itemH={92}
                          overscan={6}
                          onGoToToken={onGoToToken}
                          setExpanded={setExpanded}
                          setHoverRange={setHoverRange}
                          openClipMenu={openClipMenu}
                          togglePin={togglePin}
                          deleteClip={deleteClip}
                          onEditNote={onEditNote}
                        />
                      ) : (
                    <ul className="space-y-3" role="list">
                      {(query ? filteredClips : clips).map((c) => (
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
                          onClick={() => {
                            onGoToToken(c.start);
                            setExpanded(false);
                          }}
                        >
                          {/* Quick action buttons */}
                          <div className="absolute top-3 right-3 flex gap-2">
                                  <button
                                    className="p-1.5 rounded-lg border border-sepia-200 bg-white hover:bg-sepia-50 text-xs"
                                    aria-label={c.pinned ? "Unpin clip" : "Pin clip"}
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
                                    aria-label="Delete clip"
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
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Context menu bubble */}
      {clipMenu.open && clipMenu.clipId && (
        <div
          ref={menuRef}
          className="ctx-bubble"
          style={{ left: clipMenu.x, top: clipMenu.y }}
          onClick={(e) => e.stopPropagation()}
          role="menu"
          aria-label="Clip actions"
          onKeyDown={(e) => {
            const buttons = Array.from(menuRef.current?.querySelectorAll('button') || []) as HTMLButtonElement[];
            const idx = buttons.findIndex(b => b === document.activeElement);
            if (e.key === 'ArrowDown') { e.preventDefault(); const next = buttons[(idx + 1 + buttons.length) % buttons.length]; next?.focus(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); const prev = buttons[(idx - 1 + buttons.length) % buttons.length]; prev?.focus(); }
            else if (e.key === 'Home') { e.preventDefault(); buttons[0]?.focus(); }
            else if (e.key === 'End') { e.preventDefault(); buttons[buttons.length - 1]?.focus(); }
            else if (e.key === 'Tab') { e.preventDefault(); const dir = e.shiftKey ? -1 : 1; const nxt = buttons[(idx + dir + buttons.length) % buttons.length]; nxt?.focus(); }
          }}
        >
          <button
            role="menuitem"
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
            role="menuitem"
            onClick={() => {
              if (clipMenu.clipId) onEditNote(clipMenu.clipId);
              closeClipMenu();
            }}
          >
            {clips.find((c) => c.id === clipMenu.clipId)?.noteHtml ? "Edit note" : "Add note"}
          </button>
          <button
            role="menuitem"
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
