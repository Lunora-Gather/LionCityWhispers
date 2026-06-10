import { expect, test } from "@playwright/test";

test("persists settings and exposes the codex and manifest", async ({ page, request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBeTruthy();
  expect((await manifest.json()).short_name).toBe("狮城秘语");

  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "设置" }).click();
  await expect(page.getByText("体验")).toBeVisible();
  await expect(page.getByText("声音")).toBeVisible();
  await expect(page.getByText("辅助")).toBeVisible();
  await expect(page.getByText("控制")).toBeVisible();
  await page.getByRole("checkbox", { name: "减少动画" }).check();
  await page.getByRole("checkbox", { name: "静音" }).check();
  await page.getByRole("slider", { name: "主音量" }).fill("35");
  await page.getByRole("slider", { name: "音效" }).fill("45");
  await page.getByRole("slider", { name: "环境声" }).fill("25");

  await page.reload();
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "设置" }).click();
  await expect(page.getByRole("checkbox", { name: "减少动画" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "静音" })).toBeChecked();
  await expect(page.getByRole("slider", { name: "主音量" })).toHaveValue("35");
  await expect(page.getByRole("slider", { name: "音效" })).toHaveValue("45");
  await expect(page.getByRole("slider", { name: "环境声" })).toHaveValue("25");

  await page.getByRole("button", { name: "线索册" }).click();
  await expect(page.getByRole("dialog", { name: "线索册" })).toBeVisible();
  await expect(page.getByText("未发现文物")).toHaveCount(4);
});
