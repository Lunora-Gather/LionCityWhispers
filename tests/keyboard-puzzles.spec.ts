import { expect, type Page, test } from "@playwright/test";

async function openScene(page: Page, scene: string, label: string) {
  await page.evaluate((target) => {
    window.dispatchEvent(new CustomEvent("lcw:chapter", { detail: target }));
  }, scene);
  await expect(page.getByLabel("进度").getByText(label)).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(500);
}

async function pressNumberSequence(page: Page, keys: string[]) {
  for (const key of keys) {
    await page.keyboard.press(key);
    await page.waitForTimeout(80);
  }
}

test("completes rune and lock puzzles with number keys", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByLabel("进度").getByText("河岸")).toBeVisible();

  await openScene(page, "RunesPuzzle", "符文");
  await pressNumberSequence(page, ["2", "4", "1", "3"]);
  await expect(page.getByLabel("背包").getByText("狮门铭牌")).toBeVisible({
    timeout: 5000
  });

  await openScene(page, "LockPuzzle", "机关");
  await pressNumberSequence(page, ["1", "4", "2", "3"]);
  await expect(page.getByLabel("背包").getByText("海门钥纹")).toBeVisible({
    timeout: 5000
  });
});
