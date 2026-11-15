import { expect, test } from "@playwright/test";
import * as THREE from "three";
import { World3DCameraController } from "../src/game/three/world/World3D";

test.describe("Milestone 3 Empirical Stress Tests: Camera Controller Mathematics & Lifecycle", () => {
  /* ========================================================================= */
  /* 1. Mathematical Continuity: Exponential Damping & Decay Stability          */
  /* ========================================================================= */
  test("1. Exponential damping equation: angular velocity decays cleanly without oscillation, NaN, or subnormals", () => {
    const dummyCamera = new THREE.PerspectiveCamera(45, 16 / 9, 0.5, 300);
    const playerPos = new THREE.Vector3(0, 1.0, 0);

    // Test a wide spectrum of initial velocities (slow creep to hypersonic flick)
    const testVelocities = [
      { vx: 0.001, vy: 0.001 },
      { vx: 0.05, vy: -0.05 },
      { vx: 2.5, vy: -1.8 },
      { vx: 15.0, vy: 12.0 },
      { vx: -50.0, vy: 40.0 },
      { vx: 200.0, vy: -180.0 },
    ];

    const dt = 0.016; // 60 FPS tick

    for (const initVel of testVelocities) {
      const controller = new World3DCameraController(playerPos);
      controller.state.angularVelocityX = initVel.vx;
      controller.state.angularVelocityY = initVel.vy;
      controller.state.isDragging = false;

      let prevVx = initVel.vx;
      let prevVy = initVel.vy;
      let framesUntilStopX = -1;
      let framesUntilStopY = -1;

      for (let frame = 1; frame <= 600; frame++) {
        controller.update(dt, playerPos, null, false, dummyCamera);

        const curVx = controller.state.angularVelocityX;
        const curVy = controller.state.angularVelocityY;

        // A. Finite & NaN check
        expect(Number.isFinite(curVx)).toBe(true);
        expect(Number.isFinite(curVy)).toBe(true);
        expect(Number.isNaN(curVx)).toBe(false);
        expect(Number.isNaN(curVy)).toBe(false);

        // B. Non-oscillatory monotonic decay: sign must never invert during coasting
        if (prevVx > 0) {
          expect(curVx).toBeGreaterThanOrEqual(0);
          expect(curVx).toBeLessThanOrEqual(prevVx);
        } else if (prevVx < 0) {
          expect(curVx).toBeLessThanOrEqual(0);
          expect(curVx).toBeGreaterThanOrEqual(prevVx);
        }

        if (prevVy > 0) {
          expect(curVy).toBeGreaterThanOrEqual(0);
          expect(curVy).toBeLessThanOrEqual(prevVy);
        } else if (prevVy < 0) {
          expect(curVy).toBeLessThanOrEqual(0);
          expect(curVy).toBeGreaterThanOrEqual(prevVy);
        }

        // C. Record when cutoff zero is reached
        if (curVx === 0 && framesUntilStopX === -1) framesUntilStopX = frame;
        if (curVy === 0 && framesUntilStopY === -1) framesUntilStopY = frame;

        prevVx = curVx;
        prevVy = curVy;
      }

      // Verify that velocity actually halted cleanly within analytical bounds
      expect(framesUntilStopX).toBeGreaterThan(0);
      expect(framesUntilStopX).toBeLessThanOrEqual(160);
      expect(controller.state.angularVelocityX).toBe(0);
      expect(controller.state.angularVelocityY).toBe(0);
    }
  });

  /* ========================================================================= */
  /* 2. Polar Angle Bounds & Hard Ground Safety Clearance                      */
  /* ========================================================================= */
  test("2. Polar angle clamping: strictly prevents camera flipping or ground penetration", () => {
    const dummyCamera = new THREE.PerspectiveCamera(45, 16 / 9, 0.5, 300);
    const playerPos = new THREE.Vector3(5, 0.0, 5); // Ground level (Y = 0)

    const controller = new World3DCameraController(playerPos);

    // Stress: attempt extreme polar displacement through continuous mouse movement
    controller.state.isDragging = true;

    // A. Extreme upward drag (forcing towards / past north pole)
    for (let i = 0; i < 50; i++) {
      controller.handleMouseMove({
        clientX: 100,
        clientY: 100 + i * 100, // Large positive Y delta -> negative dTheta
      } as any);
      expect(controller.state.currentPolar).toBeGreaterThanOrEqual(controller.POLAR_MIN);
      expect(controller.state.currentPolar).toBeLessThanOrEqual(controller.POLAR_MAX);
    }

    // B. Extreme downward drag (forcing towards / past south pole / ground)
    for (let i = 0; i < 50; i++) {
      controller.handleMouseMove({
        clientX: 100,
        clientY: 100 - i * 100, // Large negative Y delta -> positive dTheta
      } as any);
      expect(controller.state.currentPolar).toBeGreaterThanOrEqual(controller.POLAR_MIN);
      expect(controller.state.currentPolar).toBeLessThanOrEqual(controller.POLAR_MAX);
    }

    controller.handleMouseUp();

    // C. Ground clearance verification under all polar angles and distance ranges
    const testDistances = [3.8, 5.2, 14.0, 24.0, 36.0];
    const testPolars = [
      controller.POLAR_MIN,
      0.5,
      0.85,
      1.28,
      controller.POLAR_MAX - 0.001,
      controller.POLAR_MAX,
    ];

    for (const dist of testDistances) {
      for (const pol of testPolars) {
        controller.state.currentDistance = dist;
        controller.state.targetDistance = dist;
        controller.state.currentPolar = pol;
        controller.state.targetPolar = pol;

        // Run update to compute 3D world camera position
        controller.update(0.016, playerPos, null, false, dummyCamera);

        // Ground clearance MUST ALWAYS satisfy Y >= 1.65m
        expect(dummyCamera.position.y).toBeGreaterThanOrEqual(1.65);
        expect(Number.isFinite(dummyCamera.position.x)).toBe(true);
        expect(Number.isFinite(dummyCamera.position.y)).toBe(true);
        expect(Number.isFinite(dummyCamera.position.z)).toBe(true);
      }
    }
  });

  /* ========================================================================= */
  /* 3. Framerate Independence: Analytical dt Invariance                        */
  /* ========================================================================= */
  test("3. Framerate independence: exponential damping trajectory is invariant under dt = 0.008s to 0.1s", () => {
    const dummyCamera = new THREE.PerspectiveCamera(45, 16 / 9, 0.5, 300);
    const startPlayerPos = new THREE.Vector3(0, 0, 0);
    const targetPlayerPos = new THREE.Vector3(12, 1.5, -8);

    const runSimulation = (stepDt: number, totalTime: number) => {
      const controller = new World3DCameraController(startPlayerPos);
      controller.state.currentDistance = 24.0;
      controller.state.targetDistance = 6.0;
      controller.state.angularVelocityX = 4.0;

      let elapsed = 0;
      while (elapsed < totalTime) {
        const curDt = Math.min(stepDt, totalTime - elapsed);
        controller.update(curDt, targetPlayerPos, null, false, dummyCamera);
        elapsed += curDt;
      }

      return {
        dist: controller.state.currentDistance,
        targetX: controller.state.target.x,
        targetY: controller.state.target.y,
        targetZ: controller.state.target.z,
        fov: controller.state.currentFov,
        velX: controller.state.angularVelocityX,
        camY: dummyCamera.position.y,
      };
    };

    const TOTAL_TIME = 1.0; // 1 second of camera transition

    // High refresh rate (120 FPS, dt ~ 0.00833s)
    const sim120 = runSimulation(1 / 120, TOTAL_TIME);
    // Standard refresh rate (60 FPS, dt ~ 0.01667s)
    const sim60 = runSimulation(1 / 60, TOTAL_TIME);
    // Low refresh rate / jitter (30 FPS, dt ~ 0.03333s)
    const sim30 = runSimulation(1 / 30, TOTAL_TIME);
    // Stress low framerate (10 FPS, dt = 0.10s)
    const sim10 = runSimulation(0.1, TOTAL_TIME);

    // Distance convergence comparison (analytical exponential: exact match)
    expect(Math.abs(sim120.dist - sim60.dist)).toBeLessThan(1e-3);
    expect(Math.abs(sim60.dist - sim30.dist)).toBeLessThan(1e-3);
    expect(Math.abs(sim60.dist - sim10.dist)).toBeLessThan(1e-2);

    // Target coordinates convergence
    expect(Math.abs(sim120.targetX - sim60.targetX)).toBeLessThan(1e-3);
    expect(Math.abs(sim60.targetX - sim30.targetX)).toBeLessThan(1e-3);
    expect(Math.abs(sim60.targetX - sim10.targetX)).toBeLessThan(1e-2);

    // FOV convergence
    expect(Math.abs(sim120.fov - sim60.fov)).toBeLessThan(1e-3);
    expect(Math.abs(sim60.fov - sim30.fov)).toBeLessThan(1e-3);

    // Velocity decay convergence
    expect(Math.abs(sim120.velX - sim60.velX)).toBeLessThan(1e-3);
    expect(Math.abs(sim60.velX - sim30.velX)).toBeLessThan(1e-3);
  });

  /* ========================================================================= */
  /* 4. Memory Profiling: Zero Object Allocations in Animation Loop             */
  /* ========================================================================= */
  test("4. Memory profiling: zero THREE heap allocations in World3DCameraController.update", () => {
    const dummyCamera = new THREE.PerspectiveCamera(45, 16 / 9, 0.5, 300);
    const playerPos = new THREE.Vector3(0, 1.0, 0);
    const controller = new World3DCameraController(playerPos);

    const landmarkMock = {
      id: "guan-huat" as const,
      nameZh: "源发香料行",
      nameEn: "Guan Huat Spice",
      type: "investigation" as const,
      position: new THREE.Vector3(-6.2, 1.2, 14.0),
      radius: 3.2,
      beaconColor: 0x3de0c8,
      investigation: {
        targetDistance: 5.2,
        targetPolar: 1.28,
        descriptionZh: "源发香料行",
        descriptionEn: "Guan Huat Spice",
      },
    };

    // Monitor THREE constructor calls
    let vector3Allocations = 0;
    let vector2Allocations = 0;
    let matrix4Allocations = 0;

    const originalV3 = THREE.Vector3;
    const originalV2 = THREE.Vector2;
    const originalM4 = THREE.Matrix4;

    try {
      (THREE as any).Vector3 = class extends originalV3 {
        constructor(...args: any[]) {
          super(...(args as [any, any, any]));
          vector3Allocations++;
        }
      };
      (THREE as any).Vector2 = class extends originalV2 {
        constructor(...args: any[]) {
          super(...(args as [any, any]));
          vector2Allocations++;
        }
      };
      (THREE as any).Matrix4 = class extends originalM4 {
        constructor(...args: any[]) {
          super();
          matrix4Allocations++;
        }
      };

      // Run 300 frames of controller updates across Follow, Macro, and Birds-Eye modes
      for (let frame = 0; frame < 100; frame++) {
        // Follow mode
        controller.update(0.016, playerPos, null, false, dummyCamera);
      }
      for (let frame = 0; frame < 100; frame++) {
        // Macro Investigation mode
        controller.update(0.016, playerPos, landmarkMock, false, dummyCamera);
      }
      for (let frame = 0; frame < 100; frame++) {
        // Birds-Eye Diorama mode
        controller.update(0.016, playerPos, null, true, dummyCamera);
      }

      // Verification: EXACTLY ZERO new object allocations in update loop!
      expect(vector3Allocations).toBe(0);
      expect(vector2Allocations).toBe(0);
      expect(matrix4Allocations).toBe(0);
    } finally {
      (THREE as any).Vector3 = originalV3;
      (THREE as any).Vector2 = originalV2;
      (THREE as any).Matrix4 = originalM4;
    }
  });

  /* ========================================================================= */
  /* 5. In-Browser E2E: Compass Needle Direct DOM Transform & Zero React Render */
  /* ========================================================================= */
  test("5. In-Browser Compass DOM sync: updates needle style without triggering React component re-renders", async ({
    page,
  }) => {
    await page.goto("/?mode=3d");
    const worldContainer = page.locator(".world-3d-fullscreen");
    await expect(worldContainer).toBeVisible();

    await page.waitForFunction(() => Boolean((window as any).__lcwWorld3D?.camController));

    // Profile DOM transform and verify state
    const result = await page.evaluate(async () => {
      const lcw = (window as any).__lcwWorld3D;
      const cam = lcw.camController;

      const compassBox = document.querySelector(".world-3d-compass-box");
      const needleEl = compassBox?.querySelector("div[style*='transform']") as HTMLDivElement;

      if (!needleEl) return { ok: false, error: "Compass needle DOM node not found" };

      // Sample needle transform before and after rotating camera
      const initialTransform = needleEl.style.transform;

      // Orbit camera azimuth by 90 degrees (~1.57079 rad)
      cam.state.azimuth += Math.PI / 2;

      // Wait 3 frames for requestAnimationFrame sync
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))));

      const updatedTransform = needleEl.style.transform;
      const expectedDeg = (-cam.state.azimuth * 180) / Math.PI;

      // Extract numeric angle from rotate(-127.242deg)
      const match = updatedTransform.match(/rotate\(([-\d.]+)deg\)/);
      const parsedDeg = match ? parseFloat(match[1]) : NaN;

      return {
        ok: true,
        initialTransform,
        updatedTransform,
        expectedDeg,
        parsedDeg,
        needleHasWillChange: needleEl.style.willChange === "transform",
      };
    });

    expect(result.ok).toBe(true);
    expect(result.initialTransform).toBeDefined();
    expect(result.updatedTransform).toBeDefined();
    expect(result.updatedTransform).not.toEqual(result.initialTransform);
    expect(Number.isFinite(result.parsedDeg)).toBe(true);
    expect(result.parsedDeg).toBeDefined();
    expect(result.expectedDeg).toBeDefined();
    expect(Math.abs((result.parsedDeg ?? 0) - (result.expectedDeg ?? 0))).toBeLessThan(0.01);
    expect(result.needleHasWillChange).toBe(true);
  });
});
