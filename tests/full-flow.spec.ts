import { expect, test } from "@playwright/test";
import {
  clickGame,
  clickUntilScene,
  dragGame,
  expectScene,
  waitForGameSettled
} from "./helpers";

test("plays through the full prototype loop", async ({ page }) => {
  test.slow();
  const errors: string[] = [];
  // Headless browsers running in parallel can starve the shared audio device;
  // that renderer-level notice is environment noise, not an app defect.
  const benignErrorPatterns = [/AudioContext encountered an error from the audio device/];
  page.on("console", (message) => {
    if (message.type() === "error" && !benignErrorPatterns.some((pattern) => pattern.test(message.text()))) {
      errors.push(message.text());
    }
  });

  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await expectScene(page, "河岸");
  await waitForGameSettled(page);

  await clickUntilScene(page, 588, 548, "拼图");
  await dragGame(page, 260, 500, 520, 345);
  await dragGame(page, 640, 514, 640, 335);
  await dragGame(page, 980, 500, 760, 345);
  await expect(page.getByLabel("背包").getByText("巴当巨石碎片")).toBeVisible({
    timeout: 4000
  });
  await expect(page.getByLabel("进度").getByText("1/3 谜题")).toBeVisible();
  await expectScene(page, "河岸");
  await waitForGameSettled(page);

  await clickUntilScene(page, 840, 448, "符文");
  for (const point of [
    [550, 430],
    [910, 430],
    [370, 430],
    [730, 430]
  ]) {
    await clickGame(page, point[0], point[1]);
  }
  await expect(page.getByLabel("背包").getByText("狮门铭牌")).toBeVisible({
    timeout: 4000
  });
  await expect(page.getByLabel("进度").getByText("2/3 谜题")).toBeVisible();
  await expectScene(page, "河岸");
  await waitForGameSettled(page);

  await clickUntilScene(page, 1010, 570, "机关");
  for (const point of [
    [355, 472],
    [925, 472],
    [545, 472],
    [735, 472]
  ]) {
    await clickGame(page, point[0], point[1]);
  }
  await expect(page.getByLabel("背包").getByText("海门钥纹")).toBeVisible({
    timeout: 4000
  });
  await expect(page.getByLabel("进度").getByText("3/3 谜题")).toBeVisible();
  await expectScene(page, "河岸");
  await waitForGameSettled(page);

  await clickUntilScene(page, 1092, 282, "仪式");
  await page.evaluate(() => {
    for (let time = 900; time <= 22800; time += 120) {
      for (let lane = 0; lane < 4; lane += 1) {
        window.setTimeout(() => {
          window.dispatchEvent(new CustomEvent("lcw:rhythm-hit", { detail: lane }));
        }, time);
      }
    }
  });
  await expect(page.getByLabel("背包").getByText("灵界清音")).toBeVisible({
    timeout: 30000
  });
  await expectScene(page, "河岸");
  await waitForGameSettled(page);

  await clickUntilScene(page, 185, 330, "博物馆");
  await dragGame(page, 276, 604, 334, 382);
  await dragGame(page, 466, 604, 545, 382);
  await dragGame(page, 656, 604, 758, 382);
  await dragGame(page, 846, 604, 968, 382);
  await expect(page.getByText("展览完成")).toBeVisible({ timeout: 4000 });
  await expect(page.getByLabel("进度").getByText("200 游客")).toBeVisible();

  expect(errors).toEqual([]);
});
