# Changelog

## [Unreleased]
### Merged
- Merge productivity-features into main (2025-09-06)

### Highlights
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
- Import supports txt/html; PDF/Docs import and APA/MLA UI deferred.

