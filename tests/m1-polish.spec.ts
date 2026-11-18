import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { playFootstep, playLockedChime, playTypewriterBlip } from "../src/game/audio";

test.describe("M1-Polish Behavioral Verification", () => {
  test("1. Synchronizes custom keybindings from settings into 3D locomotion and interaction", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "lcw:save:v2",
        JSON.stringify({
          version: 2,
          inventoryIds: [],
          flags: { jigsaw: false, runes: false, lock: false, rhythm: false },
          museum: { placements: {}, visitors: 0, complete: false },
          dialogue: "ready",
          easyMode: true,
          settings: {
            muted: true,
            volume: 0.5,
            effectsVolume: 0.5,
            ambientVolume: 0.3,
            reduceMotion: true,
            locale: "zh",
            bindings: {
              moveUp: "KeyI",
              moveDown: "KeyK",
              moveLeft: "KeyJ",
              moveRight: "KeyL",
              action: "KeyF",
              rhythm: ["KeyA", "KeyS", "KeyD", "KeyF"]
            }
          }
        })
      );
    });

    await page.goto("/?mode=3d");
    await page.waitForFunction(() => Boolean((window as any).__lcwWorld3D?.player));

    // Place player on open North Bank quay away from landmarks
    await page.evaluate(() => {
      const lcw = (window as any).__lcwWorld3D;
      lcw.player.position.set(-10.0, 1.0, -10.0);
      lcw.player.clearDestination();
    });

    // Old default KeyW must NOT move player when moveUp is remapped to KeyI
    const posBeforeOldKey = await page.evaluate(() => {
      const p = (window as any).__lcwWorld3D.player.position;
      return { x: p.x, z: p.z };
    });
    await page.keyboard.down("KeyW");
    await page.waitForTimeout(250);
    await page.keyboard.up("KeyW");
    const posAfterOldKey = await page.evaluate(() => {
      const p = (window as any).__lcwWorld3D.player.position;
      return { x: p.x, z: p.z };
    });
    expect(posAfterOldKey.x).toBeCloseTo(posBeforeOldKey.x, 3);
    expect(posAfterOldKey.z).toBeCloseTo(posBeforeOldKey.z, 3);

    // Remapped KeyI MUST move player
    await page.keyboard.down("KeyI");
    await page.waitForTimeout(300);
    await page.keyboard.up("KeyI");
    const posAfterNewKey = await page.evaluate(() => {
      const p = (window as any).__lcwWorld3D.player.position;
      return { x: p.x, z: p.z };
    });
    const movedDist = Math.hypot(posAfterNewKey.x - posBeforeOldKey.x, posAfterNewKey.z - posBeforeOldKey.z);
    expect(movedDist).toBeGreaterThan(0.2);

    // Move near Badang Megalith (-6, 1.0, -8) and verify KeyF triggers workshop while Space does not
    await page.evaluate(() => {
      const lcw = (window as any).__lcwWorld3D;
      lcw.player.position.set(-6.0, 1.0, -7.5);
      lcw.player.clearDestination();
    });
    const worldContainer = page.locator(".world-3d-fullscreen");
    await expect(worldContainer.locator(".world-3d-interact-badge")).toBeVisible();

    await page.keyboard.press("Space");
    await page.waitForTimeout(150);
    await expect(page.locator(".artifact-3d-overlay")).toHaveCount(0);

    await page.keyboard.press("KeyF");
    await expect(page.locator(".artifact-3d-overlay")).toBeVisible();
  });

  test("2. Mobile touch controls sit above 3D world and drive movement, interaction, and touch orbit", async ({ browser }) => {
    const page = await browser.newPage({
      viewport: { width: 390, height: 780 },
      isMobile: true,
      hasTouch: true
    });

    await page.goto("/?mode=3d");
    const worldContainer = page.locator(".world-3d-fullscreen");
    await expect(worldContainer).toBeVisible();
    await page.waitForFunction(() => Boolean((window as any).__lcwWorld3D?.player));

    const touchControls = page.getByLabel("触控操作");
    await expect(touchControls).toBeVisible();

    const zIndices = await page.evaluate(() => {
      const tc = document.querySelector(".touch-controls");
      const w3d = document.querySelector(".world-3d-fullscreen");
      return {
        touchZ: tc ? Number(getComputedStyle(tc).zIndex) : 0,
        worldZ: w3d ? Number(getComputedStyle(w3d).zIndex) : 0
      };
    });
    expect(zIndices.touchZ).toBe(85);
    expect(zIndices.touchZ).toBeGreaterThan(zIndices.worldZ);

    // Virtual move drives player position
    const startPos = await page.evaluate(() => {
      const lcw = (window as any).__lcwWorld3D;
      lcw.player.position.set(-6.0, 1.0, -5.0);
      lcw.player.clearDestination();
      return { x: lcw.player.position.x, z: lcw.player.position.z };
    });
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("lcw:virtual-move", { detail: { x: 1, y: 0 } }));
    });
    await page.waitForTimeout(280);
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("lcw:virtual-move", { detail: { x: 0, y: 0 } }));
    });
    const movedPos = await page.evaluate(() => {
      const p = (window as any).__lcwWorld3D.player.position;
      return { x: p.x, z: p.z };
    });
    expect(Math.hypot(movedPos.x - startPos.x, movedPos.z - startPos.z)).toBeGreaterThan(0.2);

    // Touch action button triggers NPC dialogue when near Curator Lin (-16, 1.0, -7)
    await page.evaluate(() => {
      const lcw = (window as any).__lcwWorld3D;
      lcw.player.position.set(-15.5, 1.0, -7.0);
      lcw.player.clearDestination();
    });
    await expect(worldContainer.locator(".world-3d-interact-badge")).toBeVisible();
    await page.getByLabel("交互").click();
    await expect(worldContainer.locator(".world-3d-npc-dialogue")).toBeVisible();

    // Touch drag orbit on canvas updates camera azimuth
    const azimuthBefore = await page.evaluate(() => (window as any).__lcwWorld3D.camState.azimuth);
    await page.evaluate(() => {
      const canvas = document.querySelector("canvas.world-3d-canvas");
      if (!canvas) return;
      // Exercise the canvas handlers with the same single-finger coordinates
      // on engines that expose different Touch constructors.
      for (const [type, clientX] of [["touchstart", 200], ["touchmove", 280], ["touchend", 280]] as const) {
        const touch = { identifier: 1, target: canvas, clientX, clientY: 250 };
        const touches = type === "touchend" ? [] : [touch];
        const event = new Event(type, { bubbles: true, cancelable: true });
        Object.assign(event, { touches, targetTouches: touches, changedTouches: [touch] });
        canvas.dispatchEvent(event);
      }
    });
    const azimuthAfter = await page.evaluate(() => (window as any).__lcwWorld3D.camState.azimuth);
    expect(Math.abs(azimuthAfter - azimuthBefore)).toBeGreaterThan(0.1);

    await page.close();
  });

  test("3. Auto-dismisses 3D NPC dialogue when walking beyond landmark.radius + 1.5m and renders SVG badge", async ({ page }) => {
    await page.goto("/?mode=3d");
    const worldContainer = page.locator(".world-3d-fullscreen");
    await page.waitForFunction(() => Boolean((window as any).__lcwWorld3D?.player));

    // Approach Curator Lin (-16, 1.0, -7), radius 3.2 -> dismiss threshold 4.7
    await page.evaluate(() => {
      const lcw = (window as any).__lcwWorld3D;
      lcw.player.position.set(-15.5, 1.0, -7.0);
      lcw.player.clearDestination();
    });
    await expect(worldContainer.locator(".world-3d-interact-badge")).toBeVisible();
    await page.keyboard.press("Space");

    const dialogueCard = worldContainer.locator(".world-3d-npc-dialogue");
    await expect(dialogueCard).toBeVisible();
    await expect(dialogueCard.locator(".npc-avatar-badge svg")).toBeVisible();

    // Move slightly within radius + 1.5m (dist = 3.5m <= 4.7m) -> remains visible
    await page.evaluate(() => {
      (window as any).__lcwWorld3D.player.position.set(-12.5, 1.0, -7.0);
    });
    await page.waitForTimeout(120);
    await expect(dialogueCard).toBeVisible();

    // Walk further than radius + 1.5m (dist = 5.5m > 4.7m) -> auto-dismisses
    await page.evaluate(() => {
      (window as any).__lcwWorld3D.player.position.set(-10.5, 1.0, -7.0);
    });
    await expect(dialogueCard).not.toBeVisible();
  });

  test("4. Standard-mode puzzle snap/align failure triggers visual shake feedback and audio helpers are SSR-safe", async ({ page }) => {
    // SSR / Node safety check for new procedural audio helpers (0 byte asset impact)
    expect(() => {
      playFootstep(false);
      playFootstep(true);
      playTypewriterBlip();
      playLockedChime();
    }).not.toThrow();

    // Verify ui.css line 587 sans-serif fallback fix
    const cssText = readFileSync(join(process.cwd(), "src/styles/ui.css"), "utf8");
    expect(cssText).toContain('font-family: "Microsoft YaHei", "PingFang SC", sans-serif;');
    expect(cssText).not.toContain('font-family: "Microsoft YaHei", serif;');

    await page.addInitScript(() => {
      window.localStorage.setItem(
        "lcw:save:v2",
        JSON.stringify({
          version: 2,
          inventoryIds: [],
          flags: { jigsaw: false, runes: false, lock: false, rhythm: false },
          museum: { placements: {}, visitors: 0, complete: false },
          dialogue: "ready",
          easyMode: false,
          settings: {
            muted: true,
            volume: 0.5,
            effectsVolume: 0.5,
            ambientVolume: 0.3,
            reduceMotion: true,
            locale: "zh",
            bindings: {
              moveUp: "KeyW",
              moveDown: "KeyS",
              moveLeft: "KeyA",
              moveRight: "KeyD",
              action: "Space",
              rhythm: ["KeyA", "KeyS", "KeyD", "KeyF"]
            }
          }
        })
      );
    });

    await page.goto("/");
    await expect(page.locator("canvas").first()).toBeVisible();

    // Megalith in standard mode starts misaligned (-60 deg); snapping should trigger .workshop-shake
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("lcw:open-3d-workshop", { detail: "jigsaw" }));
    });
    const megalithDialog = page.getByRole("dialog", { name: "古石重铸 · 3D工坊" });
    await expect(megalithDialog).toBeVisible();
    const snapBtn = megalithDialog.locator(".workshop-snap-btn");
    await snapBtn.click();
    await expect(snapBtn).toHaveClass(/workshop-shake/);

    await megalithDialog.getByRole("button", { name: "关闭工坊" }).click();

    // Astrolabe in standard mode starts misaligned (0 / 90); aligning should trigger .workshop-shake
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("lcw:open-3d-workshop", { detail: "lock" }));
    });
    const astrolabeDialog = page.getByRole("dialog", { name: "浑天秘匣 · 3D工坊" });
    await expect(astrolabeDialog).toBeVisible();
    const alignBtn = astrolabeDialog.locator(".workshop-snap-btn");
    await alignBtn.click();
    await expect(alignBtn).toHaveClass(/workshop-shake/);
  });
});
