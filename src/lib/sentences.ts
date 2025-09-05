import type { RangeT } from "../types";

/** Compute the sentence token range containing index i. */
export function sentenceRangeAt(tokens: string[], i: number): RangeT {
  const isBoundary = (s: string) => /[.!?]/.test(s);
  let s = 0;
  for (let k = i - 1; k >= 0; k--) {
    if (isBoundary(tokens[k])) { s = k + 1; break; }
  }
  while (s < tokens.length && /^\s+$/.test(tokens[s])) s++;
  let e = tokens.length - 1;
  for (let k = i; k < tokens.length; k++) {
    if (isBoundary(tokens[k])) { e = k; break; }
  }
  return { start: s, length: Math.max(1, e - s + 1) };
}

