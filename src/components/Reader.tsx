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

  // Ensure target block is in view for far jumps (prevents jitter on long docs)
  useEffect(() => {
    if (!playing) return; // only auto-jump when following
    if (performance.now() < overrideUntilRef.current) return; // user scrolling
    if (!blocks.length) return;
    const bi = Math.max(0, Math.min(Math.floor(focusStart / BLOCK_SIZE), blocks.length - 1));
    const vis = rowVirtualizer.getVirtualItems();
    if (!vis.length) return;
    const first = vis[0].index, last = vis[vis.length - 1].index;
    if (bi < first - 1 || bi > last + 1) {
      try { rowVirtualizer.scrollToIndex(bi, { align: 'start' }); } catch { /* ignore */ }
    }
  }, [playing, focusStart, blocks.length]);

  // Guard against unintended reset-to-top when paused or after far navigation
  useEffect(() => {
    const root = rootRef.current; if (!root) return;
    const container = (root.closest(".reader-scroll") as HTMLElement) || (root.parentElement as HTMLElement);
    if (!container) return;
    if (container.scrollTop <= 4 && lastStableScrollRef.current > 80 && performance.now() >= overrideUntilRef.current) {
      container.scrollTo({ top: lastStableScrollRef.current, behavior: 'auto' });
    }
  }, [focusStart]);

  // ---------- Selection tracking (inside-root flag + pause) ----------
  const [hasSelection, setHasSelection] = useState(false);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const onSel = () => {
      const sel = document.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        setHasSelection(false);
        return;
      }
      const r = sel.getRangeAt(0);
      const inside = root.contains(r.startContainer) && root.contains(r.endContainer);
      setHasSelection(inside);
      if (inside) {
        window.dispatchEvent(new CustomEvent("tempo:pause"));
      }
    };

    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, []);

  // ---------- Manual scroll override ----------
  const overrideUntilRef = useRef<number>(0);
  const OVERRIDE_MS = 1800;
  const lastStableScrollRef = useRef<number>(0);

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
    const onScroll = () => { lastStableScrollRef.current = container.scrollTop; markOverride(); };
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

  // ---------- Gentle follow + catch-up (no periodic hop) ----------
  // NOTE: This logic is the primary suspect for rare scroll resets when
  // word indices jump across many virtual blocks. Potential culprits:
  // 1) measureElement jitter: virtualization remeasures blocks near focus,
  //    briefly changing total height; scrollTop can clamp to 0.
  // 2) interleaving smooth scroll and scrollToIndex: a smooth scroll enqueues
  //    while virtualizer immediately scrolls to index -> snap.
  // 3) useEffect timing: follow fires while a previous follow or user scroll
  //    is still in flight; the override window may end too early.
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

    const fontPx = parseFloat(getComputedStyle(container).fontSize || "20");
    // When near the bottom, push focus toward the top before it escapes.
    // Else keep a slightly above-center anchor to reduce jitter.
    let desiredRatio = 0.42; // default anchor ~42% from top
    if (fontPx >= 26) desiredRatio = 0.40;
    else if (fontPx <= 18) desiredRatio = 0.46;

    const current = container.scrollTop;
    const top = focusEl.offsetTop;
    const edge = container.clientHeight * 0.18; // margin from edges
    const viewportTop = current + edge;
    const viewportBottom = current + container.clientHeight - edge;
    const focusBottom = top + focusEl.offsetHeight;

    // If the focus token is way outside the viewport, do a hard catch‑up (no smooth)
    if (top < viewportTop - container.clientHeight * 0.5 || top > viewportBottom + container.clientHeight * 0.5) {
      const hardTarget = Math.max(0, top - container.clientHeight * desiredRatio);
      container.scrollTo({ top: hardTarget, behavior: "auto" });
      return;
    }

    // If focus is approaching bottom edge, proactively align near the top.
    // This reduces perceived lag at high WPM/large word windows.
    if (focusBottom > viewportBottom) {
      const topAlignRatio = 0.06; // ~top
      const targetTop = Math.max(0, top - container.clientHeight * topAlignRatio);
      container.scrollTo({ top: targetTop, behavior: 'auto' });
      lastStableScrollRef.current = targetTop;
      return;
    }

    // Otherwise nudge smoothly toward the desired target
    const target = Math.max(0, top - container.clientHeight * desiredRatio);
    const delta = target - current;
    const linePx = parseFloat(getComputedStyle(container).lineHeight || String(fontPx * 1.2));
    const scale = fontPx >= 26 ? 1.0 : fontPx >= 22 ? 0.85 : 0.7;
    const threshold = isFinite(linePx) ? linePx * scale : Math.max(12, fontPx * 0.8);
    if (Math.abs(delta) > threshold) {
      const damping = fontPx >= 26 ? 0.28 : 0.36;
      const nextTop = current + delta * damping;
      container.scrollTo({ top: nextTop, behavior: "smooth" });
      // Record last known non-top scroll to guard against spurious clamps.
      if (nextTop > 4) lastStableScrollRef.current = nextTop;
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
