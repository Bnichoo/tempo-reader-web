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

