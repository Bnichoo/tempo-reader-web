import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import XIcon from "lucide-react/dist/esm/icons/x.js";

export type Tab = { id: string; title: string };

export function TabBar({ tabs, activeId, onSelect, onClose }: { tabs: Tab[]; activeId?: string; onSelect: (id: string) => void; onClose: (id: string) => void }) {
  if (!tabs.length) return null;
  const focusTab = (id: string) => {
    const el = document.getElementById(`tab-${id}`);
    if (el) (el as HTMLButtonElement).focus();
  };
  const onKey = useCallback((e: React.KeyboardEvent, id: string) => {
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx < 0) return;
    let next = idx;
    if (e.key === 'ArrowRight') next = Math.min(tabs.length - 1, idx + 1);
    else if (e.key === 'ArrowLeft') next = Math.max(0, idx - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    else return;
    e.preventDefault();
    const nextId = tabs[next]?.id;
    if (nextId) { onSelect(nextId); requestAnimationFrame(() => focusTab(nextId)); }
  }, [tabs, onSelect]);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [overflow, setOverflow] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const check = () => {
      setOverflow(el.scrollWidth > el.clientWidth + 4);
      const ids: string[] = [];
      const children = Array.from(el.querySelectorAll<HTMLDivElement>('div.tab'));
      const left = el.scrollLeft, right = left + el.clientWidth;
      for (const child of children) {
        const btn = child.querySelector('button.tab__label') as HTMLButtonElement | null;
        if (!btn) continue;
        const id = btn.id.replace('tab-','');
        const x = child.offsetLeft, w = child.offsetWidth;
        if (x + w < left + 8 || x > right - 8) ids.push(id);
      }
      setHiddenIds(ids);
    };
    const ro = new ResizeObserver(check); ro.observe(el);
    el.addEventListener('scroll', check, { passive: true });
    check();
    return () => { ro.disconnect(); el.removeEventListener('scroll', check); };
  }, [tabs.length, activeId]);
  const hiddenTabs = useMemo(() => tabs.filter(t => hiddenIds.includes(t.id)), [tabs, hiddenIds]);
  return (
    <div className="tabbar" role="tablist" aria-label="Documents">
      <div ref={wrapRef} className="tabbar-inner">
        {tabs.map((t) => (
          <div key={t.id} className={`tab ${activeId === t.id ? 'is-active' : ''}`}>
            <button id={`tab-${t.id}`} className="tab__label" role="tab" aria-selected={activeId === t.id} tabIndex={activeId === t.id ? 0 : -1} title={t.title} onClick={() => onSelect(t.id)} onKeyDown={(e) => onKey(e, t.id)}>
              {t.title}
            </button>
            <button className="tab__close" aria-label={`Close ${t.title}`} onClick={() => onClose(t.id)}>
              <XIcon aria-hidden size={14} />
            </button>
          </div>
        ))}
      </div>
      {overflow && (
        <div className="tabbar-more-wrap">
          <button className="tabbar-more" onClick={() => setMenuOpen(v => !v)} aria-haspopup="menu" aria-expanded={menuOpen} aria-label="More tabs">⋯</button>
          {menuOpen && (
            <div className="tabbar-menu" role="menu" onMouseLeave={() => setMenuOpen(false)}>
              {hiddenTabs.length === 0 ? (
                <div className="tabbar-menu-item disabled">No hidden tabs</div>
              ) : hiddenTabs.map((t) => (
                <button key={t.id} className="tabbar-menu-item" role="menuitem" onClick={() => { onSelect(t.id); setMenuOpen(false); }} title={t.title}>{t.title}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TabBar;
