import { expect, test } from "@playwright/test";
import { clickUntilScene } from "./helpers";

test.describe("Save Management", () => {
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
    const input = page.getByPlaceholder("Paste save code here...");
    await input.focus();
    await input.press("ControlOrMeta+v");
    await expect.poll(async () => (await input.inputValue()).length).toBeGreaterThan(50);
    await page.getByRole("button", { name: "确认" }).click();

    // Verify import success toast and progress restoration
    await expect(page.locator(".toast-notification")).toContainText("存档导入成功");
    await expect(page.getByLabel("背包").getByText("巴当巨石碎片")).toBeVisible();
  });
});
