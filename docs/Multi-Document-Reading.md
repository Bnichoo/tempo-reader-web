# Multi‑Document Reading

Tempo Reader supports opening multiple documents at once and switching between them quickly.

## Opening Documents

- Use the Import button or drag & drop a file (.txt, .md, .html, .pdf, .docx).
- In the Import dialog, choose:
  - "Open as new tab" (default): adds a tab and focuses it.
  - "Replace current": switches the current tab to the new file (with a confirmation).

## Tabs

- Tabs appear below the header. Click a tab to switch.
- Keyboard: Left/Right arrows to move between tabs; Home/End to jump to first/last.
- Close a tab with the ✕ button; the previous tab is focused.
- Open tabs persist between reloads, as well as the last active tab.

## Recent Documents

- Click "Recent" in the header to open previously imported documents.
- Selecting a recent document adds a tab (if not already present) and focuses it.

## Persistence

- Text is stored in an IndexedDB `docs` store.
- Document metadata (title/type/pages/size/updatedAt) is kept under `meta:doc:<id>`.
- The app requests persistent storage after import (when supported) to reduce eviction risk.

## Resume Position

- The reader restores the last position per document. Switching tabs does not affect the other tabs' positions.

