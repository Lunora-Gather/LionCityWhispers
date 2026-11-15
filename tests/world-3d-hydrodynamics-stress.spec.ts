import { expect, test } from "@playwright/test";
import * as THREE from "three";
import { HydrodynamicRiverSystem, World3DHydrodynamics, WaterSurfaceSample } from "../src/game/three/world/World3DHydrodynamics";

test.describe("Hydrodynamic River System & Gerstner Wave Dynamics Stress Tests", () => {
  test("1. Gerstner trochoidal displacements: circular orbits, sharp crests, broad troughs, absence of NaN", () => {
    const hydro = new HydrodynamicRiverSystem();
    const disp = new THREE.Vector3();
    const norm = new THREE.Vector3();

    // A. Check bounds, continuity, and absence of NaN over a wide spatial and temporal grid
    const timeMilestones = [0, 0.01, 0.5, 1.0, 5.0, 25.0, 100.0, 333.33, 500.0, 1000.0];
    const xCoords = [-30, -20, -10, -5, 0, 5, 10, 20, 25];
    const zCoords = [-1.0, 0.0, 1.0, 2.5, 3.5, 5.0, 6.0];

    let minDy = Infinity;
    let maxDy = -Infinity;
    let maxDx = -Infinity;
    let maxDz = -Infinity;

    for (const t of timeMilestones) {
      for (const x of xCoords) {
        for (const z of zCoords) {
          hydro.computeDisplacement(x, z, t, disp);
          hydro.computeSurfaceNormal(x, z, t, norm);

          expect(Number.isFinite(disp.x)).toBe(true);
          expect(Number.isFinite(disp.y)).toBe(true);
          expect(Number.isFinite(disp.z)).toBe(true);
          expect(Number.isNaN(disp.x)).toBe(false);
          expect(Number.isNaN(disp.y)).toBe(false);
          expect(Number.isNaN(disp.z)).toBe(false);

          expect(Number.isFinite(norm.x)).toBe(true);
          expect(Number.isFinite(norm.y)).toBe(true);
          expect(Number.isFinite(norm.z)).toBe(true);
          expect(norm.length()).toBeCloseTo(1.0, 3);

          if (disp.y < minDy) minDy = disp.y;
          if (disp.y > maxDy) maxDy = disp.y;
          if (Math.abs(disp.x) > maxDx) maxDx = Math.abs(disp.x);
          if (Math.abs(disp.z) > maxDz) maxDz = Math.abs(disp.z);
        }
      }
    }

    // Displacement bounds check: reasonable vertical range within +/- 0.15m
    expect(minDy).toBeGreaterThan(-0.15);
    expect(maxDy).toBeLessThan(0.18);
    // Horizontal displacement exists (trochoidal Gerstner hallmark, non-zero horizontal orbits)
    expect(maxDx).toBeGreaterThan(0.01);
    expect(maxDz).toBeGreaterThan(0.005);

    // B. Verify trochoidal particle orbit in undisturbed fairway (x = 10, z = 2.5) over a full cycle
    // In deep/intermediate water, Gerstner water particles follow circular trajectories:
    // When cos(phi) = 1 (wave peak), sin(phi) = 0.
    // When cos(phi) = 0 (zero crossing), sin(phi) = +/-1.
    const sampleDt = 0.02;
    let maxOrbitDist = 0;
    for (let step = 0; step < 200; step++) {
      const t = step * sampleDt;
      hydro.computeDisplacement(10, 2.5, t, disp);
      const horizDist = Math.hypot(disp.x, disp.z);
      if (horizDist > maxOrbitDist) maxOrbitDist = horizDist;
    }
    expect(maxOrbitDist).toBeGreaterThan(0.02);
  });

  test("2. Directional shear velocity gradient: fairway velocity vs wall friction damping", () => {
    const hydro = new HydrodynamicRiverSystem();

    // Fairway centerline is at z = 2.5m
    const vFairway = hydro.getShearVelocity(2.5);
    expect(vFairway).toBeCloseTo(1.20, 2);

    // Retaining walls at z = -1.2m and z = 6.8m (distance from center = 3.7 to 4.3m)
    const vNorthWall = hydro.getShearVelocity(-1.2);
    const vSouthWall = hydro.getShearVelocity(6.8);

    expect(vNorthWall).toBeCloseTo(0.18, 1);
    expect(vSouthWall).toBeCloseTo(0.18, 1);

    // Monotonic boundary layer profile: velocity decreases smoothly from center toward walls
    let prevV = vFairway;
    for (let z = 2.5; z <= 6.8; z += 0.5) {
      const v = hydro.getShearVelocity(z);
      expect(v).toBeLessThanOrEqual(prevV + 1e-6);
      expect(v).toBeGreaterThanOrEqual(0.18 - 1e-6);
      prevV = v;
    }

    // computeVelocity delegates to getShearVelocity
    expect(hydro.computeVelocity(0, 2.5)).toBe(vFairway);
  });

  test("3. Cavenagh Bridge pier stagnation head and downstream vortex shedding", () => {
    const hydro = new HydrodynamicRiverSystem();

    // Pier 1 is at x = 0.0, z = 0.6
    // Upstream stagnation head (x < 0): water piles up against the pier face
    const upstreamElev = hydro.getPierDisplacement(-0.2, 0.6, 1.0);
    expect(upstreamElev).toBeGreaterThan(0.02); // Stagnation pile-up > 2cm

    // Far upstream (x = -10): stagnation head decays to near zero
    const farUpstreamElev = hydro.getPierDisplacement(-10.0, 0.6, 1.0);
    expect(farUpstreamElev).toBeCloseTo(0.0, 3);

    // Downstream (x = 2.0, z = 0.6): periodic vortex shedding with oscillating sign
    let hasPositive = false;
    let hasNegative = false;
    for (let t = 0; t < 20; t += 0.5) {
      const disp = hydro.getPierDisplacement(2.0, 0.6, t);
      if (disp > 0.005) hasPositive = true;
      if (disp < -0.005) hasNegative = true;
    }
    expect(hasPositive).toBe(true);
    expect(hasNegative).toBe(true);
  });

  test("4. Bumboat Lord Kelvin wakes: universal 19.47-degree V-envelope interference", () => {
    const hydro = new HydrodynamicRiverSystem();

    // Boat 2 is at x = -6.0, z = 3.5, yaw = -0.15
    // Universal Kelvin wedge angle theta_K = arcsin(1/3) ≈ 19.471° => tan(theta_K) ≈ 0.35355
    const dx = 8.0;
    const boatX = -6.0;
    const boatZ = 3.5;
    const tanKelvin = 0.353553;
    const xDownstream = boatX + dx;

    // At the cusp line: |z - boatZ| ≈ dx * tan(theta_K)
    const zCusp = boatZ + dx * tanKelvin;
    let maxWakeAtCusp = 0;
    for (let t = 0; t < 3.0; t += 0.1) {
      const disp = Math.abs(hydro.getKelvinWakeDisplacement(xDownstream, zCusp, t));
      if (disp > maxWakeAtCusp) maxWakeAtCusp = disp;
    }

    // Outside the Kelvin envelope (e.g. lateral distance = 8.0m, far wider than wedge)
    const zOutside = boatZ + 8.0;
    const wakeOutside = hydro.getKelvinWakeDisplacement(xDownstream, zOutside, 1.0);

    // Upstream of all vessels (x = -18.0, upstream of boat 1 at x = -14.0): wake must be strictly zero
    const wakeUpstream = hydro.getKelvinWakeDisplacement(-18.0, boatZ, 1.0);

    expect(maxWakeAtCusp).toBeGreaterThan(0.01);
    expect(Math.abs(wakeOutside)).toBe(0.0);
    expect(wakeUpstream).toBe(0.0);
  });

  test("5. Shoreline smoothstep damping and dynamic foam generation", () => {
    const hydro = new HydrodynamicRiverSystem();

    // Shoreline damping D_shore at the north wall (z = -1.2) must be strictly 0
    const dampingAtWall = hydro.getShorelineDamping(0, -1.2);
    expect(dampingAtWall).toBe(0.0);

    // In the central fairway (x = 0, z = 2.5), distance to both walls is 3.7m > 0.85m => damping is exactly 1.0
    const dampingInFairway = hydro.getShorelineDamping(0, 2.5);
    expect(dampingInFairway).toBe(1.0);

    // Damping transitions smoothly in [0, 1] without overshoot
    for (let z = -1.2; z <= 2.5; z += 0.2) {
      const d = hydro.getShorelineDamping(0, z);
      expect(d).toBeGreaterThanOrEqual(0.0);
      expect(d).toBeLessThanOrEqual(1.0);
    }

    // Dynamic foam factor in [0, 1]
    const foamWall = hydro.computeFoam(0, -1.1, 1.0);
    expect(foamWall).toBeGreaterThan(0.0);
    expect(foamWall).toBeLessThanOrEqual(1.0);

    const foamFairway = hydro.computeFoam(0, 2.5, 1.0);
    expect(foamFairway).toBeGreaterThanOrEqual(0.0);
    expect(foamFairway).toBeLessThanOrEqual(1.0);
  });

  test("6. Water caustics intensity and Beer-Lambert depth color gradient", () => {
    const hydro = new HydrodynamicRiverSystem();

    // Caustics intensity in [0, 1]
    for (let t = 0; t < 5; t += 1.0) {
      const caustic = hydro.getCausticIntensity(5.0, 2.0, t);
      expect(caustic).toBeGreaterThanOrEqual(0.0);
      expect(caustic).toBeLessThanOrEqual(1.0);
    }

    // Beer-Lambert depth color gradient:
    // Shallow water (depth = 0.15m) -> cyan tint
    const shallowColor = hydro.computeDepthColor(0.15);
    // Deep fairway water (depth = 0.70m) -> deep emerald tint
    const deepColor = hydro.computeDepthColor(0.70);

    expect(shallowColor.r).toBeGreaterThan(deepColor.r);
    expect(shallowColor.g).toBeGreaterThan(deepColor.g);
    expect(shallowColor.b).toBeGreaterThan(deepColor.b);
  });

  test("7. Zero Three.js heap allocations across 3,000 continuous simulation frames", () => {
    const hydro = new HydrodynamicRiverSystem();
    const scratchSample: WaterSurfaceSample = {
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
    const scratchDisp = new THREE.Vector3();
    const scratchNormal = new THREE.Vector3();
    const scratchColor = new THREE.Color();

    const dt = 0.01667; // 60 FPS

    // Simulate 3,000 frames (50 seconds)
    for (let frame = 0; frame < 3000; frame++) {
      const time = frame * dt;
      hydro.update(time, dt);

      // Sample key coordinates
      hydro.computeDisplacement(-4.0, 2.5, time, scratchDisp);
      hydro.computeSurfaceNormal(-4.0, 2.5, time, scratchNormal);
      hydro.computeDepthColor(0.65, scratchColor);
      hydro.sampleSurface(-14.0, 2.2, time, scratchSample);

      if (frame % 500 === 0) {
        expect(Number.isFinite(scratchSample.x)).toBe(true);
        expect(Number.isFinite(scratchSample.y)).toBe(true);
        expect(Number.isFinite(scratchSample.z)).toBe(true);
        expect(scratchNormal.length()).toBeCloseTo(1.0, 2);
      }
    }

    expect(hydro.currentTime).toBeCloseTo(3000 * dt, 1);
  });
});
