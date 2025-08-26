import React, { useEffect, useMemo, useRef, useState } from "react";

type RangeT = { start: number; length: number };
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

function sentenceRangeAt(tokens: string[], i: number): RangeT {
  const isBoundary = (s: string) => /[.!?]/.test(s);
  let s = 0;
  for (let k = i - 1; k >= 0; k--) { if (isBoundary(tokens[k])) { s = k + 1; break; } }
  while (s < tokens.length && /^\s+$/.test(tokens[s])) s++;
  let e = tokens.length - 1;
  for (let k = i; k < tokens.length; k++) { if (isBoundary(tokens[k])) { e = k; break; } }
  return { start: s, length: Math.max(1, e - s + 1) };
}

const BLOCK_SIZE = 600;
const IO_ROOT_MARGIN = "800px";

const isWhitespace = (t: string) => /^\s+$/.test(t);
const isWord = (t: string) => /[\p{L}\p{N}]/u.test(t);

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

  // blocks for virtualization
  const blocks = useMemo(() => {
    const arr: { idx: number; start: number; end: number; key: string }[] = [];
    for (let i = 0, bi = 0; i < tokens.length; i += BLOCK_SIZE, bi++) {
      arr.push({ idx: bi, start: i, end: Math.min(tokens.length - 1, i + BLOCK_SIZE - 1), key: `b-${bi}` });
    }
    return arr;
  }, [tokens]);

  // virtualization state
  const [visible, setVisible] = useState<Set<number>>(() => new Set());
  const [heights, setHeights] = useState<Map<number, number>>(() => new Map());
  const avgRef = useRef<{ tokens: number; px: number }>({ tokens: 1, px: 24 });
  const wrappersRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const ioRef = useRef<IntersectionObserver | null>(null);

  // estimator at component scope
  const estimateHeight = (bi: number) => {
    const known = heights.get(bi);
    if (known) return known;
    const size = blocks[bi] ? (blocks[bi].end - blocks[bi].start + 1) : BLOCK_SIZE;
    const pxPerTok = avgRef.current.px / Math.max(1, avgRef.current.tokens);
    return Math.max(16, Math.round(size * pxPerTok));
  };

  // observe wrappers
  useEffect(() => {
    if (ioRef.current) ioRef.current.disconnect();
    const io = new IntersectionObserver(
      (entries) => {
        setVisible(prev => {
          const next = new Set(prev);
          for (const e of entries) {
            const bi = Number((e.target as HTMLElement).dataset.block);
            if (!Number.isFinite(bi)) continue;
            if (e.isIntersecting) next.add(bi); else next.delete(bi);
          }
          return next;
        });
      },
      { root: null, rootMargin: IO_ROOT_MARGIN, threshold: 0 }
    );
    ioRef.current = io;
    wrappersRef.current.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [blocks.length]);

  // refine height estimates
  useEffect(() => {
    const m = new Map(heights);
    let changed = false;
    visible.forEach((bi) => {
      const wrap = wrappersRef.current.get(bi);
      if (!wrap) return;
      const h = Math.max(16, wrap.offsetHeight);
      const known = heights.get(bi);
      if (!known || Math.abs(known - h) > 1) {
        m.set(bi, h);
        changed = true;
        const size = blocks[bi] ? (blocks[bi].end - blocks[bi].start + 1) : BLOCK_SIZE;
        avgRef.current.tokens += size;
        avgRef.current.px += h;
      }
    });
    if (changed) setHeights(m);
  }, [visible, heights, blocks]);

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
        const findTok = (el: HTMLElement | null) => {
          let cur: HTMLElement | null = el;
          while (cur && cur !== root) {
            const ti = Number((cur as any).dataset?.ti);
            if (Number.isFinite(ti)) return ti;
            cur = cur.parentElement;
          }
          return null;
        };
        const a = findTok(startSpan), b = findTok(endSpan);
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

    // keep focused token around 40% of panel height
    const desiredRatio = 0.4;
    const target = Math.max(0, focusEl.offsetTop - container.clientHeight * desiredRatio);
    const current = container.scrollTop;
    const delta = target - current;

    const linePx = parseFloat(getComputedStyle(container).lineHeight || "24");
    const threshold = isFinite(linePx) ? linePx * 0.9 : 20;

    if (Math.abs(delta) > threshold) {
      container.scrollTo({ top: current + delta * 0.5, behavior: "smooth" });
    }
  }, [focusStart, focusLength, visible, hasSelection]);

  // ---------- Context menu (unchanged) ----------
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

        const findTok = (el: HTMLElement | null) => {
          let cur: HTMLElement | null = el;
          while (cur && cur !== rootRef.current) {
            const ti = Number((cur as any).dataset?.ti);
            if (Number.isFinite(ti)) return ti;
            cur = cur.parentElement;
          }
          return null;
        };

        const a = findTok(startSpan), b = findTok(endSpan);
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

  const renderToken = (ti: number) => {
    const t = tokens[ti];
    const inFocus = ti >= focusStart && ti <= focusEnd;
    const inAid   = ti >= aidStart && ti <= aidEnd;
    const inClip  = ti >= hoverStart && ti <= hoverEnd;

    let cls = "tok token";
    if (inFocus) cls += " focus"; else cls += " dim";
    if (inAid)   cls += " aid";
    if (inClip)  cls += " clipmark";
    if (isWhitespace(t)) cls += " ws";
    if (isWord(t))       cls += " word";

    // inline style to ensure sliders take effect (uses CSS vars from parent)
    const style: React.CSSProperties = inFocus
      ? { transform: "scale(var(--scale-focus))", transition: "transform 160ms ease, filter 160ms ease" }
      : { transform: "scale(var(--scale-dim))",   filter: "blur(var(--dim-blur))", transition: "transform 160ms ease, filter 160ms ease" };

    // first-letter tint
    let content: React.ReactNode = t;
    if (isWord(t)) {
      const parts = Array.from(t);
      const first = parts[0] ?? "";
      const rest  = parts.slice(1).join("");
      content = (<><span className="initial">{first}</span>{rest}</>);
    }

    return (
      <span
        key={ti}
        className={cls}
        data-ti={ti}
        onClick={() => onJump(ti)}
        style={style}
      >
        {content}
      </span>
    );
  };

  const setWrapper = (blockIdx: number, el: HTMLDivElement | null) => {
    const map = wrappersRef.current;
    const prev = map.get(blockIdx);
    if (prev && ioRef.current) ioRef.current.unobserve(prev);
    if (el) { map.set(blockIdx, el); if (ioRef.current) ioRef.current.observe(el); }
    else { map.delete(blockIdx); }
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

  // Click anywhere in the reader toggles play/pause (App listens for this)
  const onClickToggle = () => {
    window.dispatchEvent(new CustomEvent("tempo:toggle"));
  };

  return (
    <div
      ref={rootRef}
      className="reader-container"
      onContextMenu={onContextMenu}
      onDoubleClick={onDoubleClick}
      onClickCapture={(e) => {
		// If we’re playing, a click pauses and stops the click from bubbling to tokens (so no jump).
		if (playing) {
			e.stopPropagation();
			window.dispatchEvent(new CustomEvent("tempo:pause"));
		}
	  }}
    >
      {blocks.map((b) => {
        const isVisible = visible.has(b.idx);
        const style: React.CSSProperties = {
          minHeight: isVisible ? undefined : estimateHeight(b.idx),
        };
        return (
          <div
            key={b.key}
            data-block={b.idx}
            ref={(el) => setWrapper(b.idx, el)}
            style={style}
          >
            {isVisible && (
              <span>
                {Array.from({ length: b.end - b.start + 1 }, (_, k) => b.start + k).map(renderToken)}
              </span>
            )}
          </div>
        );
      })}

      {menu.open && (
        <div className="ctx-bubble" style={{ left: menu.x, top: menu.y }}>
          <button onClick={goHere}>Go to text</button>
          <button onClick={setSentenceHere}>Select sentence</button>
          <button onClick={clearSentence}>Clear sentence</button>
          <button onClick={addClipFromSelectionOrWord}>Add clip</button>
          <button onClick={closeMenu}>Close</button>
        </div>
      )}
    </div>
  );
};

export default Reader;
