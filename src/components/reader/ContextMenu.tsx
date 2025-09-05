import React, { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  x: number;
  y: number;
  onGoHere: () => void;
  onSetSentence: () => void;
  onClearSentence: () => void;
  onAddClip: () => void;
  onClose: () => void;
};

export const ContextMenu: React.FC<Props> = ({ open, x, y, onGoHere, onSetSentence, onClearSentence, onAddClip, onClose }) => {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onEsc);
    const t = window.setTimeout(() => { const b = menuRef.current?.querySelector('button') as HTMLButtonElement | null; b?.focus(); }, 0);
    return () => { window.removeEventListener('keydown', onEsc); window.clearTimeout(t); };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={menuRef}
      className="ctx-bubble"
      style={{ left: x, top: y }}
      role="menu"
      aria-label="Reader actions"
      onKeyDown={(e) => {
        const buttons = Array.from(menuRef.current?.querySelectorAll('button') || []) as HTMLButtonElement[];
        const idx = buttons.findIndex(b => b === document.activeElement);
        if (e.key === 'ArrowDown') { e.preventDefault(); const next = buttons[(idx + 1 + buttons.length) % buttons.length]; next?.focus(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); const prev = buttons[(idx - 1 + buttons.length) % buttons.length]; prev?.focus(); }
        else if (e.key === 'Home') { e.preventDefault(); buttons[0]?.focus(); }
        else if (e.key === 'End') { e.preventDefault(); buttons[buttons.length - 1]?.focus(); }
        else if (e.key === 'Tab') { e.preventDefault(); const dir = e.shiftKey ? -1 : 1; const nxt = buttons[(idx + dir + buttons.length) % buttons.length]; nxt?.focus(); }
      }}
    >
      <button role="menuitem" onClick={onGoHere}>Go to text</button>
      <button role="menuitem" onClick={onSetSentence}>Select sentence</button>
      <button role="menuitem" onClick={onClearSentence}>Clear sentence</button>
      <button role="menuitem" onClick={onAddClip}>Add clip</button>
      <button role="menuitem" onClick={onClose}>Close</button>
    </div>
  );
};

export default ContextMenu;

