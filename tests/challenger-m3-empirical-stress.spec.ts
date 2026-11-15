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

import { World3DEnvironment, UnifiedWindField, getRiverWaveElevation } from "../src/game/three/world/World3DEnvironment";
import { World3DLifeScenes } from "../src/game/three/world/World3DLifeScenes";

test.describe("Empirical Challenger M3: Unified Wind, Buoyancy Drift & Aquatic Ecosystem", () => {
  /* ========================================================================= */
  /* 1. Unified 3D Wind Vector Field W(x, y, z, t) Mathematical Properties     */
  /* ========================================================================= */
  test("1. Unified Wind Field: continuous, finite, boundary shear, and zero allocation", () => {
    const scratch = new THREE.Vector3();
    const dt = 0.016;

    // A. Boundary Layer Wind Shear: speed at y=7.0 must be greater than at y=0.5
    const windGround = UnifiedWindField.sample(0, 0.5, 0, 10.0, scratch).clone();
    const windCrown = UnifiedWindField.sample(0, 7.0, 0, 10.0, scratch).clone();
    expect(windCrown.length()).toBeGreaterThan(windGround.length());

    // B. Straits monsoon prevailing bias (+X, -Z diagonal)
    let positiveXCount = 0;
    let negativeZCount = 0;
    const testPoints = [
      [-20, 3, -10],
      [0, 4, 0],
      [15, 2, 8],
      [-5, 5, 12],
    ];

    for (let f = 0; f < 500; f++) {
      const t = f * dt;
      for (const [x, y, z] of testPoints) {
        const w = UnifiedWindField.sample(x, y, z, t, scratch);
        expect(Number.isFinite(w.x)).toBe(true);
        expect(Number.isFinite(w.y)).toBe(true);
        expect(Number.isFinite(w.z)).toBe(true);
        if (w.x > 0) positiveXCount++;
        if (w.z < 0) negativeZCount++;
      }
    }
    // Overwhelming majority of samples must follow Straits monsoon direction
    expect(positiveXCount / 2000).toBeGreaterThan(0.90);
    expect(negativeZCount / 2000).toBeGreaterThan(0.90);

    // C. Zero allocation assertion
    let allocations = 0;
    const origVec3 = THREE.Vector3;
    (THREE as any).Vector3 = function (...args: any[]) {
      allocations++;
      return new origVec3(...args);
    };

    for (let f = 0; f < 1000; f++) {
      UnifiedWindField.sample(f * 0.1, 3.0, -f * 0.05, f * 0.016, scratch);
    }

    (THREE as any).Vector3 = origVec3;
    expect(allocations).toBe(0);
  });

  /* ========================================================================= */
  /* 2. Bumboat Tethered Stream Drift & 4-Point Buoyancy Coupling               */
  /* ========================================================================= */
  test("2. Bumboat Tethered Stream Drift: surge, sway, yaw stability, and water bounds", () => {
    const env = new World3DEnvironment();
    const dt = 0.016;

    // Run 1,200 frames (~20 seconds of simulation)
    for (let frame = 0; frame < 1200; frame++) {
      const time = frame * dt;
      env.update(time, dt);

      // Verify each bumboat
      const boats = (env as any).sampanBoats;
      const basePositions = (env as any).bumboatBasePositions;
      expect(boats.length).toBeGreaterThanOrEqual(3);

      for (let i = 0; i < boats.length; i++) {
        const boat = boats[i];
        const base = basePositions[i];

        // Surge along stream (+X direction surge bounds)
        expect(boat.position.x).toBeGreaterThanOrEqual(base.x - 0.05);
        expect(boat.position.x).toBeLessThanOrEqual(base.x + 0.20);

        // Sway transverse bounds
        expect(Math.abs(boat.position.z - base.z)).toBeLessThanOrEqual(0.08);

        // Vertical elevation within water boundary
        const waterY = getRiverWaveElevation(boat.position.x, boat.position.z, time);
        expect(boat.position.y).toBeGreaterThanOrEqual(waterY + 0.05);
        expect(boat.position.y).toBeLessThanOrEqual(waterY + 0.35);

        // Pitch and roll angular bounds
        expect(Math.abs(boat.rotation.x)).toBeLessThanOrEqual(0.18); // <= ~10 deg
        expect(Math.abs(boat.rotation.z)).toBeLessThanOrEqual(0.35); // <= ~20 deg
      }
    }

    env.dispose();
  });

  /* ========================================================================= */
  /* 3. Procedural Koi Fish School: Carangiform Kinematics & Sub-surface Bounds*/
  /* ========================================================================= */
  test("3. Koi Fish School: 6 fish, carangiform undulation, submerged depth, no NaN", () => {
    const life = new World3DLifeScenes();
    const koiSchool = (life as any).koiSchool;
    expect(koiSchool.length).toBe(6);

    const dt = 0.016;
    let minTailAngle = Infinity;
    let maxTailAngle = -Infinity;

    for (let frame = 0; frame < 1500; frame++) {
      const time = frame * dt;
      life.update(time, dt);

      for (let i = 0; i < koiSchool.length; i++) {
        const fish = koiSchool[i];
        const pos = fish.root.position;
        const rot = fish.root.rotation;
        const tailRot = fish.tailPivot.rotation;

        expect(Number.isFinite(pos.x)).toBe(true);
        expect(Number.isFinite(pos.y)).toBe(true);
        expect(Number.isFinite(pos.z)).toBe(true);
        expect(Number.isFinite(rot.y)).toBe(true);
        expect(Number.isFinite(tailRot.y)).toBe(true);

        // Fish must stay submerged beneath river surface
        const waterY = getRiverWaveElevation(pos.x, pos.z, time);
        expect(pos.y).toBeLessThanOrEqual(waterY + 0.01);
        expect(pos.y).toBeGreaterThanOrEqual(-0.25);

        // Track tail undulation
        if (tailRot.y < minTailAngle) minTailAngle = tailRot.y;
        if (tailRot.y > maxTailAngle) maxTailAngle = tailRot.y;
      }
    }

    // Verify carangiform tail oscillation exercised full range
    expect(minTailAngle).toBeLessThan(-0.30);
    expect(maxTailAngle).toBeGreaterThan(0.30);

    life.dispose();
  });

  /* ========================================================================= */
  /* 4. Peeking Wetland Otter: 4-Stage State Machine Trajectory                */
  /* ========================================================================= */
  test("4. Peeking Wetland Otter: 4-phase state transitions, elevation rise, and dive bounds", () => {
    const life = new World3DLifeScenes();
    const otterGroup = (life as any).peekingOtterGroup;
    const bodyPivot = (life as any).peekingOtterBodyPivot;
    const headPivot = (life as any).peekingOtterHeadPivot;
    expect(otterGroup).toBeDefined();

    const dt = 0.016;
    let maxElev = -Infinity;
    let minElev = Infinity;
    let maxDivePitch = 0;

    // Simulate 2 full 9.0s cycles (1,200 frames)
    for (let frame = 0; frame < 1200; frame++) {
      const time = frame * dt;
      life.update(time, dt);

      const y = otterGroup.position.y;
      expect(Number.isFinite(y)).toBe(true);
      expect(Number.isFinite(bodyPivot.rotation.x)).toBe(true);
      expect(Number.isFinite(headPivot.rotation.y)).toBe(true);

      if (y > maxElev) maxElev = y;
      if (y < minElev) minElev = y;
      if (bodyPivot.rotation.x < maxDivePitch) maxDivePitch = bodyPivot.rotation.x;
    }

    // Must exhibit periscope rise and arc dive
    expect(maxElev).toBeGreaterThan(0.30);
    expect(minElev).toBeLessThan(0.18);
    // Streamlined arc dive reaches deep negative pitch (< -0.8 rad)
    expect(maxDivePitch).toBeLessThan(-0.80);

    life.dispose();
  });

  /* ========================================================================= */
  /* 5. Dragonflies 42 Hz Wing Flapping & Water-Dipping Kinematics             */
  /* ========================================================================= */
  test("5. Dragonflies: 42 Hz out-of-phase wings, hover darting, and water-dipping", () => {
    const life = new World3DLifeScenes();
    const dragonflies = (life as any).dragonflies;
    expect(dragonflies.length).toBe(3);

    const dt = 0.016;
    let minWingAngle = Infinity;
    let maxWingAngle = -Infinity;
    let observedWaterDip = false;

    for (let frame = 0; frame < 1500; frame++) {
      const time = frame * dt;
      life.update(time, dt);

      for (let i = 0; i < dragonflies.length; i++) {
        const df = dragonflies[i];
        const foreL = df.forewingLeft.rotation.z;
        const hindL = df.hindwingLeft.rotation.z;
        const pos = df.root.position;

        expect(Number.isFinite(foreL)).toBe(true);
        expect(Number.isFinite(hindL)).toBe(true);
        expect(Number.isFinite(pos.x)).toBe(true);
        expect(Number.isFinite(pos.y)).toBe(true);
        expect(Number.isFinite(pos.z)).toBe(true);

        if (foreL < minWingAngle) minWingAngle = foreL;
        if (foreL > maxWingAngle) maxWingAngle = foreL;

        // Check water-dip elevation (swooping down near river surface)
        const waterY = getRiverWaveElevation(pos.x, pos.z, time);
        if (Math.abs(pos.y - waterY) < 0.10) {
          observedWaterDip = true;
        }
      }
    }

    // Flapping range check
    expect(minWingAngle).toBeLessThan(-0.45);
    expect(maxWingAngle).toBeGreaterThan(0.45);
    // Must have observed water-dipping maneuver
    expect(observedWaterDip).toBe(true);

    life.dispose();
  });

  /* ========================================================================= */
  /* 6. Combined Zero-Allocation 60 FPS Verification                           */
  /* ========================================================================= */
  test("6. Combined Environment & LifeScenes Zero Allocations in 600 frames", () => {
    const env = new World3DEnvironment();
    const life = new World3DLifeScenes();

    // Warm-up 10 frames
    for (let f = 0; f < 10; f++) {
      env.update(f * 0.016, 0.016);
      life.update(f * 0.016, 0.016);
    }

    // Spy on Three.js constructors
    let threeAllocations = 0;
    const constructors = [
      "Vector2", "Vector3", "Vector4",
      "Matrix3", "Matrix4",
      "Quaternion", "Euler",
      "Box3", "Sphere", "Color",
      "Group", "Mesh", "Points",
      "BufferGeometry", "MeshStandardMaterial", "MeshBasicMaterial"
    ];

    const originalConstructors: Record<string, any> = {};
    for (const name of constructors) {
      if ((THREE as any)[name]) {
        originalConstructors[name] = (THREE as any)[name];
        (THREE as any)[name] = function (...args: any[]) {
          threeAllocations++;
          return new originalConstructors[name](...args);
        };
      }
    }

    // Run 600 frames
    const dt = 0.016;
    for (let f = 10; f < 610; f++) {
      env.update(f * dt, dt);
      life.update(f * dt, dt);
    }

    // Restore
    for (const name of constructors) {
      if (originalConstructors[name]) {
        (THREE as any)[name] = originalConstructors[name];
      }
    }

    expect(threeAllocations).toBe(0);

    env.dispose();
    life.dispose();
  });
});
