import { expect, test } from "@playwright/test";
import * as THREE from "three";

// Provide minimal document mock for Node execution of procedural textures
if (typeof document === "undefined") {
  (global as any).document = {
    createElement: (tag: string) => {
      if (tag === "canvas") {
        return {
          width: 512,
          height: 512,
          getContext: () => ({
            fillStyle: "",
            strokeStyle: "",
            lineWidth: 1,
            lineCap: "butt",
            lineJoin: "miter",
            shadowBlur: 0,
            shadowColor: "",
            font: "",
            textAlign: "",
            textBaseline: "",
            save: () => {},
            restore: () => {},
            translate: () => {},
            rotate: () => {},
            scale: () => {},
            clip: () => {},
            clearRect: () => {},
            fillRect: () => {},
            strokeRect: () => {},
            beginPath: () => {},
            arc: () => {},
            ellipse: () => {},
            fill: () => {},
            stroke: () => {},
            moveTo: () => {},
            lineTo: () => {},
            closePath: () => {},
            fillText: () => {},
            strokeText: () => {},
            measureText: () => ({ width: 100 }),
            createLinearGradient: () => ({ addColorStop: () => {} }),
            createRadialGradient: () => ({ addColorStop: () => {} }),
            drawImage: () => {},
            getImageData: () => ({ data: new Uint8ClampedArray(512 * 512 * 4) }),
            putImageData: () => {},
          }),
        };
      }
      return {};
    },
  };
}

import { World3DEnvironment } from "../src/game/three/world/World3DEnvironment";
import { World3DLifeScenes } from "../src/game/three/world/World3DLifeScenes";
import { World3DCameraController } from "../src/game/three/world/World3D";

