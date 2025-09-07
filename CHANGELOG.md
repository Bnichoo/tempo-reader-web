# Changelog

## [Unreleased]
### Merged
- Merge productivity-features into main (2025-09-06)

### Highlights
- Document persistence: added IDB `docs` store and Recent Documents menu.
- Per-document resume: restores last position per document; session metrics reset on doc switch.
- Tabs foundation: basic TabBar UI, open/close/select, persisted `openTabs` and `activeDocId`.
- Tabs polish: improved dark/high-contrast colors and hover/active states.
- Import flow: Import Modal offers New Tab (default) or Replace Current; drag-and-drop defaults to New Tab.
- Performance & robustness:
  - Large-file notice in Import modal; persistent storage requested after import to reduce eviction risk.
  - Tokenization continues to run in worker for large texts; worker cleaned up when unused.
  - Minor stability tweaks and error handling.
- New AppShell composition with context providers (Document/Reader/Settings/Clips/Selection).
- Added ProductivityBar UI and clip overlay actions using lucide icons.
- Added services and hooks: citation, playback, keyboard, selection, word navigation, PWA install, escape stack, focus range.
- Kept PDF export as lazy-loaded jsPDF to minimize main bundle size.

## [0.1.0] - 2025-05-09
### Added
- ProductivityBar: session hourglass with Start/Pause/Stop, time and words.
- Compact pill style for ProductivityBar for better desktop/mobile fit.
- CitationService scaffold and FileProcessingService (HTML ? text).
- ClipsContext actions for tags/categories (API only, UI later).

### Changed
- Clips overlay quick actions use lucide icons (Pin, Trash) instead of emoji/text.
- Legacy emoji quick-action block hidden via CSS; new icon block inserted.

### Notes
- Branch: productivity-features
- Import supports txt/html/pdf/docx; APA/MLA UI deferred.
