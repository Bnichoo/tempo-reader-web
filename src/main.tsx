import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

console.log("[main] loaded"); // should appear in DevTools Console

const el = document.getElementById("root");
if (!el) throw new Error("No #root element found in index.html");

createRoot(el).render(<App />);
// PWA: register service worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {/* ignore */});
  });
}
