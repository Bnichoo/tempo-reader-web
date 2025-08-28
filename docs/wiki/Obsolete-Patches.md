# Obsolete Patch Files (Removed)

The following ad hoc patch files and archive were removed from the repository root to reduce clutter and avoid duplicating history outside of Git. Their intent is summarized here for reference.

If you need to understand the evolution of these changes, prefer using Git history for the relevant files (e.g., `src/App.tsx` and `src/components/Reader.tsx`).

## Removed files

- drag-reorder-clips.patch: Introduced drag-and-drop support for reordering clips within the same group in `src/App.tsx` (added `dragId`, `dragOverId`, and `reorderClipsWithinGroup`). Cross‑group moves were intentionally blocked.
- reader-disable-scroll-block.patch: Disabled a duplicate `scrollBy` block in `src/components/Reader.tsx` because smooth scrolling logic already kept the focus token visible.
- reader-estimate-fix.patch: Adjusted the virtual block height estimator in `src/components/Reader.tsx` (kept estimator at component scope and used an average px-per-token heuristic).
- tempo-reader-HEAD.zip: Temporary archive of a prior state; superseded by Git history.

## Where to find the history now

- Use `git log -- src/App.tsx src/components/Reader.tsx` to browse changes.
- Use `git blame` on specific regions if you need line-level provenance.
- If a previous external reference is needed, include it in a dedicated design note under this wiki directory.

If you think any of the above should be preserved as a formal design or ADR, feel free to promote this summary into a dedicated document and link it from `README.md`.

