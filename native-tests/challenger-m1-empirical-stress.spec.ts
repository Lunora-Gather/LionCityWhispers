import { expect, test } from "./safari";
import * as THREE from "three";
import { HydrodynamicRiverSystem, WaterSurfaceSample } from "../src/game/three/world/World3DHydrodynamics";

test.describe("Empirical Challenger M1: Mathematical Correctness & Stability Suite", () => {
  test("1. Extreme spatio-temporal coordinates numerical stability (x in [-100, 100], z in [-50, 50], t = 100,000s)", () => {
    const hydro = new HydrodynamicRiverSystem();
    const disp = new THREE.Vector3();
    const norm = new THREE.Vector3();
    const sample: WaterSurfaceSample = {
      x: 0,
      y: 0,
      z: 0,
      normalX: 0,
      normalY: 1,
      normalZ: 0,
      foam: 0,
      currentVx: 0,
      depth: 0.65
    };

    const xRange = [-100, -75, -50, -35.0, -20, -5, 0, 5, 20, 27.0, 50, 75, 100];
    const zRange = [-50, -25, -10, -1.2, 0, 2.5, 4.4, 6.8, 10, 25, 50];
    const tRange = [0, 0.001, 1.0, 60.0, 3600.0, 86400.0, 100000.0];

    for (const t of tRange) {
      for (const x of xRange) {
        for (const z of zRange) {
          hydro.computeDisplacement(x, z, t, disp);
          hydro.computeSurfaceNormal(x, z, t, norm);
          hydro.sampleSurface(x, z, t, sample);
          const foam = hydro.computeFoam(x, z, t);
          const vel = hydro.computeVelocity(x, z);
          const caustics = hydro.getCausticIntensity(x, z, t);

          expect(Number.isFinite(disp.x)).toBe(true);
          expect(Number.isFinite(disp.y)).toBe(true);
          expect(Number.isFinite(disp.z)).toBe(true);
          expect(Number.isNaN(disp.x)).toBe(false);
          expect(Number.isNaN(disp.y)).toBe(false);
          expect(Number.isNaN(disp.z)).toBe(false);

          expect(Number.isFinite(norm.x)).toBe(true);
          expect(Number.isFinite(norm.y)).toBe(true);
          expect(Number.isFinite(norm.z)).toBe(true);

          expect(Number.isFinite(sample.x)).toBe(true);
          expect(Number.isFinite(sample.y)).toBe(true);
          expect(Number.isFinite(sample.z)).toBe(true);
          expect(Number.isFinite(sample.depth)).toBe(true);

          expect(foam).toBeGreaterThanOrEqual(0.0);
          expect(foam).toBeLessThanOrEqual(1.0);
          expect(caustics).toBeGreaterThanOrEqual(0.0);
          expect(caustics).toBeLessThanOrEqual(1.0);
          expect(vel).toBeGreaterThanOrEqual(0.18 - 1e-6);
          expect(vel).toBeLessThanOrEqual(1.20 + 1e-6);
        }
      }
    }
  });

  test("2. Analytical normal vector unit length across space and time", () => {
    const hydro = new HydrodynamicRiverSystem();
    const norm = new THREE.Vector3();

    const xCoords = [-35, -20, -10, 0, 10, 20, 27];
    const zCoords = [-1.2, 0.0, 2.5, 4.4, 6.8];
    const times = [0, 0.5, 10.0, 100.0, 5000.0, 100000.0];

    for (const t of times) {
      for (const x of xCoords) {
        for (const z of zCoords) {
          hydro.computeSurfaceNormal(x, z, t, norm);
          const len = norm.length();
          expect(len).toBeCloseTo(1.0, 3);
        }
      }
    }
  });

  test("3. Wave steepness and Jacobian determinant J preventing wave self-intersection and normal inversion", () => {
    const hydro = new HydrodynamicRiverSystem();
    const norm = new THREE.Vector3();

    // Adversarial sweep across active river fairway to verify non-inversion (Ny > 0)
    let minNy = Infinity;
    const xSteps = 40;
    const zSteps = 20;
    const tSteps = 20;

    for (let ix = 0; ix <= xSteps; ix++) {
      const x = -35.0 + (ix / xSteps) * (27.0 - (-35.0));
      for (let iz = 0; iz <= zSteps; iz++) {
        const z = -1.2 + (iz / zSteps) * (6.8 - (-1.2));
        for (let it = 0; it <= tSteps; it++) {
          const t = (it / tSteps) * 60.0;
          hydro.computeSurfaceNormal(x, z, t, norm);
          if (norm.y < minNy) {
            minNy = norm.y;
          }
        }
      }
    }

    // Normal vector must remain upward-oriented (Ny > 0) to avoid wave self-intersection and inverted lighting
    expect(minNy).toBeGreaterThan(0.0);
  });

  test("4. High-density Monte Carlo non-inversion check across 10,000 random samples", () => {
    const hydro = new HydrodynamicRiverSystem();
    const norm = new THREE.Vector3();

    let minNy = Infinity;
    let inversions = 0;

    for (let i = 0; i < 10000; i++) {
      const x = -35.0 + Math.random() * (27.0 - (-35.0));
      const z = -1.2 + Math.random() * (6.8 - (-1.2));
      const t = Math.random() * 10000.0;

      hydro.computeSurfaceNormal(x, z, t, norm);
      if (norm.y <= 0.0) {
        inversions++;
      }
      if (norm.y < minNy) {
        minNy = norm.y;
      }
    }

    expect(inversions).toBe(0);
    expect(minNy).toBeGreaterThan(0.0);
  });

  test("5. Analytical normal vs numerical finite difference gradient in undisturbed fairway", () => {
    const hydro = new HydrodynamicRiverSystem();
    const analyticalNormal = new THREE.Vector3();
    const pCenter = new THREE.Vector3();
    const pRight = new THREE.Vector3();
    const pLeft = new THREE.Vector3();
    const pUp = new THREE.Vector3();
    const pDown = new THREE.Vector3();
    const tx = new THREE.Vector3();
    const tz = new THREE.Vector3();
    const numericalNormal = new THREE.Vector3();

    const eps = 1e-4;
    // Test points in undisturbed fairway (x in [8, 20] away from piers and boat wake sources)
    const testPoints = [
      { x: 10.0, z: 2.5, t: 1.5 },
      { x: 18.0, z: 2.5, t: 10.2 },
      { x: 22.0, z: 3.0, t: 45.7 }
    ];

    for (const pt of testPoints) {
      hydro.computeSurfaceNormal(pt.x, pt.z, pt.t, analyticalNormal);

      hydro.computeDisplacement(pt.x + eps, pt.z, pt.t, pRight);
      hydro.computeDisplacement(pt.x - eps, pt.z, pt.t, pLeft);
      hydro.computeDisplacement(pt.x, pt.z + eps, pt.t, pUp);
      hydro.computeDisplacement(pt.x, pt.z - eps, pt.t, pDown);

      tx.set(
        ((pt.x + eps + pRight.x) - (pt.x - eps + pLeft.x)) / (2 * eps),
        (pRight.y - pLeft.y) / (2 * eps),
        (pRight.z - pLeft.z) / (2 * eps)
      );

      tz.set(
        (pUp.x - pDown.x) / (2 * eps),
        (pUp.y - pDown.y) / (2 * eps),
        ((pt.z + eps + pUp.z) - (pt.z - eps + pDown.z)) / (2 * eps)
      );

      numericalNormal.crossVectors(tz, tx).normalize();
      const dot = analyticalNormal.dot(numericalNormal);
      expect(dot).toBeGreaterThan(0.99);
    }
  });
});
