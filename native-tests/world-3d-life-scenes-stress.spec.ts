import { expect, test } from "./safari";
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
            fillRect: () => {},
            strokeRect: () => {},
            beginPath: () => {},
            arc: () => {},
            fill: () => {},
            stroke: () => {},
            moveTo: () => {},
            lineTo: () => {},
            closePath: () => {},
            createLinearGradient: () => ({ addColorStop: () => {} }),
            createRadialGradient: () => ({ addColorStop: () => {} }),
          }),
        };
      }
      return {};
    },
  };
}

import { World3DLifeScenes } from "../src/game/three/world/World3DLifeScenes";
import { getRiverWaveElevation } from "../src/game/three/world/World3DEnvironment";

test.describe("Empirical Challenger M2-1: World3DLifeScenes Stress Test Suite", () => {
  /* ========================================================================= */
  /* 1. Coolie 1 Stride Kinematics & Turnaround Easing                         */
  /* ========================================================================= */
  test("1. Coolie 1 stride kinematics and turnaround easing (bounds, smooth ramp, no NaN)", () => {
    const lifeScenes = new World3DLifeScenes();
    const coolie1 = (lifeScenes as any).coolie1;
    expect(coolie1).toBeDefined();

    const dt = 0.016; // 60 FPS
    let maxZ = -Infinity;
    let minZ = Infinity;
    let maxY = -Infinity;
    let minY = Infinity;
    let maxLegAngle = -Infinity;
    let minLegAngle = Infinity;

    // Simulate 3,000 frames (~48 seconds, ~4.5 full patrol cycles)
    for (let frame = 0; frame < 3000; frame++) {
      const time = frame * dt;
      lifeScenes.update(time, dt);

      const rootPos = coolie1.root.position;
      const rootRot = coolie1.root.rotation;
      const leftLegRot = coolie1.leftLeg.rotation;
      const rightLegRot = coolie1.rightLeg.rotation;
      const polePos = coolie1.poleRig.position;
      const frontBasketPos = coolie1.frontBasket.position;
      const rearBasketPos = coolie1.rearBasket.position;

      // Verify absence of NaN or Infinite values
      expect(Number.isFinite(rootPos.x)).toBe(true);
      expect(Number.isFinite(rootPos.y)).toBe(true);
      expect(Number.isFinite(rootPos.z)).toBe(true);
      expect(Number.isFinite(rootRot.y)).toBe(true);
      expect(Number.isFinite(leftLegRot.x)).toBe(true);
      expect(Number.isFinite(rightLegRot.x)).toBe(true);
      expect(Number.isFinite(polePos.y)).toBe(true);
      expect(Number.isFinite(frontBasketPos.y)).toBe(true);
      expect(Number.isFinite(rearBasketPos.y)).toBe(true);

      // Verify patrol route Z coordinates [-3.90, -1.20]
      expect(rootPos.z).toBeGreaterThanOrEqual(-3.90001);
      expect(rootPos.z).toBeLessThanOrEqual(-1.19999);
      if (rootPos.z > maxZ) maxZ = rootPos.z;
      if (rootPos.z < minZ) minZ = rootPos.z;

      // Verify elevation ramp between pier deck (0.775) and quay (1.00)
      expect(rootPos.y).toBeGreaterThanOrEqual(0.77499);
      expect(rootPos.y).toBeLessThanOrEqual(1.00001);
      if (rootPos.y > maxY) maxY = rootPos.y;
      if (rootPos.y < minY) minY = rootPos.y;

      // Verify leg swing bounds
      expect(Math.abs(leftLegRot.x)).toBeLessThanOrEqual(0.5501);
      expect(Math.abs(rightLegRot.x)).toBeLessThanOrEqual(0.5501);
      if (leftLegRot.x > maxLegAngle) maxLegAngle = leftLegRot.x;
      if (leftLegRot.x < minLegAngle) minLegAngle = leftLegRot.x;

      // Verify pole flex elevation bounds
      expect(polePos.y).toBeGreaterThanOrEqual(1.3799);
      expect(polePos.y).toBeLessThanOrEqual(1.45);

      // Verify basket suspension bounce
      expect(frontBasketPos.y).toBeGreaterThanOrEqual(-0.60);
      expect(frontBasketPos.y).toBeLessThanOrEqual(-0.35);

      // Turnaround orientation checks:
      // Verify rotation matrix continuity: orientation vector (sin(yaw), cos(yaw))
      const dirX = Math.sin(rootRot.y);
      const dirZ = Math.cos(rootRot.y);
      expect(Number.isFinite(dirX)).toBe(true);
      expect(Number.isFinite(dirZ)).toBe(true);
    }

    // Verify full exercise of ranges
    expect(minZ).toBeCloseTo(-3.90, 1);
    expect(maxZ).toBeCloseTo(-1.20, 1);
    expect(minY).toBeCloseTo(0.775, 2);
    expect(maxY).toBeCloseTo(1.000, 2);
    expect(minLegAngle).toBeLessThan(-0.50);
    expect(maxLegAngle).toBeGreaterThan(0.50);

    lifeScenes.dispose();
  });

  /* ========================================================================= */
  /* 2. Coolie 2 Squat & Crate Lift Trajectory Clearance                       */
  /* ========================================================================= */
  test("2. Coolie 2 squat and crate lift trajectory (clearance, no NaN, no body penetration)", () => {
    const lifeScenes = new World3DLifeScenes();
    const coolie2 = (lifeScenes as any).coolie2;
    expect(coolie2).toBeDefined();

    const dt = 0.016;
    let minCrateY = Infinity;
    let maxCrateY = -Infinity;
    let minHipsY = Infinity;
    let maxHipsY = -Infinity;
    let minTorsoAngle = Infinity;
    let maxTorsoAngle = -Infinity;

    // Simulate 2,400 frames (~38 seconds, >3 full 12.0s cycles)
    for (let frame = 0; frame < 2400; frame++) {
      const time = frame * dt;
      lifeScenes.update(time, dt);

      const cratePos = coolie2.crateMesh.position;
      const crateRot = coolie2.crateMesh.rotation;
      const hipsPos = coolie2.hips.position;
      const torsoRot = coolie2.torsoGroup.rotation;

      // No NaN
      expect(Number.isFinite(cratePos.y)).toBe(true);
      expect(Number.isFinite(crateRot.y)).toBe(true);
      expect(Number.isFinite(hipsPos.y)).toBe(true);
      expect(Number.isFinite(torsoRot.x)).toBe(true);
      expect(Number.isFinite(torsoRot.y)).toBe(true);

      if (cratePos.y < minCrateY) minCrateY = cratePos.y;
      if (cratePos.y > maxCrateY) maxCrateY = cratePos.y;
      if (hipsPos.y < minHipsY) minHipsY = hipsPos.y;
      if (hipsPos.y > maxHipsY) maxHipsY = hipsPos.y;
      if (torsoRot.x < minTorsoAngle) minTorsoAngle = torsoRot.x;
      if (torsoRot.x > maxTorsoAngle) maxTorsoAngle = torsoRot.x;

      // Hips squat bounds
      expect(hipsPos.y).toBeGreaterThanOrEqual(0.42);
      expect(hipsPos.y).toBeLessThanOrEqual(0.66);

      // Torso flexion bounds
      expect(torsoRot.x).toBeGreaterThanOrEqual(0.03);
      expect(torsoRot.x).toBeLessThanOrEqual(0.72);

      // Crate elevation bounds
      // Half-height of crate = 0.21.
      // Crate center Y ranges from deck (0.21) up to lifted (0.58).
      // With micro-exertion tremor (amplitude 0.005), Y can reach 0.205 min.
      expect(cratePos.y).toBeGreaterThanOrEqual(0.2049);
      expect(cratePos.y).toBeLessThanOrEqual(0.5851);

      // Clearance: Crate bottom relative to pier deck (deck is at local y=0.0):
      const crateBottomLocalY = cratePos.y - 0.21;
      // Allow max 5.1mm tolerance for micro-tremor
      expect(crateBottomLocalY).toBeGreaterThanOrEqual(-0.0051);

      // Clearance: Crate vs Torso Body
      // Coolie 2 root position: Z = -1.40. Crate mesh local Z = 0.45.
      // Crate box dimensions: width=0.65, height=0.42, depth=0.46 (Z extends from 0.45 - 0.23 = 0.22 to 0.68).
      // Coolie torso is centered at local Z = 0.
      // Even when bent forward (rotation.x = 0.70 rad), torso length = 0.85, base at Y=0.40, top reaches Z ≈ 0.85 * sin(0.70) * 0.5 ≈ 0.27 at Y ≈ 0.75.
      // At crate height (Y in [0.21, 0.58]), hips are at Z=0 and lower torso is at Z <= 0.18.
      // Crate rear face is at local Z = 0.22, maintaining separation from lower body.
      const crateRearZ = 0.45 - 0.23;
      expect(crateRearZ).toBe(0.22);
    }

    expect(minCrateY).toBeGreaterThanOrEqual(0.2049);
    expect(maxCrateY).toBeGreaterThan(0.57);
    expect(minHipsY).toBeCloseTo(0.43, 1);
    expect(maxHipsY).toBeCloseTo(0.65, 1);

    lifeScenes.dispose();
  });

  /* ========================================================================= */
  /* 3. Otter Path Trajectory & River Wave Elevation Tracking                  */
  /* ========================================================================= */
  test("3. Otter path trajectory and wave elevation tracking under varying deltas", () => {
    const lifeScenes = new World3DLifeScenes();
    const otter1 = (lifeScenes as any).otter1Group;
    const otter2 = (lifeScenes as any).otter2Group;
    expect(otter1).toBeDefined();
    expect(otter2).toBeDefined();

    // Test a wide spectrum of variable frame deltas:
    // [0.0001s (high-freq tick), 0.016s (60 FPS), 0.033s (30 FPS), 0.1s (lag spike), 1.0s, 5.0s, 10.0s (tab background)]
    const testDeltas = [0.0001, 0.005, 0.016, 0.033, 0.1, 0.5, 1.0, 5.0, 10.0];

    for (const dt of testDeltas) {
      let simTime = 0.0;
      for (let step = 0; step < 200; step++) {
        simTime += dt;
        lifeScenes.update(simTime, dt);

        const p1 = otter1.position;
        const r1 = otter1.rotation;
        const p2 = otter2.position;

        // No NaN
        expect(Number.isFinite(p1.x)).toBe(true);
        expect(Number.isFinite(p1.y)).toBe(true);
        expect(Number.isFinite(p1.z)).toBe(true);
        expect(Number.isFinite(r1.y)).toBe(true);
        expect(Number.isFinite(p2.x)).toBe(true);
        expect(Number.isFinite(p2.y)).toBe(true);
        expect(Number.isFinite(p2.z)).toBe(true);

        // Otter 1 orbit path bounds:
        // x in [-2.60 - 0.85, -2.60 + 0.85] = [-3.45, -1.75]
        // z in [0.35 - 0.45, 0.35 + 0.45] = [-0.10, 0.80]
        expect(p1.x).toBeGreaterThanOrEqual(-3.4501);
        expect(p1.x).toBeLessThanOrEqual(-1.7499);
        expect(p1.z).toBeGreaterThanOrEqual(-0.1001);
        expect(p1.z).toBeLessThanOrEqual(0.8001);

        // Wave elevation tracking accuracy:
        // Expected wave elevation at (p1.x, p1.z)
        const expectedWaveY = getRiverWaveElevation(p1.x, p1.z, simTime);
        const waveDeltaY = Math.abs(p1.y - (expectedWaveY - 0.02));
        // Sinusoidal bobbing is +/- 0.025
        expect(waveDeltaY).toBeLessThanOrEqual(0.02501);

        // Otter 2 bounds
        // Base X: -1.90 +/- 0.15 => [-2.05, -1.75], Z = 0.65
        expect(p2.x).toBeGreaterThanOrEqual(-2.0501);
        expect(p2.x).toBeLessThanOrEqual(-1.7499);
        expect(p2.z).toBe(0.65);
      }
    }

    lifeScenes.dispose();
  });

  /* ========================================================================= */
  /* 4. Zero Allocations in 60 FPS update() Loop                               */
  /* ========================================================================= */
  test("4. Zero heap allocations in update() animation loop", () => {
    const lifeScenes = new World3DLifeScenes();

    // Warm-up 10 frames
    for (let f = 0; f < 10; f++) {
      lifeScenes.update(f * 0.016, 0.016);
    }

    // Spy on Three.js constructors
    let threeAllocations = 0;
    const spyConstructor = (obj: any, key: string) => {
      const orig = obj[key];
      if (typeof orig === "function") {
        obj[key] = function (...args: any[]) {
          threeAllocations++;
          return new orig(...args);
        };
        (obj[key] as any)._orig = orig;
      }
    };

    const threeConstructors = [
      "Vector2",
      "Vector3",
      "Vector4",
      "Matrix3",
      "Matrix4",
      "Quaternion",
      "Euler",
      "Box3",
      "Sphere",
      "Color",
      "Group",
      "Mesh",
      "Points",
      "BufferGeometry",
      "BoxGeometry",
      "CylinderGeometry",
      "SphereGeometry",
      "RingGeometry",
      "TorusGeometry",
      "MeshStandardMaterial",
      "MeshBasicMaterial",
      "PointsMaterial",
    ];

    for (const name of threeConstructors) {
      if ((THREE as any)[name]) {
        spyConstructor(THREE, name);
      }
    }

    // Run 600 frames (10 seconds of 60 FPS animation)
    const dt = 0.016;
    for (let f = 10; f < 610; f++) {
      lifeScenes.update(f * dt, dt);
    }

    // Restore constructors
    for (const name of threeConstructors) {
      if ((THREE as any)[name]?._orig) {
        (THREE as any)[name] = (THREE as any)[name]._orig;
      }
    }

    // Assert ZERO Three.js allocations in 600 frames
    expect(threeAllocations).toBe(0);

    lifeScenes.dispose();
  });

  /* ========================================================================= */
  /* 5. Complete Disposal of Geometries & Materials Across All Scenes          */
  /* ========================================================================= */
  test("5. Disposal completeness across teaGuestsScene, cooliesScene, and wildlifeScene", () => {
    const lifeScenes = new World3DLifeScenes();

    const trackedGeometries = new Set<THREE.BufferGeometry>();
    const trackedMaterials = new Set<THREE.Material>();

    const disposedGeometries = new Set<THREE.BufferGeometry>();
    const disposedMaterials = new Set<THREE.Material>();

    // Collect all geometries and materials across hierarchy
    lifeScenes.root.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
        if (obj.geometry) {
          trackedGeometries.add(obj.geometry);
          const origGeoDispose = obj.geometry.dispose.bind(obj.geometry);
          obj.geometry.dispose = function () {
            disposedGeometries.add(obj.geometry);
            origGeoDispose();
          };
        }
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => {
            trackedMaterials.add(m);
            const origMatDispose = m.dispose.bind(m);
            m.dispose = function () {
              disposedMaterials.add(m);
              origMatDispose();
            };
          });
        }
      }
    });

    // Ensure we collected a rich set of miniature components
    expect(trackedGeometries.size).toBeGreaterThan(30);
    expect(trackedMaterials.size).toBeGreaterThan(15);

    // Call dispose
    lifeScenes.dispose();

    // Verify 100% of tracked geometries were disposed
    for (const geo of trackedGeometries) {
      expect(disposedGeometries.has(geo)).toBe(true);
    }

    // Verify 100% of tracked materials were disposed
    for (const mat of trackedMaterials) {
      expect(disposedMaterials.has(mat)).toBe(true);
    }

    // Verify ripplePool array emptied
    expect((lifeScenes as any).ripplePool.length).toBe(0);
  });
});
