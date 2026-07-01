import { inflateSync } from "node:zlib";
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
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.evaluate((target) => {
      window.dispatchEvent(new CustomEvent("lcw:chapter", { detail: target }));
    }, scene);
    try {
      await page.getByLabel("进度").getByText(label).waitFor({ state: "visible", timeout: 2500 });
      await page.waitForTimeout(300);
      return;
    } catch {
      await page.waitForTimeout(250);
    }
  }
  await expect(page.getByLabel("进度").getByText(label)).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(300);
}

async function screenshotVisualStats(page: Page) {
  const image = await page.locator("canvas").screenshot();
  const pixels = readPngPixels(image);
  const colors = new Set<string>();
  let nonTransparent = 0;
  let colorful = 0;
  let minLuminance = 255;
  let maxLuminance = 0;
  const step = Math.max(1, Math.floor(pixels.width / 160));

  for (let y = 0; y < pixels.height; y += step) {
    for (let x = 0; x < pixels.width; x += step) {
      const index = (y * pixels.width + x) * 4;
      const red = pixels.data[index];
      const green = pixels.data[index + 1];
      const blue = pixels.data[index + 2];
      const alpha = pixels.data[index + 3];
      if (alpha < 16) {
        continue;
      }
      nonTransparent += 1;
      colors.add(`${red >> 4}-${green >> 4}-${blue >> 4}`);
      if (Math.max(red, green, blue) - Math.min(red, green, blue) > 18) {
        colorful += 1;
      }
      const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      minLuminance = Math.min(minLuminance, luminance);
      maxLuminance = Math.max(maxLuminance, luminance);
    }
  }

  return {
    colorfulRatio: colorful / Math.max(1, nonTransparent),
    luminanceSpread: maxLuminance - minLuminance,
    nonTransparent,
    uniqueColors: colors.size
  };
}

function readPngPixels(image: Buffer) {
  const pngSignature = "89504e470d0a1a0a";
  if (image.subarray(0, 8).toString("hex") !== pngSignature) {
    throw new Error("Screenshot is not a PNG");
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat: Buffer[] = [];
  while (offset < image.length) {
    const length = image.readUInt32BE(offset);
    const type = image.subarray(offset + 4, offset + 8).toString("ascii");
    const data = image.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const bitDepth = data[8];
      colorType = data[9];
      if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
        throw new Error(`Unsupported PNG format ${bitDepth}/${colorType}`);
      }
    } else if (type === "IDAT") {
      idat.push(Buffer.from(data));
    } else if (type === "IEND") {
      break;
    }
  }

  const channels = colorType === 6 ? 4 : 3;
  const scanline = width * channels;
  const raw = inflateSync(Buffer.concat(idat));
  const rgba = Buffer.alloc(width * height * 4);
  let rawOffset = 0;
  let previous = Buffer.alloc(scanline);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[rawOffset];
    rawOffset += 1;
    const current = Buffer.from(raw.subarray(rawOffset, rawOffset + scanline));
    rawOffset += scanline;
    unfilterPngRow(current, previous, channels, filter);
    for (let x = 0; x < width; x += 1) {
      const sourceIndex = x * channels;
      const targetIndex = (y * width + x) * 4;
      rgba[targetIndex] = current[sourceIndex];
      rgba[targetIndex + 1] = current[sourceIndex + 1];
      rgba[targetIndex + 2] = current[sourceIndex + 2];
      rgba[targetIndex + 3] = channels === 4 ? current[sourceIndex + 3] : 255;
    }
    previous = current;
  }
  return { data: rgba, height, width };
}

function unfilterPngRow(row: Buffer, previous: Buffer, bytesPerPixel: number, filter: number) {
  for (let index = 0; index < row.length; index += 1) {
    const left = index >= bytesPerPixel ? row[index - bytesPerPixel] : 0;
    const up = previous[index] ?? 0;
    const upLeft = index >= bytesPerPixel ? previous[index - bytesPerPixel] : 0;
    if (filter === 1) {
      row[index] = (row[index] + left) & 0xff;
    } else if (filter === 2) {
      row[index] = (row[index] + up) & 0xff;
    } else if (filter === 3) {
      row[index] = (row[index] + Math.floor((left + up) / 2)) & 0xff;
    } else if (filter === 4) {
      row[index] = (row[index] + paeth(left, up, upLeft)) & 0xff;
    } else if (filter !== 0) {
      throw new Error(`Unsupported PNG filter ${filter}`);
    }
  }
}

