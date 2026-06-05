const CACHE_NAME = "lion-city-whispers-v4";
const BASE_PATH = self.location.pathname.replace(/\/sw\.js$/, "");
const withBase = (path) => `${BASE_PATH}${path}`;
const BASE_ROOT = withBase("/");
const ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/assets/images/lion-city-ink-bg.webp",
  "/assets/images/world-cinematic.webp",
  "/assets/images/museum-gallery.webp",
  "/assets/images/artifact-sheet.webp",
  "/assets/images/curator-lin.webp",
  "/assets/audio/ui-click.wav",
  "/assets/audio/snap.wav",
  "/assets/audio/success.wav",
  "/assets/audio/miss.wav",
  "/assets/audio/ritual-perfect.wav",
  "/assets/audio/ritual-good.wav"
].map(withBase);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_URLS" || !Array.isArray(event.data.urls)) {
    return;
  }
  const urls = event.data.urls
    .filter((url) => typeof url === "string")
    .filter((url) => {
      try {
        return new URL(url, self.location.origin).origin === self.location.origin;
      } catch {
        return false;
      }
    });
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(urls.map((url) => cache.add(url).catch(() => undefined)))
    )
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return;
  }
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(BASE_ROOT, copy)));
          }
          return response;
        })
        .catch(() => caches.match(BASE_ROOT))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ??
        fetch(event.request).then((response) => {
          if (!response || response.status !== 200) {
            return response;
          }
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)));
          return response;
        })
    )
  );
});
