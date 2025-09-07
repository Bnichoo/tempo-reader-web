# Tempo Reader — Roadmap

## Current Capabilities
- Reader
  - Tokenized display with virtualization
  - Smooth “soft follow” of focus; manual scroll override
  - Focus/out-of-focus scaling + blur sliders
  - First-letter tint; sentence aid highlight (double click / double tap)
  - Context menu (Go to text / Select sentence / Clear sentence / Add clip)
  - Click/tap to toggle play/pause; selection pauses playback
- Controls
  - Drawer sliders: tempo, words shown, spacing, text size, focus/dim scale, blur
  - Import/Export; periodic auto‑backup
  - Dark mode
- Clips
  - Create from selection or word; snippet + note (sanitized)
  - Jump to text from clip; pinned chips dock
- Safety/Perf
  - DOMPurify sanitization; CSP-friendly markup
  - TanStack Virtual for scalable rendering

---

## Status at a Glance

- Phase 1 — Reader refactor scaffolding: ✅ Completed
- Phase 2 — Telemetry + error UX: ✅ Completed
- Phase 3 — State management (useReducer): ✅ Completed
- Phase 4 — Core unit tests: ✅ Completed
- Phase 5 — Mobile gestures + CSS tweaks: ✅ Completed
- Phase 6 — Virtualization improvements (TanStack Virtual + bug fix): ✅ Completed
- Phase 7 — Analytics events + Dev Notes: ✅ Completed

---

## Recent Work (this branch)

- Reader: subcomponents, stabilized follow; overlap bug fixed using padding‑mode virtualization + re‑measure near focus.
- Clips: extracted Dock, Header, Export Bar, Virtualized list; Lucide icons; strings normalized.
- Search: click highlights token without selection.
- Telemetry: lightweight event logging (privacy‑safe); debug toggles.
- Tests: core unit tests for tokenization, sanitize, sentences, reducer.
- Perf: jsPDF is lazy‑loaded; main bundle reduced significantly.

---

## Next Candidates

- Clip management
  - Drag & drop reorder (keyboard accessible)
  - Bulk operations (select, pin/unpin, delete, export selected)
  - Tags and filtering; promoted sort controls
- Reader UX
  - Option to disable click‑to‑toggle
  - Continue follow tuning for very large fonts
- Performance
  - Expand workerized tokenization coverage & tests
  - Opportunistic chunking for very long texts
- Documents
  - Recent documents list; optional friendly names

---

## Planned PRs (Import + Tabs)

- PR1: Import polish
  - Persist import metadata (title/type/pages/size) per doc
  - Show document title in header and use for Recent Docs
  - Replace confirmation when importing over existing text
  - Drag-and-drop import over reader viewport
  - Update changelog to reflect PDF/DOCX baseline support
- PR2: Document persistence
  - Add `docs` store (IDB) for full text; wire import to save doc
  - Recent documents menu with friendly titles
- PR3: Per-document reader state
  - Namespace resume position and playback state by `docId`
- PR4: Tabs foundation (state + UI)
  - Manage open tabs and active tab; persist via IDB meta
- PR5: Open-on-import flow
  - Import opens as a new tab; replace remains as secondary option
- PR6: Performance & robustness
  - Tokenization memory guard, worker coverage, large docs UX
- PR7: Tests & docs
  - Unit/integration tests; accessibility for tabs; docs updates

---

## Completed PRs Summary

- PR1: Import polish (metadata persistence, header title, replace confirm, DnD, changelog).
- PR2: Document persistence (IDB `docs`, Recent menu).
- PR3: Per-document reader state (resume by `docId`, session reset).
- PR4: Tabs foundation (state/UI/persist) + title caching fix.
- PR5: Import flow (New Tab default, Replace option, DnD → New Tab).
- PR6: Performance & robustness (large file notice, request persistent storage).
- PR7: Tests & docs (tab a11y roles/keys, doc/storage unit tests, multi‑doc guide).
