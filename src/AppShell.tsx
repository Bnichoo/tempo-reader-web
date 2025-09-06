import React, { useCallback, useEffect, useState } from "react";
import { Reader } from "./components/Reader";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { sanitizeHTML } from "./lib/sanitize";
import type { RangeT, SettingsV1 } from "./types";
import { NoteEditorModal } from "./components/NoteEditorModal";
import { DrawerControls } from "./components/DrawerControls";
import { ClipManager } from "./components/ClipManager";
import { clipRepository } from "./lib/clipUtils";
import { useSettingsCtx } from "./contexts/SettingsContext";
import { useClipsCtx } from "./contexts/ClipsContext";
import { useResumePosition } from "./hooks/useResumePosition";
import { useBackup } from "./hooks/useBackup";
import { exportAll, importFromFile } from "./services/ImportExportService";
import { HeaderBar } from "./components/HeaderBar";
import { ProgressBar } from "./components/ProgressBar";
import { SearchController } from "./features/search/SearchController";
import UploadIcon from "lucide-react/dist/esm/icons/upload.js";
import { docDisplayName } from "./lib/doc";
import { recordRecentDoc } from "./lib/idb";
import { KeyboardController } from "./features/keyboard/KeyboardController";
import { PlaybackEngine } from "./features/playback/PlaybackEngine";
import { useDocument } from "./contexts/DocumentContext";
import { useReader } from "./contexts/ReaderContext";
import { usePWAInstall } from "./services/PWAService";
import { useEscapeStack } from "./hooks/useEscapeStack";
import { SelectionManager } from "./features/selection/SelectionManager";
import { useWordNavigation } from "./hooks/useWordNavigation";
import { useFocusRange } from "./hooks/useFocusRange";
import { useSelectionCtx } from "./contexts/SelectionContext";
import { ProductivityBar } from "./components/ProductivityBar";

