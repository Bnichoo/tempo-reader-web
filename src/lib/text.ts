/** Whitespace-only token */
export const isWhitespace = (t: string) => /^\s+$/.test(t);

/** Word token (letters or numbers, Unicode-aware) */
export const isWord = (t: string) => /[\p{L}\p{N}]/u.test(t);

