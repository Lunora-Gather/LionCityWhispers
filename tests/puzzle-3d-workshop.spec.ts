import { expect, test } from "@playwright/test";

test("opens and solves mechanical puzzles in 3D WebGL Workshop mode", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("canvas").first()).toBeVisible();

  // 1. Open 3D Workshop from top navigation toolbar
  const workshopBtn = page.getByRole("button", { name: "3D机械工坊" });
  await expect(workshopBtn).toBeVisible();
  await workshopBtn.click();

  // 2. Megalith Workshop modal dialog and Three.js canvas should be active
  const dialog = page.getByRole("dialog", { name: "古石重铸 · 3D工坊" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".viewer-3d-canvas")).toBeVisible();
  await expect(dialog.getByText("新加坡巨石碎裂为三")).toBeVisible();

  // 3. Assemble the 3 pieces in 3D
  const piece1 = dialog.getByRole("button", { name: "残片·力" });
  await piece1.click();
  const snapBtn = dialog.getByRole("button", { name: "卡合定位" });
  await snapBtn.click();

  const piece2 = dialog.getByRole("button", { name: "残片·石" });
  await piece2.click();
  await snapBtn.click();

  const piece3 = dialog.getByRole("button", { name: "残片·潮" });
  await piece3.click();
  await snapBtn.click();

  // 4. Solved celebration card should appear
  await expect(dialog.getByText("机关复苏 · 解谜完成")).toBeVisible();

  const claimBtn = dialog.getByRole("button", { name: "收入文物库并返回" });
  await claimBtn.click();
  await expect(dialog).not.toBeVisible();

  // Verify bi-directional state sync: inventory updated with recovered artifact
  await expect(page.locator(".artifact-pill.artifact-badang-stone")).toBeVisible();

  // 5. Test opening Cryptex Workshop
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("lcw:open-3d-workshop", { detail: "runes" }));
  });

  const cryptexDialog = page.getByRole("dialog", { name: "青铜密码筒 · 3D工坊" });
  await expect(cryptexDialog).toBeVisible();
  await expect(cryptexDialog.getByText("古代航海家的机关密码筒")).toBeVisible();

  // Rotate ring
  const turnUpBtn = cryptexDialog.getByRole("button", { name: "向上拨动" });
  await turnUpBtn.click();

  const closeCryptexBtn = cryptexDialog.getByRole("button", { name: "关闭工坊" });
  await closeCryptexBtn.click();
  await expect(cryptexDialog).not.toBeVisible();

  // 6. Test opening Astrolabe Workshop
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("lcw:open-3d-workshop", { detail: "lock" }));
  });

  const astrolabeDialog = page.getByRole("dialog", { name: "浑天秘匣 · 3D工坊" });
  await expect(astrolabeDialog).toBeVisible();
  await expect(astrolabeDialog.getByText("多环联动机关锁")).toBeVisible();

  const alignBtn = astrolabeDialog.getByRole("button", { name: "校准啮合" });
  await alignBtn.click();

  const closeAstrolabeBtn = astrolabeDialog.getByRole("button", { name: "关闭工坊" });
  await closeAstrolabeBtn.click();
  await expect(astrolabeDialog).not.toBeVisible();
});
