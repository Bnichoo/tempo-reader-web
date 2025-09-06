import React, { useEffect } from "react";
import type { RangeT } from "../../types";
import { useReader } from "../../contexts/ReaderContext";

type Props = {
  noteOpen: boolean;
  currentSelection: RangeT | null;
  focusRange: RangeT;
  openNote: (r: RangeT) => void;
  toggleClips: () => void;
};

function isTypingTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === "TEXTAREA") return true;
  if (tag === "INPUT") {
    const type = (el as HTMLInputElement).type.toLowerCase();
    if (["range", "button", "checkbox", "radio"].includes(type)) return false;
    return true;
  }
  return false;
}

export const KeyboardController: React.FC<Props> = ({ noteOpen, currentSelection, focusRange, openNote, toggleClips }) => {
  const { playing, setPlaying } = useReader();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (noteOpen) return;
      if (isTypingTarget(e.target)) {
        if (e.code === "Space" && (e.target as HTMLElement).tagName === "INPUT") {
          const t = (e.target as HTMLInputElement).type.toLowerCase();
          if (!["range", "button", "checkbox", "radio"].includes(t)) return;
        } else {
          return;
        }
      }
      if (e.code === "Space") {
        e.preventDefault();
        setPlaying(!playing);
      } else if (e.key.toLowerCase() === "c") {
        e.preventDefault();
        const range = currentSelection || focusRange;
        openNote(range);
      } else if ((e.altKey || e.metaKey) && e.key.toLowerCase() === "c") {
        e.preventDefault();
        setPlaying(false);
        toggleClips();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [noteOpen, currentSelection, focusRange, playing, setPlaying, openNote, toggleClips]);

  return null;
};

