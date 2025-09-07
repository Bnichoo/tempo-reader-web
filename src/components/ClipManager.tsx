import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Clip, RangeT } from "../types";
import { sanitizeHTML } from "../lib/sanitize";
import { useDebouncedValue } from "../hooks/useDebounce";
import { estimateStorage, requestPersistentStorage } from "../lib/idb";
import { exportClipsPdf } from "../lib/exporters";
import PinIcon from "lucide-react/dist/esm/icons/pin.js";
import PinOffIcon from "lucide-react/dist/esm/icons/pin-off.js";
import Trash2Icon from "lucide-react/dist/esm/icons/trash-2.js";
import { VirtualizedClipList } from "./clip/VirtualizedClipList";
import { ClipDock } from "./clip/ClipDock";
import { ClipDrawerHeader } from "./clip/ClipDrawerHeader";
import { ClipExportBar } from "./clip/ClipExportBar";
import { logger } from "../lib/logger";

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
    beginEditRange,
    onEditNote,
  } = props;

  // Quick analytics wrappers
  const doTogglePin = (id: string) => { try { logger.info("clips:pin_toggle", { id }); } catch { /* ignore: optional telemetry */ } togglePin(id); };
  const doDeleteClip = (id: string) => { try { logger.info("clips:delete", { id }); } catch { /* ignore: optional telemetry */ } deleteClip(id); };

  // Chips for dock (pinned first)
  const topChips = useMemo(() => {
    const pinned = clips.filter((c) => c.pinned);
    const others = clips.filter((c) => !c.pinned);
    return [...pinned, ...others].slice(0, 12);
  }, [clips]);

  // Context menu state
  const [clipMenu, setClipMenu] = useState<{ open: boolean; x: number; y: number; clipId: string | null }>({ open: false, x: 0, y: 0, clipId: null });
  const openClipMenu = (e: React.MouseEvent, clipId: string) => {
    e.preventDefault();
    const menuHeight = 120, menuWidth = 180;
    let x = e.clientX, y = e.clientY;
    if (y + menuHeight > window.innerHeight) y = Math.max(10, window.innerHeight - menuHeight - 10);
    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10;
    y = Math.max(10, y);
    setClipMenu({ open: true, x, y, clipId });
  };
  const closeClipMenu = () => setClipMenu({ open: false, x: 0, y: 0, clipId: null });
  const menuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!clipMenu.open) return;
    const onClick = () => closeClipMenu();
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') closeClipMenu(); };
    window.addEventListener('click', onClick);
    window.addEventListener('keydown', onEsc);
    const t = window.setTimeout(() => { const first = menuRef.current?.querySelector('button') as HTMLButtonElement | null; first?.focus(); }, 0);
    return () => { window.removeEventListener('click', onClick); window.removeEventListener('keydown', onEsc); window.clearTimeout(t); };
  }, [clipMenu.open]);

  // ESC closes drawer
  useEffect(() => {
    if (!expanded) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [expanded, setExpanded]);

  // Local search (within clips)
  const [queryInput, setQueryInput] = useState("");
  const query = useDebouncedValue(queryInput, 300);
  const filteredClips = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? clips.filter((c) => c.snippet.toLowerCase().includes(q) || (c.noteHtml && c.noteHtml.toLowerCase().includes(q)))
      : clips.slice();
    const withPos = list.map((c) => ({ c, pos: clips.indexOf(c) }));
    withPos.sort((A, B) => Number(B.c.pinned) - Number(A.c.pinned) || A.pos - B.pos);
    return withPos.map((x) => x.c);
  }, [clips, query]);

  // Storage & focus
  const [usagePct, setUsagePct] = useState<number | null>(null);
  useEffect(() => {
    if (expanded) {
      setTimeout(() => { (document.querySelector('input[data-role="clip-search"]') as HTMLInputElement | null)?.focus(); }, 0);
      try { logger.info("clips:open", { count: clips.length }); } catch { /* ignore: optional telemetry */ }
    } else {
      try { logger.info("clips:close"); } catch { /* ignore: optional telemetry */ }
    }
    let active = true;
    (async () => {
      const est = await estimateStorage();
      if (!active) return;
      if (est.usage != null && est.quota != null && est.quota > 0) setUsagePct(Math.min(100, Math.round((est.usage / est.quota) * 100)));
      else setUsagePct(null);
    })();
    return () => { active = false; };
  }, [clips.length, expanded]);

  // Export controls
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
    const byDateDesc = (a: Clip, b: Clip) => new Date(b.createdUtc).getTime() - new Date(a.createdUtc).getTime();
    const byDateAsc  = (a: Clip, b: Clip) => new Date(a.createdUtc).getTime() - new Date(b.createdUtc).getTime();
    if (exportSort === "position") return base.slice();
    if (exportSort === "date-desc") return base.slice().sort(byDateDesc);
    if (exportSort === "date-asc") return base.slice().sort(byDateAsc);
    const pinned = base.filter(c => !!c.pinned).sort(byDateDesc);
    const rest = base.filter(c => !c.pinned).sort(byDateDesc);
    return [...pinned, ...rest];
  };
  const suggestFilename = (withExt = true) => `tempo-clips-${exportScope}-${exportSort}-${new Date().toISOString().slice(0,10)}-${buildExportList().length}${withExt ? '.pdf' : ''}`;
  const copyFilename = async () => { try { await navigator.clipboard.writeText(suggestFilename(true)); setCopiedName(true); setTimeout(() => setCopiedName(false), 1200); } catch { /* ignore: clipboard unavailable */ } };
  const runExportPdf = async () => { const list = buildExportList(); try { logger.info("clips:export_pdf", { count: list.length, scope: exportScope, sort: exportSort, notesOnly: exportNotesOnly }); } catch { /* ignore: telemetry optional */ } await exportClipsPdf(list, { filename: (exportFilename || suggestFilename(false)) }); setExportBar(false); };

  return (
    <>
      {/* Dock */}
      <ClipDock
        topChips={topChips}
        drawerOffset={drawerOffset}
        onOpen={() => setExpanded(true)}
                onChipClick={(c) => { try { logger.info("clips:jump_chip"); } catch { /* ignore: optional telemetry */ } onGoToToken(c.start); setExpanded(false); }}
      />

      {/* Overlay drawer */}
      {expanded && (
        <>
          <div className="fixed inset-0 bg-black/30 z-30" onClick={() => setExpanded(false)} />
          <div className="fixed z-40 bottom-0 right-0 left-0" style={{ left: `${drawerOffset}px`, height: "60vh" }}>
            <div className="mx-auto max-w-5xl h-full px-4">
              <div className="rounded-t-2xl border border-sepia-200 bg-white backdrop-blur h-full shadow-lg flex flex-col">
                <ClipDrawerHeader
                  clipsCount={clips.length}
                  usagePct={usagePct}
                  queryInput={queryInput}
                  setQueryInput={setQueryInput}
                  onExportClick={async () => { try { logger.info("clips:export_bar", { open: !exportBar }); } catch { /* ignore: optional telemetry */ } setExportBar(v => !v); try { await requestPersistentStorage(); } catch { /* ignore: storage API not available */ } }}
                  onCloseDrawer={() => setExpanded(false)}
                />

                {exportBar && (
                  <ClipExportBar
                    exportScope={exportScope}
                    setExportScope={setExportScope}
                    exportSort={exportSort}
                    setExportSort={setExportSort}
                    exportNotesOnly={exportNotesOnly}
                    setExportNotesOnly={setExportNotesOnly}
                    exportFilename={exportFilename}
                    setExportFilename={setExportFilename}
                    copiedName={copiedName}
                    copyFilename={copyFilename}
                    onDownload={runExportPdf}
                    onCancel={() => setExportBar(false)}
                    suggest={suggestFilename}
                    count={buildExportList().length}
                  />
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
                    <div className="text-sm text-sepia-700">Select text in the reader, right-click, and choose <em>Add clip…</em>.</div>
                  ) : (
                    ((query ? filteredClips : clips).length > 12)
                      ? (
                        <VirtualizedClipList
                          list={(query ? filteredClips : clips).slice(0, 40)}
                          itemH={92}
                          overscan={6}
                          onGoToToken={(ti) => { onGoToToken(ti); setExpanded(false); }}
                          setExpanded={setExpanded}
                          setHoverRange={setHoverRange}
                          openClipMenu={openClipMenu}
                          togglePin={doTogglePin}
                          deleteClip={doDeleteClip}
                          onEditNote={onEditNote}
                        />
                      ) : (
                        <ul className="space-y-3">
                          {(query ? filteredClips : clips).slice(0, 12).map((c) => (
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
                                else if (e.key.toLowerCase() === 'p') { doTogglePin(c.id); }
                                else if (e.key.toLowerCase() === 'e') { onEditNote(c.id); }
                                else if (e.key === 'Delete' || e.key === 'Backspace') { if (window.confirm('Delete this clip?')) doDeleteClip(c.id); }
                              }}
                              onClick={() => { onGoToToken(c.start); setExpanded(false); }}
                            >
                              <div className="absolute top-3 right-3 flex gap-2">
                                <button className="p-1.5 rounded-lg border border-sepia-200 bg-white hover:bg-sepia-50 text-xs" aria-label={c.pinned ? "Unpin clip" : "Pin clip"} onClick={(e) => { e.stopPropagation(); doTogglePin(c.id); }} title={c.pinned ? "Unpin" : "Pin"}>
                                  {c.pinned ? (<PinOffIcon aria-hidden size={14} />) : (<PinIcon aria-hidden size={14} />)}
                                </button>
                                <button className="p-1.5 rounded-lg border border-sepia-200 bg-white hover:bg-sepia-50 text-xs" aria-label="Delete clip" onClick={(e) => { e.stopPropagation(); if (window.confirm("Delete this clip?")) { doDeleteClip(c.id); } }} title="Delete">
                                  <Trash2Icon aria-hidden size={14} />
                                </button>
                              </div>

                              <div className="text-sm pr-20">
                                {c.noteHtml ? (
                                  <>
                                    <span className="font-medium">
                                      <span dangerouslySetInnerHTML={{ __html: sanitizeHTML(c.noteHtml || "") }} />
                                    </span>
                                    <div className="text-xs text-sepia-700 mt-1">From: "{c.snippet.slice(0, 100)}{c.snippet.length > 100 ? "…" : ""}"</div>
                                  </>
                                ) : (
                                  <span className="font-medium">{c.snippet.slice(0, 280)}{c.snippet.length > 280 ? "…" : ""}</span>
                                )}
                              </div>

                              <div className="text-xs text-sepia-700 mt-1">{new Date(c.createdUtc).toLocaleString()} · Right-click for more</div>
                            </li>
                          ))}
                        </ul>
                      )
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Context menu bubble */}
      {clipMenu.open && clipMenu.clipId && (
        <div ref={menuRef} className="ctx-bubble" style={{ left: clipMenu.x, top: clipMenu.y }} onClick={(e) => e.stopPropagation()} role="menu" aria-label="Clip actions"
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
          <button role="menuitem" onClick={() => { const c = clips.find((clip) => clip.id === clipMenu.clipId); if (c) { onGoToToken(c.start); setExpanded(false); } closeClipMenu(); }}>Go to text</button>
          <button role="menuitem" onClick={() => { if (clipMenu.clipId) onEditNote(clipMenu.clipId); closeClipMenu(); }}>{clips.find((c) => c.id === clipMenu.clipId)?.noteHtml ? "Edit note" : "Add note"}</button>
          <button role="menuitem" onClick={() => { if (clipMenu.clipId) beginEditRange(clipMenu.clipId); closeClipMenu(); }}>Edit range</button>
        </div>
      )}
    </>
  );
}

export default ClipManager;
