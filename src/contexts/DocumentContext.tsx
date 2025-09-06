/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useMemo, useState, useCallback } from "react";
import { useTokenizer } from "../lib/useTokenizer";
import { hashDocId } from "../lib/doc";
import { processFileToText } from "../services/FileProcessingService";

const SAMPLE_TEXT = `Reading isn't one thing; it is a braid of habits woven together. As eyes move, the mind predicts, discards, and stitches meaning on the fly. Most of this happens below awareness, but our experience of a page changes dramatically when attention is guided.

Focus reading makes that guidance explicit. It gives a gentle nudge to where your attention should settle next, then steps out of the way. The rhythm matters: too fast and comprehension collapses; too slow and your mind wanders off the line.

Clips are memory anchors. When you highlight a passage and jot a quick note, you are leaving a breadcrumb for your future self. The value of a clip is rarely the text alone; it's the thought you attach to it.

Try jumping between clips and let your eyes glide. Notice how the sentence structure becomes more obvious when the clutter fades. This is where reading feels less like scanning and more like following a current.`;

type DocContextValue = {
  text: string;
  setText: (t: string) => void;
  tokens: string[];
  isProcessingFile: boolean;
  onFile: (f: File) => Promise<void>;
  currentDocId: string;
};

const Ctx = createContext<DocContextValue | null>(null);

export function DocumentProvider({ children }: { children: React.ReactNode }) {
  const [text, setText] = useState<string>(SAMPLE_TEXT);
  const tokens = useTokenizer(text);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  const onFile = useCallback(async (file: File) => {
    setIsProcessingFile(true);
    try {
      if (file.size > 4 * 1024 * 1024) alert("This file is quite large (>4MB). It may feel slow.");
      const clean = await processFileToText(file);
      setText(clean);
    } finally {
      setIsProcessingFile(false);
    }
  }, []);

  const value = useMemo<DocContextValue>(() => ({
    text,
    setText,
    tokens,
    isProcessingFile,
    onFile,
    currentDocId: hashDocId(text),
  }), [text, tokens, isProcessingFile, onFile]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDocument() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDocument must be used within DocumentProvider");
  return v;
}

