import { useEffect, useRef, useState } from "react";
import Undo2 from "lucide-react/dist/esm/icons/undo-2.js";
import Redo2 from "lucide-react/dist/esm/icons/redo-2.js";
import LinkSvg from "lucide-react/dist/esm/icons/link.js";
import UnlinkSvg from "lucide-react/dist/esm/icons/unlink.js";
import ClipboardPaste from "lucide-react/dist/esm/icons/clipboard-paste.js";
import CloseIcon from "lucide-react/dist/esm/icons/x.js";
import { sanitizeHTML } from "../lib/sanitize";

type NoteEditorProps = {
  open: boolean;
  draftKey?: string;
  initialHtml?: string;
  onSave: (html: string) => void;
  onCancel: () => void;
};

const UndoIcon = () => <span aria-hidden>↶</span>;
const RedoIcon = () => <span aria-hidden>↷</span>;
const PasteIcon = () => <span aria-hidden>📋</span>;
const LinkIcon = () => <span aria-hidden>🔗</span>;
const UnlinkIcon = () => <span aria-hidden>✖</span>;

const MAX_PASTE_BYTES = 200 * 1024;
const textByteSize = (s: string) => new Blob([s]).size;
// keep legacy icon component identifiers referenced to avoid TS6133 during transition
void UndoIcon; void RedoIcon; void PasteIcon; void LinkIcon; void UnlinkIcon;

