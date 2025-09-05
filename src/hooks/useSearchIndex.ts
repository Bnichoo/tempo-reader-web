import { useMemo } from "react";

export type SearchHit = { tokenIdx: number; snippet: string; prefix: boolean; suffix: boolean };

export function useSearchIndex(tokens: string[]) {
  const index = useMemo(() => {
    const joined = tokens.join("");
    const starts: number[] = new Array(tokens.length);
    let pos = 0;
    for (let i = 0; i < tokens.length; i++) { starts[i] = pos; pos += tokens[i].length; }
    return { joined, starts };
  }, [tokens]);

  function tokenIndexFromChar(charPos: number): number {
    const a = index.starts;
    let lo = 0, hi = a.length - 1, ans = 0;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (a[m] <= charPos) { ans = m; lo = m + 1; } else hi = m - 1; }
    return ans;
  }

  function search(q: string, max = 100): SearchHit[] {
    const term = q.trim().toLowerCase();
    if (term.length < 2) return [];
    const hay = index.joined.toLowerCase();
    const hits: SearchHit[] = [];
    let from = 0;
    while (hits.length < max) {
      const at = hay.indexOf(term, from);
      if (at === -1) break;
      const ti = tokenIndexFromChar(at);
      // build snippet around ti (±60 chars)
      const startChar = Math.max(0, at - 60);
      const endChar = Math.min(index.joined.length, at + term.length + 60);
      const snippet = index.joined.slice(startChar, endChar);
      const prefix = startChar > 0;
      const suffix = endChar < index.joined.length;
      hits.push({ tokenIdx: ti, snippet, prefix, suffix });
      from = at + term.length;
    }
    return hits;
  }

  return { search } as const;
}
