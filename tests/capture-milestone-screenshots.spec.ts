import { test } from "@playwright/test";
import { join } from "node:path";

test("captures milestone showcase screenshots", async ({ page }, testInfo) => {
  test.slow();
  const artifactDir = process.env.ARTIFACT_DIR || testInfo.outputDir;

  // Set viewport to crisp 16:9 1280x720
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/?mode=3d");

  const worldContainer = page.locator(".world-3d-fullscreen");
  await worldContainer.waitFor({ state: "visible" });
  await page.waitForFunction(() => Boolean((window as any).__lcwWorld3D?.player));

  // 1. Hydrodynamics Focus: Singapore River, Gerstner Waves, Wakes & Caustics
  await page.evaluate(() => {
    const lcw = (window as any).__lcwWorld3D;
    if (lcw) {
      if (!(window as any).__origCamUpdate && lcw.camController) {
        (window as any).__origCamUpdate = lcw.camController.update.bind(lcw.camController);
        lcw.camController.update = () => {};
      }
      lcw.player.root.visible = true;
      lcw.player.position.set(-7.4, 1.48, -0.35);
      lcw.player.root.position.set(-7.4, 1.48, -0.35);
      lcw.player.root.rotation.y = 0.45;
      lcw.camera.position.set(-4.0, 2.85, 0.2);
      lcw.camera.lookAt(-7.6, 0.95, 2.5);
    }
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(artifactDir, "preview-r1-hydrodynamics.png") });

  // 1.5 Museum-Grade Artisan Twakow Bumboat Close-Up Feature Shot
  await page.evaluate(() => {
    const lcw = (window as any).__lcwWorld3D;
    if (lcw) {
      if (!(window as any).__origCamUpdate && lcw.camController) {
        (window as any).__origCamUpdate = lcw.camController.update.bind(lcw.camController);
        lcw.camController.update = () => {};
      }
      lcw.player.root.visible = false;
      lcw.player.position.set(-20.0, 1.0, 10.0); // Move away from triggers
      lcw.camera.position.set(-4.4, 2.35, 6.7);
      lcw.camera.lookAt(-6.0, 0.85, 3.5);
    }
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(artifactDir, "preview-artisan-bumboat.png") });

  // 1.6 Badang Megalith Geological Fractured Monolith Feature Shot
  await page.evaluate(() => {
    const lcw = (window as any).__lcwWorld3D;
    if (lcw) {
      lcw.player.root.visible = false;
      lcw.player.position.set(-20.0, 1.0, 10.0);
      lcw.camera.position.set(-4.8, 3.4, -1.6);
      lcw.camera.lookAt(-6.2, 2.95, -8.0);
    }
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(artifactDir, "preview-badang-megalith.png") });

  // 1.7 Centennial Banyan Tree Botanical Cloud Canopy Feature Shot
  await page.evaluate(() => {
    const lcw = (window as any).__lcwWorld3D;
    if (lcw) {
      lcw.player.root.visible = false;
      lcw.player.position.set(-20.0, 1.0, 10.0);
      lcw.camera.position.set(5.4, 4.8, -3.2);
      lcw.camera.lookAt(-1.2, 4.6, -18.0);
    }
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(artifactDir, "preview-centennial-banyan.png") });

  // 1.75 Sculpted Continuous S-Curve Merlion Statue Feature Shot
  await page.evaluate(() => {
    const lcw = (window as any).__lcwWorld3D;
    if (lcw) {
      lcw.player.root.visible = false;
      lcw.player.position.set(-20.0, 1.0, 10.0);
      lcw.camera.position.set(8.8, 5.0, 0.2);
      lcw.camera.lookAt(15.6, 4.35, -9.8);
    }
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(artifactDir, "preview-merlion-sculpted.png") });

  // 1.8 Colonial National Museum Neoclassical Facade Feature Shot
  await page.evaluate(() => {
    const lcw = (window as any).__lcwWorld3D;
    if (lcw) {
      lcw.player.root.visible = false;
      lcw.player.position.set(10.0, 1.0, 10.0);
      lcw.camera.position.set(-18.5, 5.6, 5.8);
      lcw.camera.lookAt(-20.0, 5.2, -14.0);
    }
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(artifactDir, "preview-colonial-museum.png") });

  // 2. Artisan Figurine Locomotion: 3-Segment Articulated Kinematics & Ripples
  await page.evaluate(() => {
    const lcw = (window as any).__lcwWorld3D;
    if (lcw?.player) {
      lcw.player.root.visible = true;
      lcw.player.targetPosition = null;
      lcw.player.position.set(0.0, 1.48, 2.5);
      lcw.player.root.position.set(0.0, 1.48, 2.5);
      lcw.player.root.rotation.y = 0.22;
      lcw.camera.position.set(0.85, 2.85, 6.55);
      lcw.camera.lookAt(0.0, 2.62, 2.5);
    }
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(artifactDir, "preview-r2-artisan-locomotion.png") });

  // 3. Aquatic Ecosystem: Koi School, Peeking Otter, Wading Egret, Dragonflies & Lotus Pads
  await page.evaluate(() => {
    const lcw = (window as any).__lcwWorld3D;
    if (lcw) {
      lcw.player.root.visible = false;
      lcw.camera.position.set(-6.8, 2.45, 5.6);
      lcw.camera.lookAt(-8.2, 0.45, 2.4);
    }
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: join(artifactDir, "preview-r3-aquatic-ecology.png") });

  // Restore camera controller & player visibility for Bird's Eye View
  await page.evaluate(() => {
    const lcw = (window as any).__lcwWorld3D;
    if (lcw) {
      if ((window as any).__origCamUpdate && lcw.camController) {
        lcw.camController.update = (window as any).__origCamUpdate;
      }
      if (lcw.player) {
        lcw.player.root.visible = true;
        lcw.player.position.set(-6.0, 1.0, 0.0);
      }
    }
  });

  // 4. Living Diorama Bird's Eye View: Unified Wind Field & Full Realm
  const viewToggleBtn = worldContainer.getByTitle("切换俯瞰全景视角");
  if (await viewToggleBtn.isVisible()) {
    await viewToggleBtn.click();
    await page.waitForTimeout(1000);
  }
  await page.screenshot({ path: join(artifactDir, "preview-r3-living-diorama.png") });

  // 5. Hop Hing Tea House Guests & Pier Coolies Artisan Figurines Close-Up
  await page.evaluate(() => {
    const lcw = (window as any).__lcwWorld3D;
    if (lcw) {
      lcw.camController.update = () => {};
      lcw.player.root.visible = false;
      lcw.camera.position.set(4.1, 2.35, 11.4);
      lcw.camera.lookAt(6.2, 1.85, 14.0);
    }
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(artifactDir, "preview-npc-tea-guests.png") });

  await page.evaluate(() => {
    const lcw = (window as any).__lcwWorld3D;
    if (lcw) {
      lcw.camera.position.set(0.1, 2.65, 1.8);
      lcw.camera.lookAt(0.0, 2.15, -1.8);
    }
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(artifactDir, "preview-npc-boatman-coolies.png") });

  await page.evaluate(() => {
    const lcw = (window as any).__lcwWorld3D;
    if (lcw) {
      lcw.camera.position.set(-15.1, 2.65, -3.5);
      lcw.camera.lookAt(-16.0, 2.45, -7.0);
    }
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(artifactDir, "preview-npc-curator.png") });

  // 6. 3D Astrolabe Box Mechanical Workshop (True 3D Extruded Beveled Rings & Gear Teeth)
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("lcw:open-3d-workshop", { detail: "lock" }));
  });
  await page.getByRole("dialog", { name: "浑天秘匣 · 3D工坊" }).waitFor({ state: "visible" });
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(artifactDir, "preview-workshop-astrolabe-3d.png") });
  await page.getByRole("button", { name: "关闭工坊" }).click();
  await page.waitForTimeout(400);

  // 7. 3D Artifact Hologram Vault (Carved Flat Jade Bi-disc & Flared Bamboo Culm Nodes)
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("lcw:open-3d-vault", { detail: "spirit-chime" }));
  });
  const vaultDialog = page.getByRole("dialog", { name: "三维全息鉴赏" });
  await vaultDialog.waitFor({ state: "visible" });
  await vaultDialog.getByRole("button", { name: "辟邪碧玉神竹铃" }).click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(artifactDir, "preview-vault-spirit-chime-3d.png") });

  // 8. 2D Riverside Scene with Painterly Nanyang Characters (Player, Curator Lin & Old Boatman)
  await page.goto("/?mode=2d");
  await page.locator(".game-host canvas").waitFor({ state: "visible" });
  await page.getByLabel("进度").getByText("河岸").waitFor({ state: "visible", timeout: 30000 });
  await page.waitForTimeout(300);
  await page.keyboard.press("Space");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: join(artifactDir, "preview-2d-rebuilt.png") });
});
