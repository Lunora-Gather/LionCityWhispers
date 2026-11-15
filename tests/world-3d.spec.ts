import { expect, test } from "@playwright/test";

test("opens and explores the 3D Miniature Realm with locomotion, time of day, and diorama views", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();

  // 1. Open 3D World from toolbar
  const world3DBtn = page.getByRole("button", { name: "3D微缩世界" });
  await expect(world3DBtn).toBeVisible();
  await world3DBtn.click();

  // 2. 3D World container and Three.js canvas should be visible
  const worldContainer = page.locator(".world-3d-fullscreen");
  await expect(worldContainer).toBeVisible();
  await expect(worldContainer.locator("canvas.world-3d-canvas")).toBeVisible();
  await expect(worldContainer.getByText("狮城微缩探索世界")).toBeVisible();

  // 3. Switch Time of Day (Dawn, Dusk, Night)
  const nightBtn = worldContainer.getByTitle("璀璨夜市");
  await nightBtn.click();
  await page.waitForTimeout(300);

  const dawnBtn = worldContainer.getByTitle("晨曦初晓");
  await dawnBtn.click();
  await page.waitForTimeout(300);

  const duskBtn = worldContainer.getByTitle("暮色金辉");
  await duskBtn.click();
  await page.waitForTimeout(300);

  // 4. Toggle Birds-Eye Diorama view
  const viewToggleBtn = worldContainer.getByTitle("切换俯瞰全景视角");
  await viewToggleBtn.click();
  await page.waitForTimeout(400);
  await viewToggleBtn.click();
  await page.waitForTimeout(400);

  // 5. Walk player character with WASD keys
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(500);
  await page.keyboard.up("KeyW");

  await page.keyboard.down("KeyD");
  await page.waitForTimeout(400);
  await page.keyboard.up("KeyD");

  // 6. Click ground to trigger click-to-move
  await worldContainer.locator("canvas.world-3d-canvas").click({ position: { x: 450, y: 380 } });
  await page.waitForTimeout(500);

  // 7. Close 3D World
  const closeBtn = worldContainer.getByRole("button", { name: "退出 3D 世界" });
  await closeBtn.click();
  await expect(worldContainer).not.toBeVisible();
});

test("loads directly into 3D Miniature Realm when mode=3d", async ({ page }) => {
  await page.goto("/?mode=3d");
  const worldContainer = page.locator(".world-3d-fullscreen");
  await expect(worldContainer).toBeVisible();
  await expect(worldContainer.locator("canvas.world-3d-canvas")).toBeVisible();
  await expect(worldContainer.getByText("狮城微缩探索世界")).toBeVisible();

  // Switch to 2D view using the header button
  const closeBtn = worldContainer.getByRole("button", { name: "退出 3D 世界" });
  await closeBtn.click();
  await expect(worldContainer).not.toBeVisible();
});

test("interacts with NPC in 3D world and steps through dialogue", async ({ page }) => {
  await page.goto("/?mode=3d");
  const worldContainer = page.locator(".world-3d-fullscreen");
  await expect(worldContainer).toBeVisible();

  // Wait for 3D world environment & player to be mounted
  await page.waitForFunction(() => Boolean((window as any).__lcwWorld3D?.player));

  // Position player near Curator Lin: (-16, 1.0, -7)
  await page.evaluate(() => {
    const lcw = (window as any).__lcwWorld3D;
    if (lcw?.player) {
      lcw.player.position.set(-15.5, 1.0, -7.0);
      lcw.player.clearDestination();
    }
  });

  // Interaction prompt should appear
  const interactBadge = worldContainer.locator(".world-3d-interact-badge");
  await expect(interactBadge).toBeVisible();
  await expect(interactBadge).toContainText("林馆长");

  // Click the interaction action button to start dialogue
  const talkBtn = interactBadge.locator(".interact-action-btn");
  await expect(talkBtn).toBeVisible();
  await talkBtn.click({ force: true });

  // NPC dialogue card appears
  const dialogueCard = worldContainer.locator(".world-3d-npc-dialogue");
  await expect(dialogueCard).toBeVisible();
  await expect(dialogueCard.locator(".world-3d-npc-speaker-pill")).toContainText("林馆长");

  // Advance dialogue with next button or Space
  const nextBtn = dialogueCard.locator(".world-3d-npc-next-btn");
  await expect(nextBtn).toBeVisible();
  await nextBtn.click();

  // Step through remaining line or complete
  const isStillVisible = await dialogueCard.isVisible();
  if (isStillVisible) {
    await page.keyboard.press("Space");
  }
  await expect(dialogueCard).not.toBeVisible();
});

test("triggers 3D puzzle workshop from in-world landmark", async ({ page }) => {
  await page.goto("/?mode=3d");
  const worldContainer = page.locator(".world-3d-fullscreen");
  await expect(worldContainer).toBeVisible();

  // Wait for 3D world environment & player to be mounted
  await page.waitForFunction(() => Boolean((window as any).__lcwWorld3D?.player));

  // Position player near Badang Megalith: (-6, 1.0, -8)
  await page.evaluate(() => {
    const lcw = (window as any).__lcwWorld3D;
    if (lcw?.player) {
      lcw.player.position.set(-6, 1.0, -7.5);
      lcw.player.clearDestination();
    }
  });

  const interactBadge = worldContainer.locator(".world-3d-interact-badge");
  await expect(interactBadge).toBeVisible();
  await expect(interactBadge).toContainText("巴当巨石遗址");

  // Trigger interaction via KeyE
  await page.keyboard.press("KeyE");

  // 3D Workshop modal should open on top of the 3D world
  const workshop = page.locator(".artifact-3d-overlay");
  await expect(workshop).toBeVisible();
  await expect(workshop.getByText("古石重铸 · 3D工坊")).toBeVisible();

  // Close workshop and return to 3D exploration
  const closeWorkshop = workshop.getByRole("button", { name: "关闭工坊" });
  await closeWorkshop.click();
  await expect(workshop).not.toBeVisible();
  await expect(worldContainer).toBeVisible();
});

