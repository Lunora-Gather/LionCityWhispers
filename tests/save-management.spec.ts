import { expect, test } from "@playwright/test";

async function gamePoint(page: any, gameX: number, gameY: number) {
  const box = await page.locator("canvas").boundingBox();
  if (!box) {
    throw new Error("Game canvas is not visible");
  }
  return {
    x: box.x + (box.width * gameX) / 1280,
    y: box.y + (box.height * gameY) / 720
  };
}

async function clickGame(page: any, gameX: number, gameY: number) {
  const point = await gamePoint(page, gameX, gameY);
  await page.mouse.click(point.x, point.y);
}

async function clickUntilScene(page: any, gameX: number, gameY: number, name: string) {
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

test.describe("Save Management", () => {
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  });

  test("exports save, resets progress, and imports save to restore progress", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("canvas")).toBeVisible();
    await expect(page.getByLabel("进度").getByText("河岸")).toBeVisible();
    await page.waitForTimeout(1000);

    // Solve Jigsaw puzzle to get some progress
    await clickUntilScene(page, 588, 548, "拼图");
    await page.keyboard.press("1");
    await page.keyboard.press("2");
    await page.keyboard.press("3");
    await expect(page.getByLabel("背包").getByText("巴当巨石碎片")).toBeVisible({
      timeout: 5000
    });

    // Open settings and export save
    await page.getByRole("button", { name: "设置" }).click();
    await page.getByRole("button", { name: "导出存档" }).click();
    await expect(page.locator(".toast-notification")).toContainText("存档代码已复制");

    // Read the save code from clipboard
    const saveCode = await page.evaluate(async () => {
      return await navigator.clipboard.readText();
    });
    expect(saveCode).toBeTruthy();
    expect(saveCode.length).toBeGreaterThan(50);

    // Close settings and reset game
    await page.getByRole("button", { name: "关闭设置" }).click();
    await page.getByRole("button", { name: "重新开始" }).click();
    await page.getByRole("button", { name: "确认重置" }).click();

    // Verify progress is reset
    await expect(page.getByLabel("背包").getByText("背包空")).toBeVisible();

    // Open settings and import save
    await page.getByRole("button", { name: "设置" }).click();
    await page.getByRole("button", { name: "导入存档" }).click();
    await expect(page.getByRole("dialog", { name: "导入存档" })).toBeVisible();

    // Paste save code and confirm
    await page.fill('textarea[placeholder="Paste save code here..."]', saveCode);
    await page.getByRole("button", { name: "确认" }).click();

    // Verify import success toast and progress restoration
    await expect(page.locator(".toast-notification")).toContainText("存档导入成功");
    await expect(page.getByLabel("背包").getByText("巴当巨石碎片")).toBeVisible();
  });
});
