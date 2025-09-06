import React, { createContext, useContext, useState } from "react";
import type { RangeT } from "../types";

type Value = {
  selection: RangeT | null;
  setSelection: (r: RangeT | null) => void;
  hoverRange: RangeT | null;
  setHoverRange: (r: RangeT | null) => void;
  aidRange: RangeT | null;
  setAidRange: (r: RangeT | null) => void;
};

const Ctx = createContext<Value | null>(null);

export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const [selection, setSelection] = useState<RangeT | null>(null);
  const [hoverRange, setHoverRange] = useState<RangeT | null>(null);
  const [aidRange, setAidRange] = useState<RangeT | null>(null);
  return (
    <Ctx.Provider value={{ selection, setSelection, hoverRange, setHoverRange, aidRange, setAidRange }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSelectionCtx() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSelectionCtx must be used within SelectionProvider");
  return v;
}
