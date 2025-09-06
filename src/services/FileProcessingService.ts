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
  const lines: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const text = (tc.items || []).map((it: any) => (it.str ?? '')).join(' ');
    lines.push(text.trim());
  }
  return lines.join('\n\n');
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
