import type { RefObject } from "react";
import { useRef } from "react";

/**
 * Edge-hover horizontal auto-scroll for a container.
 * Attach returned handlers to the scrollable element.
 */
export function useEdgeScroll(
  ref: RefObject<HTMLElement | null>,
  opts?: { zone?: number; min?: number; max?: number }
) {
  const { zone = 60, min = 2, max = 8 } = opts || {};
  const rafRef = useRef<number | null>(null);
  const lastXRef = useRef<number>(0);

  const step = () => {
    const el = ref.current;
    if (!el) { rafRef.current = null; return; }
    const rect = el.getBoundingClientRect();
    const x = lastXRef.current;
    let dx = 0;
    const dLeft = x - rect.left;
    const dRight = rect.right - x;
    if (dLeft >= 0 && dLeft <= zone) {
      const t = 1 - dLeft / zone; dx = -(min + (max - min) * t);
    } else if (dRight >= 0 && dRight <= zone) {
      const t = 1 - dRight / zone; dx = min + (max - min) * t;
    }
    if (dx !== 0) {
      el.scrollLeft += dx;
      rafRef.current = requestAnimationFrame(step);
    } else {
      rafRef.current = null;
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    lastXRef.current = e.clientX;
    if (!rafRef.current) rafRef.current = requestAnimationFrame(step);
  };
  const onMouseLeave = () => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  };

  return { onMouseMove, onMouseLeave };
}
