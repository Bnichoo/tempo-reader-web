import React, { useEffect, useMemo, useRef, useState } from "react";
import Upload from "lucide-react/dist/esm/icons/upload.js";
import Loader2 from "lucide-react/dist/esm/icons/loader-2.js";
import FileText from "lucide-react/dist/esm/icons/file-text.js";
import X from "lucide-react/dist/esm/icons/x.js";
import { processFileToText, extractImportMeta } from "../services/FileProcessingService";
import type { ImportMeta } from "../services/FileProcessingService";

// import meta extraction moved to service

export function ImportModal({ open, onClose, onApply }: { open: boolean; onClose: () => void; onApply: (text: string, meta: ImportMeta, opt: { mode: 'new' | 'replace' }) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState<ImportMeta | null>(null);
  const [titleOverride, setTitleOverride] = useState<string>("");
  const [text, setText] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<'new' | 'replace'>('new');
  const [isLarge, setIsLarge] = useState(false);

  useEffect(() => {
    if (!open) {
      setFile(null); setMeta(null); setTitleOverride(""); setText(""); setBusy(false); setErr(null);
    }
  }, [open]);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    (async () => {
      setBusy(true); setErr(null);
      try {
        setIsLarge(file.size > 4 * 1024 * 1024);
        const t = await processFileToText(file);
        if (cancelled) return;
        setText(t);
        const m = await extractImportMeta(file, t.slice(0, 2000));
        if (!cancelled) setMeta(m);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally { if (!cancelled) setBusy(false); }
    })();
    return () => { cancelled = true; };
  }, [file]);

  const preview = useMemo(() => {
    const parts = text.split(/\n{2,}/).filter(Boolean).slice(0, 4);
    return parts.join('\n\n');
  }, [text]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-window" style={{ top: 90, left: '50%', transform: 'translateX(-50%)' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="font-semibold">Import Document</div>
          <button className="px-2 py-1 rounded border" onClick={onClose}><X aria-hidden size={16} /></button>
        </div>
        <div className="modal-body">
          {!file && (
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-sepia-200 bg-white cursor-pointer">
                <Upload aria-hidden size={16} /> Choose file (.txt, .md, .html, .pdf, .docx)
                <input ref={inputRef} type="file" accept=".txt,.md,.markdown,.html,.htm,.pdf,.docx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); }} />
              </label>
            </div>
          )}

          {file && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <FileText aria-hidden size={16} />
                <div className="font-medium">{file.name}</div>
                <div className="text-sepia-700">{(file.size/1024).toFixed(1)} KB</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-sm">Title
                  <input className="mt-1 w-full px-2 py-1 rounded border border-sepia-200 bg-white" value={titleOverride || meta?.title || ''} onChange={(e)=>setTitleOverride(e.target.value)} placeholder={meta?.title || file.name} />
                </label>
                <div className="text-sm text-sepia-700 flex items-end">Type: <span className="ml-1 font-medium">{meta?.type || (file.type || 'unknown')}</span>{meta?.pages ? <span className="ml-3">Pages: <span className="font-medium">{meta.pages}</span></span> : null}</div>
              </div>

              <fieldset className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <label className="inline-flex items-center gap-2 px-2 py-2 rounded-lg border border-sepia-200 bg-white/70 hover:bg-white cursor-pointer">
                  <input type="radio" name="import-mode" value="new" checked={mode === 'new'} onChange={() => setMode('new')} />
                  <span>Open as new tab</span>
                </label>
                <label className="inline-flex items-center gap-2 px-2 py-2 rounded-lg border border-sepia-200 bg-white/70 hover:bg-white cursor-pointer">
                  <input type="radio" name="import-mode" value="replace" checked={mode === 'replace'} onChange={() => setMode('replace')} />
                  <span>Replace current</span>
                </label>
              </fieldset>

              {isLarge && <div className="text-xs text-amber-900 bg-amber-100 border border-amber-200 px-2 py-1 rounded">Large file detected; parsing may take longer.</div>}
              <div className="text-xs text-sepia-700">Preview</div>
              <pre className="max-h-56 overflow-auto p-2 bg-white border border-sepia-200 rounded text-sm whitespace-pre-wrap">{busy ? 'Parsing…' : (preview || '(empty)')}</pre>
              {err && <div className="text-sm text-red-700">{err}</div>}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="px-3 py-2 rounded border" onClick={onClose}>Cancel</button>
          <button className="px-3 py-2 rounded border primary" disabled={!file || busy || !text} onClick={() => { if (file && meta && text) onApply(text, { ...meta, title: titleOverride || meta.title }, { mode }); }}>
            {busy ? (<><Loader2 className="animate-spin" aria-hidden size={16} /> Importing…</>) : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ImportModal;
