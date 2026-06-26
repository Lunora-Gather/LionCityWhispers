import { expect, test } from "@playwright/test";

test("loads the playable prototype shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "狮城秘语" })).toBeVisible();
  await expect(page.locator("main.stage")).toBeVisible();
  await expect(page.locator("#lion-city-game-host")).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByText("当前目标")).toBeVisible();
});

test("opens settings and switches language", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "设置" }).click();
  await expect(page.getByRole("dialog", { name: "设置" })).toBeVisible();

  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await expect(page.getByText("Current Objective")).toBeVisible();
});
