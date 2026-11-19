import { expect, test } from "./safari";

test("opens and interacts with the 3D WebGL Artifact Hologram Vault", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();

  // 1. Open 3D Viewer from toolbar
  const vaultBtn = page.getByRole("button", { name: "三维全息鉴赏" });
  await expect(vaultBtn).toBeVisible();
  await vaultBtn.click();

  // 2. Modal dialog and Three.js canvas should be visible
  const dialog = page.getByRole("dialog", { name: "三维全息鉴赏" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".three-canvas-host canvas")).toBeVisible();
  await expect(dialog.getByText("巴当巨石 (Singapore Stone)")).toBeVisible();

  // 3. Toggle 3D controls (Turntable, UV mode, Acoustic resonance)
  const turntableBtn = dialog.getByRole("button", { name: "自动旋转展台" });
  await turntableBtn.click();

  const uvBtn = dialog.getByRole("button", { name: "多波段考古荧光透视" });
  await uvBtn.click();

  const resonateBtn = dialog.getByRole("button", { name: "古音共振" });
  await resonateBtn.click();

  // 4. Switch tabs to other 3D artifacts
  const plaqueTab = dialog.getByRole("button", { name: "狮门符文铭牌" });
  await plaqueTab.click();
  await expect(dialog.getByText("室利佛逝王朝王室信物 · 青铜重器")).toBeVisible();

  const astrolabeTab = dialog.getByRole("button", { name: "海门天枢机锁" });
  await astrolabeTab.click();
  await expect(dialog.getByText("海防航海天文枢机 · 机械密码锁")).toBeVisible();

  const chimeTab = dialog.getByRole("button", { name: "辟邪碧玉神竹铃" });
  await chimeTab.click();
  await expect(dialog.getByText("南洋航海辟邪乐器 · 仪式祭器")).toBeVisible();

  // 5. Close 3D Viewer
  const closeBtn = dialog.getByRole("button", { name: "关闭三维鉴赏" });
  await closeBtn.click();
  await expect(dialog).not.toBeVisible();
});
