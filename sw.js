/* Skeleton service worker: cache-first shell, cache-first word lists (they are immutable-by-rule on
 * the mirror: a content change is a new -v<n> name, and the unversioned NL files bump the app's own
 * cache logic — revisit when list refresh lands; see todo.md). Bump VERSION on every deploy. */
const VERSION = "v202609021959";
const SHELL = ["./", "app.js", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

self.addEventListener("install", (e) => {
  self.skipWaiting(); // take over on the next reload instead of waiting for every tab to close first
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  const cacheable = e.request.method === "GET" && (url.origin === location.origin || url.pathname.includes("/wordlists/"));
  if (!cacheable) return;
  e.respondWith(
    caches.match(e.request).then(
      (hit) =>
        hit ??
        fetch(e.request).then((resp) => {
          if (resp.ok) {
            const copy = resp.clone();
            caches.open(VERSION).then((c) => c.put(e.request, copy));
          }
          return resp;
        })
    )
  );
});
