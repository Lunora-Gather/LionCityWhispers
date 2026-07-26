import { expect, test } from "@playwright/test";
import { clickGame, clickUntilScene, seedCompletedSave } from "./helpers";

test("places museum artifacts without drag input", async ({ page }) => {
  test.slow();
  await seedCompletedSave(page);

  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator(".artifact-pill")).toHaveCount(4, { timeout: 15000 });
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
