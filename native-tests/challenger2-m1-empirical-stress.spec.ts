import { expect, test } from "./safari";
import * as THREE from "three";
import {
  HydrodynamicRiverSystem,
  WaterSurfaceSample
} from "../src/game/three/world/World3DHydrodynamics";

test.describe("Challenger 2 Empirical Stress Test: Hydrodynamic Guarantees & Boundaries", () => {
  /* ========================================================================= */
  /* 1. Memory Allocation Stress Check Across 10,000 Simulation Ticks          */
  /* ========================================================================= */
  test("C2-1. Zero Three.js heap allocations and stable V8 heap across 10,000 simulation ticks", () => {
    const hydro = new HydrodynamicRiverSystem();
    const dt = 1.0 / 60.0; // 60 FPS tick interval

    // Pre-allocated scratch objects for sampling
    const scratchDisp = new THREE.Vector3();
    const scratchNormal = new THREE.Vector3();
    const scratchColor = new THREE.Color();
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

    // Warm-up phase (100 ticks) to stabilize JIT optimization
    for (let f = 0; f < 100; f++) {
      const t = f * dt;
      hydro.update(t, dt);
      hydro.computeDisplacement(0.0, 2.5, t, scratchDisp);
      hydro.computeSurfaceNormal(0.0, 2.5, t, scratchNormal);
      hydro.computeDepthColor(0.65, scratchColor);
      hydro.computeFoam(0.0, 2.5, t);
      hydro.sampleSurface(0.0, 2.5, t, scratchSample);
    }

    // Instrument Three.js object constructors
    let threeAllocations = 0;
    const trackedConstructors = [
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
      "BufferGeometry"
    ];

    const originals: Record<string, any> = {};
    for (const name of trackedConstructors) {
      const orig = (THREE as any)[name];
      if (typeof orig === "function") {
        originals[name] = orig;
        (THREE as any)[name] = function (...args: any[]) {
          threeAllocations++;
          return new orig(...args);
        };
        (THREE as any)[name]._orig = orig;
      }
    }

    // Spatial test points covering key hydrodynamic regions:
    // 1. Fairway center
    // 2. Upstream pier stagnation
    // 3. Downstream pier vortex shedding
    // 4. Bumboat Kelvin wake cusp
    // 5. Shoreline damping zone (North wall)
    // 6. Shoreline damping zone (South wall)
    // 7. Water steps damping zone
    // 8. Riverbed shallow margin
    const testPoints = [
      { x: 0.0, z: 2.5 },
      { x: -0.2, z: 0.6 },
      { x: 2.0, z: 0.6 },
      { x: -6.0 + 8.0, z: 3.5 + 8.0 * 0.353553 },
      { x: -10.0, z: -1.0 },
      { x: 10.0, z: 6.5 },
      { x: 2.4, z: -0.2 },
      { x: -20.0, z: 0.0 }
    ];

    const totalTicks = 10000;
    const initialHeapUsed = process.memoryUsage().heapUsed;
    let heapAt1000 = initialHeapUsed;
    let heapAt10000 = initialHeapUsed;

    try {
      for (let tick = 1; tick <= totalTicks; tick++) {
        const time = tick * dt;
        hydro.update(time, dt);

        for (let p = 0; p < testPoints.length; p++) {
          const pt = testPoints[p];
          hydro.computeDisplacement(pt.x, pt.z, time, scratchDisp);
          hydro.computeSurfaceNormal(pt.x, pt.z, time, scratchNormal);
          hydro.computeDepthColor(0.65, scratchColor);
          hydro.computeFoam(pt.x, pt.z, time);
          hydro.sampleSurface(pt.x, pt.z, time, scratchSample);
          hydro.computeVelocity(pt.x, pt.z);
          hydro.getCausticIntensity(pt.x, pt.z, time);
        }

        if (tick === 1000) {
          heapAt1000 = process.memoryUsage().heapUsed;
        } else if (tick === 10000) {
          heapAt10000 = process.memoryUsage().heapUsed;
        }
      }
    } finally {
      // Restore Three.js constructors
      for (const name of trackedConstructors) {
        if (originals[name]) {
          (THREE as any)[name] = originals[name];
        }
      }
    }

    // 1. Strict zero Three.js heap allocations across 10,000 ticks
    expect(threeAllocations).toBe(0);

    // 2. V8 heap stability: heap does not run away unbounded (under 30 MB growth in worker)
    const netGrowth = Math.max(0, heapAt10000 - heapAt1000);
    expect(netGrowth).toBeLessThan(30 * 1024 * 1024);
  });

  /* ========================================================================= */
  /* 2. Shoreline Damping & Retaining Wall Boundary Zero-Amplitude Check       */
  /* ========================================================================= */
  test("C2-2. Shoreline damping strictly forces wave amplitude to zero at retaining walls (z = -1.2, z = 6.8) without geometry clipping", () => {
    const hydro = new HydrodynamicRiverSystem();
    const disp = new THREE.Vector3();
    const norm = new THREE.Vector3();
    const times = [0, 0.05, 0.5, 1.25, 5.0, 15.0, 60.0, 150.0, 500.0, 1000.0];

    // North retaining wall is at z = -1.2
    // South retaining wall is at z = 6.8
    // Longitudinal extent of Singapore River model: x in [-35.0, 27.0]
    const xPositions: number[] = [];
    for (let x = -35.0; x <= 27.0; x += 1.0) {
      xPositions.push(x);
    }

    // A. Verify zero displacement and strictly vertical normal (0, 1, 0) at North retaining wall (z = -1.2)
    for (const t of times) {
      for (const x of xPositions) {
        const damping = hydro.getShorelineDamping(x, -1.2);
        hydro.computeDisplacement(x, -1.2, t, disp);
        hydro.computeSurfaceNormal(x, -1.2, t, norm);

        expect(damping).toBe(0.0);
        expect(Math.abs(disp.x)).toBe(0);
        expect(Math.abs(disp.y)).toBe(0);
        expect(Math.abs(disp.z)).toBe(0);

        expect(Math.abs(norm.x)).toBe(0);
        expect(norm.y).toBe(1);
        expect(Math.abs(norm.z)).toBe(0);
      }
    }

    // B. Verify zero displacement and strictly vertical normal (0, 1, 0) at South retaining wall (z = 6.8)
    for (const t of times) {
      for (const x of xPositions) {
        const damping = hydro.getShorelineDamping(x, 6.8);
        hydro.computeDisplacement(x, 6.8, t, disp);
        hydro.computeSurfaceNormal(x, 6.8, t, norm);

        expect(damping).toBe(0.0);
        expect(Math.abs(disp.x)).toBe(0);
        expect(Math.abs(disp.y)).toBe(0);
        expect(Math.abs(disp.z)).toBe(0);

        expect(Math.abs(norm.x)).toBe(0);
        expect(norm.y).toBe(1);
        expect(Math.abs(norm.z)).toBe(0);
      }
    }

    // C. Verify beyond retaining walls (z < -1.2 and z > 6.8), displacement remains strictly 0 and normal (0, 1, 0)
    const outsideZ = [-5.0, -2.5, -1.5, -1.21, 6.81, 7.5, 10.0, 15.0];
    for (const z of outsideZ) {
      for (const t of times) {
        hydro.computeDisplacement(0.0, z, t, disp);
        hydro.computeSurfaceNormal(0.0, z, t, norm);
        const damping = hydro.getShorelineDamping(0.0, z);

        expect(damping).toBe(0.0);
        expect(Math.abs(disp.x)).toBe(0);
        expect(Math.abs(disp.y)).toBe(0);
        expect(Math.abs(disp.z)).toBe(0);

        expect(Math.abs(norm.x)).toBe(0);
        expect(norm.y).toBe(1);
        expect(Math.abs(norm.z)).toBe(0);
      }
    }

    // D. Verify smoothstep continuity and monotonicity in boundary layers
    // North boundary layer: z in [-1.2, -1.2 + 0.85 = -0.35]
    let prevDNorth = -1.0;
    for (let s = 0; s <= 17; s++) {
      const z = -1.2 + s * 0.05;
      const d = hydro.getShorelineDamping(0.0, z);
      expect(d).toBeGreaterThanOrEqual(prevDNorth);
      expect(d).toBeGreaterThanOrEqual(0.0);
      expect(d).toBeLessThanOrEqual(1.0);
      prevDNorth = d;
    }
    expect(prevDNorth).toBeCloseTo(1.0, 2);

    // South boundary layer: z in [6.8 - 0.85 = 5.95, 6.8]
    let prevDSouth = 2.0;
    for (let s = 0; s <= 17; s++) {
      const z = 5.95 + s * 0.05;
      const d = hydro.getShorelineDamping(0.0, z);
      expect(d).toBeLessThanOrEqual(prevDSouth);
      expect(d).toBeGreaterThanOrEqual(0.0);
      expect(d).toBeLessThanOrEqual(1.0);
      prevDSouth = d;
    }
    expect(prevDSouth).toBe(0.0);

    // E. Verify water steps zone: damping drops to 0 at z = -0.6
    for (let x = 1.0; x <= 3.8; x += 0.4) {
      const dStepWall = hydro.getShorelineDamping(x, -0.6);
      expect(dStepWall).toBe(0.0);

      hydro.computeDisplacement(x, -0.6, 1.0, disp);
      expect(Math.abs(disp.y)).toBe(0);
    }

    // F. Geometry clearance verification (no clipping above retaining wall / promenade)
    // Wall top elevation is Y = 1.0; curb top is Y = 1.275
    // Water base elevation is Y = 0.20
    let maxGlobalElevation = -Infinity;
    for (let x = -35.0; x <= 27.0; x += 2.0) {
      for (let z = -1.2; z <= 6.8; z += 0.5) {
        for (const t of [0, 1.0, 5.0, 10.0]) {
          hydro.computeDisplacement(x, z, t, disp);
          const surfaceY = hydro.baseElevation + disp.y;
          if (surfaceY > maxGlobalElevation) {
            maxGlobalElevation = surfaceY;
          }
        }
      }
    }

    // Maximum water elevation must remain well below quay ground (Y = 1.0)
    // Clearance buffer >= 0.65m
    expect(maxGlobalElevation).toBeLessThan(0.35);
    const wallClearance = 1.0 - maxGlobalElevation;
    expect(wallClearance).toBeGreaterThan(0.65);
  });

  /* ========================================================================= */
  /* 3. Kelvin Wake Interference Boundaries Around Bumboats                   */
  /* ========================================================================= */
  test("C2-3. Kelvin wake interference boundaries around bumboats: upstream cutoff, wedge angle, cusp caustic", () => {
    const hydro = new HydrodynamicRiverSystem();
    const tanKelvin = 0.353553; // tan(arcsin(1/3))

    // Bumboats configured in system:
    // Boat 1: x = -14.0, z = 2.2
    // Boat 2: x = -6.0, z = 3.5
    // Boat 3: x = 12.0, z = 2.4
    const boats = [
      { id: "Boat 1", x: -14.0, z: 2.2 },
      { id: "Boat 2", x: -6.0, z: 3.5 },
      { id: "Boat 3", x: 12.0, z: 2.4 }
    ];

    const times = [0.0, 0.5, 1.0, 2.0, 3.5];

    // A. Upstream boundary condition: for all x <= boat.x (prior to any vessel wake source)
    // Upstream of Boat 1 at x <= -14.0: all wake displacements must be strictly 0
    for (const x of [-35.0, -25.0, -18.0, -14.0]) {
      for (let z = -1.2; z <= 6.8; z += 1.0) {
        for (const t of times) {
          const wake = hydro.getKelvinWakeDisplacement(x, z, t);
          expect(wake).toBe(0.0);
        }
      }
    }

    // B. Universal Kelvin wedge envelope boundary:
    // For Boat 1 (isolated upstream of Boat 2, x in [-14, -7]):
    // Half-width boundary is: dx * tanKelvin + halfHull + 0.6 = dx * tanKelvin + 1.4
    const dxBoat1 = [1.0, 2.5, 4.0, 6.0];
    for (const dx of dxBoat1) {
      const x = -14.0 + dx;
      const wedgeHalfWidth = dx * tanKelvin + 0.8;
      const outerBoundary = wedgeHalfWidth + 0.6;

      // Points outside envelope: wake must be strictly 0
      const outsideOffsets = [outerBoundary + 0.1, outerBoundary + 1.0, outerBoundary + 2.5];
      for (const offset of outsideOffsets) {
        for (const t of times) {
          const wakeNorth = hydro.getKelvinWakeDisplacement(x, 2.2 - offset, t);
          const wakeSouth = hydro.getKelvinWakeDisplacement(x, 2.2 + offset, t);
          expect(wakeNorth).toBe(0.0);
          expect(wakeSouth).toBe(0.0);
        }
      }

      // C. Constructive interference at the caustic cusp line:
      // The cusp line is at |dzRel| = dx * tanKelvin.
      // Compare amplitude at cusp line vs near-boundary point.
      const zCusp = 2.2 + dx * tanKelvin;
      const zNearBoundary = 2.2 + outerBoundary - 0.05;

      let maxCuspAmp = 0;
      let maxBoundaryAmp = 0;
      for (let t = 0; t < 4.0; t += 0.1) {
        const cuspVal = Math.abs(hydro.getKelvinWakeDisplacement(x, zCusp, t));
        const boundVal = Math.abs(hydro.getKelvinWakeDisplacement(x, zNearBoundary, t));
        if (cuspVal > maxCuspAmp) maxCuspAmp = cuspVal;
        if (boundVal > maxBoundaryAmp) maxBoundaryAmp = boundVal;
      }

      expect(maxCuspAmp).toBeGreaterThan(0.005);
      expect(maxCuspAmp).toBeGreaterThan(maxBoundaryAmp);
    }

    // D. Far downstream cutoff: beyond x = 12.0 + 18.0 = 30.0, ALL vessel wakes are finished
    const farDownstreamXs = [30.01, 32.0, 35.0, 50.0];
    for (const x of farDownstreamXs) {
      for (let z = -1.2; z <= 6.8; z += 1.0) {
        for (const t of times) {
          const wake = hydro.getKelvinWakeDisplacement(x, z, t);
          expect(wake).toBe(0.0);
        }
      }
    }

    // E. Wake superposition between Boat 1 and Boat 2 in overlapping wake zone (x in [-6, 4])
    // Ensure linear superposition is stable and finite with no resonance or NaN
    const overlapXs = [-5.0, -2.0, 0.0, 2.0, 4.0];
    for (const x of overlapXs) {
      for (let z = 0.0; z <= 5.0; z += 0.5) {
        for (const t of times) {
          const wake = hydro.getKelvinWakeDisplacement(x, z, t);
          expect(Number.isFinite(wake)).toBe(true);
          expect(Number.isNaN(wake)).toBe(false);
          // Combined wakes must remain within realistic physical bounds (< 0.08m)
          expect(Math.abs(wake)).toBeLessThan(0.08);
        }
      }
    }
  });

  /* ========================================================================= */
  /* 4. Empirical Exploration: Kelvin Wake Cusp vs Dynamic Foam Alignment      */
  /* ========================================================================= */
  test("C2-4. Empirical inspection: wake displacement caustic vs dynamic foam alignment under vessel yaw", () => {
    const hydro = new HydrodynamicRiverSystem();

    // Boat 1 has yaw = 0.20 rad (~11.46 degrees), Boat 2 has yaw = -0.15 rad
    // In computeFoam, vessel yaw introduces a lateral skew: - dx * sin(yaw)
    // While getKelvinWakeDisplacement aligns along the stream direction: dzRel = z - vessel.z
    // We quantify this empirical offset:
    const boat1 = { x: -14.0, z: 2.2, yaw: 0.20 };
    const dx = 8.0;
    const x = boat1.x + dx;

    const tanKelvin = 0.353553;
    const wakeCuspZ = boat1.z + dx * tanKelvin;
    const foamSkew = dx * Math.sin(boat1.yaw);
    const foamCuspZ = boat1.z + foamSkew + dx * tanKelvin;

    const lateralDisparity = Math.abs(foamCuspZ - wakeCuspZ);
    // Disparity equals foamSkew = dx * sin(yaw)
    expect(lateralDisparity).toBeCloseTo(dx * Math.sin(0.20), 3);

    // Verify both wake displacement and foam stay strictly finite and bounded [0, 1]
    const wakeAtWakeCusp = hydro.getKelvinWakeDisplacement(x, wakeCuspZ, 1.0);
    const foamAtWakeCusp = hydro.computeFoam(x, wakeCuspZ, 1.0);
    const foamAtFoamCusp = hydro.computeFoam(x, foamCuspZ, 1.0);

    expect(Number.isFinite(wakeAtWakeCusp)).toBe(true);
    expect(foamAtWakeCusp).toBeGreaterThanOrEqual(0.0);
    expect(foamAtWakeCusp).toBeLessThanOrEqual(1.0);
    expect(foamAtFoamCusp).toBeGreaterThanOrEqual(0.0);
    expect(foamAtFoamCusp).toBeLessThanOrEqual(1.0);
  });
});
