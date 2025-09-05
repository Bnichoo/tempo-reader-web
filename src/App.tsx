import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Reader } from "./components/Reader";
import { useReducer } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useTokenizer } from "./lib/useTokenizer";
import { sanitizeHTML } from "./lib/sanitize";
import type { Clip, RangeT, SettingsV1 } from "./types";
import { NoteEditorModal } from "./components/NoteEditorModal";
import { DrawerControls } from "./components/DrawerControls";
import { ClipManager } from "./components/ClipManager";
import { LIMITS } from "./lib/constants";
import { clipRepository } from "./lib/clipUtils";
// exports handled inside Clips panel options
import { useSettings } from "./hooks/useSettings";
import { useClips } from "./hooks/useClips";
import { useResumePosition } from "./hooks/useResumePosition";
import { useBackup } from "./hooks/useBackup";
import { exportDataFile, parseImport } from "./lib/storage";
// SVG icons (lucide-react) to replace previous corrupted glyphs
import { HeaderBar } from "./components/HeaderBar";
import { ProgressBar } from "./components/ProgressBar";
import { SearchDrawer } from "./components/SearchDrawer";
import { useSearchIndex } from "./hooks/useSearchIndex";
import UploadIcon from "lucide-react/dist/esm/icons/upload.js";
import { hashDocId, docDisplayName } from "./lib/doc";
import { recordRecentDoc } from "./lib/idb";
import { uuid } from "./lib/uuid";
import { notify } from "./lib/toast";
import { logger } from "./lib/logger";
import { initSessionState, sessionReducer } from "./state/session";

/* ---------------- Utils & Types ---------------- */
// uuid moved to ./lib/uuid

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
const stripHtml = (s: string) => s.replace(/<[^>]*>/g, "");

// sentenceRangeAt defined/used within Reader component
const isAlphaNum = (t: string) => /\p{L}|\p{N}/u.test(t);
const isJoiner = (t: string) => t === "'" || t === "'" || t === "-" || t === "_";

/* ---------------- Sanitizer ---------------- */
// Using sanitizeHTML from ./lib/sanitize

/* ---------------- Persistence ---------------- */
const K_BACKUP = "tr:backup:v1";
const K_RESUME_WINDEX = "tr:wIndex:v1";
function clampSettings(s: Partial<SettingsV1>): Partial<SettingsV1> {
  const r: Partial<SettingsV1> = { ...s };
  const c = (v: number, min: number, max: number) => clamp(Number(v), min, max);
  if (r.wps != null) r.wps = c(r.wps, 0.5, 3);
  if (r.count != null) r.count = c(r.count, 1, 7);
  if (r.gap != null) r.gap = c(r.gap, 0.2, 0.8);
  if (r.focusScale != null) r.focusScale = c(r.focusScale, 1.0, 1.6);
  if (r.dimScale != null) r.dimScale = c(r.dimScale, 0.85, 1.0);
  if (r.dimBlur != null) r.dimBlur = c(r.dimBlur, 0, 2.5);
  if (r.fontPx != null) r.fontPx = c(r.fontPx, 16, 28);
  return r;
}
// clip pruning/migration moved to src/lib/clipUtils.ts

/* ---------------- Sample text ---------------- */
const SAMPLE_TEXT = `Reading isn't one thing; it is a braid of habits woven together. As eyes move, the mind predicts, discards, and stitches meaning on the fly. Most of this happens below awareness, but our experience of a page changes dramatically when attention is guided.

Focus reading makes that guidance explicit. It gives a gentle nudge to where your attention should settle next, then steps out of the way. The rhythm matters: too fast and comprehension collapses; too slow and your mind wanders off the line.

Clips are memory anchors. When you highlight a passage and jot a quick note, you are leaving a breadcrumb for your future self. The value of a clip is rarely the text alone; it's the thought you attach to it.

Try jumping between clips and let your eyes glide. Notice how the sentence structure becomes more obvious when the clutter fades. This is where reading feels less like scanning and more like following a current.`;

