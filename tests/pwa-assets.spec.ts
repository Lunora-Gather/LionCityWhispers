import { expect, test } from "@playwright/test";

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

test("starts from the cached route after the service worker is warmed", async ({ page, context }) => {
  await page.goto("/?pwa=1");
  await expect(page.locator("canvas")).toBeVisible();
  await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) {
      throw new Error("service worker unavailable");
    }
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      location.reload();
    }
  });
  await page.waitForLoadState("load");
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(async () => {
    const resourceUrls = performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((name) => name.includes("/_next/") && name.includes(".js"));
    if (resourceUrls.length === 0) {
      return false;
    }
    const hits = await Promise.all(resourceUrls.map((name) => caches.match(name)));
    return hits.every(Boolean);
  });

  await context.setOffline(true);
  await page.reload({ waitUntil: "load" });
  await expect(page.locator("canvas")).toBeVisible({ timeout: 10000 });
  await context.setOffline(false);
});