function paeth(left: number, up: number, upLeft: number) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) {
    return left;
  }
  return upDistance <= upLeftDistance ? up : upLeft;
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
    const route = rect(".route-rail");
    const dialogue = rect(".dialogue-bar");
    const toolbar = rect(".toolbar");
    return {
      title: document.title,
      canvas,
      canvasRatio: canvas ? canvas.width / canvas.height : 0,
      loadedWorldAsset: performance
        .getEntriesByType("resource")
        .some((entry) => entry.name.includes("world-cinematic-v3.webp")),
      progressOverlapsDialogue: overlaps(progress, dialogue),
      inventoryOverlapsDialogue: overlaps(inventory, dialogue),
      routeOverlapsDialogue: overlaps(route, dialogue),
      routeOverlapsInventory: overlaps(route, inventory),
      routeOverlapsProgress: overlaps(route, progress),
      toolbarOverlapsInventory: overlaps(toolbar, inventory)
    };
  });

  expect(metrics.canvas?.width ?? 0).toBeGreaterThan(1000);
  expect(metrics.canvas?.height ?? 0).toBeGreaterThan(560);
  expect(metrics.canvasRatio).toBeGreaterThan(1.7);
  expect(metrics.canvasRatio).toBeLessThan(1.9);
  expect(metrics.title).toBe("狮城秘语 | Lion City Whispers");
  await expect(page.getByLabel("修复路线")).toBeVisible();
  await expect(page.locator(".route-step[data-state='current']")).toContainText("巨石");
  expect(metrics.progressOverlapsDialogue).toBe(false);
  expect(metrics.inventoryOverlapsDialogue).toBe(false);
  expect(metrics.routeOverlapsDialogue).toBe(false);
  expect(metrics.routeOverlapsInventory).toBe(false);
  expect(metrics.routeOverlapsProgress).toBe(false);
  expect(metrics.toolbarOverlapsInventory).toBe(false);
  expect(
    metrics.loadedWorldAsset || [...loadedAssets].some((url) => url.includes("world-cinematic-v3.webp"))
  ).toBe(true);
});

test("keeps polished ritual, puzzle, and museum scenes stable", async ({ page }) => {
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
  await expect(page.getByLabel("进度").getByText("河岸")).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".route-step[data-state='done']")).toHaveCount(4);
  await expect(page.locator(".route-step[data-state='current']")).toContainText("展厅");

  for (const [scene, label] of [
    ["JigsawPuzzle", "拼图"],
    ["RunesPuzzle", "符文"],
    ["LockPuzzle", "机关"],
    ["RhythmScene", "仪式"],
    ["MuseumScene", "博物馆"]
  ] as const) {
    await openScene(page, scene, label);
    const canvas = await page.locator("canvas").boundingBox();
    expect(canvas?.width ?? 0).toBeGreaterThan(1000);
    expect(canvas?.height ?? 0).toBeGreaterThan(560);
  }

  expect(errors).toEqual([]);
});

test("keeps key canvas scenes visually nonblank", async ({ page }) => {
  test.setTimeout(90000);
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
  await expect(page.getByLabel("进度").getByText("河岸")).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(800);

  for (const scene of [
    ["WorldScene", "河岸"],
    ["JigsawPuzzle", "拼图"],
    ["RunesPuzzle", "符文"],
    ["LockPuzzle", "机关"],
    ["RhythmScene", "仪式"],
    ["MuseumScene", "博物馆"]
  ] as const) {
    if (scene[0] !== "WorldScene") {
      await openScene(page, scene[0], scene[1]);
    }
    const stats = await screenshotVisualStats(page);
    expect(stats.nonTransparent, scene[1]).toBeGreaterThan(2000);
    expect(stats.uniqueColors, scene[1]).toBeGreaterThan(24);
    expect(stats.luminanceSpread, scene[1]).toBeGreaterThan(35);
    expect(stats.colorfulRatio, scene[1]).toBeGreaterThan(0.02);
  }
});
