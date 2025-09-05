import { useEffect, useRef } from "react";

export function useBackup<T extends object>(data: T, key = "tr:backup:v1", intervalMs = 5000) {
  const ref = useRef<T | null>(null);
  useEffect(() => { ref.current = data; }, [data]);

  useEffect(() => {
    const doBackup = () => {
      try { const d = ref.current; if (!d) return; localStorage.setItem(key, JSON.stringify({ ts: Date.now(), ...d } as any)); } catch {}
    };
    const onBeforeUnload = () => doBackup();
    const onPageHide = () => doBackup();
    const onVis = () => { if (document.visibilityState === "hidden") doBackup(); };
    const iv = window.setInterval(doBackup, intervalMs);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(iv);
    };
  }, [key, intervalMs]);
}

