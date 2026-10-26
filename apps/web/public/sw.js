// Offline support (REVIEW A-10): an offline page for navigations, and build files kept so the shell loads fast.
// Never stores pages or API answers (see sw-rules.js).
importScripts("/sw-rules.js");

const { CACHE, PRECACHE, route } = self.krSw;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith("kr-") && k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const kind = route({ method: req.method, url: req.url, mode: req.mode }, self.location.origin);
  if (kind === "page") {
    event.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
  } else if (kind === "static") {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok && res.type === "basic") {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});
