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
import { ImportModal } from "./components/ImportModal";
import DropOverlay from "./components/DropOverlay";
import { ProgressBar } from "./components/ProgressBar";
import { SearchController } from "./features/search/SearchController";
import UploadIcon from "lucide-react/dist/esm/icons/upload.js";
import { docDisplayName, hashDocId } from "./lib/doc";
import { sentenceRangeAt } from "./lib/sentences";
import { recordRecentDoc, metaGet, metaSet, docPut, docGet, requestPersistentStorage } from "./lib/idb";
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
import { extractImportMeta, processFileToText } from "./services/FileProcessingService";
import type { ImportMeta } from "./services/FileProcessingService";
import RecentDocsMenu from "./components/RecentDocsMenu";
import TabBar, { type Tab } from "./components/TabBar";

export default function AppShell() {
  // Providers
  const { text, setText, tokens, isProcessingFile, onFile, currentDocId } = useDocument();
  const { wIndex, setWIndex, playing, setPlaying } = useReader();

  // Install + online state via service hook
  const { canInstall, offline, promptInstall: doInstall } = usePWAInstall();

  // Word navigation helpers
  const { wordIdxData, wordIndexFromToken, tokenIndexFromWord } = useWordNavigation(tokens);

  // Settings and clips
  const { settings, setWps, setCount, setGap, setFocusScale, setDimScale, setDimBlur, setFontPx, setDark, setDrawerOpen, setTheme } = useSettingsCtx();
  const { wps, count, gap, focusScale, dimScale, dimBlur, fontPx, dark, drawerOpen, theme } = settings;
  const { clips, setClips, togglePin, deleteClip, addClip, updateClipNote, addTag } = useClipsCtx();
  const [docMeta, setDocMeta] = useState<ImportMeta | null>(null);
  // Load metadata for current document (if saved previously)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await metaGet<ImportMeta>(`doc:${currentDocId}`);
        if (!cancelled) setDocMeta(saved || null);
      } catch {
        if (!cancelled) setDocMeta(null);
      }
    })();
    return () => { cancelled = true; };
  }, [currentDocId]);
  // Record recent doc with friendly name
  useEffect(() => {
    try {
      localStorage.setItem("tr:lastDocId", currentDocId);
      const name = docMeta?.title || docDisplayName(text);
      void recordRecentDoc(currentDocId, name);
    } catch { /* ignore: best-effort persist */ }
  }, [currentDocId, text, docMeta?.title]);

  // Focus window
  const focusRange = useFocusRange(wIndex, count, wordIdxData);

  // Ticker moved into PlaybackEngine component

  // Search query (controller renders drawer)
  const [searchStr, setSearchStr] = useState("");
  // Import modal state
  const [importOpen, setImportOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | undefined>(undefined);

  // Rehydrate tabs only when explicitly requested (user opted on exit)
  useEffect(() => {
    let cancelled = false;
    const shouldRestore = (() => {
      try { return localStorage.getItem('tr:restoreTabs:next') === '1'; } catch { return false; }
    })();
    if (!shouldRestore) return;
    (async () => {
      try {
        const ids = (await metaGet<string[]>("openTabs")) || [];
        const active = await metaGet<string>("activeDocId");
        const metas = await Promise.all(ids.map((id) => metaGet<ImportMeta>(`doc:${id}`)));
        if (!cancelled) {
          const list = ids.map((id, i) => ({ id, title: metas[i]?.title || id }));
          setTabs(list);
          setActiveTabId(active || list[0]?.id);
          const toLoad = active || list[0]?.id;
          if (toLoad && toLoad !== currentDocId) {
            try {
              const rec = await docGet(toLoad);
              if (rec?.text) {
                setText(rec.text);
                const m = await metaGet<ImportMeta>(`doc:${toLoad}`);
                if (m) setDocMeta(m);
              }
            } catch { /* ignore */ }
          }
        }
      } catch { /* ignore */ }
      finally { try { localStorage.removeItem('tr:restoreTabs:next'); } catch { /* ignore */ } }
    })();
    return () => { cancelled = true; };
  }, []);

  // Apply imported text and persist metadata
  const applyImported = useCallback(async (newText: string, meta: ImportMeta, opt?: { mode?: 'new' | 'replace' }) => {
    const mode = opt?.mode || 'new';
    const id = hashDocId(newText);
    const enriched = { ...meta, createdAt: Date.now(), updatedAt: Date.now() } as ImportMeta & { createdAt: number; updatedAt: number };
    try { await Promise.all([ metaSet(`doc:${id}`, enriched), docPut(id, newText) ]); } catch { /* ignore: best-effort persist */ }
    // Ask browser for persistent storage to reduce eviction risk for large docs
    try { void requestPersistentStorage(); } catch { /* ignore */ }
    setDocMeta(meta);
    setImportOpen(false);

    if (mode === 'replace' && (activeTabId || tokens.length > 0)) {
      const ok = window.confirm("Replace current tab with the imported document?");
      if (!ok) return;
      const oldId = activeTabId || currentDocId;
      setText(newText);
      const mapped = tabs.map((t) => t.id === oldId ? { id, title: meta.title } : t);
      // de-duplicate if new id already existed
      const seen = new Set<string>();
      const uniq = mapped.filter(t => (seen.has(t.id) ? false : (seen.add(t.id), true)));
      setTabs(uniq);
      setActiveTabId(id);
      // Defer tab persistence to exit prompt; do not write here.
      return;
    }

    // Default: open as new tab
    setText(newText);
    const exists = tabs.some((t) => t.id === id);
    const nextTabs = exists ? tabs.map((t) => t.id === id ? { ...t, title: meta.title } : t) : [...tabs, { id, title: meta.title }];
    setTabs(nextTabs);
    setActiveTabId(id);
    // Defer tab persistence to exit prompt; do not write here.
  }, [setText, tabs, activeTabId, currentDocId, tokens.length]);

  const onDropFile = useCallback(async (file: File) => {
    try {
      const t = await processFileToText(file);
      const m = await extractImportMeta(file, t.slice(0, 2000));
      await applyImported(t, m, { mode: 'new' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      alert("Import failed: " + msg);
    }
  }, [applyImported]);

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
  const onImportJson = async (file: File | null) => { if (!file) return; setIsImporting(true); try { await importFromFile(file, { setWps, setCount, setGap, setFocusScale, setDimScale, setDimBlur, setFontPx, setDark, setDrawerOpen, setTheme }, (list) => setClips(clipRepository.prune(clipRepository.migrate(list)))); alert("Import complete."); } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e); alert("Import failed: " + msg); } finally { setIsImporting(false); } };

  // Resume + backup
  useBackup({ settings: { wps, count, gap, focusScale, dimScale, dimBlur, fontPx, dark, drawerOpen, theme }, clips }, "tr:backup:v1", 5000);
  useResumePosition(wordIdxData.count, wIndex, setWIndex, `resume:${currentDocId}`);

  // Progress bar

  // Auto sentence highlighting while navigating/playing
  useEffect(() => {
    if (!tokens.length) return;
    const ti = tokenIndexFromWord(wIndex);
    setAidRange(sentenceRangeAt(tokens, ti));
  }, [wIndex, tokens, tokenIndexFromWord, setAidRange]);

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

  // On exit, ask whether to persist open tabs for next time
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      try {
        if (tabs.length === 0) return;
        const ok = window.confirm('Save open tabs for next time?');
        if (ok) {
          try {
            void metaSet('openTabs', tabs.map(t => t.id));
            if (activeTabId) void metaSet('activeDocId', activeTabId);
            localStorage.setItem('tr:restoreTabs:next', '1');
          } catch { /* ignore */ }
        } else {
          localStorage.removeItem('tr:restoreTabs:next');
        }
      } catch { /* ignore */ }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [tabs, activeTabId]);

  // Search helpers
  const onGoToToken = (tokenIdx: number) => setWIndex(wordIndexFromToken(tokenIdx));

  return (
    <>
      <HeaderBar offline={offline} canInstall={canInstall} doInstall={doInstall} onOpenImport={() => setImportOpen(true)} playing={playing} setPlaying={(v) => setPlaying(v)} disablePlay={wordIdxData.count === 0} search={searchStr} setSearch={setSearchStr} onOpenRecent={() => setRecentOpen(true)} />

      <TabBar tabs={tabs} activeId={activeTabId} onSelect={async (id) => {
        setActiveTabId(id);
        try {
          // Defer persistence; switch in-memory only
          if (id !== currentDocId) {
            const rec = await docGet(id);
            if (rec?.text) {
              setText(rec.text);
              const m = await metaGet<ImportMeta>(`doc:${id}`);
              if (m) setDocMeta(m);
            }
          }
        } catch { /* ignore */ }
      }} onClose={async (id) => {
        const remaining = tabs.filter((t) => t.id !== id);
        setTabs(remaining);
        // Defer persistence to exit prompt
        if (activeTabId === id) {
          const next = remaining[remaining.length - 1]?.id;
          setActiveTabId(next);
          if (next) {
            try {
              const rec = await docGet(next);
              if (rec?.text) {
                setText(rec.text);
                const m = await metaGet<ImportMeta>(`doc:${next}`);
                if (m) setDocMeta(m);
              }
            } catch { /* ignore */ }
          }
        }
      }} />

      <DrawerControls open={settings.drawerOpen} setOpen={setDrawerOpen} offset={settings.drawerOpen ? 332 : 0} wps={wps} setWps={setWps} count={count} setCount={setCount} gap={gap} setGap={setGap} focusScale={focusScale} setFocusScale={setFocusScale} dimScale={dimScale} setDimScale={setDimScale} dimBlur={dimBlur} setDimBlur={setDimBlur} fontPx={fontPx} setFontPx={setFontPx} theme={settings.theme || 'clean'} setTheme={setTheme} isImporting={isImporting} onImportJson={onImportJson} isExporting={isExporting} doExport={doExport} />

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
                <button className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-dashed border-sepia-300 bg-white/50 hover:bg-white transition" onClick={() => setImportOpen(true)}>
                  <UploadIcon aria-hidden size={16} />
                  <span>Import a file</span>
                </button>
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
            <ClipManager clips={clips} expanded={clipsExpanded} setExpanded={setClipsExpanded} drawerOffset={settings.drawerOpen ? 332 : 0} onGoToToken={onGoToToken} setHoverRange={setHoverRange} togglePin={togglePin} deleteClip={deleteClip} beginEditRange={() => {}} onEditNote={(id) => { setEditingClipId(id); setNoteOpen(true); }} />
          </ErrorBoundary>

          <NoteEditorModal open={noteOpen} draftKey={editingClipId ? `draft:clip:${editingClipId}` : pendingRange ? `draft:new` : undefined} initialHtml={editingClipId ? clips.find((c) => c.id === editingClipId)?.noteHtml || "" : ""} onCancel={() => { setNoteOpen(false); setEditingClipId(null); setPendingRange(null); }} onSave={(html) => handleSaveNote(html)} />
        </main>
      </div>
      <ProductivityBar tokens={tokens} drawerOffsetLeft={settings.drawerOpen ? 332 : 0} docId={currentDocId} />
      <SearchController tokens={tokens} search={searchStr} setSearch={setSearchStr} onGoToToken={(ti) => onGoToToken(ti)} drawerOffsetLeft={settings.drawerOpen ? 332 : 0} />
      <PlaybackEngine wordCount={wordIdxData.count} />
      <SelectionManager />
      <KeyboardController noteOpen={noteOpen} currentSelection={currentSelection} focusRange={focusRange} openNote={openNoteFromRange} toggleClips={toggleClips} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onApply={(newText, meta, opt) => { void applyImported(newText, meta, opt); }} />
      <DropOverlay onFile={onDropFile} />
      <RecentDocsMenu open={recentOpen} onClose={() => setRecentOpen(false)} onSelect={async (id) => {
        try {
          const rec = await docGet(id);
          if (!rec) { alert("Document not found in storage"); return; }
          const m = await metaGet<ImportMeta>(`doc:${id}`);
          if (m) setDocMeta(m);
          setText(rec.text);
          // add to tabs and activate
          const title = m?.title || id;
          const exists = tabs.some((t) => t.id === id);
          const nextTabs = exists ? tabs : [...tabs, { id, title }];
          setTabs(nextTabs);
          setActiveTabId(id);
          // Defer persistence to exit prompt
          setRecentOpen(false);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          alert("Failed to open document: " + msg);
        }
      }} />
    </>
  );
}
