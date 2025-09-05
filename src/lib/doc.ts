export function hashDocId(text: string): string {
  // Simple FNV-1a 32-bit hash for deterministic doc id
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  // include length to reduce trivial collisions
  return `doc-${h.toString(16)}-${text.length}`;
}

export function docDisplayName(text: string): string {
  const firstLine = (text || "").split(/\r?\n/).find(l => l.trim().length > 0) || "Untitled";
  const trimmed = firstLine.trim();
  return trimmed.length > 60 ? trimmed.slice(0, 57) + "…" : trimmed;
}
