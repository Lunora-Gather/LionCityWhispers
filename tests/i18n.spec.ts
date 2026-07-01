import { expect, test } from "@playwright/test";

test("switches the shell and codex to English and persists the locale", async ({ page }) => {
  test.slow();
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();

  await page.getByRole("button", { name: "设置" }).click();
  await page.getByRole("button", { name: "English" }).click();

  await expect(page.getByText("Current Objective")).toBeVisible();
  await expect(page.getByLabel("Restoration Route")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Close Settings" })).toBeVisible();
  await page.getByRole("button", { name: "Close Settings" }).click();

  await page.getByRole("button", { name: "Codex" }).click();
  await expect(page.getByRole("dialog", { name: "Codex" })).toBeVisible();
  await expect(page.getByText("Undiscovered Artifact")).toHaveCount(4);
  await page.getByRole("button", { name: "Close Codex" }).click();

  await page.reload();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByText("Current Objective")).toBeVisible();
  await expect(page.getByLabel("Progress").getByText("Puzzles")).toBeVisible();
  await expect(page.getByLabel("Inventory").getByText("Inventory Empty")).toBeVisible();
});
