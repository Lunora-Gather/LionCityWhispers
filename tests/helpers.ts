import { expect, type Page } from "@playwright/test";

/** Map 1280x720 game coordinates to page coordinates on the scaled canvas. */
export async function gamePoint(page: Page, gameX: number, gameY: number) {
  const box = await page.locator("canvas").boundingBox();
  if (!box) {
    throw new Error("Game canvas is not visible");
  }
  return {
    x: box.x + (box.width * gameX) / 1280,
    y: box.y + (box.height * gameY) / 720
  };
}

export async function clickGame(page: Page, gameX: number, gameY: number) {
  const point = await gamePoint(page, gameX, gameY);
  await page.mouse.click(point.x, point.y);
}

export async function dragGame(
  page: Page,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
) {
  const from = await gamePoint(page, fromX, fromY);
  const to = await gamePoint(page, toX, toY);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
}

export async function expectScene(page: Page, name: string, timeout = 30000) {
  await expect(page.getByLabel("进度").getByText(name)).toBeVisible({ timeout });
}

/** Click a world interactable until the target scene label shows up. */
export async function clickUntilScene(page: Page, gameX: number, gameY: number, name: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await clickGame(page, gameX, gameY);
    try {
      await page.getByLabel("进度").getByText(name).waitFor({ state: "visible", timeout: 2500 });
      return;
    } catch {
      await page.waitForTimeout(300);
    }
  }
  await expectScene(page, name);
}

/** Jump to a scene via the chapter event and wait for its HUD label. */
export async function openScene(page: Page, scene: string, label: string, settleMs = 300) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.evaluate((target) => {
      window.dispatchEvent(new CustomEvent("lcw:chapter", { detail: target }));
    }, scene);
    try {
      await page.getByLabel("进度").getByText(label).waitFor({ state: "visible", timeout: 2500 });
      if (settleMs > 0) {
        await page.waitForTimeout(settleMs);
      }
      return;
    } catch {
      await page.waitForTimeout(250);
    }
  }
  await expect(page.getByLabel("进度").getByText(label)).toBeVisible({ timeout: 15000 });
  if (settleMs > 0) {
    await page.waitForTimeout(settleMs);
  }
}

export async function waitForGameSettled(page: Page) {
  await page.waitForFunction(() => {
    const box = document.querySelector("canvas")?.getBoundingClientRect();
    return Boolean(box && box.width > 600 && box.height > 300);
  });
  await page.waitForTimeout(1000);
}

/** Seed a save with all four artifacts collected and every rite complete. */
export async function seedCompletedSave(page: Page) {
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
}
