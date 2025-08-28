export type RangeT = { start: number; length: number };

export type Clip = {
  id: string;
  start: number;
  length: number;
  snippet: string;
  noteHtml?: string;
  pinned?: boolean;
  createdUtc: string;
};

export type SettingsV1 = {
  wps: number;
  count: number;
  gap: number;
  focusScale: number;
  dimScale: number;
  dimBlur: number;
  fontPx: number;
  dark: boolean;
  drawerOpen: boolean;
};

