import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type ToastKind = "info" | "success" | "warn" | "error";
export type Toast = { id: number; kind: ToastKind; message: string };

const ToastCtx = createContext<{ toasts: Toast[]; remove: (id: number) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    let idSeed = 1;
    const onToast = (e: Event) => {
      const ce = e as CustomEvent<{ message: string; kind?: ToastKind; ttl?: number }>;
      const id = idSeed++;
      const kind = ce.detail?.kind ?? "info";
      const ttl = ce.detail?.ttl ?? 3200;
      const message = ce.detail?.message ?? "";
      setToasts((prev) => [...prev, { id, kind, message }]);
      window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), ttl);
    };
    window.addEventListener("tr:toast", onToast as EventListener);
    return () => window.removeEventListener("tr:toast", onToast as EventListener);
  }, []);

  const remove = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));
  const value = useMemo(() => ({ toasts, remove }), [toasts]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div aria-live="polite" className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} role="status" className={`px-3 py-2 rounded-lg shadow border text-sm bg-white ${
              t.kind === "error" ? "border-red-300 text-red-900" :
              t.kind === "warn" ? "border-yellow-300 text-yellow-900" :
              t.kind === "success" ? "border-emerald-300 text-emerald-900" :
              "border-sepia-200 text-sepia-800"
            }`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("ToastProvider missing");
  return ctx;
}

export function notify(message: string, kind: ToastKind = "info", ttl = 3200) {
  try {
    window.dispatchEvent(new CustomEvent("tr:toast", { detail: { message, kind, ttl } }));
  } catch {
    // Fallback
    console.log(`[toast:${kind}]`, message);
  }
}

