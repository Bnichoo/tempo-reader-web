import type { Clip } from "../types";
import { sanitizeHTML } from "./sanitize";

/** Generate and download a PDF of clips. Dynamically imports jsPDF to keep main bundle lean. */
export async function exportClipsPdf(clips: Clip[], opts?: { filename?: string }) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  const nowStr = new Date().toLocaleString();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  const header = `Tempo Reader — Clips Export (${nowStr})`;
  doc.text(doc.splitTextToSize(header, maxWidth), margin, y);
  y += 22;

  for (const c of clips) {
    // Note (bold)
    if (c.noteHtml) {
      const noteText = sanitizeHTML(c.noteHtml).replace(/<[^>]*>/g, "");
      if (noteText.trim().length > 0) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        const lines = doc.splitTextToSize(noteText, maxWidth);
        for (const line of lines) {
          if (y > pageHeight - margin) { doc.addPage(); y = margin; }
          doc.text(line as string, margin, y);
          y += 16;
        }
      }
    }
    // Quote (italic with proper quotes)
    const quote = `“${(c.snippet || "").replace(/\s+/g, " ").trim()}”`;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(11);
    const qLines = doc.splitTextToSize(quote, maxWidth);
    for (const line of qLines) {
      if (y > pageHeight - margin) { doc.addPage(); y = margin; }
      doc.text(line as string, margin, y);
      y += 14;
    }
    // Date + pinned
    const meta = `${new Date(c.createdUtc).toLocaleString()}${c.pinned ? "  • Pinned" : ""}`;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    if (y > pageHeight - margin) { doc.addPage(); y = margin; }
    doc.text(meta, margin, y);
    y += 18;
    // Divider
    doc.setDrawColor(210);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;
  }
  const safe = (opts?.filename || `tempo-clips-${new Date().toISOString().slice(0,10)}-${clips.length}`).replace(/[^a-z0-9\-_.]/gi, "-");
  doc.save(`${safe}.pdf`);
}

