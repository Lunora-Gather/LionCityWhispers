import { expect, test } from "@playwright/test";

type Rect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
};

test("keeps the first world screen readable on desktop", async ({ page }) => {
  const loadedAssets = new Set<string>();
  page.on("requestfinished", (request) => {
    loadedAssets.add(request.url());
  });

  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByLabel("进度").getByText("河岸")).toBeVisible();
  await page.waitForTimeout(800);

  const metrics = await page.evaluate(() => {
    const rect = (selector: string) => {
      const node = document.querySelector(selector);
      if (!node) {
        return null;
      }
      const box = node.getBoundingClientRect();
      return {
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom,
        width: box.width,
        height: box.height
      };
    };
    const overlaps = (a: Rect | null, b: Rect | null) =>
      Boolean(
        a &&
          b &&
          a.left < b.right &&
          a.right > b.left &&
          a.top < b.bottom &&
          a.bottom > b.top
      );
    const canvas = rect("canvas");
    const progress = rect(".progress-strip");
    const inventory = rect(".inventory-dock");
    const dialogue = rect(".dialogue-bar");
    const toolbar = rect(".toolbar");
    return {
      canvas,
      canvasRatio: canvas ? canvas.width / canvas.height : 0,
      progressOverlapsDialogue: overlaps(progress, dialogue),
      inventoryOverlapsDialogue: overlaps(inventory, dialogue),
      toolbarOverlapsInventory: overlaps(toolbar, inventory)
    };
  });

  expect(metrics.canvas?.width ?? 0).toBeGreaterThan(1000);
  expect(metrics.canvas?.height ?? 0).toBeGreaterThan(560);
  expect(metrics.canvasRatio).toBeGreaterThan(1.7);
  expect(metrics.canvasRatio).toBeLessThan(1.9);
  expect(metrics.progressOverlapsDialogue).toBe(false);
  expect(metrics.inventoryOverlapsDialogue).toBe(false);
  expect(metrics.toolbarOverlapsInventory).toBe(false);
  expect([...loadedAssets].some((url) => url.includes("world-cinematic-v3.webp"))).toBe(true);
});
