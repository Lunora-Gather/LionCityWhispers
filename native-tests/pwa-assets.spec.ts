import { createServer, request } from "node:http";
import { once } from "node:events";
import { expect, test } from "./safari";

const imageAssets = [
  "/icon-192.png",
  "/icon-512.png",
  "/assets/images/lion-city-ink-bg.webp",
  "/assets/images/world-cinematic-v3.webp",
  "/assets/images/museum-gallery.webp",
  "/assets/images/artifact-sheet.webp",
  "/assets/images/curator-lin.webp"
];

const audioAssets = [
  "/assets/audio/ui-click.wav",
  "/assets/audio/snap.wav",
  "/assets/audio/success.wav",
  "/assets/audio/miss.wav",
  "/assets/audio/ritual-perfect.wav",
  "/assets/audio/ritual-good.wav"
];

test("keeps install metadata and critical asset budgets valid", async ({ request }) => {
  const manifestResponse = await request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBeTruthy();
  const manifest = await manifestResponse.json();
  expect(manifest.display).toBe("standalone");
  expect(["/", "./"]).toContain(manifest.scope);
  expect(manifest.orientation).toBe("landscape-primary");
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ src: "./icon-192.png", sizes: "192x192", type: "image/png" }),
      expect.objectContaining({ src: "./icon-512.png", sizes: "512x512", type: "image/png" })
    ])
  );

  const swResponse = await request.get("/sw.js");
  expect(swResponse.ok()).toBeTruthy();
  const swText = await swResponse.text();
  expect(swText).toContain("catch(() => caches.match(BASE_ROOT)");
  expect(swText).toMatch(/event\.waitUntil\(\s*caches\s*\.open\(CACHE_NAME\)/);
  expect(swText).toContain("CACHE_URLS");
  expect(swText).toContain("curator-lin.webp");
  expect(swText).toContain("success.wav");
  expect(swText).toContain("icon-512.png");

  let imageBytes = 0;
  for (const asset of imageAssets) {
    const response = await request.get(asset);
    expect(response.ok(), asset).toBeTruthy();
    imageBytes += (await response.body()).byteLength;
  }
  expect(imageBytes).toBeLessThan(2_200_000);

  let audioBytes = 0;
  for (const asset of audioAssets) {
    const response = await request.get(asset);
    expect(response.ok(), asset).toBeTruthy();
    audioBytes += (await response.body()).byteLength;
  }
  expect(audioBytes).toBeLessThan(120_000);
});

test("starts from the cached route after the service worker is warmed", async ({ page, baseURL }) => {
  // Disconnect this test origin at the HTTP layer. Browser-level offline
  // emulation can abort a WebKit navigation before the worker sees it.
  if (!baseURL) throw new Error("Missing game server URL");
  const target = new URL(baseURL);
  const server = createServer((incoming, outgoing) => {
    const upstream = request(target, {
      path: incoming.url,
      method: incoming.method,
      headers: { ...incoming.headers, host: target.host },
    }, (response) => {
      outgoing.writeHead(response.statusCode!, response.headers);
      response.pipe(outgoing);
    });
    upstream.on("error", () => outgoing.destroy());
    incoming.pipe(upstream);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test origin");
  const origin = `http://127.0.0.1:${address.port}`;
  async function disconnect() {
    if (!server.listening) return;
    const closed = once(server, "close");
    server.close();
    server.closeAllConnections();
    await closed;
  }
  try {
    await page.goto(origin + "/?pwa=1");
    await expect(page.locator("canvas")).toBeVisible();
    const hasController = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) {
        throw new Error("service worker unavailable");
      }
      await navigator.serviceWorker.ready;
      return Boolean(navigator.serviceWorker.controller);
    });
    if (!hasController) {
      // Reload from the test side; calling location.reload() inside evaluate
      // destroys the execution context mid-call and rejects the evaluation.
      await page.reload({ waitUntil: "load" });
    }
    await expect(page.locator("canvas")).toBeVisible();
    await expect.poll(() => page.evaluate(async () => {
      const resourceUrls = performance
        .getEntriesByType("resource")
        .map((entry) => entry.name)
        .filter((name) => name.includes("/_next/") && /\.(js|css)(\?|$)/.test(name));
      if (resourceUrls.length === 0) {
        return false;
      }
      const hits = await Promise.all(resourceUrls.map((name) => caches.match(name)));
      return hits.every(Boolean);
    }), { timeout: 30000 }).toBe(true);

    await disconnect();
    await page.reload({ waitUntil: "load" });
    await expect(page.locator("canvas")).toBeVisible({ timeout: 10000 });
  } finally {
    await disconnect();
  }
});
