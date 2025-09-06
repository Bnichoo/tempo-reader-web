import { useMemo } from "react";

export type WordIndexData = { starts: number[]; ends: number[]; count: number };

const isAlphaNum = (t: string) => /\p{L}|\p{N}/u.test(t);
const isJoiner = (t: string) => t === "'" || t === "'" || t === "-" || t === "_";

export function useWordNavigation(tokens: string[]) {
  const wordIdxData = useMemo<WordIndexData>(() => {
    const starts: number[] = [], ends: number[] = [];
    let i = 0;
    while (i < tokens.length) {
      if (!isAlphaNum(tokens[i])) { i++; continue; }
      const start = i; i++;
      while (i < tokens.length) {
        if (isAlphaNum(tokens[i])) { i++; continue; }
        if (isJoiner(tokens[i]) && i + 1 < tokens.length && isAlphaNum(tokens[i + 1])) { i += 2; continue; }
        break;
      }
      starts.push(start); ends.push(i - 1);
    }
    return { starts, ends, count: starts.length };
  }, [tokens]);

  const tokenIndexFromWord = (w: number) => wordIdxData.starts[Math.max(0, Math.min(w, wordIdxData.count - 1))] ?? 0;
  const tokenEndFromWord = (w: number) => wordIdxData.ends[Math.max(0, Math.min(w, wordIdxData.count - 1))] ?? 0;
  const wordIndexFromToken = (ti: number) => {
    const a = wordIdxData.starts; if (!a.length) return 0; let lo = 0, hi = a.length - 1, ans = 0;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (a[m] <= ti) { ans = m; lo = m + 1; } else hi = m - 1; }
    return ans;
  };

  return { wordIdxData, tokenIndexFromWord, tokenEndFromWord, wordIndexFromToken } as const;
}

