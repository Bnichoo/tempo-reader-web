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
  - [ ] Edit clip range (reselect → **Update clip**)
  - [ ] Reorder clips (drag & drop)
  - [ ] Pin/Unpin clips (pinned float to top)
  - [ ] Search/filter clips by snippet or note text
- Note editor polish
  - [ ] Undo/Redo (keyboard + buttons)
  - [ ] Auto-save draft while editing
  - [ ] Link button with URL validation (keep; lists manual)
- Reader UX polish
  - [ ] Setting to disable click-to-toggle
  - [ ] Fine-tune follow thresholds for very large fonts
- Performance & robustness
  - [ ] Workerized tokenization
  - [ ] Error boundary + “recover session” banner
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
