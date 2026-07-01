import { expect, type Page, test } from "@playwright/test";

async function openChapter(page: Page, target: string, label: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.evaluate((scene) => {
      window.dispatchEvent(new CustomEvent("lcw:chapter", { detail: scene }));
    }, target);
    try {
      await page.getByLabel("进度").getByText(label).waitFor({ state: "visible", timeout: 2500 });
      return;
    } catch {
      await page.waitForTimeout(250);
    }
  }
  await expect(page.getByLabel("进度").getByText(label)).toBeVisible({ timeout: 15000 });
}

test("settings overlay blocks world hotkeys until it is closed", async ({ page }) => {
  test.slow();
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByLabel("进度").getByText("河岸")).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: "设置" }).click();
  await expect(page.getByRole("dialog", { name: "设置" })).toBeVisible({ timeout: 15000 });
  await page.evaluate(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      active.blur();
    }
  });

  await page.keyboard.press("Space");
  await expect(page.getByRole("dialog", { name: "设置" })).toBeVisible({ timeout: 15000 });
  await expect(page.getByLabel("进度").getByText("河岸")).toBeVisible({ timeout: 15000 });
  await expect(page.getByLabel("进度").getByText("对话")).toBeHidden();

  await page.getByRole("button", { name: "关闭设置" }).click();
  await expect(page.getByRole("dialog", { name: "设置" })).toBeHidden({ timeout: 15000 });

  await page.keyboard.press("Space");
  await expect(page.getByLabel("进度").getByText("对话")).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(3000);
  await expect(page.getByLabel("进度").getByText("对话")).toBeVisible({ timeout: 15000 });
});

test("shows a paused rite state while settings are open in rhythm mode", async ({ page }) => {
  test.slow();
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByLabel("进度").getByText("河岸")).toBeVisible({ timeout: 15000 });
  await openChapter(page, "RhythmScene", "仪式");

  await page.getByRole("button", { name: "设置" }).click();
  await expect(page.getByRole("dialog", { name: "设置" })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("仪式已暂停")).toBeVisible({ timeout: 15000 });
});
