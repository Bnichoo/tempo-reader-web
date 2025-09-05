# Tempo Reader – Roadmap

## ✅ Current capabilities
- Reader
  - Tokenized display with virtualization
  - Smooth “soft follow” of focus; manual scroll override
  - Focus/out-of-focus scaling + blur sliders
  - First-letter tint; sentence-aid highlight (double click)
  - Right-click bubble menu (Go to text / Select sentence / Clear sentence / Add clip)
  - Click-to-toggle play/pause (dispatches `tempo:toggle`)
  - Selection pauses playback (dispatches `tempo:pause`)
- Controls
  - Drawer with sliders: tempo, words shown, spacing, text size, focus/dim scale, blur
  - Import/Export settings; auto-backup on unload
  - Dark mode
- Clips
  - Create from selection or word; shows snippet + note (basic editor)
  - Jump to text from clip
- Safety/perf
  - Paste-as-plain-text (sanitized)
  - CSP header (basic), virtualization for long texts

---

## 🚧 In progress / queued
- Clip management MVP
  - [x] Edit clip range (reselect → **Update clip**)
  - [x] Search/filter clips by snippet or note text
  - [x] Always show **Delete** + **Add/Edit note** (empty notes deletable)
  - [ ] Reorder clips via **drag & drop**
  - [x] Pin/Unpin clips (basic; pinned surface at top)
- Note editor polish
  - [x] Paste sanitize (plain-text + safe HTML)
  - [x] Undo/Redo (buttons + shortcuts)
  - [x] Link button with URL validation
  - [ ] Draft autosave resume across restarts (persist per-clip)
- Reader UX polish
  - [x] Selection pauses playback
  - [x] Click-to-pause finalized (click pauses when playing; click jumps when paused)
  - [ ] Setting to disable click-to-toggle
  - [ ] Fine-tune follow thresholds for very large fonts
- Performance & robustness
  - [ ] Workerized tokenization (keep virtualization)
  - [ ] Error boundary + “Recover session” banner
- Packaging
  - [ ] PWA (manifest, SW, offline cache, install prompt)
  - [ ] Desktop (Tauri) / Android (Capacitor) after PWA is solid
- Accessibility
  - [ ] Keyboard nav for context menu & clips
  - [ ] ARIA labels, focus rings, contrast pass

---

## 📐 Data model (clips) – target state
```ts
type Clip = {
  id: string;            // stable id
  start: number;         // token index
  length: number;
  snippet: string;       // cached display snippet
  noteHtml: string;      // sanitized note content
  pinned: boolean;       // for pinning
  createdAt: number;
  updatedAt: number;
};


---

## Phase 2 — Completed (summary)

- Document‑scoped clips (per‑text docId) with IndexedDB index
- Export: direct PDF download (jsPDF), filename editing; removed print flow
- Search: header search + right drawer; bold highlights and ellipses in results
- Storage: periodic backup, persistent storage request, usage indicator
- Accessibility: keyboard navigation in clips and context menus; Esc suppression in inputs; click‑outside to close drawers
- Error boundaries around Reader and Clips with simple recovery

## Phase 3 — Next

- Clip management
  - Drag & drop reorder (keyboard‑accessible)
  - Bulk operations (select, pin/unpin, delete, export selected)
  - Tags and filtering; promote sort controls
- Reader UX
  - Option to disable click‑to‑toggle
  - Continue follow tuning/data fencing as needed
- Performance
  - Workerized tokenization
  - Opportunistic chunking for very long texts
- Documents
  - Recent documents list; optional friendly names