export function NoteEditorModal({ open, draftKey, initialHtml, onSave, onCancel }: NoteEditorProps) {
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 160, top: 120 });
  const dragging = useRef(false);
  const start = useRef<{ x: number; y: number; left: number; top: number } | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<{ b: boolean; i: boolean; u: boolean; link: boolean }>({ b: false, i: false, u: false, link: false });
  const lastRangeRef = useRef<Range | null>(null);
  const histRef = useRef<{ stack: string[]; idx: number }>({ stack: [], idx: -1 });
  const histTimer = useRef<number | null>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  function withinTag(tag: string): boolean {
    const sel = document.getSelection();
    if (!sel || sel.rangeCount === 0) return false;
    let node: Node | null = sel.anchorNode;
    const root = editorRef.current;
    while (node && node !== root && node.nodeType === 3) node = node.parentNode;
    while (node && node !== root) {
      if ((node as HTMLElement).tagName?.toLowerCase() === tag) return true;
      node = node.parentNode;
    }
    return false;
  }
  function getAnchorInSelection(): HTMLAnchorElement | null {
    const sel = document.getSelection(), root = editorRef.current;
    if (!sel || sel.rangeCount === 0 || !root) return null;
    let node: Node | null = sel.anchorNode;
    while (node && node !== root) {
      if (node instanceof HTMLAnchorElement) return node;
      node = node.parentNode;
    }
    return null;
  }
  function updateToolbarStates() {
    setActive({
      b: typeof document.queryCommandState === "function" ? document.queryCommandState("bold") : false,
      i: typeof document.queryCommandState === "function" ? document.queryCommandState("italic") : false,
      u: typeof document.queryCommandState === "function" ? document.queryCommandState("underline") : false,
      link: withinTag("a"),
    });
  }
  function captureSelectionIfInside() {
    const ed = editorRef.current; if (!ed) return;
    const sel = document.getSelection(); if (!sel || sel.rangeCount === 0) return;
    const r = sel.getRangeAt(0);
    if (ed.contains(r.startContainer) && ed.contains(r.endContainer)) lastRangeRef.current = r.cloneRange();
  }
  function restoreSelection() {
    const ed = editorRef.current; if (!ed) return;
    const sel = window.getSelection(); if (!sel) return;
    sel.removeAllRanges();
    if (lastRangeRef.current) sel.addRange(lastRangeRef.current);
    else { const range = document.createRange(); range.selectNodeContents(ed); range.collapse(false); sel.addRange(range); }
  }
  function pushHistorySnapshot(force = false) {
    const ed = editorRef.current; if (!ed) return;
    const html = ed.innerHTML; const { stack, idx } = histRef.current;
    if (!force && stack[idx] === html) return;
    if (idx < stack.length - 1) stack.splice(idx + 1);
    stack.push(html); histRef.current.idx = stack.length - 1;
  }
  function scheduleHistoryCommit() {
    if (histTimer.current) cancelAnimationFrame(histTimer.current!);
    histTimer.current = requestAnimationFrame(() => pushHistorySnapshot(false));
  }
  function applyHtml(html: string) {
    const ed = editorRef.current; if (!ed) return;
    ed.innerHTML = html || "<p><br></p>";
    const range = document.createRange(); range.selectNodeContents(ed); range.collapse(false);
    const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(range);
    updateToolbarStates();
  }
  function undo() { const h = histRef.current; if (h.idx > 0) { h.idx--; applyHtml(h.stack[h.idx]); } }
  function redo() { const h = histRef.current; if (h.idx < h.stack.length - 1) { h.idx++; applyHtml(h.stack[h.idx]); } }
  function exec(cmd: string, value?: string) {
    const ed = editorRef.current; if (!ed) return; ed.focus(); restoreSelection();
    try { if (typeof document.execCommand === "function") document.execCommand(cmd, false, value); } catch {}
    updateToolbarStates(); scheduleHistoryCommit();
  }
  function normalizeHref(input: string): string | null {
    let href = input.trim(); if (!href) return null;
    if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(href) || /^www\./i.test(href)) { href = href.replace(/^www\./i, ""); href = "https://" + href; }
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(href)) href = "mailto:" + href;
    if (/^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/i.test(href)) return href;
    if (/^tel:\+?[0-9()[\]\-\s]{3,}$/.test(href)) return href;
    if (/^https?:\/\/.+/i.test(href)) { try { const u = new URL(href); if (!u.hostname) return null; return u.toString(); } catch { return null; } }
    return null;
  }
  function fixupAllAnchors(ed: HTMLElement) {
    ed.querySelectorAll("a").forEach((a) => {
      const href = a.getAttribute("href") || "";
      if (!/^https?:|^mailto:|^tel:/i.test(href)) { const span = document.createElement("span"); span.textContent = a.textContent || ""; a.replaceWith(span); }
      else { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener noreferrer"); }
    });
  }
  function createOrEditLink() {
    const ed = editorRef.current; if (!ed) return; ed.focus(); restoreSelection();
    const selectedAnchor = getAnchorInSelection();
    const currentHref = selectedAnchor?.getAttribute("href") || "";
    const input = window.prompt("Enter URL (https://, http://, mailto:, or tel:)", currentHref);
    if (input == null) return; const href = normalizeHref(input); if (!href) { alert("Invalid URL. Use https://, http://, mailto:, or tel:."); return; }
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && sel.getRangeAt(0).collapsed) {
      const zwsp = document.createTextNode("\u200B"); const r = sel.getRangeAt(0); r.insertNode(zwsp);
      sel.removeAllRanges(); const nr = document.createRange(); nr.setStartBefore(zwsp); nr.setEndAfter(zwsp); sel.addRange(nr);
    }
    try { if (typeof document.execCommand === "function") document.execCommand("createLink", false, href); } catch {}
    if (editorRef.current) fixupAllAnchors(editorRef.current); updateToolbarStates(); pushHistorySnapshot(true);
  }
  function unlinkSelection() {
    const ed = editorRef.current; if (!ed) return; ed.focus(); restoreSelection();
    try { if (typeof document.execCommand === "function") document.execCommand("unlink"); } catch {}
    updateToolbarStates(); pushHistorySnapshot(true);
  }
  function normalizeOfficeHtml(html: string): string {
    html = html.replace(/<!--\[if[\s\S]*?endif\]-->/gi, "");
    html = html.replace(/class=\"?Mso[a-zA-Z0-9]*\"?/g, "");
    html = html.replace(/style=\"[^\"]*mso-[^\";]*;?[^\"]*\"/gi, "");
    html = html.replace(/<o:p>\s*<\/o:p>/gi, "");
    html = html.replace(/<o:p>.*?<\/o:p>/gi, "");
    return html;
  }
  function textToHtmlParagraphs(text: string): string {
    const paras = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
    const html = paras
      .map((p) => p.split("\n").map((line) => line
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;")
      ).join("<br>")).map((safe) => `<p>${safe}</p>`).join("");
    return html || "<p></p>";
  }
  function insertSanitizedHtml(html: string) {
    const ed = editorRef.current; if (!ed) return; ed.focus(); restoreSelection();
    const safe = sanitizeHTML(html);
    const ok = document.queryCommandSupported && document.queryCommandSupported("insertHTML");
    const fallbackInsert = () => {
      const sel = window.getSelection(); if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0); range.deleteContents();
      const frag = range.createContextualFragment(safe); range.insertNode(frag);
      const r = document.createRange(); r.selectNodeContents(ed); r.collapse(false);
      sel.removeAllRanges(); sel.addRange(r);
    };
    if (ok) {
      try {
        document.execCommand("insertHTML", false, safe);
      } catch (e) {
        console.warn("execCommand insertHTML failed; using fallback", e);
        fallbackInsert();
      }
    } else {
      fallbackInsert();
    }
    if (editorRef.current) fixupAllAnchors(editorRef.current); updateToolbarStates(); pushHistorySnapshot(true);
  }
  const onPaste = (e: React.ClipboardEvent) => {
    e.preventDefault(); const dt = e.clipboardData;
    const html = dt?.getData("text/html"); const text = dt?.getData("text/plain");
    const candidate = html ? normalizeOfficeHtml(html) : text ? textToHtmlParagraphs(text) : "";
    if (!candidate) return;
    if (textByteSize(candidate) > MAX_PASTE_BYTES) {
      alert("That paste is quite large. Only the first ~200KB will be inserted.");
      let trimmed = candidate.slice(0, Math.min(candidate.length, MAX_PASTE_BYTES));
      while (textByteSize(trimmed) > MAX_PASTE_BYTES) trimmed = trimmed.slice(0, Math.floor(trimmed.length * 0.9));
      insertSanitizedHtml(trimmed);
    } else insertSanitizedHtml(candidate);
  };
  async function pasteAsPlainText() {
    try {
      const txt = await navigator.clipboard.readText();
      if (txt != null) {
        let html = textToHtmlParagraphs(txt);
        if (textByteSize(html) > MAX_PASTE_BYTES) {
          alert("That paste is quite large. Only the first ~200KB will be inserted.");
          while (textByteSize(html) > MAX_PASTE_BYTES) html = html.slice(0, Math.floor(html.length * 0.9));
        }
        insertSanitizedHtml(html);
      }
    } catch (e) {
      console.warn("Clipboard read blocked; falling back to prompt.", e);
      const txt = window.prompt("Paste here, then press OK:", "");
      if (txt != null) insertSanitizedHtml(textToHtmlParagraphs(txt));
    }
  }
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); const txt = e.dataTransfer.getData("text/plain");
    if (txt) {
      let html = textToHtmlParagraphs(txt);
      if (textByteSize(html) > MAX_PASTE_BYTES) { alert("That paste is quite large. Only the first ~200KB will be inserted."); while (textByteSize(html) > MAX_PASTE_BYTES) html = html.slice(0, Math.floor(html.length * 0.9)); }
      insertSanitizedHtml(html);
    }
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if (mod && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) { e.preventDefault(); redo(); return; }
    if (mod && e.key.toLowerCase() === "b") { e.preventDefault(); exec("bold"); return; }
    if (mod && e.key.toLowerCase() === "i") { e.preventDefault(); exec("italic"); return; }
    if (mod && e.key.toLowerCase() === "u") { e.preventDefault(); exec("underline"); return; }
  };
  const keepFocus = (e: React.MouseEvent) => e.preventDefault();

  useEffect(() => {
  if (!open) return;
  prevFocusRef.current = (document.activeElement as HTMLElement) || null;
  setTimeout(() => editorRef.current?.focus(), 0);
  const onKeyDownDoc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); return; }
    if (e.key !== 'Tab') return;
    const root = modalRef.current; if (!root) return;
    const focusables = Array.from(root.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(el => !el.hasAttribute('disabled'));
    if (focusables.length === 0) return;
    const first = focusables[0]; const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
  };
  document.addEventListener('keydown', onKeyDownDoc);

  const saved = draftKey ? localStorage.getItem(draftKey) : null;
  if (editorRef.current) {
    if (saved) {
      try { const parsed = JSON.parse(saved) as { value: string }; editorRef.current.innerHTML = parsed.value || ''; }
      catch { editorRef.current.innerHTML = initialHtml || ''; }
    } else editorRef.current.innerHTML = initialHtml || '';
    fixupAllAnchors(editorRef.current); const html = editorRef.current.innerHTML; histRef.current = { stack: [html], idx: 0 };
  }

  return () => { document.removeEventListener('keydown', onKeyDownDoc); prevFocusRef.current?.focus?.(); };
}, [open, draftKey, initialHtml]);

  useEffect(() => {
    if (!draftKey) return;
    const ed = editorRef.current;
    const save = () => localStorage.setItem(draftKey, JSON.stringify({ value: ed?.innerHTML || "" }));
    const onInput = () => { save(); scheduleHistoryCommit(); };
    const onKeyUp = () => { save(); };
    if (ed) { ed.addEventListener("input", onInput); ed.addEventListener("keyup", onKeyUp); }
    return () => { if (ed) { ed.removeEventListener("input", onInput); ed.removeEventListener("keyup", onKeyUp); } };
  }, [draftKey]);

  useEffect(() => {
    if (!open) return;
    const onSel = () => { captureSelectionIfInside(); updateToolbarStates(); };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, [open]);

  const finalize = () => {
    const html = editorRef.current?.innerHTML || "";
    onSave(sanitizeHTML(html).trim());
    if (draftKey) localStorage.removeItem(draftKey);
  };
  if (!open) return null;

  return (
    <>
      <div className="modal-backdrop" onClick={onCancel} />
      <div
        className="modal-window" role="dialog" aria-modal="true" aria-labelledby="note-editor-title" ref={modalRef}
        style={{ left: pos.left, top: pos.top }}
        onMouseMove={(e) => {
          if (!dragging.current || !start.current) return;
          setPos({ left: Math.max(24, start.current.left + (e.clientX - start.current.x)), top: Math.max(24, start.current.top + (e.clientY - start.current.y)) });
        }}
        onMouseUp={() => { dragging.current = false; start.current = null; }}
      >
        <div
          className="modal-header"
          onMouseDown={(e) => { dragging.current = true; start.current = { x: e.clientX, y: e.clientY, left: pos.left, top: pos.top }; }}
        >
          <div id="note-editor-title" style={{ fontWeight: 600 }}>Add / Edit Note</div>
          <button onClick={onCancel} title="Close" aria-label="Close note editor"><CloseIcon aria-hidden size={16} /></button>
        </div>

        <div className="modal-body" onKeyDown={onKeyDown}>
          <div className="toolbar" role="toolbar" aria-label="Text formatting">
            <button className={active.b ? "active" : ""} aria-pressed={active.b} onMouseDown={keepFocus} onClick={() => exec("bold")} title="Bold (Ctrl/Cmd+B)"><b>B</b></button>
            <button className={active.i ? "active" : ""} aria-pressed={active.i} onMouseDown={keepFocus} onClick={() => exec("italic")} title="Italic (Ctrl/Cmd+I)"><i>I</i></button>
            <button className={active.u ? "active" : ""} aria-pressed={active.u} onMouseDown={keepFocus} onClick={() => exec("underline")} title="Underline (Ctrl/Cmd+U)"><u>U</u></button>
            <span className="sep" />
            <button onMouseDown={keepFocus} onClick={() => undo()} title="Undo (Ctrl/Cmd+Z)"><Undo2 aria-hidden size={16} /> Undo</button>
            <button onMouseDown={keepFocus} onClick={() => redo()} title="Redo (Ctrl+Y or Cmd/Ctrl+Shift+Z)"><Redo2 aria-hidden size={16} /> Redo</button>
            <span className="sep" />
            {active.link ? (
              <button onMouseDown={keepFocus} onClick={() => unlinkSelection()} title="Remove link"><UnlinkSvg aria-hidden size={16} /> Unlink</button>
            ) : (
              <button onMouseDown={keepFocus} onClick={() => createOrEditLink()} title="Add link…"><LinkSvg aria-hidden size={16} /> Link</button>
            )}
            <span className="sep" />
            <button onMouseDown={keepFocus} onClick={() => pasteAsPlainText()} title="Paste as plain text"><ClipboardPaste aria-hidden size={16} /> Paste as text</button>
          </div>

          <div
            ref={editorRef}
            className="note-editor"
            contentEditable role="textbox" aria-multiline="true" aria-label="Note editor"
            suppressContentEditableWarning
            onPaste={onPaste}
            onDrop={onDrop}
          />
        </div>

        <div className="modal-footer">
          <button onClick={onCancel}>Cancel</button>
          <button className="primary" onMouseDown={(e) => e.preventDefault()} onClick={finalize}>Save note</button>
        </div>
      </div>
    </>
  );
}
