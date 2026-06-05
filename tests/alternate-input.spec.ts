import { expect, type Page, test } from "@playwright/test";

async function gamePoint(page: Page, gameX: number, gameY: number) {
  const box = await page.locator("canvas").boundingBox();
  if (!box) {
    throw new Error("Game canvas is not visible");
  }
  return {
    x: box.x + (box.width * gameX) / 1280,
    y: box.y + (box.height * gameY) / 720
  };
}

async function clickGame(page: Page, gameX: number, gameY: number) {
  const point = await gamePoint(page, gameX, gameY);
  await page.mouse.click(point.x, point.y);
}

async function clickUntilScene(page: Page, gameX: number, gameY: number, name: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await clickGame(page, gameX, gameY);
    try {
      await page.getByLabel("进度").getByText(name).waitFor({ state: "visible", timeout: 2500 });
      return;
    } catch {
      await page.waitForTimeout(300);
    }
  }
  await expect(page.getByLabel("进度").getByText(name)).toBeVisible();
}

test("places museum artifacts without drag input", async ({ page }) => {
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
  await expect(page.locator(".artifact-pill")).toHaveCount(4);
  await page.waitForTimeout(1000);

  await clickUntilScene(page, 185, 330, "博物馆");

  for (const pair of [
    [276, 604, 334, 382],
    [466, 604, 545, 382],
    [656, 604, 758, 382],
    [846, 604, 968, 382]
  ]) {
    await clickGame(page, pair[0], pair[1]);
    await clickGame(page, pair[2], pair[3]);
  }

  await expect(page.getByText("展览完成")).toBeVisible();
  await expect(page.getByLabel("进度").getByText("200 游客")).toBeVisible();
});
