import type { RangeT } from "../types";

export type SessionState = {
  wIndex: number;
  playing: boolean;
  searchStr: string;
  hoverRange: RangeT | null;
  currentSelection: RangeT | null;
  aidRange: RangeT | null;
  clipsExpanded: boolean;
};

export type SessionAction =
  | { type: "setWordIndex"; index: number; maxWords: number }
  | { type: "advanceWords"; by: number; maxWords: number }
  | { type: "setPlaying"; value: boolean }
  | { type: "togglePlaying" }
  | { type: "pause" }
  | { type: "setSearch"; value: string }
  | { type: "setHoverRange"; range: RangeT | null }
  | { type: "setSelection"; range: RangeT | null }
  | { type: "setAidRange"; range: RangeT | null }
  | { type: "setClipsExpanded"; value: boolean }
  | { type: "toggleClipsExpanded" };

export function initSessionState(): SessionState {
  return {
    wIndex: 0,
    playing: false,
    searchStr: "",
    hoverRange: null,
    currentSelection: null,
    aidRange: null,
    clipsExpanded: false,
  };
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case "setWordIndex": {
      const max = Math.max(0, action.maxWords - 1);
      const next = Math.max(0, Math.min(action.index, max));
      if (next === state.wIndex) return state;
      return { ...state, wIndex: next };
    }
    case "advanceWords": {
      const max = Math.max(0, action.maxWords - 1);
      const next = Math.max(0, Math.min(state.wIndex + action.by, max));
      if (next === state.wIndex) return state;
      return { ...state, wIndex: next };
    }
    case "setPlaying":
      return action.value === state.playing ? state : { ...state, playing: action.value };
    case "togglePlaying":
      return { ...state, playing: !state.playing };
    case "pause":
      return state.playing ? { ...state, playing: false } : state;
    case "setSearch":
      return action.value === state.searchStr ? state : { ...state, searchStr: action.value };
    case "setHoverRange":
      return action.range === state.hoverRange ? state : { ...state, hoverRange: action.range };
    case "setSelection":
      return action.range === state.currentSelection ? state : { ...state, currentSelection: action.range };
    case "setAidRange":
      return action.range === state.aidRange ? state : { ...state, aidRange: action.range };
    case "setClipsExpanded":
      return action.value === state.clipsExpanded ? state : { ...state, clipsExpanded: action.value };
    case "toggleClipsExpanded":
      return { ...state, clipsExpanded: !state.clipsExpanded };
    default:
      return state;
  }
}

