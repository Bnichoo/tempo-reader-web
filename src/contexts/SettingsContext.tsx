import React, { createContext, useContext } from "react";
import { useSettings } from "../hooks/useSettings";

type CtxValue = ReturnType<typeof useSettings>;

const Ctx = createContext<CtxValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const value = useSettings();
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettingsCtx() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSettingsCtx must be used within SettingsProvider");
  return v;
}

