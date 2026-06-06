import { expect, type Page, test } from "@playwright/test";

type Rect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
};

async function openScene(page: Page, scene: string, label: string) {
  await page.evaluate((target) => {
    window.dispatchEvent(new CustomEvent("lcw:chapter", { detail: target }));
  }, scene);
  await expect(page.getByLabel("进度").getByText(label)).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(300);
}

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
      title: document.title,
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
  expect(metrics.title).toBe("狮城秘语 | Lion City Whispers");
  expect(metrics.progressOverlapsDialogue).toBe(false);
  expect(metrics.inventoryOverlapsDialogue).toBe(false);
  expect(metrics.toolbarOverlapsInventory).toBe(false);
  expect([...loadedAssets].some((url) => url.includes("world-cinematic-v3.webp"))).toBe(true);
});

test("keeps polished puzzle and museum scenes stable", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.addInitScript(() => {
    window.localStorage.setItem(
      "lcw:save:v2",
      JSON.stringify({
        version: 2,
        inventoryIds: ["badang-stone", "rune-plaque", "harbor-seal", "spirit-chime"],
        flags: { jigsaw: true, runes: true, lock: true, rhythm: true },
        museum: { placements: {}, visitors: 0, complete: false },
        dialogue: "四件文物已经备齐，等待入柜。",
        easyMode: true,
        settings: { muted: true, volume: 0.4, reduceMotion: true, locale: "zh" }
      })
    );
  });

  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByLabel("进度").getByText("河岸")).toBeVisible({ timeout: 5000 });

  for (const [scene, label] of [
    ["JigsawPuzzle", "拼图"],
    ["RunesPuzzle", "符文"],
    ["LockPuzzle", "机关"],
    ["MuseumScene", "博物馆"]
  ] as const) {
    await openScene(page, scene, label);
    const canvas = await page.locator("canvas").boundingBox();
    expect(canvas?.width ?? 0).toBeGreaterThan(1000);
    expect(canvas?.height ?? 0).toBeGreaterThan(560);
  }

  expect(errors).toEqual([]);
});