export default function AppShell() {
  // Providers
  const { text, tokens, isProcessingFile, onFile, currentDocId } = useDocument();
  const { wIndex, setWIndex, playing, setPlaying } = useReader();

  // Install + online state via service hook
  const { canInstall, offline, promptInstall: doInstall } = usePWAInstall();

  // Word navigation helpers
  const { wordIdxData, wordIndexFromToken } = useWordNavigation(tokens);

  // Settings and clips
  const { settings, setWps, setCount, setGap, setFocusScale, setDimScale, setDimBlur, setFontPx, setDark, setDrawerOpen, setTheme } = useSettingsCtx();
  const { wps, count, gap, focusScale, dimScale, dimBlur, fontPx, dark, drawerOpen, theme } = settings;
  const { clips, setClips, togglePin, deleteClip, addClip, updateClipNote, addTag } = useClipsCtx();
  useEffect(() => { try { localStorage.setItem("tr:lastDocId", currentDocId); void recordRecentDoc(currentDocId, docDisplayName(text)); } catch {} }, [currentDocId, text]);

  // Focus window
  const focusRange = useFocusRange(wIndex, count, wordIdxData);

  // Ticker moved into PlaybackEngine component

  // Search query (controller renders drawer)
  const [searchStr, setSearchStr] = useState("");

  // Global tag add events from ClipManager buttons
  useEffect(() => {
    const onAddTag = (e: Event) => {
      const d = (e as CustomEvent).detail as { id: string; tag: string };
      if (d && d.id && d.tag) addTag(d.id, d.tag);
    };
    window.addEventListener("tr:addTag", onAddTag as EventListener);
    return () => window.removeEventListener("tr:addTag", onAddTag as EventListener);
  }, [addTag]);

  // Reader CSS vars
  const guardExtra = Math.max(0, (focusScale - 1) * 0.42 * (fontPx / 20));
  const computedGapEm = Math.max(gap, 0.2 + guardExtra);
  type CSSVars = React.CSSProperties & { ["--word-gap"]?: string; ["--scale-focus"]?: string; ["--scale-dim"]?: string; ["--dim-blur"]?: string; };
  const readerStyle: CSSVars = { fontSize: `${fontPx}px`, ["--word-gap"]: `${computedGapEm}em`, ["--scale-focus"]: String(focusScale), ["--scale-dim"]: String(dimScale), ["--dim-blur"]: `${dimBlur}px`, paddingBottom: `${80}px` };

  // Clips UI state + note modal
  const { selection: currentSelection, hoverRange, setHoverRange, aidRange, setAidRange } = useSelectionCtx();
  const [noteOpen, setNoteOpen] = useState(false);
  const [editingClipId, setEditingClipId] = useState<string | null>(null);
  const [pendingRange, setPendingRange] = useState<RangeT | null>(null);
  const [clipsExpanded, setClipsExpanded] = useState(false);

  // Escape key close order via hook
  useEscapeStack([
    { when: noteOpen, close: () => { setNoteOpen(false); setEditingClipId(null); setPendingRange(null); } },
    { when: clipsExpanded, close: () => setClipsExpanded(false) },
    { when: drawerOpen, close: () => setDrawerOpen(false) },
  ]);

  // Import/export
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const doExport = () => { setIsExporting(true); try { const payload: SettingsV1 = { wps, count, gap, focusScale, dimScale, dimBlur, fontPx, dark, drawerOpen, theme }; exportAll(payload, clips); } finally { setTimeout(() => setIsExporting(false), 500); } };
  const onImportJson = async (file: File | null) => { if (!file) return; setIsImporting(true); try { await importFromFile(file, { setWps, setCount, setGap, setFocusScale, setDimScale, setDimBlur, setFontPx, setDark, setDrawerOpen, setTheme: setTheme as any }, (list) => setClips(clipRepository.prune(clipRepository.migrate(list)))); alert("Import complete."); } catch (e: unknown) { const msg = (typeof e === "object" && e && "message" in e && typeof (e as any).message === "string") ? (e as any).message : String(e); alert("Import failed: " + msg); } finally { setIsImporting(false); } };

  // Resume + backup
  useBackup({ settings: { wps, count, gap, focusScale, dimScale, dimBlur, fontPx, dark, drawerOpen, theme }, clips }, "tr:backup:v1", 5000);
  useResumePosition(wordIdxData.count, wIndex, setWIndex, "tr:wIndex:v1");

  // Progress bar

  // Keyboard controls via controller component
  const openNoteFromRange = useCallback((r: RangeT) => { setPendingRange(r); setEditingClipId(null); setNoteOpen(true); }, []);
  const toggleClips = useCallback(() => setClipsExpanded((v) => !v), []);

  // Save clip
  const handleSaveNote = useCallback((html: string) => {
    const safe = sanitizeHTML(html);
    const stripHtml = (s: string) => s.replace(/<[^>]*>/g, "");
    const empty = stripHtml(safe).trim().length === 0;
    if (editingClipId) {
      updateClipNote(editingClipId, empty ? undefined : safe);
      setEditingClipId(null); setNoteOpen(false); setHoverRange(null); return;
    }
    if (!pendingRange) { setNoteOpen(false); return; }
    const start = Math.max(0, Math.min(pendingRange.start, tokens.length - 1));
    const length = Math.max(1, Math.min(pendingRange.length, tokens.length - start));
    const snippet = tokens.slice(start, start + length).join("");
    addClip({ start, length, snippet, noteHtml: empty ? undefined : safe, docId: currentDocId });
    setPendingRange(null); setNoteOpen(false); setHoverRange(null);
  }, [editingClipId, pendingRange, tokens, currentDocId, addClip, updateClipNote]);

  // Search helpers
  const onGoToToken = (tokenIdx: number) => setWIndex(wordIndexFromToken(tokenIdx));

  return (
    <>
      <HeaderBar offline={offline} canInstall={canInstall} doInstall={doInstall} isProcessingFile={isProcessingFile} onFile={(f) => onFile(f)} playing={playing} setPlaying={(v) => setPlaying(v)} disablePlay={wordIdxData.count === 0} search={searchStr} setSearch={setSearchStr} />

      <DrawerControls open={settings.drawerOpen} setOpen={setDrawerOpen} offset={settings.drawerOpen ? 332 : 0} wps={wps} setWps={setWps} count={count} setCount={setCount} gap={gap} setGap={setGap} focusScale={focusScale} setFocusScale={setFocusScale} dimScale={dimScale} setDimScale={setDimScale} dimBlur={dimBlur} setDimBlur={setDimBlur} fontPx={fontPx} setFontPx={setFontPx} theme={settings.theme as any} setTheme={setTheme as any} isImporting={isImporting} onImportJson={onImportJson} isExporting={isExporting} doExport={doExport} />

      {settings.drawerOpen && <div className="fixed inset-0 z-20" style={{ left: `${settings.drawerOpen ? 332 : 0}px` }} onClick={() => setDrawerOpen(false)} />}

      <div className="page-wrap" style={{ ["--drawer-offset"]: `${settings.drawerOpen ? 332 : 0}px` } as React.CSSProperties}>
        <main className="max-w-5xl mx-auto h-[calc(100vh-64px)] relative">
          <ProgressBar current={wIndex} total={wordIdxData.count} />
          <section className="reader-scroll w-full h-full rounded-2xl shadow-sm bg-white p-6 border border-sepia-200 overflow-y-auto scroll-smooth" style={readerStyle}>
            {tokens.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="text-6xl mb-4 opacity-20">Tempo Reader</div>
                <h2 className="text-2xl font-semibold text-sepia-700 mb-2">No text loaded</h2>
                <p className="text-sepia-600 mb-6">Open a .txt or .html file to start reading</p>
                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-dashed border-sepia-300 bg-white/50 hover:bg-white transition cursor-pointer">
                  <UploadIcon aria-hidden size={16} />
                  <span>Choose a file</span>
                  <input type="file" accept=".txt,.html,.htm,.md" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
                </label>
              </div>
            ) : isProcessingFile ? (
              <div className="flex flex-col items-center justify-center h-full"><div className="text-4xl mb-4 animate-pulse">Loading...</div><p className="text-sepia-600">Processing file...</p></div>
            ) : (
              <ErrorBoundary>
                <Reader tokens={tokens} focusStart={focusRange.start} focusLength={focusRange.length} hoverRange={hoverRange} aidRange={aidRange} playing={playing} onJump={(ti) => onGoToToken(ti)} onAddClip={(range) => { setPendingRange(range); setEditingClipId(null); setNoteOpen(true); }} onAidRangeChange={setAidRange} />
              </ErrorBoundary>
            )}
          </section>

          <ErrorBoundary>
            <ClipManager clips={clips} expanded={clipsExpanded} setExpanded={setClipsExpanded} drawerOffset={settings.drawerOpen ? 332 : 0} onGoToToken={onGoToToken} setHoverRange={setHoverRange} togglePin={togglePin} deleteClip={deleteClip} editRangeForId={null} currentSelection={currentSelection} applyEditedRange={() => {}} cancelEditRange={() => {}} beginEditRange={() => {}} onEditNote={(id) => { setEditingClipId(id); setNoteOpen(true); }} />
          </ErrorBoundary>

          <NoteEditorModal open={noteOpen} draftKey={editingClipId ? `draft:clip:${editingClipId}` : pendingRange ? `draft:new` : undefined} initialHtml={editingClipId ? clips.find((c) => c.id === editingClipId)?.noteHtml || "" : ""} onCancel={() => { setNoteOpen(false); setEditingClipId(null); setPendingRange(null); }} onSave={(html) => handleSaveNote(html)} />
        </main>
      </div>
      <ProductivityBar tokens={tokens} drawerOffsetLeft={settings.drawerOpen ? 332 : 0} />
      <SearchController tokens={tokens} search={searchStr} setSearch={setSearchStr} onGoToToken={(ti) => onGoToToken(ti)} drawerOffsetLeft={settings.drawerOpen ? 332 : 0} />
      <PlaybackEngine wordCount={wordIdxData.count} />
      <SelectionManager />
      <KeyboardController noteOpen={noteOpen} currentSelection={currentSelection} focusRange={focusRange} openNote={openNoteFromRange} toggleClips={toggleClips} />
    </>
  );
}
