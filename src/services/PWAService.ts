import { useEffect, useRef, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function usePWAInstall() {
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const onBIP = (e: Event) => { e.preventDefault(); if ("prompt" in e) { deferredRef.current = e as BeforeInstallPromptEvent; setCanInstall(true); } };
    const onInstalled = () => setCanInstall(false);
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const promptInstall = async () => {
    const ev = deferredRef.current; if (!ev) return;
    await ev.prompt(); try { await ev.userChoice; } catch {}
    deferredRef.current = null; setCanInstall(false);
  };

  return { canInstall, offline, promptInstall } as const;
}

