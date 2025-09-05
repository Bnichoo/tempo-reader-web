import { createRoot } from "react-dom/client";
import App from "./App";
import { initGlobalErrorHandlers, logger } from "./lib/logger";
import { ToastProvider } from "./lib/toast";
import "./index.css";

const el = document.getElementById("root");
if (!el) throw new Error("No #root element found in index.html");

createRoot(el).render(
  <ToastProvider>
    <App />
  </ToastProvider>
);
// PWA: register service worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {/* ignore */});
  });
}

// Telemetry: attach global handlers and a friendly hello in debug
initGlobalErrorHandlers();
logger.debug("Telemetry initialized");
