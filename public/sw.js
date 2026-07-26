const CACHE_NAME = "lion-city-whispers-v10";
const RUNTIME_CACHE = "lion-city-whispers-runtime-v10";
const RUNTIME_CACHE_LIMIT = 80;
const CACHE_PREFIX = "lion-city-whispers";
const BASE_PATH = self.location.pathname.replace(/\/sw\.js$/, "");
const withBase = (path) => `${BASE_PATH}${path}`;
const BASE_ROOT = withBase("/");
const ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/robots.txt",
  "/sitemap.xml",
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

async function putInShellCache(request, response) {
  if (!isCacheableResponse(response)) {
    return;
  }
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
}

async function trimRuntimeCache(cache) {
  const keys = await cache.keys();
  if (keys.length <= RUNTIME_CACHE_LIMIT) {
    return;
  }
  await Promise.all(keys.slice(0, keys.length - RUNTIME_CACHE_LIMIT).map((key) => cache.delete(key)));
}

async function putInRuntimeCache(request, response) {
  if (!isCacheableResponse(response)) {
    return;
  }
  const cache = await caches.open(RUNTIME_CACHE);
  await cache.put(request, response.clone());
  await trimRuntimeCache(cache);
}

async function warmCache(urls) {
  const uniqueUrls = [...new Set(urls.filter((url) => typeof url === "string").filter(isSameOrigin))];
  const cache = await caches.open(RUNTIME_CACHE);
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
  await trimRuntimeCache(cache);
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
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(`${CACHE_PREFIX}-`) && key !== CACHE_NAME && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    // Sent by the page when the user accepts the in-app update prompt; the new
    // worker never seizes live pages on its own (no skipWaiting during install).
    self.skipWaiting();
    return;
  }
  if (event.data?.type !== "CACHE_URLS" || !Array.isArray(event.data.urls)) {
    return;
  }
  event.waitUntil(warmCache(event.data.urls));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || !isSameOrigin(request.url)) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          void putInShellCache(BASE_ROOT, response);
          return response;
        })
        .catch(() => caches.match(BASE_ROOT))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          void putInRuntimeCache(request, response);
          return response;
        })
        .catch(() => undefined);
      return cached || networkFetch;
    })
  );
});
