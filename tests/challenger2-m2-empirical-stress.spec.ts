import { expect, test } from "@playwright/test";
import * as THREE from "three";
import { World3DPlayer } from "../src/game/three/world/World3DPlayer";

test.describe("Challenger 2 Empirical Stress Test: Footstep Generation, Moisture Sensing & Pool Recycling", () => {
  /* ========================================================================= */
  /* 1. Heel-Strike Event Detection: Cadence, Alternation & Invariance         */
  /* ========================================================================= */
  test("C2-1. Zero-crossing heel-strike event detection: exactly 1 event per half-cycle, no double-triggering or missed steps", () => {
    const player = new World3DPlayer();

    // Spy on private onFootstep method
    const footstepEvents: Array<{ time: number; walkCycle: number; isLeft: boolean }> = [];
    const origOnFootstep = (player as any).onFootstep.bind(player);
    (player as any).onFootstep = (isLeft: boolean) => {
      footstepEvents.push({
        time: (player as any).elapsedTime,
        walkCycle: (player as any).walkCycle,
        isLeft
      });
      origOnFootstep(isLeft);
    };

    // Test a range of frame durations (dt = 0.005s to 0.1s)
    const dts = [0.005, 0.00833, 0.01667, 0.03333, 0.05, 0.1];

    for (const dt of dts) {
      footstepEvents.length = 0;
      (player as any).walkCycle = 0;
      (player as any).prevWalkCycle = 0;
      (player as any).elapsedTime = 0;
      (player as any).currentSpeed = (player as any).moveSpeed; // Full walk intensity

      // Walk forward with constant input
      const input = new THREE.Vector2(0, 1);
      const totalSteps = 600;

      for (let f = 0; f < totalSteps; f++) {
        player.update(dt, input);
      }

      const totalPhase = (player as any).walkCycle;
      const expectedHalfCycles = Math.floor(totalPhase / Math.PI);

      // 1. Total events must match the number of half-cycles crossed
      expect(footstepEvents.length).toBe(expectedHalfCycles);

      // 2. Strict alternation: Left and Right must alternate without fail
      for (let i = 1; i < footstepEvents.length; i++) {
        expect(footstepEvents[i].isLeft).not.toBe(footstepEvents[i - 1].isLeft);
      }

      // 3. Phase distance between consecutive footsteps must equal approximately PI (+/- one frame delta)
      const maxPhaseDeltaPerFrame = dt * 14.0;
      for (let i = 1; i < footstepEvents.length; i++) {
        const phaseDiff = footstepEvents[i].walkCycle - footstepEvents[i - 1].walkCycle;
        expect(phaseDiff).toBeGreaterThanOrEqual(Math.PI - maxPhaseDeltaPerFrame - 1e-4);
        expect(phaseDiff).toBeLessThanOrEqual(Math.PI + maxPhaseDeltaPerFrame + 1e-4);
      }
    }
  });

  test("C2-2. Stochastic jittered timesteps: phase integration prevents double-triggering or missed steps", () => {
    const player = new World3DPlayer();
    const footstepEvents: Array<{ walkCycle: number; isLeft: boolean }> = [];
    const origOnFootstep = (player as any).onFootstep.bind(player);
    (player as any).onFootstep = (isLeft: boolean) => {
      footstepEvents.push({ walkCycle: (player as any).walkCycle, isLeft });
      origOnFootstep(isLeft);
    };

    (player as any).currentSpeed = (player as any).moveSpeed;
    const input = new THREE.Vector2(1, 0);

    // Run 500 frames with pseudo-random jittered dt in [0.004, 0.09]
    let seed = 42;
    const rng = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    for (let f = 0; f < 500; f++) {
      const dt = 0.004 + rng() * 0.086;
      player.update(dt, input);
    }

    const totalPhase = (player as any).walkCycle;
    const expectedSteps = Math.floor(totalPhase / Math.PI);

    expect(footstepEvents.length).toBe(expectedSteps);

    // Verify alternation holds under irregular clock ticks
    for (let i = 1; i < footstepEvents.length; i++) {
      expect(footstepEvents[i].isLeft).toBe(!footstepEvents[i - 1].isLeft);
    }
  });

  test("C2-3. Stationary threshold: zero footstep events triggered when player is idle or decelerated below 10%", () => {
    const player = new World3DPlayer();
    let stepCount = 0;
    (player as any).onFootstep = () => {
      stepCount++;
    };

    // Idle stationary player: 200 frames with zero input
    const zeroInput = new THREE.Vector2(0, 0);
    for (let f = 0; f < 200; f++) {
      player.update(0.016, zeroInput);
    }
    expect(stepCount).toBe(0);

    // Creep below walkIntensity = 0.1 threshold (speed < 0.75)
    (player as any).currentSpeed = 0.5; // 0.5 / 7.5 = 0.0667 < 0.1
    for (let f = 0; f < 100; f++) {
      // Force currentSpeed to stay below threshold
      (player as any).currentSpeed = 0.5;
      player.update(0.016, zeroInput);
    }
    expect(stepCount).toBe(0);
  });

  /* ========================================================================= */
  /* 2. Proximity & Moisture Sensing: River Margin & Water Steps Boundaries   */
  /* ========================================================================= */
  test("C2-4. Moisture sensing boundary: water ripple triggers when Py <= 0.45 in river zone, dust puff on dry ground", () => {
    const player = new World3DPlayer();

    let waterRippleCount = 0;
    let dustPuffCount = 0;

    const origRipple = (player as any).spawnWaterRipple.bind(player);
    (player as any).spawnWaterRipple = (lx: number, lz: number) => {
      waterRippleCount++;
      origRipple(lx, lz);
    };

    const origDust = (player as any).spawnDustPuff.bind(player);
    (player as any).spawnDustPuff = (lx: number, lz: number) => {
      dustPuffCount++;
      origDust(lx, lz);
    };

    // (A) River margin test: worldZ in [-1.5, 6.5], worldY <= 0.45
    // Place outside water steps (X = 10.0, outside [0, 5])
    player.position.set(10.0, 0.40, 2.0); // Inside river zone, below 0.45
    (player as any).onFootstep(true);
    expect(waterRippleCount).toBe(1);
    expect(dustPuffCount).toBe(0);

    // Exact threshold boundary Py = 0.45
    player.position.set(10.0, 0.45, 2.0);
    (player as any).onFootstep(false);
    expect(waterRippleCount).toBe(2);
    expect(dustPuffCount).toBe(0);

    // Dry ground just above threshold Py = 0.451
    player.position.set(10.0, 0.451, 2.0);
    (player as any).onFootstep(true);
    expect(waterRippleCount).toBe(2);
    expect(dustPuffCount).toBe(1); // Dust puff triggered!

    // Elevated dry bridge Py = 1.0, inside river Z range
    player.position.set(10.0, 1.0, 2.0);
    (player as any).onFootstep(false);
    expect(waterRippleCount).toBe(2);
    expect(dustPuffCount).toBe(2);

    // River margin boundary Z tests at Py = 0.40 (incorporating footZ = +0.08 offset)
    // worldZ = position.z + 0.08
    // worldZ = -1.50 (boundary min) -> position.z = -1.58
    player.position.set(10.0, 0.40, -1.58);
    (player as any).onFootstep(true);
    expect(waterRippleCount).toBe(3);

    // worldZ = -1.51 (just outside min) -> position.z = -1.59
    player.position.set(10.0, 0.40, -1.59);
    (player as any).onFootstep(false);
    expect(dustPuffCount).toBe(3);

    // worldZ = 6.50 (boundary max) -> position.z = 6.42
    player.position.set(10.0, 0.40, 6.42);
    (player as any).onFootstep(true);
    expect(waterRippleCount).toBe(4);

    // worldZ = 6.51 (just outside max) -> position.z = 6.43
    player.position.set(10.0, 0.40, 6.43);
    (player as any).onFootstep(false);
    expect(dustPuffCount).toBe(4);
  });

  test("C2-5. Moisture sensing: water steps zone triggers ripples regardless of Py height", () => {
    const player = new World3DPlayer();

    let waterRippleCount = 0;
    let dustPuffCount = 0;

    (player as any).spawnWaterRipple = () => waterRippleCount++;
    (player as any).spawnDustPuff = () => dustPuffCount++;

    // Water steps: worldX in [0.0, 5.0] and worldZ in [-2.0, 2.0]
    // Even at Py = 1.0 (dry elevation), wet stepping stones must trigger ripples
    player.position.set(2.5, 1.0, 0.0);
    (player as any).onFootstep(true);
    expect(waterRippleCount).toBe(1);
    expect(dustPuffCount).toBe(0);

    // Boundary min: left foot footX = -0.20 -> position.x = 0.20 yields worldX = 0.00
    player.position.set(0.20, 1.0, 0.0);
    (player as any).onFootstep(true);
    expect(waterRippleCount).toBe(2);

    // Boundary max: right foot footX = +0.20 -> position.x = 4.80 yields worldX = 5.00
    player.position.set(4.80, 1.0, 0.0);
    (player as any).onFootstep(false);
    expect(waterRippleCount).toBe(3);

    // Just outside max: right foot footX = +0.20 -> position.x = 4.81 yields worldX = 5.01
    player.position.set(4.81, 1.0, 0.0);
    (player as any).onFootstep(false);
    expect(dustPuffCount).toBe(1);

    // Just outside min: left foot footX = -0.20 -> position.x = 0.19 yields worldX = -0.01
    player.position.set(0.19, 1.0, 0.0);
    (player as any).onFootstep(true);
    expect(dustPuffCount).toBe(2);
  });

  /* ========================================================================= */
  /* 3. Pool Recycling Under Rapid Footstep Stress: 100+ Continuous Steps       */
  /* ========================================================================= */
  test("C2-6. Dust pool recycling: 100 continuous dry footsteps without pool exhaustion, errors, or index corruption", () => {
    const player = new World3DPlayer();
    player.position.set(-10, 1.0, -10); // Completely dry cobblestone

    const dustPoolSize = (World3DPlayer as any).DUST_POOL_SIZE; // 24
    expect(dustPoolSize).toBe(24);

    const dustPositions = (player as any).dustPositions as Float32Array;
    const dustActive = (player as any).dustActive as Uint8Array;
    const dustLife = (player as any).dustLife as Float32Array;

    // Trigger 100 rapid footsteps
    for (let step = 0; step < 100; step++) {
      const isLeft = step % 2 === 0;
      (player as any).onFootstep(isLeft);

      // Verify nextDustIndex wraps cleanly modulo 24
      const nextIdx = (player as any).nextDustIndex;
      expect(nextIdx).toBeGreaterThanOrEqual(0);
      expect(nextIdx).toBeLessThan(dustPoolSize);
      expect(Number.isInteger(nextIdx)).toBe(true);

      // Advance time slightly to simulate physics tick
      player.update(0.016, new THREE.Vector2(0, 1));
    }

    // Verify all active particle coordinates and lifetimes are non-NaN and finite
    for (let i = 0; i < dustPoolSize; i++) {
      const px = dustPositions[i * 3 + 0];
      const py = dustPositions[i * 3 + 1];
      const pz = dustPositions[i * 3 + 2];
      const life = dustLife[i];

      expect(Number.isFinite(px)).toBe(true);
      expect(Number.isFinite(py)).toBe(true);
      expect(Number.isFinite(pz)).toBe(true);
      expect(Number.isFinite(life)).toBe(true);

      if (dustActive[i] === 0) {
        // Deactivated particles must rest below ground
        expect(py).toBe(-999.0);
      } else {
        expect(py).toBeGreaterThanOrEqual(0.01);
      }
    }

    // Let simulation run for 1 second with no further steps — all particles must cleanly expire
    for (let f = 0; f < 60; f++) {
      player.update(0.016, new THREE.Vector2(0, 0));
    }

    for (let i = 0; i < dustPoolSize; i++) {
      expect(dustActive[i]).toBe(0);
      expect(dustPositions[i * 3 + 1]).toBe(-999.0);
    }
  });

  test("C2-7. Water ripple pool recycling: 100 continuous wet footsteps without pool exhaustion or mesh detachment", () => {
    const player = new World3DPlayer();
    player.position.set(2.0, 0.40, 2.0); // Shallow river water

    const ripplePoolSize = (World3DPlayer as any).RIPPLE_POOL_SIZE; // 6
    expect(ripplePoolSize).toBe(6);

    const ripplePool = (player as any).ripplePool as THREE.Mesh[];
    const rippleActive = (player as any).rippleActive as Uint8Array;
    const rippleLife = (player as any).rippleLife as Float32Array;

    expect(ripplePool.length).toBe(6);

    // Trigger 100 continuous footsteps
    for (let step = 0; step < 100; step++) {
      const isLeft = step % 2 === 0;
      (player as any).onFootstep(isLeft);

      const nextIdx = (player as any).nextRippleIndex;
      expect(nextIdx).toBeGreaterThanOrEqual(0);
      expect(nextIdx).toBeLessThan(ripplePoolSize);

      player.update(0.016, new THREE.Vector2(1, 0));
    }

    // Verify all 6 pool meshes maintain valid transforms, scales, and opacity
    for (let i = 0; i < ripplePoolSize; i++) {
      const mesh = ripplePool[i];
      expect(mesh).toBeDefined();
      expect(Number.isFinite(mesh.position.x)).toBe(true);
      expect(Number.isFinite(mesh.position.y)).toBe(true);
      expect(Number.isFinite(mesh.position.z)).toBe(true);
      expect(mesh.scale.x).toBeGreaterThanOrEqual(1.0);
      expect(mesh.scale.x).toBeLessThanOrEqual(4.5 + 1e-4);

      const mat = mesh.material as THREE.MeshBasicMaterial;
      expect(mat.opacity).toBeGreaterThanOrEqual(0.0);
      expect(mat.opacity).toBeLessThanOrEqual(0.75 + 1e-4);
    }

    // Let simulation run for 0.6 seconds — all ripples must cleanly expire and become invisible
    for (let f = 0; f < 40; f++) {
      player.update(0.016, new THREE.Vector2(0, 0));
    }

    for (let i = 0; i < ripplePoolSize; i++) {
      expect(rippleActive[i]).toBe(0);
      expect(ripplePool[i].visible).toBe(false);
    }
  });

  /* ========================================================================= */
  /* 4. Zero Heap Allocations & Stable Memory In Hot Render Loop               */
  /* ========================================================================= */
  test("C2-8. Zero Three.js heap allocations during 1,000 continuous update ticks (walking & footsteps)", () => {
    const player = new World3DPlayer();
    const input = new THREE.Vector2(0, 1);

    // Warm-up 100 frames to achieve steady state
    for (let f = 0; f < 100; f++) {
      player.update(0.016, input);
    }

    // Instrument THREE constructors
    let allocCount = 0;
    const trackedClasses = [
      "Vector2",
      "Vector3",
      "Vector4",
      "Matrix3",
      "Matrix4",
      "Quaternion",
      "Euler",
      "Color",
      "Box3",
      "Sphere",
      "Group",
      "Mesh",
      "Points",
      "BufferGeometry",
      "MeshStandardMaterial",
      "MeshBasicMaterial"
    ];

    const unpatches: Array<() => void> = [];
    for (const className of trackedClasses) {
      const OriginalClass = (THREE as any)[className];
      if (typeof OriginalClass === "function") {
        const PatchedClass = function (...args: any[]) {
          allocCount++;
          return new OriginalClass(...args);
        };
        PatchedClass.prototype = OriginalClass.prototype;
        Object.assign(PatchedClass, OriginalClass);
        (THREE as any)[className] = PatchedClass;
        unpatches.push(() => {
          (THREE as any)[className] = OriginalClass;
        });
      }
    }

    try {
      // Execute 1,000 frames of walking locomotion with footstep generation
      for (let f = 0; f < 1000; f++) {
        player.update(0.016, input);
      }
      expect(allocCount).toBe(0);
    } finally {
      unpatches.forEach((unpatch) => unpatch());
    }
  });

  /* ========================================================================= */
  /* 5. Scene Graph Cleanup & Lifecycle Dispose Invariants                     */
  /* ========================================================================= */
  test("C2-9. Lifecycle dispose: cleans up all child geometries, materials, and pool references without throw", () => {
    const player = new World3DPlayer();

    // Trigger both dust and water pools
    player.position.set(1.0, 0.40, 0.0);
    for (let f = 0; f < 20; f++) {
      player.update(0.016, new THREE.Vector2(1, 0));
    }

    expect(() => {
      player.dispose();
    }).not.toThrow();

    expect((player as any).ripplePool.length).toBe(0);
  });
});
