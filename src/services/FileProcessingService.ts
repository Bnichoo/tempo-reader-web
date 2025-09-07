/**
 * Utilities to process dropped/opened files into plain text suitable for the reader.
 * Baseline support: .txt, .html/.htm (Readability), .pdf (pdf.js), .docx (mammoth)
 */
export async function processFileToText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const ext = name.includes('.') ? name.split('.').pop()! : '';

  // Route by extension; fall back to text()
  if (ext === 'html' || ext === 'htm') {
    const html = await file.text();
    return await extractReadableHtmlToText(html);
  }
  if (ext === 'pdf') {
    return await extractPdfToText(await file.arrayBuffer());
  }
  if (ext === 'docx') {
    return await extractDocxToText(await file.arrayBuffer());
  }
  // Simple text-like formats
  if (ext === 'txt' || ext === 'md' || ext === 'markdown') {
    const raw = await file.text();
    return normalizePlainText(raw);
  }
  // Default: best-effort text()
  return normalizePlainText(await file.text());
}

function normalizePlainText(raw: string): string {
  // Collapse Windows newlines, ensure paragraphs are separated by single blank line
  const unified = raw.replace(/\r\n/g, '\n');
  // Trim trailing whitespace on lines
  return unified.split('\n').map((l) => l.replace(/\s+$/g, '')).join('\n');
}

async function extractDocxToText(ab: ArrayBuffer): Promise<string> {
  // Lazy import browser build to avoid bundling when unused
  const mammoth = await import('mammoth/mammoth.browser');
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: ab }, { convertImage: mammoth.images.inline() });
  return htmlToText(html);
}

async function extractPdfToText(ab: ArrayBuffer): Promise<string> {
  // pdf.js worker wiring for Vite (ESM)
  const pdfjs = await import('pdfjs-dist');
  try {
    const workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
    // Some bundlers require explicit workerSrc
    (pdfjs as any).GlobalWorkerOptions.workerSrc = workerSrc;
  } catch { /* ignore: worker may auto-resolve */ }

  const loadingTask = (pdfjs as any).getDocument({ data: ab });
  const pdf = await loadingTask.promise;
  const pages: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const text = (tc.items || []).map((it: any) => (it.str ?? '')).join(' ');
    pages.push(text.trim());
  }
  // Heuristic: strip repeating headers/footers across pages
  if (pages.length >= 3) {
    const headCounts = new Map<string, number>();
    const footCounts = new Map<string, number>();
    const head = (s: string) => s.slice(0, Math.min(120, Math.max(40, Math.floor(s.length * 0.1)))).replace(/\s+/g, ' ').trim();
    const foot = (s: string) => s.slice(Math.max(0, s.length - 120)).replace(/\s+/g, ' ').trim();
    pages.forEach((s) => { headCounts.set(head(s), (headCounts.get(head(s)) || 0) + 1); footCounts.set(foot(s), (footCounts.get(foot(s)) || 0) + 1); });
    const threshold = Math.max(2, Math.floor(pages.length * 0.6));
    const commonHead = Array.from(headCounts.entries()).find(([, c]) => c >= threshold)?.[0];
    const commonFoot = Array.from(footCounts.entries()).find(([, c]) => c >= threshold)?.[0];
    if (commonHead) {
      for (let i = 0; i < pages.length; i++) pages[i] = pages[i].replace(commonHead, '').trim();
    }
    if (commonFoot) {
      for (let i = 0; i < pages.length; i++) {
        const idx = pages[i].lastIndexOf(commonFoot);
        if (idx > -1) pages[i] = (pages[i].slice(0, idx) + pages[i].slice(idx + commonFoot.length)).trim();
      }
    }
  }
  let text = pages.join('\n\n');
  // Ensure common scholarly headings are on their own paragraphs
  text = text.replace(/\b(Abstract|Introduction|Methods?|Materials and Methods|Results|Discussion|Conclusion|References)\b\s*/g, '\n\n$1\n\n');
  return text;
}

async function extractReadableHtmlToText(html: string): Promise<string> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  try {
    // Prefer Readability when available for article-like content
    const { Readability } = await import('@mozilla/readability');
    const reader = new Readability(doc);
    const article = reader.parse();
    if (article?.content) return htmlToText(article.content);
  } catch {
    // Fallback to body text
  }
  return doc.body?.innerText || '';
}

function htmlToText(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const walker = doc.createTreeWalker(doc.body || doc, NodeFilter.SHOW_TEXT, null);
  const parts: string[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    parts.push((node.textContent || '').replace(/\s+/g, ' ').trim());
  }
  const text = parts.filter(Boolean).join(' ');
  // Insert paragraph breaks where block elements end
  const blocks = Array.from((doc.body || doc).querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote'));
  if (blocks.length) {
    return blocks.map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n\n');
  }
  return text;
}

// --- Import metadata extraction (shared) ---

export type ImportMeta = {
  title: string;
  type: string;
  pages?: number;
  size?: number;
};

/**
 * Best-effort metadata extraction for imported files. Designed to be lightweight and run in-browser.
 */
export async function extractImportMeta(file: File, textSample: string): Promise<ImportMeta> {
  const name = file.name.replace(/\.[^.]+$/, '');
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  let title = name;
  let pages: number | undefined;
  try {
    if (ext === 'pdf') {
      const pdfjs = await import('pdfjs-dist');
      const loadingTask = (pdfjs as any).getDocument({ data: await file.arrayBuffer() });
      const pdf = await loadingTask.promise;
      pages = pdf.numPages;
      try { const md = await pdf.getMetadata(); title = (md?.info?.Title || name) as string; } catch {}
      await pdf.destroy?.();
    } else if (ext === 'html' || ext === 'htm') {
      const html = await file.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      title = (doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || doc.title || name).trim() || name;
    } else if (ext === 'docx') {
      // heuristic: first non-empty line from converted/plain text sample
      const firstLine = (textSample.split('\n').find((l) => l.trim().length > 0) || '').trim();
      if (firstLine) title = firstLine.slice(0, 120);
    } else if (ext === 'md' || ext === 'markdown') {
      const header = textSample.split('\n').find((l) => /^#\s+/.test(l));
      if (header) title = header.replace(/^#\s+/, '').slice(0, 120);
    }
  } catch {}
  return { title, type: ext || file.type || 'unknown', pages, size: file.size };
}
