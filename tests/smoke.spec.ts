import { expect, test } from "@playwright/test";

test("loads the playable prototype shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "狮城秘语" })).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByText("当前目标")).toBeVisible();
});

test("accepts keyboard input without throwing console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });

  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Space");
  await page.waitForTimeout(500);

  expect(errors).toEqual([]);
});
