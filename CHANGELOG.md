# Changelog

All notable changes to this project are documented here. Dates use YYYY‑MM‑DD.

## [Phase 1 – Quick Wins] – 2025-08-28
Tag: `phase-1`

- Constants: Added `LIMITS` (`src/lib/constants.ts`) for shared limits and thresholds.
- Tokenizer: Worker gating now uses `LIMITS.TOKENIZE_WORKER_THRESHOLD` (`src/lib/useTokenizer.ts`).
- Storage: Centralized persistence in `src/lib/storage.ts`; debounced writes; flush pending writes on `pagehide`/`visibilitychange`.
- Clips: Introduced `clipRepository` (`src/lib/clipUtils.ts`) with `migrate`, `prune`, and `serialize`. `migrate` sanitizes `noteHtml`.
- Reader performance: Replaced `Array.from` token render with a simple loop; memoized focus/dim style objects (`src/components/Reader.tsx`).
- Edge-scroll: Extracted `useEdgeScroll` hook for dock chip auto-scroll on edge hover (`src/hooks/useEdgeScroll.ts`), integrated in `ClipManager`.
- Cleanup: Removed startup `console.log` from `src/main.tsx`. Fixed JSX comment in `src/App.tsx`.
- App wiring: `App.tsx` now uses shared constants, storage helpers, and clip utils; removed duplicate migration/prune/persistence logic.

Notes:
- No breaking changes; existing localStorage data remains compatible.
- Build verified with Vite + TypeScript.

