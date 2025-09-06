import React, { createContext, useContext, useMemo, useReducer } from "react";

export type ReaderState = {
  wIndex: number;
  playing: boolean;
};

export type ReaderAction =
  | { type: "setIndex"; value: number }
  | { type: "play" }
  | { type: "pause" }
  | { type: "toggle" };

function reducer(state: ReaderState, action: ReaderAction): ReaderState {
  switch (action.type) {
    case "setIndex":
      return { ...state, wIndex: Math.max(0, action.value | 0) };
    case "play":
      return { ...state, playing: true };
    case "pause":
      return { ...state, playing: false };
    case "toggle":
      return { ...state, playing: !state.playing };
    default:
      return state;
  }
}

type ReaderContextValue = ReaderState & {
  dispatch: React.Dispatch<ReaderAction>;
  setWIndex: (i: number) => void;
  setPlaying: (v: boolean) => void;
  togglePlaying: () => void;
};

const Ctx = createContext<ReaderContextValue | null>(null);

export function ReaderProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { wIndex: 0, playing: false });
  const value = useMemo<ReaderContextValue>(() => ({
    ...state,
    dispatch,
    setWIndex: (i: number) => dispatch({ type: "setIndex", value: i }),
    setPlaying: (v: boolean) => dispatch({ type: v ? "play" : "pause" }),
    togglePlaying: () => dispatch({ type: "toggle" }),
  }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useReader() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useReader must be used within ReaderProvider");
  return v;
}

