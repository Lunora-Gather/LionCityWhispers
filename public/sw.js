const CACHE_VERSION = "v7";
const CACHE_PREFIX = "lion-city-whispers";
const CACHE_NAME = `${CACHE_PREFIX}-${CACHE_VERSION}`;
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
  "/assets/images/world-cinematic-v3.webp",
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

const isSameOrigin = (url) => {
  try {
    return new URL(url, self.location.origin).origin === self.location.origin;
  } catch {
    return false;
  }
};

const isCacheableResponse = (response) => {
  return Boolean(response && response.status === 200 && response.type !== "opaque");
};

const normalizeSameOriginUrl = (url) => {
  const parsed = new URL(url, self.location.origin);
  return `${parsed.pathname}${parsed.search}`;
};

async function putInCache(request, response) {
  if (!isCacheableResponse(response)) {
    return;
  }
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
}

async function warmCache(urls) {
  const uniqueUrls = [...new Set(urls.filter((url) => typeof url === "string").filter(isSameOrigin))];
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(
    uniqueUrls.map(async (url) => {
      try {
        const response = await fetch(url, { credentials: "same-origin" });
        if (isCacheableResponse(response)) {
          await cache.put(normalizeSameOriginUrl(url), response);
        }
      } catch {
        // Runtime cache warming is best-effort.
      }
    })
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.allSettled(
          ASSETS.map((asset) =>
            fetch(asset, { credentials: "same-origin" }).then((response) => {
              if (isCacheableResponse(response)) {
                return cache.put(asset, response);
              }
              return undefined;
            })
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(`${CACHE_PREFIX}-`) && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_URLS" || !Array.isArray(event.data.urls)) {
    return;
  }
  event.waitUntil(warmCache(event.data.urls));
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
          event.waitUntil(putInCache(BASE_ROOT, response));
          return response;
        })
        .catch(() => caches.match(BASE_ROOT))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          event.waitUntil(putInCache(event.request, response));
          return response;
        })
        .catch(() => undefined);

      return cached ?? networkFetch;
    })
  );
});
