/** Tempo Reader – App.tsx (controls drawer kept, clips dock + overlay drawer added) */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Reader } from "./components/Reader";
import { useTokenizer } from "./lib/useTokenizer";

/* ---------------- Icons (simple placeholders) ---------------- */
const Play = () => <span aria-hidden>▶</span>;
const Pause = () => <span aria-hidden>⏸</span>;
const Upload = () => <span aria-hidden>⬆</span>;
const BookOpenText = () => <span aria-hidden>📖</span>;
const UndoIcon = () => <span aria-hidden>↶</span>;
const RedoIcon = () => <span aria-hidden>↷</span>;
const PasteIcon = () => <span aria-hidden>📋</span>;
const LinkIcon = () => <span aria-hidden>🔗</span>;
const UnlinkIcon = () => <span aria-hidden>⛓️‍✂️</span>;

/* ---------------- Utils & Types ---------------- */
function uuid() {
  try {
    if (globalThis.crypto && "randomUUID" in globalThis.crypto)
      return (globalThis.crypto as any).randomUUID();
  } catch {}
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
type RangeT = { start: number; length: number };
type Clip = {
  id: string;
  start: number;
  length: number;
  snippet: string;
  noteHtml?: string;
  pinned?: boolean;
  createdUtc: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
const stripHtml = (s: string) => s.replace(/<[^>]*>/g, "");
const textByteSize = (s: string) => new Blob([s]).size;

function sentenceRangeAt(tokens: string[], i: number): RangeT {
  const isBoundary = (s: string) => /[.!?]/.test(s);
  let s = 0;
  for (let k = i - 1; k >= 0; k--) {
    if (isBoundary(tokens[k])) {
      s = k + 1;
      break;
    }
  }
  while (s < tokens.length && /^\s+$/.test(tokens[s])) s++;
  let e = tokens.length - 1;
  for (let k = i; k < tokens.length; k++) {
    if (isBoundary(tokens[k])) {
      e = k;
      break;
    }
  }
  return { start: s, length: Math.max(1, e - s + 1) };
}
const isAlphaNum = (t: string) => /\p{L}|\p{N}/u.test(t);
const isJoiner = (t: string) => t === "’" || t === "'" || t === "-" || t === "_";

/* ---------------- Sanitizer ---------------- */
const ALLOW_TAG = new Set(["b", "strong", "i", "em", "u", "a", "p", "ul", "ol", "li", "br"]);
function sanitizeHTML(dirty: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<!doctype html><body>${dirty}`, "text/html");
  function cleanNode(node: Node): Node | null {
    if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent || "");
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (!ALLOW_TAG.has(tag)) return document.createTextNode(el.textContent || "");
    const out = document.createElement(tag);
    if (tag === "a") {
      const href = el.getAttribute("href") || "";
      if (/^https?:|^mailto:|^tel:/i.test(href)) out.setAttribute("href", href);
      out.setAttribute("target", "_blank");
      out.setAttribute("rel", "noopener noreferrer");
    }
    for (const child of Array.from(el.childNodes)) {
      const c = cleanNode(child);
      if (c) out.appendChild(c);
    }
    return out;
  }
  const frag = document.createDocumentFragment();
  for (const child of Array.from(doc.body.childNodes)) {
    const c = cleanNode(child);
    if (c) frag.appendChild(c);
  }
  const div = document.createElement("div");
  div.appendChild(frag);
  return div.innerHTML;
}

/* ---------------- Persistence ---------------- */
type SettingsV1 = {
  wps: number;
  count: number;
  gap: number;
  focusScale: number;
  dimScale: number;
  dimBlur: number;
  fontPx: number;
  dark: boolean;
  drawerOpen: boolean;
};
const K_SETTINGS = "tr:settings:v1";
const K_CLIPS = "tr:clips:v1";
const K_BACKUP = "tr:backup:v1";

const MAX_PASTE_BYTES = 200 * 1024;
const MAX_IMPORT_BYTES = 1024 * 1024;
const MAX_CLIPS = 500;

function loadSettings(): Partial<SettingsV1> | null {
  try {
    return JSON.parse(localStorage.getItem(K_SETTINGS) || "null");
  } catch {
    return null;
  }
}
function saveSettings(s: SettingsV1) {
  try {
    localStorage.setItem(K_SETTINGS, JSON.stringify(s));
  } catch {}
}
function loadClipsRaw(): any[] {
  try {
    const a = JSON.parse(localStorage.getItem(K_CLIPS) || "[]");
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}
function saveClips(list: Clip[]) {
  try {
    localStorage.setItem(K_CLIPS, JSON.stringify(list));
  } catch {}
}
function exportDataFile(payload: { settings: SettingsV1; clips: Clip[] }) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tempo-reader-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function parseImport(json: string): { settings?: Partial<SettingsV1>; clips?: any[] } {
  const data = JSON.parse(json);
  const out: { settings?: Partial<SettingsV1>; clips?: any[] } = {};
  if (data && typeof data === "object") {
    if (data.settings && typeof data.settings === "object") out.settings = data.settings;
    if (Array.isArray(data.clips)) out.clips = data.clips;
  }
  return out;
}
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
function pruneClips(list: Clip[]): Clip[] {
  if (list.length <= MAX_CLIPS) return list;
  const pinned = list.filter((c) => c.pinned);
  const rest = list
    .filter((c) => !c.pinned)
    .sort(
      (a, b) =>
        new Date(b.createdUtc).getTime() - new Date(a.createdUtc).getTime()
    );
  return [...pinned, ...rest].slice(0, MAX_CLIPS);
}
/** MIGRATION: normalize old/raw clip objects */
function migrateClips(list: any[]): Clip[] {
  const arr = Array.isArray(list) ? list : [];
  const nowIso = new Date().toISOString();
  return arr.map((c: any, idx: number) => {
    const id: string =
      typeof c?.id === "string" && c.id
        ? c.id
        : (crypto?.randomUUID ? crypto.randomUUID() : `${nowIso}-${idx}`);
    const start = Math.max(0, Number(c?.start) || 0);
    const length = Math.max(1, Number(c?.length) || 1);
    const snippet = typeof c?.snippet === "string" ? c.snippet : "";
    const pinned = !!c?.pinned;
    const createdUtc =
      typeof c?.createdUtc === "string" && c.createdUtc ? c.createdUtc : nowIso;
    const noteHtml =
      typeof c?.noteHtml === "string" && c.noteHtml
        ? sanitizeHTML(c.noteHtml)
        : undefined;
    return { id, start, length, snippet, noteHtml, pinned, createdUtc };
  });
}

/* ---------------- Sample text ---------------- */
const SAMPLE_TEXT = `Reading isn’t one thing; it is a braid of habits woven together. As eyes move, the mind predicts, discards, and stitches meaning on the fly. Most of this happens below awareness, but our experience of a page changes dramatically when attention is guided.

Focus reading makes that guidance explicit. It gives a gentle nudge to where your attention should settle next, then steps out of the way. The rhythm matters: too fast and comprehension collapses; too slow and your mind wanders off the line.

Clips are memory anchors. When you highlight a passage and jot a quick note, you are leaving a breadcrumb for your future self. The value of a clip is rarely the text alone; it’s the thought you attach to it.

Try jumping between clips and let your eyes glide. Notice how the sentence structure becomes more obvious when the clutter fades. This is where reading feels less like scanning and more like following a current.`;

/* ---------------- Note Editor Modal (full) ---------------- */
function NoteEditorModal(props: {
  open: boolean;
  draftKey?: string;
  initialHtml?: string;
  onSave: (html: string) => void;
  onCancel: () => void;
}) {
  const { open, draftKey, initialHtml, onSave, onCancel } = props;
  const [pos, setPos] = useState<{ left: number; top: number }>({
    left: 160,
    top: 120,
  });
  const dragging = useRef(false);
  const start = useRef<{ x: number; y: number; left: number; top: number } | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<{ b: boolean; i: boolean; u: boolean; link: boolean }>({
    b: false,
    i: false,
    u: false,
    link: false,
  });
  const lastRangeRef = useRef<Range | null>(null);
  const histRef = useRef<{ stack: string[]; idx: number }>({ stack: [], idx: -1 });
  const histTimer = useRef<number | null>(null);

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
    const sel = document.getSelection(),
      root = editorRef.current;
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
      b:
        typeof document.queryCommandState === "function"
          ? document.queryCommandState("bold")
          : false,
      i:
        typeof document.queryCommandState === "function"
          ? document.queryCommandState("italic")
          : false,
      u:
        typeof document.queryCommandState === "function"
          ? document.queryCommandState("underline")
          : false,
      link: withinTag("a"),
    });
  }
  function captureSelectionIfInside() {
    const ed = editorRef.current;
    if (!ed) return;
    const sel = document.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const r = sel.getRangeAt(0);
    if (ed.contains(r.startContainer) && ed.contains(r.endContainer)) {
      lastRangeRef.current = r.cloneRange();
    }
  }
  function restoreSelection() {
    const ed = editorRef.current;
    if (!ed) return;
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    if (lastRangeRef.current) sel.addRange(lastRangeRef.current);
    else {
      const range = document.createRange();
      range.selectNodeContents(ed);
      range.collapse(false);
      sel.addRange(range);
    }
  }
  function pushHistorySnapshot(force = false) {
    const ed = editorRef.current;
    if (!ed) return;
    const html = ed.innerHTML;
    const { stack, idx } = histRef.current;
    if (!force && stack[idx] === html) return;
    if (idx < stack.length - 1) stack.splice(idx + 1);
    stack.push(html);
    histRef.current.idx = stack.length - 1;
  }
  function scheduleHistoryCommit() {
    if (histTimer.current) cancelAnimationFrame(histTimer.current);
    histTimer.current = requestAnimationFrame(() => pushHistorySnapshot(false));
  }
  function applyHtml(html: string) {
    const ed = editorRef.current;
    if (!ed) return;
    ed.innerHTML = html || "<p><br></p>";
    const range = document.createRange();
    range.selectNodeContents(ed);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    updateToolbarStates();
  }
  function undo() {
    const h = histRef.current;
    if (h.idx > 0) {
      h.idx--;
      applyHtml(h.stack[h.idx]);
    }
  }
  function redo() {
    const h = histRef.current;
    if (h.idx < h.stack.length - 1) {
      h.idx++;
      applyHtml(h.stack[h.idx]);
    }
  }
  function exec(cmd: string, value?: string) {
    const ed = editorRef.current;
    if (!ed) return;
    ed.focus();
    restoreSelection();
    try {
      if (typeof document.execCommand === "function")
        document.execCommand(cmd, false, value);
    } catch (e) {
      console.warn("execCommand failed", cmd, e);
    }
    updateToolbarStates();
    scheduleHistoryCommit();
  }
  function normalizeHref(input: string): string | null {
    let href = input.trim();
    if (!href) return null;
    if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(href) || /^www\./i.test(href)) {
      href = href.replace(/^www\./i, "");
      href = "https://" + href;
    }
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(href)) href = "mailto:" + href;
    if (/^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/i.test(href)) return href;
    if (/^tel:\+?[0-9()[\]\-\s]{3,}$/.test(href)) return href;
    if (/^https?:\/\/.+/i.test(href)) {
      try {
        const u = new URL(href);
        if (!u.hostname) return null;
        return u.toString();
      } catch {
        return null;
      }
    }
    return null;
  }
  function fixupAllAnchors(ed: HTMLElement) {
    ed.querySelectorAll("a").forEach((a) => {
      const href = a.getAttribute("href") || "";
      if (!/^https?:|^mailto:|^tel:/i.test(href)) {
        const span = document.createElement("span");
        span.textContent = a.textContent || "";
        a.replaceWith(span);
      } else {
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener noreferrer");
      }
    });
  }
  function createOrEditLink() {
    const ed = editorRef.current;
    if (!ed) return;
    ed.focus();
    restoreSelection();
    const selectedAnchor = getAnchorInSelection();
    const currentHref = selectedAnchor?.getAttribute("href") || "";
    const input = window.prompt("Enter URL (https://, http://, mailto:, or tel:)", currentHref);
    if (input == null) return;
    const href = normalizeHref(input);
    if (!href) {
      alert("Invalid URL. Use https://, http://, mailto:, or tel:.");
      return;
    }
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && sel.getRangeAt(0).collapsed) {
      const zwsp = document.createTextNode("\u200B");
      const r = sel.getRangeAt(0);
      r.insertNode(zwsp);
      sel.removeAllRanges();
      const nr = document.createRange();
      nr.setStartBefore(zwsp);
      nr.setEndAfter(zwsp);
      sel.addRange(nr);
    }
    try {
      if (typeof document.execCommand === "function")
        document.execCommand("createLink", false, href);
    } catch (e) {
      console.warn("createLink failed", e);
    }
    if (editorRef.current) fixupAllAnchors(editorRef.current);
    updateToolbarStates();
    pushHistorySnapshot(true);
  }
  function unlinkSelection() {
    const ed = editorRef.current;
    if (!ed) return;
    ed.focus();
    restoreSelection();
    try {
      if (typeof document.execCommand === "function") document.execCommand("unlink");
    } catch (e) {
      console.warn("unlink failed", e);
    }
    updateToolbarStates();
    pushHistorySnapshot(true);
  }
  function normalizeOfficeHtml(html: string): string {
    html = html.replace(/<!--\[if[\s\S]*?endif\]-->/gi, "");
    html = html.replace(/class="?Mso[a-zA-Z0-9]*"?/g, "");
    html = html.replace(/style="[^"]*mso-[^";]*;?[^"]*"/gi, "");
    html = html.replace(/<o:p>\s*<\/o:p>/gi, "");
    html = html.replace(/<o:p>.*?<\/o:p>/gi, "");
    return html;
  }
  function textToHtmlParagraphs(text: string): string {
    const paras = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
    const html = paras
      .map((p) => {
        const safe = p
          .split("\n")
          .map((line) =>
            line
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#39;")
          )
          .join("<br>");
        return `<p>${safe}</p>`;
      })
      .join("");
    return html || "<p></p>";
  }
  function insertSanitizedHtml(html: string) {
    const ed = editorRef.current;
    if (!ed) return;
    ed.focus();
    restoreSelection();
    const safe = sanitizeHTML(html);
    const ok =
      document.queryCommandSupported &&
      document.queryCommandSupported("insertHTML");
    if (ok) {
      try {
        document.execCommand("insertHTML", false, safe);
      } catch (e) {
        console.warn("insertHTML failed; falling back", e);
      }
    } else {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const frag = range.createContextualFragment(safe);
      range.insertNode(frag);
      const r = document.createRange();
      r.selectNodeContents(ed);
      r.collapse(false);
      sel.removeAllRanges();
      sel.addRange(r);
    }
    if (editorRef.current) fixupAllAnchors(editorRef.current);
    updateToolbarStates();
    pushHistorySnapshot(true);
  }
  const onPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const dt = e.clipboardData;
    const html = dt?.getData("text/html");
    const text = dt?.getData("text/plain");
    const candidate = html ? normalizeOfficeHtml(html) : text ? textToHtmlParagraphs(text) : "";
    if (!candidate) return;
    if (textByteSize(candidate) > MAX_PASTE_BYTES) {
      alert("That paste is quite large. Only the first ~200KB will be inserted.");
      let trimmed = candidate.slice(0, Math.min(candidate.length, MAX_PASTE_BYTES));
      while (textByteSize(trimmed) > MAX_PASTE_BYTES) {
        trimmed = trimmed.slice(0, Math.floor(trimmed.length * 0.9));
      }
      insertSanitizedHtml(trimmed);
    } else {
      insertSanitizedHtml(candidate);
    }
  };
  async function pasteAsPlainText() {
    try {
      const txt = await navigator.clipboard.readText();
      if (txt != null) {
        let html = textToHtmlParagraphs(txt);
        if (textByteSize(html) > MAX_PASTE_BYTES) {
          alert("That paste is quite large. Only the first ~200KB will be inserted.");
          while (textByteSize(html) > MAX_PASTE_BYTES)
            html = html.slice(0, Math.floor(html.length * 0.9));
        }
        insertSanitizedHtml(html);
      }
    } catch {
      const txt = window.prompt("Paste here, then press OK:", "");
      if (txt != null) insertSanitizedHtml(textToHtmlParagraphs(txt));
    }
  }
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const txt = e.dataTransfer.getData("text/plain");
    if (txt) {
      let html = textToHtmlParagraphs(txt);
      if (textByteSize(html) > MAX_PASTE_BYTES) {
        alert("That paste is quite large. Only the first ~200KB will be inserted.");
        while (textByteSize(html) > MAX_PASTE_BYTES)
          html = html.slice(0, Math.floor(html.length * 0.9));
      }
      insertSanitizedHtml(html);
    }
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
      e.preventDefault();
      undo();
      return;
    }
    if (
      mod &&
      (e.key.toLowerCase() === "y" ||
        (e.key.toLowerCase() === "z" && e.shiftKey))
    ) {
      e.preventDefault();
      redo();
      return;
    }
    if (mod && e.key.toLowerCase() === "b") {
      e.preventDefault();
      exec("bold");
      return;
    }
    if (mod && e.key.toLowerCase() === "i") {
      e.preventDefault();
      exec("italic");
      return;
    }
    if (mod && e.key.toLowerCase() === "u") {
      e.preventDefault();
      exec("underline");
      return;
    }
  };
  const keepFocus = (e: React.MouseEvent) => e.preventDefault();

  useEffect(() => {
    if (!open) return;
    const saved = draftKey ? localStorage.getItem(draftKey) : null;
    if (editorRef.current) {
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as { value: string };
          editorRef.current.innerHTML = parsed.value || "";
        } catch {
          editorRef.current.innerHTML = initialHtml || "";
        }
      } else editorRef.current.innerHTML = initialHtml || "";
      fixupAllAnchors(editorRef.current);
      const html = editorRef.current.innerHTML;
      histRef.current = { stack: [html], idx: 0 };
    }
  }, [open, draftKey, initialHtml]);

  useEffect(() => {
    if (!draftKey) return;
    const ed = editorRef.current;
    const save = () =>
      localStorage.setItem(
        draftKey,
        JSON.stringify({ value: ed?.innerHTML || "" })
      );
    const onInput = () => {
      save();
      scheduleHistoryCommit();
    };
    const onKeyUp = () => {
      save();
    };
    if (ed) {
      ed.addEventListener("input", onInput);
      ed.addEventListener("keyup", onKeyUp);
    }
    return () => {
      if (ed) {
        ed.removeEventListener("input", onInput);
        ed.removeEventListener("keyup", onKeyUp);
      }
    };
  }, [draftKey]);

  useEffect(() => {
    if (!open) return;
    const onSel = () => {
      captureSelectionIfInside();
      updateToolbarStates();
    };
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
        className="modal-window"
        style={{ left: pos.left, top: pos.top }}
        onMouseMove={(e) => {
          if (!dragging.current || !start.current) return;
          setPos({
            left: Math.max(24, start.current.left + (e.clientX - start.current.x)),
            top: Math.max(24, start.current.top + (e.clientY - start.current.y)),
          });
        }}
        onMouseUp={() => {
          dragging.current = false;
          start.current = null;
        }}
      >
        <div
          className="modal-header"
          onMouseDown={(e) => {
            dragging.current = true;
            start.current = { x: e.clientX, y: e.clientY, left: pos.left, top: pos.top };
          }}
        >
          <div style={{ fontWeight: 600 }}>Add / Edit Note</div>
          <button onClick={onCancel} title="Close">
            ✖
          </button>
        </div>

        <div className="modal-body" onKeyDown={onKeyDown}>
          <div className="toolbar">
            <button
              className={active.b ? "active" : ""}
              onMouseDown={keepFocus}
              onClick={() => exec("bold")}
              title="Bold (Ctrl/Cmd+B)"
            >
              <b>B</b>
            </button>
            <button
              className={active.i ? "active" : ""}
              onMouseDown={keepFocus}
              onClick={() => exec("italic")}
              title="Italic (Ctrl/Cmd+I)"
            >
              <i>I</i>
            </button>
            <button
              className={active.u ? "active" : ""}
              onMouseDown={keepFocus}
              onClick={() => exec("underline")}
              title="Underline (Ctrl/Cmd+U)"
            >
              <u>U</u>
            </button>
            <span className="sep" />
            <button
              onMouseDown={keepFocus}
              onClick={() => undo()}
              title="Undo (Ctrl/Cmd+Z)"
            >
              <UndoIcon /> Undo
            </button>
            <button
              onMouseDown={keepFocus}
              onClick={() => redo()}
              title="Redo (Ctrl+Y or Cmd/Ctrl+Shift+Z)"
            >
              <RedoIcon /> Redo
            </button>
            <span className="sep" />
            {active.link ? (
              <button
                onMouseDown={keepFocus}
                onClick={() => unlinkSelection()}
                title="Remove link"
              >
                <UnlinkIcon /> Unlink
              </button>
            ) : (
              <button
                onMouseDown={keepFocus}
                onClick={() => createOrEditLink()}
                title="Add link…"
              >
                <LinkIcon /> Link
              </button>
            )}
            <span className="sep" />
            <button
              onMouseDown={keepFocus}
              onClick={() => pasteAsPlainText()}
              title="Paste as plain text"
            >
              <PasteIcon /> Paste as text
            </button>
          </div>

          <div
            ref={editorRef}
            className="note-editor"
            contentEditable
            suppressContentEditableWarning
            onPaste={onPaste}
            onDrop={onDrop}
          />
        </div>

        <div className="modal-footer">
          <button onClick={onCancel}>Cancel</button>
          <button
            className="primary"
            onMouseDown={(e) => e.preventDefault()}
            onClick={finalize}
          >
            Save note
          </button>
        </div>
      </div>
    </>
  );
}

/* ============================== App ============================== */
export default function App() {
  /* ------- PWA install + online status ------- */
  const deferredPromptRef = useRef<any>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const onBIP = (e: any) => {
      e.preventDefault();
      deferredPromptRef.current = e;
      setCanInstall(true);
    };
    const onInstalled = () => setCanInstall(false);
    const goOnline = () => setOffline(false),
      goOffline = () => setOffline(true);
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);
  const doInstall = async () => {
    const ev = deferredPromptRef.current;
    if (!ev) return;
    ev.prompt();
    try {
      await ev.userChoice;
    } catch {}
    deferredPromptRef.current = null;
    setCanInstall(false);
  };

  /* ------- Reader text + tokenization ------- */
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

  /* ------- Playback ------- */
  const [wIndex, setWIndex] = useState(0);
  const [count, setCount] = useState(3);
  const [wps, setWps] = useState(1.5);
  const [playing, setPlaying] = useState(false);

  /* ------- Reader styling vars ------- */
  const [gap, setGap] = useState(0.2);
  const [focusScale, setFocusScale] = useState(1.18);
  const [dimScale, setDimScale] = useState(0.96);
  const [dimBlur, setDimBlur] = useState(0.8);
  const [fontPx, setFontPx] = useState(20);

  /* ------- Theme ------- */
  const [dark, setDark] = useState<boolean>(() => {
    const saved = localStorage.getItem("theme:dark");
    if (saved != null) return saved === "1";
    return (
      window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
    );
  });
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    localStorage.setItem("theme:dark", dark ? "1" : "0");
  }, [dark]);

  /* ------- Left controls drawer ------- */
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerWidth = 320,
    drawerGap = 12;
  const drawerOffset = drawerOpen ? drawerWidth + drawerGap : 0;

  // hover-scroll + auto-close after idle
  const drawerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastMouseY = useRef<number>(0);
  const stepAutoScroll = () => {
    const el = drawerRef.current;
    if (!el) {
      rafRef.current = null;
      return;
    }
    const rect = el.getBoundingClientRect(),
      y = lastMouseY.current;
    const Z = 120,
      MIN = 0.8,
      MAX = 3.2;
    let dy = 0;
    const dTop = y - rect.top,
      dBottom = rect.bottom - y;
    if (dTop >= 0 && dTop <= Z) {
      const t = 1 - dTop / Z;
      dy = -(MIN + (MAX - MIN) * t);
    } else if (dBottom >= 0 && dBottom <= Z) {
      const t = 1 - dBottom / Z;
      dy = MIN + (MAX - MIN) * t;
    }
    if (dy !== 0) {
      el.scrollTop += dy;
      rafRef.current = requestAnimationFrame(stepAutoScroll);
    } else {
      rafRef.current = null;
    }
  };
  useEffect(() => {
    if (!drawerOpen) return;
    let timer: number | null = null;
    const reset = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => setDrawerOpen(false), 20000);
    };
    reset();
    const el = drawerRef.current || document;
    const handler = () => reset();
    const events: (keyof DocumentEventMap)[] = [
      "mousemove",
      "mousedown",
      "wheel",
      "keydown",
      "touchstart",
    ];
    events.forEach((ev) =>
      el.addEventListener(ev, handler as any, { passive: true } as any)
    );
    return () => {
      if (timer) window.clearTimeout(timer);
      events.forEach((ev) => el.removeEventListener(ev, handler as any));
    };
  }, [drawerOpen]);

  /* ------- Reader/clips area sizing (baseline) ------- */
  const [readerRatio, setReaderRatio] = useState(0.7);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  useEffect(() => {
    function onMove(ev: MouseEvent) {
      if (!draggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const y = ev.clientY - rect.top;
      const ratio = clamp(y / rect.height, 0.3, 0.85);
      setReaderRatio(ratio);
    }
    function onUp() {
      draggingRef.current = false;
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  /* ------- Reader click/selection events ------- */
  useEffect(() => {
    const onToggle = () => setPlaying((p) => !p);
    const onPause = () => setPlaying(false);
    window.addEventListener("tempo:toggle", onToggle);
    window.addEventListener("tempo:pause", onPause);
    return () => {
      window.removeEventListener("tempo:toggle", onToggle);
      window.removeEventListener("tempo:pause", onPause);
    };
  }, []);

  /* ------- Persist settings & clips ------- */
  const [clips, setClips] = useState<Clip[]>([]);
  const [hoverRange, setHoverRange] = useState<RangeT | null>(null);
  const [aidRange, setAidRange] = useState<RangeT | null>(null);
  const [aidAuto, setAidAuto] = useState(false);
  const [currentSelection, setCurrentSelection] = useState<RangeT | null>(null);

  useEffect(() => {
    const s = loadSettings() || {};
    const c = { ...s };
    const sc = (p: any, k: string, f: (v: any) => void) => {
      if (p[k] != null) f(p[k]);
    };
    sc(c, "wps", (v) => setWps(clamp(Number(v), 0.5, 3)));
    sc(c, "count", (v) => setCount(clamp(Number(v), 1, 7)));
    sc(c, "gap", (v) => setGap(clamp(Number(v), 0.2, 0.8)));
    sc(c, "focusScale", (v) => setFocusScale(clamp(Number(v), 1.0, 1.6)));
    sc(c, "dimScale", (v) => setDimScale(clamp(Number(v), 0.85, 1.0)));
    sc(c, "dimBlur", (v) => setDimBlur(clamp(Number(v), 0, 2.5)));
    sc(c, "fontPx", (v) => setFontPx(clamp(Number(v), 16, 28)));
    sc(c, "dark", (v) => setDark(!!v));
    sc(c, "drawerOpen", (v) => setDrawerOpen(!!v));
    const raw = loadClipsRaw();
    if (raw?.length) setClips(pruneClips(migrateClips(raw)));
  }, []);
  useEffect(() => {
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
    saveSettings(settings);
  }, [wps, count, gap, focusScale, dimScale, dimBlur, fontPx, dark, drawerOpen]);
  useEffect(() => {
    saveClips(clips);
  }, [clips]);

  /* ------- Auto-backup on unload ------- */
  const backupRef = useRef<{ settings: SettingsV1; clips: Clip[] } | null>(null);
  useEffect(() => {
    backupRef.current = {
      settings: { wps, count, gap, focusScale, dimScale, dimBlur, fontPx, dark, drawerOpen },
      clips,
    };
  }, [wps, count, gap, focusScale, dimScale, dimBlur, fontPx, dark, drawerOpen, clips]);
  useEffect(() => {
    const doBackup = () => {
      try {
        const data = backupRef.current;
        if (!data) return;
        localStorage.setItem(K_BACKUP, JSON.stringify({ ts: Date.now(), ...data }));
      } catch {}
    };
    const onBeforeUnload = () => {
      doBackup();
    };
    const onPageHide = () => {
      doBackup();
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") doBackup();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

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
        setWIndex((i) => Math.min(i + jump, Math.max(0, wordIdxData.count - 1)));
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, wps, count, wordIdxData.count]);

  /* ------- Import / Export ------- */
  const onFile = useCallback(async (file: File) => {
    if (file.size > 4 * 1024 * 1024) alert("This file is quite large (>4MB). It may feel slow.");
    const ext = file.name.toLowerCase().split(".").pop();
    const raw = await file.text();
    let clean = raw;
    if (ext === "html" || ext === "htm") {
      const parser = new DOMParser();
      const doc = parser.parseFromString(raw, "text/html");
      clean = doc.body.innerText;
    }
    setText(clean);
  }, []);
  const doExport = () => {
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
  };
  const onImportJson = async (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      alert("That JSON is larger than 1MB. Please split it or trim some clips.");
      return;
    }
    try {
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
      if (data.clips) setClips(pruneClips(migrateClips(data.clips)));
      alert("Import complete.");
    } catch (e: any) {
      alert("Import failed: " + (e?.message || String(e)));
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
          pruneClips(
            prev.map((c) =>
              c.id === editingClipId ? { ...c, noteHtml: empty ? undefined : safe } : c
            )
          )
        );
        setEditingClipId(null);
        setNoteOpen(false);
        setHoverRange(null);
        if (!aidAuto) setAidRange(null);
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
      };
      setClips((prev) => pruneClips([newClip, ...prev]));
      setPendingRange(null);
      setNoteOpen(false);
      setHoverRange(null);
      if (!aidAuto) setAidRange(null);
    },
    [editingClipId, pendingRange, tokens, aidAuto]
  );
  const togglePin = (id: string) =>
    setClips((prev) => prev.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)));
  const deleteClip = (id: string) => {
    setClips((prev) => prev.filter((c) => c.id !== id));
    setHoverRange(null);
    if (!aidAuto) setAidRange(null);
  };
  const moveClip = (id: string, dir: -1 | 1) =>
    setClips((prev) => {
      const ix = prev.findIndex((c) => c.id === id);
      if (ix < 0) return prev;
      const jx = ix + dir;
      if (jx < 0 || jx >= prev.length) return prev;
      const next = prev.slice();
      const [item] = next.splice(ix, 1);
      next.splice(jx, 0, item);
      return next;
    });
  const [editRangeForId, setEditRangeForId] = useState<string | null>(null);
  const beginEditRange = (id: string) => {
    setEditRangeForId(id);
    setCurrentSelection(null);
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
    setHoverRange(null);
  };

  /* ------- Filtered clips ------- */
  const [query, setQuery] = useState("");
  const filteredClips = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? clips.filter(
          (c) =>
            c.snippet.toLowerCase().includes(q) ||
            (c.noteHtml && stripHtml(c.noteHtml).toLowerCase().includes(q))
        )
      : clips.slice();
    const withPos = list.map((c) => ({ c, pos: clips.indexOf(c) }));
    withPos.sort((A, B) => Number(B.c.pinned) - Number(A.c.pinned) || A.pos - B.pos);
    return withPos.map((x) => x.c);
  }, [clips, query]);

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
    height: `calc(${(readerRatio * 100).toFixed(2)}% - 4px)`,
    fontSize: `${fontPx}px`,
    ["--word-gap"]: `${computedGapEm}em`,
    ["--scale-focus"]: String(focusScale),
    ["--scale-dim"]: String(dimScale),
    ["--dim-blur"]: `${dimBlur}px`,
    paddingBottom: `${64 + 12}px`, // space for dock when collapsed
  };

  /* ------- Keyboard shortcuts ------- */
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
        setPlaying((p) => !p);
      } else if (e.key.toLowerCase() === "c") {
        e.preventDefault();
        const tokenStart = focusTokenStart;
        const range = currentSelection
          ? currentSelection
          : aidAuto
          ? sentenceRangeAt(tokens, tokenStart)
          : focusRange;
        setPendingRange(range);
        setEditingClipId(null);
        setNoteOpen(true);
      } else if ((e.altKey || e.metaKey) && e.key.toLowerCase() === "c") {
        e.preventDefault();
        setPlaying(false);
        setClipsExpanded((v) => !v);
      } else if (e.key === "Escape") {
        setAidRange(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [noteOpen, currentSelection, aidAuto, tokens, focusRange, focusTokenStart]);

  /* ------- Clips dock + overlay drawer ------- */
  const [clipsExpanded, setClipsExpanded] = useState(false);
  const dockH = 64;
  const topChips = useMemo(() => {
    const pinned = clips.filter((c) => c.pinned);
    const others = clips.filter((c) => !c.pinned);
    const src = [...pinned, ...others];
    return src.slice(0, 2);
  }, [clips]);

  /* ============================ Render ============================ */
  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur bg-sepia-50/80 border-b border-sepia-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <BookOpenText />
          <h1 className="text-xl font-semibold mr-3">Tempo Reader (Web)</h1>

          <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-sepia-200 bg-white/70 hover:bg-white transition cursor-pointer ml-2">
            <Upload />
            <span className="text-sm">Open .txt / .html</span>
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

          <div className="ml-auto flex items-center gap-2">
            {offline && (
              <span className="px-2 py-1 rounded-lg bg-amber-200 text-amber-900 text-xs border border-amber-300">
                Offline
              </span>
            )}
            {canInstall && (
              <button
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-sepia-300 bg-white/70 hover:bg-white"
                onClick={doInstall}
                title="Install this app"
              >
                ➕ Install
              </button>
            )}
            <button
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sepia-800 text-white hover:bg-sepia-700 active:scale-[.99] transition disabled:opacity-50"
              onClick={() => setPlaying((p) => !p)}
              disabled={wordIdxData.count === 0}
              title="Space"
            >
              {playing ? <Pause /> : <Play />}
              <span className="text-sm">{playing ? "Pause" : "Play"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Left Controls Drawer (full content preserved) */}
      <button
        className={`drawer-toggle-fab ${drawerOpen ? "open" : ""}`}
        onClick={() => setDrawerOpen((o) => !o)}
        aria-label="Toggle controls"
        style={{ left: `${drawerOffset}px` }}
      >
        <span className="fab-icon">
          <span className="bar" />
        </span>
        <span className="fab-text">Controls</span>
      </button>
      <aside
        className={`drawer-left ${drawerOpen ? "open" : ""}`}
        ref={drawerRef}
        style={{ overflowY: "auto", maxHeight: "100vh" }}
        onWheel={(e) => {
          e.stopPropagation();
        }}
        onMouseMove={(e) => {
          lastMouseY.current = e.clientY;
          if (!rafRef.current) rafRef.current = requestAnimationFrame(stepAutoScroll);
        }}
        onMouseEnter={(e) => {
          lastMouseY.current = e.clientY;
          if (!rafRef.current) rafRef.current = requestAnimationFrame(stepAutoScroll);
        }}
        onMouseLeave={() => {
          if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
          }
        }}
      >
        <div className="text-sm font-semibold mb-2">Reader controls</div>

        <div className="my-3">
          <div className="text-xs text-sepia-700 mb-1">
            ⏱ Tempo (words/sec): {wps.toFixed(1)}
          </div>
          <input
            type="range"
            min={0.5}
            max={3}
            step={0.1}
            value={wps}
            onChange={(e) => setWps(parseFloat(e.target.value))}
          />
        </div>

        <div className="my-3">
          <div className="text-xs text-sepia-700 mb-1">🔤 Words shown: {count}</div>
          <input
            type="range"
            min={1}
            max={7}
            step={1}
            value={count}
            onChange={(e) => setCount(clamp(parseInt(e.target.value, 10), 1, 7))}
          />
        </div>

        <div className="my-3">
          <div className="text-xs text-sepia-700 mb-1">
            ↔️ Text spacing: {gap.toFixed(2)}em
          </div>
          <input
            type="range"
            min={0.2}
            max={0.8}
            step={0.01}
            value={gap}
            onChange={(e) => setGap(parseFloat(e.target.value))}
          />
        </div>

        <div className="my-3">
          <div className="text-xs text-sepia-700 mb-1">
            🔎 In-focus size: {focusScale.toFixed(2)}×
          </div>
          <input
            type="range"
            min={1.0}
            max={1.6}
            step={0.01}
            value={focusScale}
            onChange={(e) => setFocusScale(parseFloat(e.target.value))}
          />
        </div>

        <div className="my-3">
          <div className="text-xs text-sepia-700 mb-1">
            🧘 Out-of-focus size: {dimScale.toFixed(2)}×
          </div>
          <input
            type="range"
            min={0.85}
            max={1.0}
            step={0.01}
            value={dimScale}
            onChange={(e) => setDimScale(parseFloat(e.target.value))}
          />
        </div>

        <div className="my-3">
          <div className="text-xs text-sepia-700 mb-1">
            🌫 Out-of-focus blur: {dimBlur.toFixed(2)}px
          </div>
          <input
            type="range"
            min={0}
            max={2.5}
            step={0.1}
            value={dimBlur}
            onChange={(e) => setDimBlur(parseFloat(e.target.value))}
          />
        </div>

        <div className="my-3">
          <div className="text-xs text-sepia-700 mb-1">🔠 Text size: {fontPx}px</div>
          <input
            type="range"
            min={16}
            max={28}
            step={1}
            value={fontPx}
            onChange={(e) => setFontPx(parseInt(e.target.value, 10))}
          />
        </div>

        <div className="my-4 border-t border-sepia-200 pt-3">
          <div className="text-sm font-semibold mb-2">Data</div>
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-sepia-200 bg-white/70 hover:bg-white transition cursor-pointer">
            ⤴ Import Settings
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => onImportJson(e.target.files?.[0] ?? null)}
            />
          </label>
          <button
            className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-sepia-200 bg-white/70 hover:bg-white transition"
            onClick={doExport}
            title="Export clips + settings"
          >
            ⤵ Export Settings
          </button>
          <div className="text-xs text-sepia-700 mt-2">
            Auto-backup on close is always on.
          </div>
        </div>

        <div className="my-3 flex items-center gap-2">
          <input
            id="aidAuto"
            type="checkbox"
            checked={aidAuto}
            onChange={(e) => {
              setAidAuto(e.target.checked);
              if (!e.target.checked) setAidRange(null);
            }}
          />
          <label htmlFor="aidAuto" className="text-sm">
            Sentence highlight (auto)
          </label>
        </div>

        <div className="my-3 flex items-center gap-2">
          <input
            id="darkmode"
            type="checkbox"
            checked={dark}
            onChange={(e) => setDark(e.target.checked)}
          />
          <label htmlFor="darkmode" className="text-sm">
            Dark mode
          </label>
        </div>

        <div className="mt-4 text-xs text-sepia-700">
          Shortcuts: <kbd>Space</kbd> play/pause, <kbd>C</kbd> add note,{" "}
          <kbd>Alt/Cmd+C</kbd> open/close clips
        </div>
      </aside>

      {/* Main area */}
      <div className="page-wrap" style={{ ["--drawer-offset" as any]: `${drawerOffset}px` }}>
        <main className="max-w-5xl mx-auto p-4 h-[calc(100vh-64px)] md:h-[calc(100vh-64px)] relative">
          <div ref={containerRef} className="w-full h-full flex flex-col min-h-0">
            <section
              className="reader-scroll relative flex-1 min-h-0 rounded-2xl shadow-sm bg-white p-6 border border-sepia-200 overflow-y-auto scroll-smooth"
              style={{
                ...readerStyle,
                filter: clipsExpanded ? "blur(0.2px)" : undefined,
              }}
            >
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
                onAidRangeChange={setAidRange}
                onSelectionChange={setCurrentSelection}
              />
            </section>

            {/* Resizer keeps baseline ratio feature */}
            <div
              className="resizer"
              onMouseDown={(e) => {
                e.preventDefault();
                (draggingRef as any).current = true;
              }}
              title="Drag to resize"
            />
          </div>

          {/* ---- CLIPS DOCK (overlay, always visible at bottom) ---- */}
          <div
            className="fixed z-30 bottom-0 right-0 left-0"
            style={{ left: `${drawerOffset}px`, height: "64px" }}
          >
            <div className="mx-auto max-w-5xl px-4">
              <div className="rounded-t-2xl border border-sepia-200 bg-white/80 backdrop-blur px-3 py-2 shadow-sm flex items-center gap-3">
                <button
                  className="px-3 py-1.5 text-sm rounded-lg border border-sepia-300 bg-white hover:bg-sepia-50"
                  onClick={() => {
                    setPlaying(false);
                    setClipsExpanded(true);
                  }}
                  title="Alt/Cmd+C"
                >
                  ▲ Clips
                </button>

                {topChips.length === 0 ? (
                  <div className="text-xs text-sepia-700">
                    No clips yet. Select text → right click → “Add clip”.
                  </div>
                ) : (
                  <div className="flex items-center gap-2 overflow-x-auto">
                    {topChips.map((c) => (
                      <button
                        key={c.id}
                        className="px-2.5 py-1.5 text-xs rounded-xl border border-sepia-300 bg-white hover:bg-sepia-50"
                        onClick={() => {
                          setWIndex(wordIndexFromToken(c.start));
                          setClipsExpanded(false);
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

          {/* ---- CLIPS DRAWER (overlay) ---- */}
          {clipsExpanded && (
            <>
              <div
                className="fixed inset-0 bg-black/30 z-30"
                onClick={() => setClipsExpanded(false)}
              />
              <div
                className="fixed z-40 bottom-0 right-0 left-0"
                style={{ left: `${drawerOffset}px`, height: "60vh" }}
              >
                <div className="mx-auto max-w-5xl h-full px-4">
                  <div className="rounded-t-2xl border border-sepia-200 bg-white backdrop-blur h-full shadow-lg flex flex-col">
                    {/* Header */}
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
                          onClick={() => setClipsExpanded(false)}
                        >
                          Close
                        </button>
                      </div>
                    </div>

                    {/* Edit-range hint */}
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
                          onClick={() => setEditRangeForId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    {/* List */}
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
                              className="clip-card p-3 rounded-xl border border-sepia-200 hover:bg-sepia-50"
                              onMouseEnter={() =>
                                setHoverRange({ start: c.start, length: c.length })
                              }
                              onMouseLeave={() => setHoverRange(null)}
                            >
                              <div className="clip-actions">
                                <button onClick={() => togglePin(c.id)}>
                                  {c.pinned ? "Unpin" : "Pin"}
                                </button>
                                <button onClick={() => moveClip(c.id, -1)}>▲</button>
                                <button onClick={() => moveClip(c.id, 1)}>▼</button>
                                <button
                                  onClick={() => {
                                    setWIndex(wordIndexFromToken(c.start));
                                    setClipsExpanded(false);
                                  }}
                                >
                                  Go to text
                                </button>
                                <button onClick={() => beginEditRange(c.id)}>
                                  Edit range
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingClipId(c.id);
                                    setNoteOpen(true);
                                  }}
                                >
                                  {c.noteHtml ? "Edit note" : "Add note"}
                                </button>
                                <button onClick={() => deleteClip(c.id)}>Delete</button>
                              </div>

                              <div className="text-sm">
                                <span className="text-sepia-700">Snippet:</span>{" "}
                                <span className="font-medium">
                                  {c.snippet.slice(0, 280)}
                                  {c.snippet.length > 280 ? "…" : ""}
                                </span>
                                {c.pinned && (
                                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full border border-sepia-200">
                                    Pinned
                                  </span>
                                )}
                              </div>

                              {c.noteHtml && (
                                <div className="text-sm mt-2">
                                  <span className="text-sepia-700">Note:</span>{" "}
                                  <span
                                    dangerouslySetInnerHTML={{
                                      __html: sanitizeHTML(c.noteHtml),
                                    }}
                                  />
                                </div>
                              )}

                              <div className="text-xs text-sepia-700 mt-1">
                                {new Date(c.createdUtc).toLocaleString()}
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
        </main>

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
      </div>
    </>
  );
}
