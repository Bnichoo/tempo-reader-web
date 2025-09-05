# Tempo Reader (Web) — Dev Notes

These notes help contributors run, test, debug and understand telemetry at a glance.

## Quick Start

- Install deps (pnpm recommended):
  - `pnpm install`
- Dev server:
  - `pnpm dev` then open `http://localhost:5173`
- Production build:
  - `pnpm build`
- Preview production build:
  - `pnpm preview`

## Tests

- Run once: `pnpm test:run`
- Watch mode: `pnpm test`
- Framework:
  - Vitest + jsdom
  - Unit tests live near logic:
    - `src/lib/tokenizeImpl.test.ts`
    - `src/lib/sanitize.test.ts`
    - `src/lib/sentences.test.ts`
    - `src/state/session.test.ts`

## Telemetry & Logging

- The app uses a small logger (`src/lib/logger.ts`) with levels `debug/info/warn/error`.
- By default, logs go to the console. You can add a remote sink via `setTelemetrySink(fn)` if desired.
- Enable verbose debug:
  - In dev: logs are already verbose.
  - In prod: set `localStorage.setItem('tr:debug','1')` or build with `VITE_DEBUG=1`.
- Privacy: events are aggregate/structural only (counts, timings, flags). No clip text or file contents are sent.

### Instrumented Events (examples)

- Reader:
  - `reader:playing` (on toggle)
  - `reader:setPlaying` (explicit set from header)
  - `jump:reader` (from in‑reader click)
- Search:
  - `jump:search` (clicking a search result)
  - `search:close`
- Clips:
  - `clips:open` / `clips:close`
  - `clips:jump_chip` (dock chip click)
  - `clips:pin_toggle`, `clips:delete`
  - `clips:export_bar` (open/close)
  - `clips:export_pdf` (export with count/scope/sort)
- Files:
  - `file:loaded` (bytes + parse time)

## Performance Notes

- Reader virtualization uses TanStack Virtual (padding mode) with targeted re‑measurement near the focus window. This avoids stacked transforms and overlapping text.
- jsPDF is lazy‑loaded for exports only, keeping the main bundle smaller.
- ClipManager is compartmentalized (Dock, Header, ExportBar, Virtualized list) to reduce re‑render surface and simplify profiling.

## Debug Tips

- Toggle dark mode / font / scales from the left drawer to stress test rendering.
- Use the search drawer to validate token highlighting (no selection is made).
- For large inputs, tokenizer can fall back to sync; check console logs for timing and worker fallback.

## Contributing

- Keep PRs focused and small where possible.
- Favor pure logic in hooks/libs and thin components for easier tests.
- Ensure new strings avoid unusual glyphs — prefer ASCII + semantic punctuation (… — “ ”) where appropriate.
