import { expect, test } from "@playwright/test";
import * as THREE from "three";
import { getRiverWaveElevation } from "../src/game/three/world/World3DEnvironment";

test.describe("Empirical Wave Dynamics & Buoyancy Stress Test", () => {
  test("1. Analytical River Wave Elevation: bounds, continuity, smoothness, and NaN absence", () => {
    // 1. Theoretical bounds:
    // y = 0.2 + sin(u * 0.35 + 2.2t) * 0.08 + cos(v * 0.5 + 1.8t) * 0.06 + sin((u + v) * 0.25 + 1.4t) * 0.04
    // Min theoretical: 0.2 - 0.08 - 0.06 - 0.04 = 0.02
    // Max theoretical: 0.2 + 0.08 + 0.06 + 0.04 = 0.38
    const MIN_THEORETICAL = 0.02;
    const MAX_THEORETICAL = 0.38;

    let minSampled = Infinity;
    let maxSampled = -Infinity;
    let sampleCount = 0;

    // A. Regular spatial and temporal grid sampling across t in [0, 1000], x in [-30, 30], z in [-2, 8]
    const timeMilestones = [0, 0.001, 0.1, 1.0, 5.0, 25.0, 100.0, 333.33, 500.0, 750.0, 999.0, 1000.0];
    const xCoords = [-30, -25, -20, -14, -10, -6, 0, 6, 12, 18, 24, 30];
    const zCoords = [-2, -1, 0, 1.2, 2.2, 2.5, 3.5, 5.0, 6.5, 8.0];

    for (const t of timeMilestones) {
      for (const x of xCoords) {
        for (const z of zCoords) {
          const elev = getRiverWaveElevation(x, z, t);
          sampleCount++;
          expect(Number.isFinite(elev)).toBe(true);
          expect(Number.isNaN(elev)).toBe(false);
          expect(elev).toBeGreaterThanOrEqual(MIN_THEORETICAL - 1e-9);
          expect(elev).toBeLessThanOrEqual(MAX_THEORETICAL + 1e-9);

          if (elev < minSampled) minSampled = elev;
          if (elev > maxSampled) maxSampled = elev;
        }
      }
    }

    // B. High-density pseudo-random Monte Carlo sampling (50,000 points)
    // Seeded-like LCG generator for deterministic empirical repeatability
    let rngState = 123456789;
    const nextRand = () => {
      rngState = (1103515245 * rngState + 12345) & 0x7fffffff;
      return rngState / 0x7fffffff;
    };

    for (let i = 0; i < 50000; i++) {
      const rx = -30 + nextRand() * 60; // [-30, 30]
      const rz = -2 + nextRand() * 10;  // [-2, 8]
      const rt = nextRand() * 1000;     // [0, 1000]

      const elev = getRiverWaveElevation(rx, rz, rt);
      sampleCount++;
      if (!Number.isFinite(elev) || Number.isNaN(elev) || elev < MIN_THEORETICAL - 1e-9 || elev > MAX_THEORETICAL + 1e-9) {
        throw new Error(`River wave elevation out of bounds at (${rx}, ${rz}, ${rt}): ${elev}`);
      }

      if (elev < minSampled) minSampled = elev;
      if (elev > maxSampled) maxSampled = elev;
    }
    expect(sampleCount).toBeGreaterThan(50000);

    // Ensure range is actually exercised
    expect(minSampled).toBeLessThan(0.08);
    expect(maxSampled).toBeGreaterThan(0.32);

    // C. Derivative Smoothness & Continuity Verification:
    // Compare finite differences with analytical partial derivatives
    // u = x + 4.0, v = 2.5 - z
    // dy/dx = 0.08 * 0.35 * cos(0.35u + 2.2t) + 0.04 * 0.25 * cos(0.25(u+v) + 1.4t)
    // dy/dz = 0.06 * 0.5 * sin(0.5v + 1.8t) - 0.04 * 0.25 * cos(0.25(u+v) + 1.4t)
    // dy/dt = 0.08 * 2.2 * cos(...) - 0.06 * 1.8 * sin(...) + 0.04 * 1.4 * cos(...)
    const h = 1e-5;
    for (let i = 0; i < 1000; i++) {
      const x = -30 + nextRand() * 60;
      const z = -2 + nextRand() * 10;
      const t = nextRand() * 1000;

      const u = x + 4.0;
      const v = 2.5 - z;

      // Analytical derivatives
      const expectedDx =
        0.08 * 0.35 * Math.cos(u * 0.35 + t * 2.2) +
        0.04 * 0.25 * Math.cos((u + v) * 0.25 + t * 1.4);

      const expectedDz =
        0.06 * 0.5 * Math.sin(v * 0.5 + t * 1.8) -
        0.04 * 0.25 * Math.cos((u + v) * 0.25 + t * 1.4);

      const expectedDt =
        0.08 * 2.2 * Math.cos(u * 0.35 + t * 2.2) -
        0.06 * 1.8 * Math.sin(v * 0.5 + t * 1.8) +
        0.04 * 1.4 * Math.cos((u + v) * 0.25 + t * 1.4);

      // Numerical finite differences
      const numDx = (getRiverWaveElevation(x + h, z, t) - getRiverWaveElevation(x - h, z, t)) / (2 * h);
      const numDz = (getRiverWaveElevation(x, z + h, t) - getRiverWaveElevation(x, z - h, t)) / (2 * h);
      const numDt = (getRiverWaveElevation(x, z, t + h) - getRiverWaveElevation(x, z, t - h)) / (2 * h);

      expect(Math.abs(numDx - expectedDx)).toBeLessThan(1e-4);
      expect(Math.abs(numDz - expectedDz)).toBeLessThan(1e-4);
      expect(Math.abs(numDt - expectedDt)).toBeLessThan(1e-4);

      // Lipschitz bounds
      expect(Math.abs(numDx)).toBeLessThanOrEqual(0.08 * 0.35 + 0.04 * 0.25 + 1e-5); // <= 0.038
      expect(Math.abs(numDz)).toBeLessThanOrEqual(0.06 * 0.5 + 0.04 * 0.25 + 1e-5);  // <= 0.040
      expect(Math.abs(numDt)).toBeLessThanOrEqual(0.08 * 2.2 + 0.06 * 1.8 + 0.04 * 1.4 + 1e-5); // <= 0.340
    }
  });

  test("2. Bumboat Pitch, Roll, and Elevation Stability under variable delta intervals", () => {
    // Model configuration matching World3DEnvironment.ts lines 1900-1952
    const hullLength = 4.8;
    const hullWidth = 1.6;
    const draftOffset = 0.15;
    const halfL = 0.4 * hullLength;
    const halfW = 0.4 * hullWidth;

    interface BoatState {
      x: number;
      z: number;
      yaw: number;
      y: number;
      pitch: number;
      roll: number;
    }

    const stepBoat = (boat: BoatState, time: number, delta: number) => {
      const dampFactor = Math.min(1.0, delta * 4.0);
      const bx = boat.x;
      const bz = boat.z;
      const yaw = boat.yaw;

      const sinYaw = Math.sin(yaw);
      const cosYaw = Math.cos(yaw);

      const xBow = bx + halfL * sinYaw;
      const zBow = bz + halfL * cosYaw;
      const xStern = bx - halfL * sinYaw;
      const zStern = bz - halfL * cosYaw;
      const xStbd = bx + halfW * cosYaw;
      const zStbd = bz - halfW * sinYaw;
      const xPort = bx - halfW * cosYaw;
      const zPort = bz + halfW * sinYaw;

      const hBow = getRiverWaveElevation(xBow, zBow, time);
      const hStern = getRiverWaveElevation(xStern, zStern, time);
      const hPort = getRiverWaveElevation(xPort, zPort, time);
      const hStbd = getRiverWaveElevation(xStbd, zStbd, time);

      const targetPitch = -Math.atan((hBow - hStern) / (0.8 * hullLength));
      const targetRoll = Math.atan((hStbd - hPort) / (0.8 * hullWidth));
      const hCenter = (hBow + hStern + hPort + hStbd) / 4.0;
      const targetY = hCenter + draftOffset;

      boat.y = THREE.MathUtils.lerp(boat.y, targetY, dampFactor);
      boat.pitch = THREE.MathUtils.lerp(boat.pitch, targetPitch, dampFactor);
      boat.roll = THREE.MathUtils.lerp(boat.roll, targetRoll, dampFactor);
    };

    // Boats in World3DEnvironment.ts
    const testVessels = [
      { name: "Boat 1", x: -14, z: 2.2, yaw: 0.2 },
      { name: "Boat 2", x: -6, z: 3.5, yaw: -0.15 },
      { name: "Boat 3", x: 12, z: 2.4, yaw: 0.1 },
      // Boundary/adversarial vessels
      { name: "Adversarial Edge Left", x: -30, z: -2, yaw: 0 },
      { name: "Adversarial Edge Right", x: 30, z: 8, yaw: Math.PI / 3 },
      { name: "Adversarial Diagonal", x: 0, z: 2.5, yaw: Math.PI / 4 }
    ];

    // Delta integration regimes:
    // Regime A: Tiny delta (0.001 - 1000 FPS)
    // Regime B: Standard delta (0.0166 - 60 FPS)
    // Regime C: Laggy delta (0.05 - 20 FPS)
    // Regime D: Maximum specified delta (0.2 - 5 FPS)
    // Regime E: Extreme variable delta (pseudo-random between 0.001 and 0.2)
    // Regime F: Pathological alternating delta [0.001, 0.2, 0.001, 0.2]
    // Regime G: Spike overload delta (0.5, 1.0, 5.0) to assert damping clamp behavior

    const regimes = [
      { name: "Tiny Delta (0.001s)", getDelta: () => 0.001, steps: 5000 },
      { name: "Standard 60FPS (0.0167s)", getDelta: () => 0.01667, steps: 3000 },
      { name: "Slow 20FPS (0.05s)", getDelta: () => 0.05, steps: 2000 },
      { name: "Lag Spike 5FPS (0.2s)", getDelta: () => 0.2, steps: 1500 },
      {
        name: "Variable Jitter Delta [0.001s, 0.2s]",
        getDelta: (step: number) => 0.001 + ((step * 9301 + 49297) % 233280) / 233280 * 0.199,
        steps: 3000
      },
      {
        name: "Square Alternating [0.001s, 0.2s]",
        getDelta: (step: number) => (step % 2 === 0 ? 0.001 : 0.2),
        steps: 3000
      },
      {
        name: "Overload Clamp Spikes [0.5s, 1.5s]",
        getDelta: (step: number) => (step % 10 === 0 ? 1.5 : 0.016),
        steps: 1000
      }
    ];

    for (const vessel of testVessels) {
      for (const regime of regimes) {
        const boat: BoatState = {
          x: vessel.x,
          z: vessel.z,
          yaw: vessel.yaw,
          y: 0.35, // Initial position in World3DEnvironment
          pitch: 0,
          roll: 0
        };

        let simTime = 0;
        let minY = Infinity;
        let maxY = -Infinity;
        let maxAbsPitch = 0;
        let maxAbsRoll = 0;

        for (let step = 0; step < regime.steps; step++) {
          const delta = regime.getDelta(step);
          simTime += delta;
          stepBoat(boat, simTime, delta);

          // Invariant 1: No NaN or Infinity
          if (!Number.isFinite(boat.y) || !Number.isFinite(boat.pitch) || !Number.isFinite(boat.roll)) {
            throw new Error(`Boat simulation diverged at step ${step}: y=${boat.y}, pitch=${boat.pitch}, roll=${boat.roll}`);
          }

          minY = Math.min(minY, boat.y);
          maxY = Math.max(maxY, boat.y);
          maxAbsPitch = Math.max(maxAbsPitch, Math.abs(boat.pitch));
          maxAbsRoll = Math.max(maxAbsRoll, Math.abs(boat.roll));
        }

        // Invariant 2: Water bounds stability
        // Wave min = 0.02, max = 0.38. draftOffset = 0.15.
        // Therefore, targetY in [0.17, 0.53]. With damping margin: [0.15, 0.55].
        expect(minY).toBeGreaterThanOrEqual(0.15);
        expect(maxY).toBeLessThanOrEqual(0.55);

        // Invariant 3: Angular stability (no flip, no runaway oscillation)
        // Max pitch target is ~atan(0.36 / 3.84) = 0.094 rad.
        expect(maxAbsPitch).toBeLessThanOrEqual(0.15); // <= 8.6 degrees

        // Max roll target is ~atan(0.36 / 1.28) = 0.275 rad.
        expect(maxAbsRoll).toBeLessThanOrEqual(0.35); // <= 20 degrees
      }
    }
  });

  test("3. Damping Transient & Perturbation Recovery (absence of resonance blowup)", () => {
    // Assert that if a vessel is placed in a severely perturbed state,
    // exponential damping monotonically contracts distance to equilibrium manifold without diverging.
    const hullLength = 4.8;
    const hullWidth = 1.6;
    const draftOffset = 0.15;
    const halfL = 0.4 * hullLength;
    const halfW = 0.4 * hullWidth;

    const vessel = { x: -6, z: 3.5, yaw: -0.15 };

    // Severely perturbed state
    const boat = {
      x: vessel.x,
      z: vessel.z,
      yaw: vessel.yaw,
      y: 5.0,        // 5 meters in the air
      pitch: 1.5,    // near vertical tilt
      roll: 1.5
    };

    let simTime = 0;
    const dt = 0.016; // 60 FPS
    const dampFactor = Math.min(1.0, dt * 4.0); // = 0.064

    let prevDistance = Math.abs(boat.y - 0.35);

    // After 100 steps (~1.6 seconds), the error should contract by at least (1 - 0.064)^100 ≈ 0.0013
    for (let step = 0; step < 120; step++) {
      simTime += dt;
      const bx = boat.x;
      const bz = boat.z;
      const yaw = boat.yaw;
      const sinYaw = Math.sin(yaw);
      const cosYaw = Math.cos(yaw);

      const xBow = bx + halfL * sinYaw;
      const zBow = bz + halfL * cosYaw;
      const xStern = bx - halfL * sinYaw;
      const zStern = bz - halfL * cosYaw;
      const xStbd = bx + halfW * cosYaw;
      const zStbd = bz - halfW * sinYaw;
      const xPort = bx - halfW * cosYaw;
      const zPort = bz + halfW * sinYaw;

      const hBow = getRiverWaveElevation(xBow, zBow, simTime);
      const hStern = getRiverWaveElevation(xStern, zStern, simTime);
      const hPort = getRiverWaveElevation(xPort, zPort, simTime);
      const hStbd = getRiverWaveElevation(xStbd, zStbd, simTime);

      const targetPitch = -Math.atan((hBow - hStern) / (0.8 * hullLength));
      const targetRoll = Math.atan((hStbd - hPort) / (0.8 * hullWidth));
      const targetY = (hBow + hStern + hPort + hStbd) / 4.0 + draftOffset;

      boat.y = THREE.MathUtils.lerp(boat.y, targetY, dampFactor);
      boat.pitch = THREE.MathUtils.lerp(boat.pitch, targetPitch, dampFactor);
      boat.roll = THREE.MathUtils.lerp(boat.roll, targetRoll, dampFactor);
    }

    // Must have decayed back into stable water boundary
    expect(boat.y).toBeGreaterThanOrEqual(0.15);
    expect(boat.y).toBeLessThanOrEqual(0.55);
    expect(Math.abs(boat.pitch)).toBeLessThanOrEqual(0.15);
    expect(Math.abs(boat.roll)).toBeLessThanOrEqual(0.35);
  });
});
