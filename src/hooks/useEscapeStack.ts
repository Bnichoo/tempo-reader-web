import { useEffect } from "react";

/**
 * Registers a single Escape handler that closes UI in priority order.
 * Returns nothing; call inside a component at top level.
 */
export function useEscapeStack(steps: Array<{ when: boolean; close: () => void }>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      for (const s of steps) {
        if (s.when) { s.close(); return; }
      }
      // If nothing closed, clear native selection
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) sel.removeAllRanges();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [JSON.stringify(steps.map(s => s.when))]);
}

