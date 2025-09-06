export function uuid(): string {
  try {
    const { crypto } = globalThis as { crypto?: Crypto & { randomUUID?: () => string } };
    if (crypto?.randomUUID) return crypto.randomUUID();
    // Fallback to RFC4122-ish random via getRandomValues if available
    if (crypto && 'getRandomValues' in crypto) {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      // Set bits for version and `clock_seq_hi_and_reserved`
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const b = Array.from(bytes).map((x) => x.toString(16).padStart(2, '0'));
      return `${b[0]}${b[1]}${b[2]}${b[3]}-${b[4]}${b[5]}-${b[6]}${b[7]}-${b[8]}${b[9]}-${b[10]}${b[11]}${b[12]}${b[13]}${b[14]}${b[15]}`;
    }
  } catch { /* ignore: fall back to Math.random */ }
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