test.describe("Empirical Challenger 2 M2: NPC Interactions, Workshop Triggers & Multi-System Zero Allocation", () => {
  /* ========================================================================= */
  /* 1. In-Browser NPC Dialogue: Curator Lin & Boatman Chen End-to-End         */
  /* ========================================================================= */
  test("C2-M2-1. NPC interaction: Curator Lin and Boatman Chen proximity, dialogue progression, and dismiss", async ({
    page,
  }) => {
    await page.goto("/?mode=3d");
    const worldContainer = page.locator(".world-3d-fullscreen");
    await expect(worldContainer).toBeVisible({ timeout: 25000 });

    // Wait for 3D world environment & player to be mounted
    await page.waitForFunction(() => Boolean((window as any).__lcwWorld3D?.player));

    // A. Curator Lin Proximity & Dialogue
    await page.evaluate(() => {
      const lcw = (window as any).__lcwWorld3D;
      if (lcw?.player) {
        lcw.player.position.set(-15.5, 1.0, -7.0);
        lcw.player.clearDestination();
      }
    });

    const interactBadge = worldContainer.locator(".world-3d-interact-badge");
    await expect(interactBadge).toBeVisible();
    await expect(interactBadge).toContainText("林馆长");

    // Click talk button to trigger dialogue
    const talkBtn = interactBadge.locator(".interact-action-btn");
    await expect(talkBtn).toBeVisible();
    await talkBtn.click({ force: true });

    // Dialogue card validation
    const dialogueCard = worldContainer.locator(".world-3d-npc-dialogue");
    await expect(dialogueCard).toBeVisible();
    await expect(dialogueCard.locator(".world-3d-npc-speaker-pill")).toContainText("林馆长");

    // Advance dialogue through all lines
    const nextBtn = dialogueCard.locator(".world-3d-npc-next-btn");
    while (await dialogueCard.isVisible()) {
      await nextBtn.click();
      await page.waitForTimeout(100);
    }
    await expect(dialogueCard).not.toBeVisible();

    // B. Boatman Chen Proximity & Dialogue
    await page.evaluate(() => {
      const lcw = (window as any).__lcwWorld3D;
      if (lcw?.player) {
        lcw.player.position.set(0.0, 0.8, -2.0);
        lcw.player.clearDestination();
      }
    });

    await expect(interactBadge).toBeVisible();
    await expect(interactBadge).toContainText("老船夫");

    // Trigger dialogue using keyboard Space
    await page.keyboard.press("Space");
    await expect(dialogueCard).toBeVisible();
    await expect(dialogueCard.locator(".world-3d-npc-speaker-pill")).toContainText("老船夫");

    // Step through boatman dialogue with Space
    while (await dialogueCard.isVisible()) {
      await page.keyboard.press("Space");
      await page.waitForTimeout(100);
    }
    await expect(dialogueCard).not.toBeVisible();

    // C. Walk away to open ground: verify badge disappears cleanly
    await page.evaluate(() => {
      const lcw = (window as any).__lcwWorld3D;
      if (lcw?.player) {
        lcw.player.position.set(0.0, 1.0, 8.0);
        lcw.player.clearDestination();
      }
    });

    await expect(interactBadge).not.toBeVisible();
  });

  /* ========================================================================= */
  /* 2. In-Browser 3D Landmark Workshop Triggers: Megalith, Plaque & Harbor Gate*/
  /* ========================================================================= */
  test("C2-M2-2. Landmark workshop triggers: Badang Megalith, Ancient Rune Plaque, and Harbor Gate", async ({
    page,
  }) => {
    await page.goto("/?mode=3d");
    const worldContainer = page.locator(".world-3d-fullscreen");
    await expect(worldContainer).toBeVisible({ timeout: 25000 });

    await page.waitForFunction(() => Boolean((window as any).__lcwWorld3D?.player));
    const interactBadge = worldContainer.locator(".world-3d-interact-badge");
    const workshop = page.locator(".artifact-3d-overlay");

    // Landmark 1: Badang Megalith at (-6, 1.0, -8)
    await page.evaluate(() => {
      const lcw = (window as any).__lcwWorld3D;
      if (lcw?.player) {
        lcw.player.position.set(-6, 1.0, -7.5);
        lcw.player.clearDestination();
      }
    });
    await expect(interactBadge).toBeVisible();
    await expect(interactBadge).toContainText("巴当巨石遗址");

    await page.keyboard.press("KeyE");
    await expect(workshop).toBeVisible();
    await expect(workshop.getByText("古石重铸 · 3D工坊")).toBeVisible();
    await workshop.getByRole("button", { name: "关闭工坊" }).click();
    await expect(workshop).not.toBeVisible();

    // Landmark 2: Ancient Rune Plaque at (9, 1.0, -8)
    await page.evaluate(() => {
      const lcw = (window as any).__lcwWorld3D;
      if (lcw?.player) {
        lcw.player.position.set(9.0, 1.0, -7.5);
        lcw.player.clearDestination();
      }
    });
    await expect(interactBadge).toBeVisible();
    await expect(interactBadge).toContainText("古文字碑");

    await page.keyboard.press("KeyE");
    await expect(workshop).toBeVisible();
    await expect(workshop.getByText("青铜密码筒 · 3D工坊")).toBeVisible();
    await workshop.getByRole("button", { name: "关闭工坊" }).click();
    await expect(workshop).not.toBeVisible();

    // Landmark 3: Harbor Gate at (18, 1.0, 3.0)
    await page.evaluate(() => {
      const lcw = (window as any).__lcwWorld3D;
      if (lcw?.player) {
        lcw.player.position.set(17.5, 1.0, 3.0);
        lcw.player.clearDestination();
      }
    });
    await expect(interactBadge).toBeVisible();
    await expect(interactBadge).toContainText("海门机关");

    await page.keyboard.press("KeyE");
    await expect(workshop).toBeVisible();
    await expect(workshop.getByText("浑天秘匣 · 3D工坊")).toBeVisible();
    await workshop.getByRole("button", { name: "关闭工坊" }).click();
    await expect(workshop).not.toBeVisible();

    await expect(worldContainer).toBeVisible();
  });

  /* ========================================================================= */
  /* 3. Combined Multi-System 1,200 Frames Zero Heap Allocations               */
  /* ========================================================================= */
  test("C2-M2-3. Combined Multi-System 1,200 continuous frames zero heap allocation stress test", () => {
    const env = new World3DEnvironment();
    const life = new World3DLifeScenes();
    const playerPos = new THREE.Vector3(0, 1.0, 0);
    const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.5, 300);
    const camController = new World3DCameraController(playerPos);

    // Warm-up 20 frames
    for (let f = 0; f < 20; f++) {
      const t = f * 0.016;
      env.update(t, 0.016);
      life.update(t, 0.016);
      camController.update(0.016, playerPos, null, false, camera);
    }

    // Instrument THREE constructors
    let threeAllocations = 0;
    const trackedClasses = [
      "Vector2", "Vector3", "Vector4",
      "Matrix3", "Matrix4",
      "Quaternion", "Euler",
      "Box3", "Sphere", "Color",
      "Group", "Mesh", "Points",
      "BufferGeometry", "MeshStandardMaterial", "MeshBasicMaterial"
    ];

    const originalConstructors: Record<string, any> = {};
    for (const name of trackedClasses) {
      if ((THREE as any)[name]) {
        originalConstructors[name] = (THREE as any)[name];
        (THREE as any)[name] = function (...args: any[]) {
          threeAllocations++;
          return new originalConstructors[name](...args);
        };
      }
    }

    const dtSpectrum = [0.008, 0.016, 0.024, 0.033];
    try {
      // Run 1,200 continuous frames
      let simTime = 0.32;
      for (let f = 0; f < 1200; f++) {
        const dt = dtSpectrum[f % dtSpectrum.length];
        simTime += dt;

        // Animate simulated player motion
        playerPos.x = Math.sin(simTime * 0.5) * 10;
        playerPos.z = Math.cos(simTime * 0.4) * 8;

        env.update(simTime, dt);
        life.update(simTime, dt);
        camController.update(dt, playerPos, null, f % 300 < 50, camera);
      }
      expect(threeAllocations).toBe(0);
    } finally {
      for (const name of trackedClasses) {
        if (originalConstructors[name]) {
          (THREE as any)[name] = originalConstructors[name];
        }
      }
    }

    env.dispose();
    life.dispose();
  });
});
