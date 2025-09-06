import { useMemo } from "react";
import type { WordIndexData } from "./useWordNavigation";

export function useFocusRange(wIndex: number, count: number, wordIdxData: WordIndexData) {
  return useMemo(() => {
    const start = wordIdxData.starts[Math.max(0, Math.min(wIndex, wordIdxData.count - 1))] ?? 0;
    const endWord = Math.min(wIndex + count - 1, wordIdxData.count - 1);
    const end = wordIdxData.ends[Math.max(0, Math.min(endWord, wordIdxData.count - 1))] ?? start;
    return { start, length: Math.max(1, end - start + 1) };
  }, [wIndex, count, wordIdxData]);
}

