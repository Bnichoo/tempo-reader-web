import React, { useEffect, useMemo, useRef, useState } from "react";
import type { RangeT } from "../types";
import { sentenceRangeAt } from "../lib/sentences";
import Token from "./reader/Token";
import ContextMenu from "./reader/ContextMenu";
import { useVirtualizer } from "@tanstack/react-virtual";

type Props = {
  tokens: string[];
  focusStart: number;
  focusLength: number;
  hoverRange: RangeT | null;
  aidRange: RangeT | null;
  playing: boolean;
  onJump: (tokenIdx: number) => void;
  onAddClip: (range: RangeT) => void;
  onAidRangeChange: (range: RangeT | null) => void;
  onSelectionChange: (range: RangeT | null) => void;
};

// Find the nearest token index up the DOM tree from an element
function findTok(root: HTMLElement | null, el: HTMLElement | null): number | null {
  let cur: HTMLElement | null = el;
  while (cur && cur !== root) {
    const ti = Number(cur.dataset?.ti);
    if (Number.isFinite(ti)) return ti;
    cur = cur.parentElement as HTMLElement | null;
  }
  return null;
}

export const Reader: React.FC<Props> = ({
  tokens,
  focusStart,
  focusLength,
  hoverRange,
  aidRange,
  playing,
  onJump,
  onAddClip,
  onAidRangeChange,
  onSelectionChange,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
  const BLOCK_SIZE = 600;

  // Blocks for virtualization (same size as previous LIMITS.BLOCK_SIZE)
  const blocks = useMemo(() => {
    const arr: { idx: number; start: number; end: number; key: string }[] = [];
    for (let i = 0, bi = 0; i < tokens.length; i += BLOCK_SIZE, bi++) {
      arr.push({ idx: bi, start: i, end: Math.min(tokens.length - 1, i + BLOCK_SIZE - 1), key: `b-${bi}` });
    }
    return arr;
  }, [tokens]);

  const rowVirtualizer = useVirtualizer({
    count: blocks.length,
    getScrollElement: () => (rootRef.current?.closest(".reader-scroll") as HTMLElement | null),
    estimateSize: () => 400,
    overscan: 3,
    measureElement: (el) => (el as HTMLElement).offsetHeight,
  });

  // Re-measure the block that contains the focus token (and neighbors)
  useEffect(() => {
    if (!blocks.length) return;
    const bi = Math.max(0, Math.min(Math.floor(focusStart / BLOCK_SIZE), blocks.length - 1));
    for (const idx of [bi - 1, bi, bi + 1]) {
      if (idx < 0 || idx >= blocks.length) continue;
      const el = rowRefs.current.get(idx) as HTMLElement | null;
      if (el) rowVirtualizer.measureElement(el);
    }
  }, [focusStart, focusLength, blocks.length]);

  // ---------- Selection tracking + pause ----------
  const [hasSelection, setHasSelection] = useState(false);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const onSel = () => {
      const sel = document.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        setHasSelection(false);
        onSelectionChange(null);
        return;
      }
      const r = sel.getRangeAt(0);
      const inside = root.contains(r.startContainer) && root.contains(r.endContainer);
      setHasSelection(inside);
      if (inside) {
        // send pause request
        window.dispatchEvent(new CustomEvent("tempo:pause"));
        // also forward token range
        const startSpan = (r.startContainer.nodeType === 3 ? (r.startContainer.parentElement) : (r.startContainer as Element)) as HTMLElement | null;
        const endSpan   = (r.endContainer.nodeType === 3 ? (r.endContainer.parentElement) : (r.endContainer as Element)) as HTMLElement | null;
        const a = findTok(root, startSpan), b = findTok(root, endSpan);
        if (a != null && b != null) onSelectionChange({ start: Math.min(a,b), length: Math.abs(b - a) + 1 });
      }
    };

    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, [onSelectionChange]);

  // ---------- Manual scroll override ----------
  const overrideUntilRef = useRef<number>(0);
  const OVERRIDE_MS = 1800;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const container =
      (root.closest(".reader-scroll") as HTMLElement) ||
      (root.parentElement as HTMLElement);
    if (!container) return;

    const markOverride = () => { overrideUntilRef.current = performance.now() + OVERRIDE_MS; };

    // Wheel/scroll/touch all mark override
    const onWheel = () => markOverride();
    const onScroll = () => markOverride();
    const onTouchStart = () => markOverride();
    const onPointerDown = () => markOverride(); // scrollbar drag, etc.

    container.addEventListener("wheel", onWheel, { passive: true });
    container.addEventListener("scroll", onScroll, { passive: true });
    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("pointerdown", onPointerDown, { passive: true });

    return () => {
      container.removeEventListener("wheel", onWheel);
      container.removeEventListener("scroll", onScroll);
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  // ---------- Gentle follow (no periodic hop) ----------
  useEffect(() => {
    if (hasSelection) return; // suspend while selecting/selected
    if (performance.now() < overrideUntilRef.current) return; // user scrolling

    const root = rootRef.current;
    if (!root) return;
    const container =
      (root.closest(".reader-scroll") as HTMLElement) ||
      (root.parentElement as HTMLElement);
    if (!container) return;

    const focusEl = root.querySelector(`.tok[data-ti="${focusStart}"]`) as HTMLElement | null;
    if (!focusEl) return;

    // keep focused token near a font-aware target
    // adapt position & threshold to font size to reduce jitter at large sizes
    const fontPx = parseFloat(getComputedStyle(container).fontSize || "20");
    let desiredRatio = 0.4; // baseline
    if (fontPx >= 26) desiredRatio = 0.35;
    else if (fontPx <= 18) desiredRatio = 0.45;
    const target = Math.max(0, focusEl.offsetTop - container.clientHeight * desiredRatio);
    const current = container.scrollTop;
    const delta = target - current;

    const linePx = parseFloat(getComputedStyle(container).lineHeight || String(fontPx * 1.2));
    // scale threshold with font so big fonts don't trigger micro scrolls
    const scale = fontPx >= 26 ? 1.6 : fontPx >= 22 ? 1.2 : 0.9;
    const threshold = isFinite(linePx) ? linePx * scale : Math.max(20, fontPx);

    if (Math.abs(delta) > threshold) {
      const damping = fontPx >= 26 ? 0.35 : 0.5; // slower approach at large fonts
      container.scrollTo({ top: current + delta * damping, behavior: "smooth" });
    }
  }, [focusStart, focusLength, hasSelection]);

  // ---------- Context menu ----------
  const [menu, setMenu] = useState<{ open: boolean; x: number; y: number; ti: number | null }>({
    open: false, x: 0, y: 0, ti: null
  });
  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const el = (e.target as HTMLElement);
    const tiAttr = el?.closest(".tok")?.getAttribute("data-ti");
    const ti = tiAttr ? Number(tiAttr) : null;
    setMenu({ open: true, x: e.clientX, y: e.clientY, ti: Number.isFinite(ti as number) ? (ti as number) : null });
  };
  const closeMenu = () => setMenu({ open: false, x: 0, y: 0, ti: null });

  const addClipFromSelectionOrWord = () => {
    const sel = document.getSelection();
    if (sel && sel.rangeCount > 0) {
      const r = sel.getRangeAt(0);
      if (rootRef.current && rootRef.current.contains(r.startContainer) && rootRef.current.contains(r.endContainer)) {
        const startSpan = (r.startContainer.nodeType === 3 ? (r.startContainer.parentElement) : (r.startContainer as Element)) as HTMLElement | null;
        const endSpan   = (r.endContainer.nodeType === 3 ? (r.endContainer.parentElement) : (r.endContainer as Element)) as HTMLElement | null;

        const a = findTok(rootRef.current, startSpan), b = findTok(rootRef.current, endSpan);
        if (a != null && b != null) {
          const s = Math.min(a, b), e = Math.max(a, b);
          onAddClip({ start: s, length: e - s + 1 });
          closeMenu();
          return;
        }
      }
    }
    const ti = menu.ti ?? focusStart;
    onAddClip({ start: ti, length: 1 });
    closeMenu();
  };

  const goHere = () => { if (menu.ti != null) onJump(menu.ti); closeMenu(); };
  const setSentenceHere = () => { const ti = menu.ti ?? focusStart; onAidRangeChange(sentenceRangeAt(tokens, ti)); closeMenu(); };
  const clearSentence = () => { onAidRangeChange(null); closeMenu(); };

  // ---------- Render helpers ----------
  const focusEnd   = focusStart + Math.max(0, focusLength - 1);
  const aidStart   = aidRange ? aidRange.start : -1;
  const aidEnd     = aidRange ? aidRange.start + aidRange.length - 1 : -2;
  const hoverStart = hoverRange ? hoverRange.start : -1;
  const hoverEnd   = hoverRange ? hoverRange.start + hoverRange.length - 1 : -2;

  const styleFocus = useMemo<React.CSSProperties>(() => ({
    transform: "scale(var(--scale-focus))",
    transition: "transform 160ms ease, filter 160ms ease",
  }), []);
  const styleDim = useMemo<React.CSSProperties>(() => ({
    transform: "scale(var(--scale-dim))",
    filter: "blur(var(--dim-blur))",
    transition: "transform 160ms ease, filter 160ms ease",
  }), []);

  const renderToken = (ti: number) => {
    const t = tokens[ti];
    const inFocus = ti >= focusStart && ti <= focusEnd;
    const inAid   = ti >= aidStart && ti <= aidEnd;
    const inClip  = ti >= hoverStart && ti <= hoverEnd;
    return (
      <Token
        key={ti}
        ti={ti}
        text={t}
        inFocus={inFocus}
        inAid={inAid}
        inClip={inClip}
        styleFocus={styleFocus}
        styleDim={styleDim}
        onJump={onJump}
      />
    );
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const el = (e.target as HTMLElement);
    const tiAttr = el?.closest(".tok")?.getAttribute("data-ti");
    if (!tiAttr) return;
    const ti = Number(tiAttr);
    if (!Number.isFinite(ti)) return;
    onAidRangeChange(sentenceRangeAt(tokens, ti));
  };

  // ---------- Touch gestures: long-press context + double-tap sentence ----------
  const pressRef = useRef<{t: number; x: number; y: number; moved: boolean; ti: number | null; timer: number | null} | null>(null);
  const lastTapRef = useRef<{t: number; x: number; y: number} | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    const el = (e.target as HTMLElement);
    const tiAttr = el?.closest('.tok')?.getAttribute('data-ti');
    const ti = tiAttr ? Number(tiAttr) : null;
    const data = { t: performance.now(), x: e.clientX, y: e.clientY, moved: false, ti: Number.isFinite(ti as number) ? (ti as number) : null, timer: null as number | null };
    data.timer = window.setTimeout(() => {
      if (!pressRef.current || pressRef.current.moved) return;
      const pr = pressRef.current;
      setMenu({ open: true, x: pr!.x, y: pr!.y, ti: pr!.ti });
    }, 450);
    pressRef.current = data;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    const pr = pressRef.current; if (!pr) return;
    if (pr.moved) return;
    const dx = e.clientX - pr.x, dy = e.clientY - pr.y;
    if (Math.hypot(dx, dy) > 10) { pr.moved = true; if (pr.timer) { window.clearTimeout(pr.timer); pr.timer = null; } }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    const pr = pressRef.current;
    if (pr?.timer) { window.clearTimeout(pr.timer); pr.timer = null; }
    const now = performance.now();
    const prev = lastTapRef.current;
    if (prev && (now - prev.t) < 300 && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 24) {
      const el = (e.target as HTMLElement);
      const tiAttr = el?.closest('.tok')?.getAttribute('data-ti');
      const ti = tiAttr ? Number(tiAttr) : null;
      if (Number.isFinite(ti as number)) onAidRangeChange(sentenceRangeAt(tokens, ti as number));
      lastTapRef.current = null;
    } else {
      lastTapRef.current = { t: now, x: e.clientX, y: e.clientY };
    }
    pressRef.current = null;
  };

  // Click anywhere in the reader toggles play/pause is handled in App via events

  return (
    <div
      ref={rootRef}
      className="reader-container"
      onContextMenu={onContextMenu}
      onKeyDownCapture={(e) => { if (e.key === 'Escape') { e.stopPropagation(); } }}
      onDoubleClick={onDoubleClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClickCapture={(e) => {
		// If we’re playing, a click pauses and stops the click from bubbling to tokens (so no jump).
		if (playing) {
			e.stopPropagation();
			window.dispatchEvent(new CustomEvent("tempo:pause"));
		}
	  }}
    >
      {(() => {
        const vis = rowVirtualizer.getVirtualItems();
        const paddingTop = vis.length > 0 ? vis[0].start : 0;
        const paddingBottom = vis.length > 0 ? rowVirtualizer.getTotalSize() - vis[vis.length - 1].end : 0;
        return (
          <div style={{ paddingTop, paddingBottom }}>
            {vis.map((vi) => {
              const b = blocks[vi.index];
              const renderRange = (start: number, end: number) => {
                const nodes: React.ReactNode[] = [];
                for (let ti = start; ti <= end; ti++) nodes.push(renderToken(ti));
                return nodes;
              };
              return (
                <div
                  key={vi.key}
                  data-block={b.idx}
                  ref={(el) => {
                    rowRefs.current.set(vi.index, el);
                    if (el) rowVirtualizer.measureElement(el);
                  }}
                >
                  <span>
                    {renderRange(b.start, b.end)}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })()}

      <ContextMenu
        open={menu.open}
        x={menu.x}
        y={menu.y}
        onGoHere={goHere}
        onSetSentence={setSentenceHere}
        onClearSentence={clearSentence}
        onAddClip={addClipFromSelectionOrWord}
        onClose={closeMenu}
      />
    </div>
  );
};

export default Reader;
