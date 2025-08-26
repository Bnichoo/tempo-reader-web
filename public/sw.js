/* Tempo Reader SW: cache app shell + static assets (runtime), offline fallback */
const CACHE = "tempo-reader-v1";
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icons/icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* Strategy:
 * - Navigations: network-first, fallback to cached index.html.
 * - Static assets (script/style/font/image): stale-while-revalidate.
 * - Ignore POST/PUT/etc and cross-origin requests.
 */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin GET
  if (req.method !== "GET" || url.origin !== location.origin) return;

  // Navigations -> app shell
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put("/index.html", copy));
          return res;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Static assets SWR
  const dest = req.destination;
  if (["script", "style", "font", "image", "worker"].includes(dest)) {
    event.respondWith(
      caches.match(req).then((hit) => {
        const fetchPromise = fetch(req)
          .then((net) => {
            const copy = net.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
            return net;
          })
          .catch(() => hit);
        return hit || fetchPromise;
      })
    );
  }
});