/* ============================== App ============================== */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function App() {
  /* ------- PWA install + online status ------- */
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const onBIP = (e: Event) => {
      e.preventDefault();
      if ("prompt" in e) {
        deferredPromptRef.current = e as BeforeInstallPromptEvent;
        setCanInstall(true);
      }
    };
    const onInstalled = () => setCanInstall(false);
    const goOnline = () => setOffline(false),
      goOffline = () => setOffline(true);
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    // Global ESC suppression for inputs/contenteditable
    const stopEscInInputs = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return;
      const ae = document.activeElement as HTMLElement | null;
      const tag = (ae?.tagName || '').toLowerCase();
      const isEditable = !!(ae && (ae.isContentEditable || tag === 'input' || tag === 'textarea'));
      if (isEditable) ev.stopPropagation();
    };
    window.addEventListener('keydown', stopEscInInputs, true);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener('keydown', stopEscInInputs, true);
    };
  }, []);
  const doInstall = async () => {
    const ev = deferredPromptRef.current;
    if (!ev) return;
    await ev.prompt();
    try {
      await ev.userChoice;
    } catch {}
    deferredPromptRef.current = null;
    setCanInstall(false);
  };

  /* ------- Loading states ------- */
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [text, setText] = useState(SAMPLE_TEXT);
  const tokens = useTokenizer(text);

  /* ------- Word windows ------- */
  const wordIdxData = useMemo(() => {
    const starts: number[] = [],
      ends: number[] = [];
    let i = 0;
    while (i < tokens.length) {
      if (!isAlphaNum(tokens[i])) {
        i++;
        continue;
      }
      const start = i;
      i++;
      while (i < tokens.length) {
        if (isAlphaNum(tokens[i])) {
          i++;
          continue;
        }
        if (isJoiner(tokens[i]) && i + 1 < tokens.length && isAlphaNum(tokens[i + 1])) {
          i += 2;
          continue;
        }
        break;
      }
      starts.push(start);
      ends.push(i - 1);
    }
    return { starts, ends, count: starts.length };
  }, [tokens]);
  const tokenIndexFromWord = (w: number) =>
    wordIdxData.starts[Math.max(0, Math.min(w, wordIdxData.count - 1))] ?? 0;
  const tokenEndFromWord = (w: number) =>
    wordIdxData.ends[Math.max(0, Math.min(w, wordIdxData.count - 1))] ?? 0;
  const wordIndexFromToken = (ti: number) => {
    const a = wordIdxData.starts;
    if (!a.length) return 0;
    let lo = 0,
      hi = a.length - 1,
      ans = 0;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (a[m] <= ti) {
        ans = m;
        lo = m + 1;
      } else hi = m - 1;
    }
    return ans;
  };

  /* ------- Playback / Session (useReducer) ------- */
  const [session, dispatch] = useReducer(sessionReducer, undefined, initSessionState);
  const { wIndex, playing, searchStr, hoverRange, currentSelection, aidRange, clipsExpanded } = session;
  const { settings, setWps, setCount, setGap, setFocusScale, setDimScale, setDimBlur, setFontPx, setDark, setDrawerOpen } = useSettings();
  const { wps, count, gap, focusScale, dimScale, dimBlur, fontPx, dark, drawerOpen } = settings;
  // Quick jump input moved to reducer as searchStr

  /* ------- Reader styling vars ------- */
  // styling derived from settings

  /* ------- Theme ------- */
  // theme handled in useSettings

  /* ------- Left controls drawer ------- */
  // drawerOpen handled in useSettings
  const drawerWidth = 320,
    drawerGap = 12;
  const drawerOffset = drawerOpen ? drawerWidth + drawerGap : 0;

  const searchIndex = useSearchIndex(tokens);
  const searchHits = useMemo(() => searchIndex.search(searchStr, 200), [searchIndex, searchStr]);

  /* ------- Reader click/selection events ------- */
  useEffect(() => {
    const onToggle = () => dispatch({ type: "togglePlaying" });
    const onPause = () => dispatch({ type: "pause" });
    window.addEventListener("tempo:toggle", onToggle);
    window.addEventListener("tempo:pause", onPause);
    return () => {
      window.removeEventListener("tempo:toggle", onToggle);
      window.removeEventListener("tempo:pause", onPause);
    };
  }, []);

  /* ------- Clips ------- */
  const currentDocId = useMemo(() => hashDocId(text), [text]);
  useEffect(() => {
    try {
      localStorage.setItem("tr:lastDocId", currentDocId);
      void recordRecentDoc(currentDocId, docDisplayName(text));
    } catch {}
  }, [currentDocId, text]);
  const { clips, setClips, togglePin, deleteClip } = useClips(currentDocId);
  // hoverRange, currentSelection, aidRange managed by reducer

  // Settings/clips persistence handled in hooks

  /* ------- Auto-backup via hook ------- */
  useBackup({
    settings: { wps, count, gap, focusScale, dimScale, dimBlur, fontPx, dark, drawerOpen },
    clips,
  }, K_BACKUP, 5000);

  /* ------- Smooth resume via hook ------- */
  const setWIndex = useCallback((n: number) => {
    dispatch({ type: "setWordIndex", index: n, maxWords: wordIdxData.count });
  }, [wordIdxData.count]);
  useResumePosition(wordIdxData.count, wIndex, setWIndex, K_RESUME_WINDEX);

  /* ------- Ticker ------- */
  useEffect(() => {
    if (!playing) return;
    let last = performance.now(),
      acc = 0,
      raf: number;
    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      acc += dt * wps;
      if (acc >= 1) {
        const jump = Math.floor(acc) * count;
        acc = acc % 1;
        dispatch({ type: "advanceWords", by: jump, maxWords: wordIdxData.count });
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, wps, count, wordIdxData.count]);

  /* ------- Import / Export ------- */
  const onFile = useCallback(async (file: File) => {
    setIsProcessingFile(true);
    try {
      if (file.size > 4 * 1024 * 1024) {
        notify("Large file (>4MB). Rendering may feel slow.", "warn");
      }
      const ext = file.name.toLowerCase().split(".").pop();
      const t0 = performance.now();
      const raw = await file.text();
      let clean = raw;
      if (ext === "html" || ext === "htm") {
        const parser = new DOMParser();
        const doc = parser.parseFromString(raw, "text/html");
        clean = doc.body.innerText;
      }
      setText(clean);
      logger.info("file:loaded", { bytes: file.size, ms: Math.round(performance.now() - t0) });
    } finally {
      setIsProcessingFile(false);
    }
  }, []);
  
  const doExport = () => {
    setIsExporting(true);
    try {
      const settings: SettingsV1 = {
        wps,
        count,
        gap,
        focusScale,
        dimScale,
        dimBlur,
        fontPx,
        dark,
        drawerOpen,
      };
      exportDataFile({ settings, clips });
    } finally {
      setTimeout(() => setIsExporting(false), 500); // Brief visual feedback
    }
  };

  // Export handled from Clips panel
  
  const onImportJson = async (file: File | null) => {
    if (!file) return;
    setIsImporting(true);
    try {
      if (file.size > LIMITS.MAX_IMPORT_BYTES) {
        notify("JSON is larger than 1MB. Please split or trim.", "warn");
        return;
      }
      const text = await file.text();
      const data = parseImport(text);
      if (data.settings) {
        const s = clampSettings(data.settings);
        if (s.wps != null) setWps(s.wps);
        if (s.count != null) setCount(s.count);
        if (s.gap != null) setGap(s.gap);
        if (s.focusScale != null) setFocusScale(s.focusScale);
        if (s.dimScale != null) setDimScale(s.dimScale);
        if (s.dimBlur != null) setDimBlur(s.dimBlur);
        if (s.fontPx != null) setFontPx(s.fontPx);
        if (s.dark != null) setDark(!!s.dark);
        if (s.drawerOpen != null) setDrawerOpen(!!s.drawerOpen);
      }
      if (data.clips) setClips(clipRepository.prune(clipRepository.migrate(data.clips)));
      notify("Import complete.", "success");
    } catch (e: unknown) {
      const msg = (typeof e === "object" && e && "message" in e && typeof (e as { message?: unknown }).message === "string")
        ? ((e as { message?: unknown }).message as string)
        : String(e);
      notify("Import failed: " + msg, "error");
      logger.error("import:failed", e as unknown, { message: msg });
    } finally {
      setIsImporting(false);
    }
  };

  /* ------- Focus window ------- */
  const focusTokenStart = useMemo(() => tokenIndexFromWord(wIndex), [wIndex, wordIdxData]);
  const focusTokenEnd = useMemo(
    () => tokenEndFromWord(Math.min(wIndex + count - 1, wordIdxData.count - 1)),
    [wIndex, count, wordIdxData]
  );
  const focusRange = useMemo(
    () => ({ start: focusTokenStart, length: Math.max(1, focusTokenEnd - focusTokenStart + 1) }),
    [focusTokenStart, focusTokenEnd]
  );

  /* ------- Notes / clips actions ------- */
  const [noteOpen, setNoteOpen] = useState(false);
  const [editingClipId, setEditingClipId] = useState<string | null>(null);
  const [pendingRange, setPendingRange] = useState<RangeT | null>(null);
  const handleSaveNote = useCallback(
    (html: string) => {
      const safe = sanitizeHTML(html);
      const empty = stripHtml(safe).trim().length === 0;
      if (editingClipId) {
        setClips((prev) =>
          clipRepository.prune(
            prev.map((c) =>
              c.id === editingClipId ? { ...c, noteHtml: empty ? undefined : safe } : c
            )
          )
        );
        setEditingClipId(null);
        setNoteOpen(false);
        dispatch({ type: "setHoverRange", range: null });
        return;
      }
      if (!pendingRange) {
        setNoteOpen(false);
        return;
      }
      const start = Math.max(0, Math.min(pendingRange.start, tokens.length - 1));
      const length = Math.max(1, Math.min(pendingRange.length, tokens.length - start));
      const snippet = tokens.slice(start, start + length).join("");
      const newClip: Clip = {
        id: uuid(),
        start,
        length,
        snippet,
        noteHtml: empty ? undefined : safe,
        createdUtc: new Date().toISOString(),
        pinned: false,
        docId: currentDocId,
      };
      setClips((prev) => clipRepository.prune([newClip, ...prev]));
      setPendingRange(null);
      setNoteOpen(false);
      dispatch({ type: "setHoverRange", range: null });
    },
    [editingClipId, pendingRange, tokens]
  );
  // togglePin/deleteClip provided by useClips
  const [editRangeForId, setEditRangeForId] = useState<string | null>(null);
  const beginEditRange = (id: string) => {
    setEditRangeForId(id);
    dispatch({ type: "setSelection", range: null });
  };
  const applyEditedRange = () => {
    if (!editRangeForId || !currentSelection) return;
    setClips((prev) =>
      prev.map((c) => {
        if (c.id !== editRangeForId) return c;
        const start = Math.max(0, Math.min(currentSelection.start, tokens.length - 1));
        const length = Math.max(1, Math.min(currentSelection.length, tokens.length - start));
        return { ...c, start, length, snippet: tokens.slice(start, start + length).join("") };
      })
    );
    setEditRangeForId(null);
    dispatch({ type: "setHoverRange", range: null });
  };

  /* ------- Reader CSS vars ------- */
  const guardExtra = Math.max(0, (focusScale - 1) * 0.42 * (fontPx / 20));
  const computedGapEm = Math.max(gap, 0.2 + guardExtra);
  type CSSVars = React.CSSProperties & {
    ["--word-gap"]?: string;
    ["--scale-focus"]?: string;
    ["--scale-dim"]?: string;
    ["--dim-blur"]?: string;
  };
  const readerStyle: CSSVars = {
    fontSize: `${fontPx}px`,
    ["--word-gap"]: `${computedGapEm}em`,
    ["--scale-focus"]: String(focusScale),
    ["--scale-dim"]: String(dimScale),
    ["--dim-blur"]: `${dimBlur}px`,
    paddingBottom: `${80}px`, // small space for dock
  };

  /* ------- Global Escape key handler ------- */
  // clipsExpanded moved to reducer
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      
      // Priority order: close deepest element first
      if (noteOpen) {
        setNoteOpen(false);
        setEditingClipId(null);
        setPendingRange(null);
        return;
      }
      
      if (clipsExpanded) {
        dispatch({ type: "setClipsExpanded", value: false });
        return;
      }
      
      if (drawerOpen) {
        setDrawerOpen(false);
        return;
      }
      
      // Clear text selection if nothing else to close
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) {
        selection.removeAllRanges();
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [noteOpen, clipsExpanded, drawerOpen]);
  useEffect(() => {
    function isTypingTarget(el: EventTarget | null) {
      if (!(el instanceof HTMLElement)) return false;
      if (el.isContentEditable) return true;
      const tag = el.tagName;
      if (tag === "TEXTAREA") return true;
      if (tag === "INPUT") {
        const type = (el as HTMLInputElement).type.toLowerCase();
        if (["range", "button", "checkbox", "radio"].includes(type)) return false;
        return true;
      }
      return false;
    }
    const onKey = (e: KeyboardEvent) => {
      if (noteOpen) return;
      if (isTypingTarget(e.target)) {
        if (e.code === "Space" && (e.target as HTMLElement).tagName === "INPUT") {
          const t = (e.target as HTMLInputElement).type.toLowerCase();
          if (!["range", "button", "checkbox", "radio"].includes(t)) return;
        } else {
          return;
        }
      }
      if (e.code === "Space") {
        e.preventDefault();
        dispatch({ type: "togglePlaying" });
      } else if (e.key.toLowerCase() === "c") {
        e.preventDefault();
        const range = currentSelection || focusRange;
        setPendingRange(range);
        setEditingClipId(null);
        setNoteOpen(true);
      } else if ((e.altKey || e.metaKey) && e.key.toLowerCase() === "c") {
        e.preventDefault();
        dispatch({ type: "setPlaying", value: false });
        dispatch({ type: "toggleClipsExpanded" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [noteOpen, currentSelection, tokens, focusRange, focusTokenStart]);

  /* ============================ Render ============================ */
  return (
    <>
      {/* Header */}
      <HeaderBar
        offline={offline}
        canInstall={canInstall}
        doInstall={doInstall}
        isProcessingFile={isProcessingFile}
        onFile={(f) => onFile(f)}
        playing={playing}
        setPlaying={(v) => dispatch({ type: "setPlaying", value: v })}
        disablePlay={wordIdxData.count === 0}
        search={searchStr}
        setSearch={(v) => dispatch({ type: "setSearch", value: v })}
      />

      {/* Left Controls Drawer */}
      <DrawerControls
        open={drawerOpen}
        setOpen={setDrawerOpen}
        offset={drawerOffset}
        wps={wps} setWps={setWps}
        count={count} setCount={setCount}
        gap={gap} setGap={setGap}
        focusScale={focusScale} setFocusScale={setFocusScale}
        dimScale={dimScale} setDimScale={setDimScale}
        dimBlur={dimBlur} setDimBlur={setDimBlur}
        fontPx={fontPx} setFontPx={setFontPx}
        dark={dark} setDark={setDark}
        isImporting={isImporting} onImportJson={onImportJson}
        isExporting={isExporting} doExport={doExport}
      />

      {/* Click outside main content to close left drawer */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-20"
          style={{ left: `${drawerOffset}px` }}
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Main area */}
      <div
        className="page-wrap"
        style={{ ["--drawer-offset"]: `${drawerOffset}px` } as React.CSSProperties}
        onPointerDown={(e) => {
          if (e.pointerType !== 'touch') return;
          const x = e.clientX, y = e.clientY;
          ;(window as any).__tr_swipe = { x, y, t: performance.now(), dx: 0, dy: 0, startX: x };
        }}
        onPointerMove={(e) => {
          if (e.pointerType !== 'touch') return;
          const st = (window as any).__tr_swipe; if (!st) return;
          st.dx = e.clientX - st.x; st.dy = e.clientY - st.y;
        }}
        onPointerUp={(e) => {
          if (e.pointerType !== 'touch') return;
          const st = (window as any).__tr_swipe; (window as any).__tr_swipe = null;
          if (!st) return;
          const absY = Math.abs(st.dy);
          const absX = Math.abs(st.dx);
          // Edge open: start near left edge and swipe right
          if (!drawerOpen && st.startX < 24 && st.dx > 60 && absY < 40) {
            setDrawerOpen(true);
            return;
          }
          // Close when drawer open: swipe left from near drawer area
          if (drawerOpen && absX > 60 && st.dx < -60 && absY < 40) {
            setDrawerOpen(false);
          }
        }}
      >
        <main className="max-w-5xl mx-auto h-[calc(100vh-64px)] relative">
          <ProgressBar current={wIndex} total={wordIdxData.count} />
          <section
            className="reader-scroll w-full h-full rounded-2xl shadow-sm bg-white p-6 border border-sepia-200 overflow-y-auto scroll-smooth"
            style={{
              ...readerStyle,
              filter: clipsExpanded ? "blur(0.2px)" : undefined,
            }}
          >
            {tokens.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="text-6xl mb-4 opacity-20">Tempo Reader</div>
                <h2 className="text-2xl font-semibold text-sepia-700 mb-2">No text loaded</h2>
                <p className="text-sepia-600 mb-6">
                  Open a .txt or .html file to start reading
                </p>
                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-dashed border-sepia-300 bg-white/50 hover:bg-white transition cursor-pointer">
                  <UploadIcon aria-hidden size={16} />
                  <span>Choose a file</span>
                  <input
                    type="file"
                    accept=".txt,.html,.htm,.md"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onFile(f);
                    }}
                  />
                </label>
                <button
                  className="mt-4 text-sm text-sepia-600 hover:text-sepia-800 underline"
                  onClick={() => setText(SAMPLE_TEXT)}
                >
                  Load sample text
                </button>
              </div>
            ) : isProcessingFile ? (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="text-4xl mb-4 animate-pulse">Loading...</div>
                <p className="text-sepia-600">Processing file...</p>
              </div>
            ) : (
              <ErrorBoundary>
                <Reader
                  tokens={tokens}
                  focusStart={focusRange.start}
                  focusLength={focusRange.length}
                  hoverRange={hoverRange}
                  aidRange={aidRange}
                  playing={playing}
                  onJump={(tokenIdx) => setWIndex(wordIndexFromToken(tokenIdx))}
                  onAddClip={(range) => {
                    setPendingRange(range);
                    setEditingClipId(null);
                    setNoteOpen(true);
                  }}
                  onAidRangeChange={(r) => dispatch({ type: "setAidRange", range: r })}
                  onSelectionChange={(r) => dispatch({ type: "setSelection", range: r })}
                />
              </ErrorBoundary>
            )}
          </section>

          {/* Clips dock + manager */}
          <ErrorBoundary>
          <ClipManager
            clips={clips}
            expanded={clipsExpanded}
            setExpanded={(v) => dispatch({ type: "setClipsExpanded", value: v })}
            drawerOffset={drawerOffset}
            onGoToToken={(tokenIdx) => setWIndex(wordIndexFromToken(tokenIdx))}
            setHoverRange={(r) => dispatch({ type: "setHoverRange", range: r })}
            togglePin={togglePin}
            deleteClip={deleteClip}
            editRangeForId={editRangeForId}
            currentSelection={currentSelection}
            applyEditedRange={applyEditedRange}
            cancelEditRange={() => setEditRangeForId(null)}
            beginEditRange={beginEditRange}
            onEditNote={(id) => { setEditingClipId(id); setNoteOpen(true); }}
          />
          </ErrorBoundary>
          {/* Note modal */}
          <NoteEditorModal
          open={noteOpen}
          draftKey={
            editingClipId ? `draft:clip:${editingClipId}` : pendingRange ? `draft:new` : undefined
          }
          initialHtml={editingClipId ? clips.find((c) => c.id === editingClipId)?.noteHtml || "" : ""}
          onCancel={() => {
            setNoteOpen(false);
            setEditingClipId(null);
            setPendingRange(null);
          }}
          onSave={(html) => handleSaveNote(html)}
        />
        </main>
      </div>
      <SearchDrawer
        open={searchStr.trim().length >= 2}
        query={searchStr}
        hits={searchHits}
        onClose={() => { dispatch({ type: "setSearch", value: "" }); dispatch({ type: "setAidRange", range: null }); }}
        onGoToToken={(ti) => { setWIndex(wordIndexFromToken(ti)); dispatch({ type: "setAidRange", range: { start: ti, length: 1 } }); }}
        drawerOffsetLeft={drawerOffset}
      />
    </>
  );
}



