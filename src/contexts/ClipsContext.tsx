import React, { createContext, useContext, useMemo } from "react";
import { useDocument } from "./DocumentContext";
import { useClips } from "../hooks/useClips";
import type { Clip } from "../types";

type Base = ReturnType<typeof useClips>;
type CtxValue = Base & {
  addClip: (c: Omit<Clip, "id" | "createdUtc" | "pinned"> & Partial<Pick<Clip, "id" | "createdUtc" | "pinned">>) => Clip;
  updateClipNote: (id: string, noteHtml?: string) => void;
  addTag: (id: string, tag: string) => void;
  removeTag: (id: string, tag: string) => void;
  setCategory: (id: string, category?: string) => void;
};

const Ctx = createContext<CtxValue | null>(null);

export function ClipsProvider({ children }: { children: React.ReactNode }) {
  const { currentDocId } = useDocument();
  const base = useClips(currentDocId);
  const value = useMemo<CtxValue>(() => ({
    ...base,
    addClip: (payload) => {
      const clip: Clip = {
        id: payload.id ?? ("id-" + Math.random().toString(36).slice(2) + Date.now().toString(36)),
        createdUtc: payload.createdUtc ?? new Date().toISOString(),
        pinned: payload.pinned ?? false,
        docId: payload.docId ?? currentDocId,
        start: payload.start,
        length: payload.length,
        snippet: payload.snippet,
        noteHtml: payload.noteHtml,
      };
      base.setClips((prev) => [clip, ...prev]);
      return clip;
    },
    updateClipNote: (id, noteHtml) => {
      base.setClips((prev) => prev.map((c) => c.id === id ? { ...c, noteHtml } : c));
    },
    addTag: (id, tag) => {
      const t = tag.trim(); if (!t) return;
      base.setClips((prev) => prev.map((c) => c.id === id ? { ...c, tags: Array.from(new Set([...(c.tags || []), t])) } : c));
    },
    removeTag: (id, tag) => {
      base.setClips((prev) => prev.map((c) => c.id === id ? { ...c, tags: (c.tags || []).filter(x => x !== tag) } : c));
    },
    setCategory: (id, category) => {
      base.setClips((prev) => prev.map((c) => c.id === id ? { ...c, category } : c));
    },
  }), [base, currentDocId]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useClipsCtx() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useClipsCtx must be used within ClipsProvider");
  return v;
}
