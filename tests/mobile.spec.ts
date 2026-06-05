import { expect, test } from "@playwright/test";

test.use({
  viewport: { width: 390, height: 780 },
  isMobile: true,
  hasTouch: true
});

test("keeps mobile controls usable without horizontal overflow", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByLabel("触控操作")).toBeVisible();

  const metrics = await page.evaluate(() => {
    const canvas = document.querySelector("canvas")?.getBoundingClientRect();
    return {
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      canvasRatio: canvas ? canvas.width / canvas.height : 0
    };
  });
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth + 1);
  expect(metrics.canvasRatio).toBeGreaterThan(1.7);
  expect(metrics.canvasRatio).toBeLessThan(1.9);

  await expect(page.getByLabel("进度").getByText("河岸")).toBeVisible({ timeout: 5000 });
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("lcw:chapter", { detail: "RhythmScene" }));
  });
  await expect(page.getByLabel("进度").getByText("仪式")).toBeVisible({ timeout: 5000 });
  await expect(page.locator(".rhythm-controls button")).toHaveCount(4);
});

test("uses the full stage in mobile landscape", async ({ browser }) => {
  const page = await browser.newPage({
    viewport: { width: 780, height: 390 },
    isMobile: true,
    hasTouch: true
  });
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  const metrics = await page.evaluate(() => {
    const canvas = document.querySelector("canvas")?.getBoundingClientRect();
    return {
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      canvasRatio: canvas ? canvas.width / canvas.height : 0,
      canvasHeight: canvas?.height ?? 0
    };
  });
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth + 1);
  expect(metrics.canvasRatio).toBeGreaterThan(1.7);
  expect(metrics.canvasRatio).toBeLessThan(1.9);
  expect(metrics.canvasHeight).toBeGreaterThan(320);
  await page.close();
});
