import { expect, test } from "@playwright/test";

test("offers contextual, non-blocking hints in exploration and puzzles", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();

  await page.evaluate(() => {
    (window as typeof window & { __lcwHintCount?: number }).__lcwHintCount = 0;
    window.addEventListener("lcw:hint", () => {
      const target = window as typeof window & { __lcwHintCount?: number };
      target.__lcwHintCount = (target.__lcwHintCount ?? 0) + 1;
    });
  });

  const hintButton = page.getByRole("button", { name: "获取当前任务提示" });
  await expect(hintButton).toBeVisible();
  await hintButton.click();
  await expect(page.getByRole("status")).toContainText("巨石碎片");
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as typeof window & { __lcwHintCount?: number }).__lcwHintCount ?? 0
      )
    )
    .toBe(1);

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("lcw:chapter", { detail: "JigsawPuzzle" }));
  });
  await expect(page.getByLabel("进度").getByText("拼图")).toBeVisible();
  await hintButton.click();
  await expect(page.getByRole("status")).toContainText("浅色轮廓");
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as typeof window & { __lcwHintCount?: number }).__lcwHintCount ?? 0
      )
    )
    .toBe(2);
});
