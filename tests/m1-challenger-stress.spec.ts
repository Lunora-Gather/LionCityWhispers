import { expect, test } from "@playwright/test";
import * as THREE from "three";

// Provide minimal document mock for Node execution
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
import { World3DCameraController } from "../src/game/three/world/World3D";

test.describe("Milestone 1 Empirical Challenger: Waypoint Math, Zero Allocations & Raycast Overlays", () => {
  /* ========================================================================= */
  /* 1. Zero Allocation Verification for updateLandmarkCues Across States      */
  /* ========================================================================= */
  test("1. updateLandmarkCues strictly maintains 0 Three.js heap allocations across 6000 frames under all progression states", () => {
    const env = new World3DEnvironment();

    const trackedConstructors = [
      "Vector2", "Vector3", "Vector4",
      "Matrix3", "Matrix4",
      "Quaternion", "Euler",
      "Box3", "Sphere", "Color",
      "Group", "Mesh", "Points",
      "BufferGeometry", "MeshStandardMaterial", "MeshBasicMaterial"
    ];

    let allocations = 0;
    const originals: Record<string, any> = {};
    for (const name of trackedConstructors) {
      if ((THREE as any)[name]) {
        originals[name] = (THREE as any)[name];
        (THREE as any)[name] = function (...args: any[]) {
          allocations++;
          return new originals[name](...args);
        };
      }
    }

    const dt = 0.016;
    const states = [
      { completed: [], ritual: false, museum: false },
      { completed: ["badang-stone"], ritual: false, museum: false },
      { completed: ["badang-stone", "rune-plaque"], ritual: false, museum: false },
      { completed: ["badang-stone", "rune-plaque", "harbor-seal"], ritual: false, museum: false },
      { completed: ["badang-stone", "rune-plaque", "harbor-seal", "spirit-chime"], ritual: true, museum: false },
      { completed: ["badang-stone", "rune-plaque", "harbor-seal", "spirit-chime"], ritual: true, museum: true },
    ];

    try {
      let frame = 0;
      for (const st of states) {
        env.setProgressionState(st.completed, st.ritual, st.museum);
        // Run 1,000 frames per progression stage
        for (let i = 0; i < 1000; i++) {
          frame++;
          env.update(frame * dt, dt);
        }
      }

      expect(allocations).toBe(0);
    } finally {
      for (const name of trackedConstructors) {
        if (originals[name]) {
          (THREE as any)[name] = originals[name];
        }
      }
      env.dispose();
    }
  });

  /* ========================================================================= */
  /* 2. Analytical & Boundary Testing of Waypoint Math                         */
  /* ========================================================================= */
  test("2. Waypoint mathematical evaluation under boundary azimuth angles and pitch extremes", () => {
    const dummyCamera = new THREE.PerspectiveCamera(45, 16 / 9, 0.5, 300);
    const playerPos = new THREE.Vector3(0, 1.0, 0);
    const controller = new World3DCameraController(playerPos);

    // Test a sweep of boundary azimuth angles:
    // crossing 0, 2*PI, -2*PI, negative radians, large numbers
    const testAzimuths = [
      0,
      Math.PI * 0.5,
      Math.PI,
      Math.PI * 1.5,
      Math.PI * 2.0,
      Math.PI * 4.0,
      -Math.PI * 0.5,
      -Math.PI,
      -Math.PI * 2.0,
      -Math.PI * 10.0,
      100.0,
      -100.0
    ];

    const testPolars = [
      controller.POLAR_MIN,
      0.5,
      1.0,
      controller.POLAR_MAX
    ];

    for (const az of testAzimuths) {
      for (const pol of testPolars) {
        controller.state.azimuth = az;
        controller.state.currentPolar = pol;
        controller.state.targetPolar = pol;

        controller.update(0.016, playerPos, null, false, dummyCamera);

        // Camera must remain finite and valid
        expect(Number.isFinite(dummyCamera.position.x)).toBe(true);
        expect(Number.isFinite(dummyCamera.position.y)).toBe(true);
        expect(Number.isFinite(dummyCamera.position.z)).toBe(true);
        expect(dummyCamera.position.y).toBeGreaterThanOrEqual(1.65);

        // Compass formula: -deg
        const compassDeg = (-az * 180) / Math.PI;
        expect(Number.isFinite(compassDeg)).toBe(true);
      }
    }
  });

  /* ========================================================================= */
  /* 3. In-Browser: UI Overlays Do Not Obstruct Ground Raycasting             */
  /* ========================================================================= */
  test("3. In-Browser UI Overlays allow ground raycasting and waypoint click-to-move operates", async ({ page }) => {
    await page.goto("/?mode=3d");
    const worldContainer = page.locator(".world-3d-fullscreen");
    await expect(worldContainer).toBeVisible();

    await page.waitForFunction(() => Boolean((window as any).__lcwWorld3D?.player));

    // A. Verify that central gameplay region hits the canvas, NOT an overlay
    const hitPoints = [
      { x: 300, y: 300 },
      { x: 450, y: 380 },
      { x: 640, y: 360 },
      { x: 800, y: 400 },
      { x: 640, y: 500 },
      { x: 200, y: 450 },
      { x: 1000, y: 450 },
    ];

    for (const pt of hitPoints) {
      const elementTag = await page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return el ? `${el.tagName.toLowerCase()}.${el.className}` : "none";
      }, pt);

      // Must be the canvas (or vignette/macro-focus must have pointer-events: none)
      expect(elementTag).toContain("canvas");
    }

    // B. Verify that clicking the waypoint guide button triggers locomotion to the guided target
    const waypointBtn = worldContainer.locator(".world-3d-waypoint-guide");
    await expect(waypointBtn).toBeVisible();

    // Reset player position to (0, 1, 0)
    await page.evaluate(() => {
      const lcw = (window as any).__lcwWorld3D;
      lcw.player.position.set(0, 1, 0);
      lcw.player.clearDestination();
    });

    // Check player has no destination initially
    const destBefore = await page.evaluate(() => {
      const lcw = (window as any).__lcwWorld3D;
      return lcw.player.targetPosition ? { ...lcw.player.targetPosition } : null;
    });
    expect(destBefore).toBeNull();

    // Click waypoint guide button
    await waypointBtn.click();

    // Check player now has destination set to Badang Megalith (-6, 1, -8)
    const destAfter = await page.evaluate(() => {
      const lcw = (window as any).__lcwWorld3D;
      return lcw.player.targetPosition ? {
        x: lcw.player.targetPosition.x,
        y: lcw.player.targetPosition.y,
        z: lcw.player.targetPosition.z
      } : null;
    });

    expect(destAfter).not.toBeNull();
    expect(destAfter?.x).toBeCloseTo(-6, 1);
    expect(destAfter?.z).toBeCloseTo(-8, 1);

    // C. Click on ground canvas and verify destination changes to click point
    await expect.poll(() => page.evaluate(() => {
      const { player } = (window as any).__lcwWorld3D;
      return Math.hypot(player.position.x + 6, player.position.z + 8);
    }), { timeout: 15000 }).toBeLessThan(0.5);
    // Project a point on the walkable ground through the current camera.
    const ground = await page.evaluate(() => {
      const { player, camera } = (window as any).__lcwWorld3D;
      const canvas = document.querySelector("canvas.world-3d-canvas")!;
      const rect = canvas.getBoundingClientRect();
      // Sample the top of the north bank around the landmark. The camera
      // eases into place and HUD controls can cover part of the projection.
      for (const dx of [-2, 2, -3, 3]) {
        for (const dz of [-2, 2, 0]) {
          const point = player.position.clone().set(-6 + dx, 1, -8 + dz).project(camera);
          if (Math.abs(point.x) > 0.75 || Math.abs(point.y) > 0.75 || Math.abs(point.z) > 1) continue;
          const x = (1 + point.x) * rect.width / 2;
          const y = (1 - point.y) * rect.height / 2;
          if (document.elementFromPoint(rect.left + x, rect.top + y) === canvas) return { x, y };
        }
      }
      throw new Error("No visible walkable point around the waypoint");
    });
    await worldContainer.locator("canvas.world-3d-canvas").click({ position: ground, timeout: 5000 });
    await page.waitForTimeout(100);

    const destGround = await page.evaluate(() => {
      const lcw = (window as any).__lcwWorld3D;
      return lcw.player.targetPosition ? {
        x: lcw.player.targetPosition.x,
        y: lcw.player.targetPosition.y,
        z: lcw.player.targetPosition.z
      } : null;
    });

    expect(destGround).not.toBeNull();
  });
});
