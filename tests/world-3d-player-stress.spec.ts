import { expect, test } from "@playwright/test";
import * as THREE from "three";
import { World3DPlayer } from "../src/game/three/world/World3DPlayer";

function isSubnormal(n: number): boolean {
  return n !== 0 && Math.abs(n) < 2.2250738585072014e-308;
}

test.describe("Milestone 2 Empirical Challenger Stress Suite: World3DPlayer", () => {
  /* ========================================================================= */
  /* Test 1: 50,000-Frame Multi-Scenario Empirical Stress Simulation           */
  /* ========================================================================= */
  test("1. 50,000 frames of update() with variable delta, 180° switches, start-stop, and navigation", () => {
    const player = new World3DPlayer();
    const input = new THREE.Vector2(0, 0);

    let nanCount = 0;
    let infCount = 0;
    let subnormalCount = 0;
    let hyperextensionCount = 0;
    let kneeExceedCount = 0;
    let pelvisExceedCount = 0;
    let bankExceedCount = 0;

    let minKneeFlexionDeg = Infinity;
    let maxKneeFlexionDeg = -Infinity;
    let minPelvisRollDeg = Infinity;
    let maxPelvisRollDeg = -Infinity;
    let minBankDeg = Infinity;
    let maxBankDeg = -Infinity;

    // Deterministic LCG random generator for reproducible stress testing
    let seed = 42;
    function rand() {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    }

    const testDestinations = [
      new THREE.Vector3(15, 1.0, 10),
      new THREE.Vector3(-20, 1.0, -15),
      new THREE.Vector3(2, 0.4, 0), // Water margin / wet area
      new THREE.Vector3(-10, 1.0, 12),
      new THREE.Vector3(0, 1.0, 0),
    ];
    let destIndex = 0;

    const TOTAL_FRAMES = 50000;

    for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
      let delta = 0.016; // default 60 FPS
      input.set(0, 0);

      // --- Scenario Selection across 50,000 frames ---
      if (frame < 10000) {
        // Phase 1: Rapid Start-Stop Cycles (frames 0 - 9,999)
        delta = 0.005 + rand() * 0.045; // 0.005s to 0.050s
        const cycle = Math.floor(frame / 12);
        if (cycle % 2 === 0) {
          input.set(1.0, 0);
        } else {
          input.set(0, 0);
        }
      } else if (frame < 20000) {
        // Phase 2: Sudden 180° Direction Switches (frames 10,000 - 19,999)
        delta = 0.008 + rand() * 0.08; // 0.008s to 0.088s
        const switchCycle = Math.floor(frame / 25);
        if (switchCycle % 2 === 0) {
          input.set(0, 1.0); // South
        } else {
          input.set(0, -1.0); // North (instant 180° switch)
        }
        // Occasional diagonal 180° flip
        if (frame % 100 > 50) {
          input.x = -input.y;
          input.normalize();
        }
      } else if (frame < 35000) {
        // Phase 3: Long-Distance Destination Navigation & Arrival (frames 20,000 - 34,999)
        delta = 0.01 + rand() * 0.03;
        if (!player.targetPosition) {
          player.setDestination(testDestinations[destIndex % testDestinations.length]);
          destIndex++;
        }
        // Click-to-move takes precedence when input is (0,0)
      } else if (frame < 45000) {
        // Phase 4: Variable Delta Jitter & Extreme Frame Times (frames 35,000 - 44,999)
        // Deliberately push delta to extreme boundaries: 0.0005s to 0.5s
        if (frame % 50 === 0) {
          delta = 0.5; // Massive frame hitch / lag spike
        } else if (frame % 25 === 0) {
          delta = 0.001; // Ultra-fast micro-tick
        } else if (frame % 10 === 0) {
          delta = 0.2; // 5 FPS drop
        } else {
          delta = 0.005 + rand() * 0.06;
        }
        const ang = rand() * Math.PI * 2;
        input.set(Math.cos(ang), Math.sin(ang));
      } else {
        // Phase 5: Adversarial Pseudorandom Walk (frames 45,000 - 49,999)
        delta = 0.001 + rand() * 0.499; // Continuous range [0.001s, 0.500s]
        const action = rand();
        if (action < 0.3) {
          input.set(0, 0);
        } else if (action < 0.7) {
          const theta = rand() * Math.PI * 2;
          input.set(Math.cos(theta), Math.sin(theta));
        } else {
          input.set(0, 0);
          player.setDestination(
            new THREE.Vector3(-25 + rand() * 45, 1.0, -20 + rand() * 38)
          );
        }
      }

      // Execute update
      player.update(delta, input);

      // --- Numerical Verification: Position & Scene Graph Integrity ---
      const p = player.position;
      if (isNaN(p.x) || isNaN(p.y) || isNaN(p.z)) nanCount++;
      if (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z)) infCount++;
      if (isSubnormal(p.x) || isSubnormal(p.y) || isSubnormal(p.z)) subnormalCount++;

      // Traverse all hierarchy nodes
      player.root.traverse((obj) => {
        const pos = obj.position;
        const rot = obj.rotation;
        const scl = obj.scale;

        if (isNaN(pos.x) || isNaN(pos.y) || isNaN(pos.z)) nanCount++;
        if (isNaN(rot.x) || isNaN(rot.y) || isNaN(rot.z)) nanCount++;
        if (isNaN(scl.x) || isNaN(scl.y) || isNaN(scl.z)) nanCount++;

        if (!isFinite(pos.x) || !isFinite(pos.y) || !isFinite(pos.z)) infCount++;
        if (!isFinite(rot.x) || !isFinite(rot.y) || !isFinite(rot.z)) infCount++;
        if (!isFinite(scl.x) || !isFinite(scl.y) || !isFinite(scl.z)) infCount++;

        if (isSubnormal(pos.x) || isSubnormal(pos.y) || isSubnormal(pos.z)) subnormalCount++;
        if (isSubnormal(rot.x) || isSubnormal(rot.y) || isSubnormal(rot.z)) subnormalCount++;
        if (isSubnormal(scl.x) || isSubnormal(scl.y) || isSubnormal(scl.z)) subnormalCount++;
      });

      // --- Joint Angle Biological Bounds Verification ---
      const anyPlayer = player as any;
      const leftShankRotX = anyPlayer.leftShankGroup.rotation.x;
      const rightShankRotX = anyPlayer.rightShankGroup.rotation.x;

      // Knee flexion is positive angle backwards (-rotation.x in Three.js coords)
      const leftFlexionDeg = -leftShankRotX * (180 / Math.PI);
      const rightFlexionDeg = -rightShankRotX * (180 / Math.PI);

      if (leftShankRotX > 1e-6 || rightShankRotX > 1e-6) {
        hyperextensionCount++;
      }
      if (leftFlexionDeg > 60.0001 || rightFlexionDeg > 60.0001) {
        kneeExceedCount++;
      }

      minKneeFlexionDeg = Math.min(minKneeFlexionDeg, leftFlexionDeg, rightFlexionDeg);
      maxKneeFlexionDeg = Math.max(maxKneeFlexionDeg, leftFlexionDeg, rightFlexionDeg);

      // Pelvis roll bounds: [-5°, +5°]
      const pelvisRollDeg = anyPlayer.pelvisGroup.rotation.z * (180 / Math.PI);
      if (pelvisRollDeg < -5.0001 || pelvisRollDeg > 5.0001) {
        pelvisExceedCount++;
      }
      minPelvisRollDeg = Math.min(minPelvisRollDeg, pelvisRollDeg);
      maxPelvisRollDeg = Math.max(maxPelvisRollDeg, pelvisRollDeg);

      // Centripetal banking bounds: [-10°, +10°]
      const bankDeg = anyPlayer.bodyGroup.rotation.z * (180 / Math.PI);
      if (bankDeg < -10.0001 || bankDeg > 10.0001) {
        bankExceedCount++;
      }
      minBankDeg = Math.min(minBankDeg, bankDeg);
      maxBankDeg = Math.max(maxBankDeg, bankDeg);
    }

    // Telemetry log for handoff report
    console.log("=== EMPIRICAL 50,000-FRAME TELEMETRY ===");
    console.log(`Frames Evaluated: ${TOTAL_FRAMES}`);
    console.log(`NaN Count: ${nanCount}`);
    console.log(`Infinity Count: ${infCount}`);
    console.log(`Subnormal Count: ${subnormalCount}`);
    console.log(`Hyperextension Events: ${hyperextensionCount}`);
    console.log(`Knee Flexion Range: [${minKneeFlexionDeg.toFixed(2)}°, ${maxKneeFlexionDeg.toFixed(2)}°] (spec: [0°, 60°])`);
    console.log(`Pelvis Roll Range: [${minPelvisRollDeg.toFixed(2)}°, ${maxPelvisRollDeg.toFixed(2)}°] (spec: [-5°, +5°])`);
    console.log(`Centripetal Bank Range: [${minBankDeg.toFixed(2)}°, ${maxBankDeg.toFixed(2)}°] (spec: [-10°, +10°])`);

    // Strict assertions
    expect(nanCount).toBe(0);
    expect(infCount).toBe(0);
    expect(subnormalCount).toBe(0);
    expect(hyperextensionCount).toBe(0);
    expect(kneeExceedCount).toBe(0);
    expect(pelvisExceedCount).toBe(0);
    expect(bankExceedCount).toBe(0);

    expect(minKneeFlexionDeg).toBeGreaterThanOrEqual(-1e-6);
    expect(maxKneeFlexionDeg).toBeLessThanOrEqual(60.0);
    expect(minPelvisRollDeg).toBeGreaterThanOrEqual(-5.0);
    expect(maxPelvisRollDeg).toBeLessThanOrEqual(5.0);
    expect(minBankDeg).toBeGreaterThanOrEqual(-10.0);
    expect(maxBankDeg).toBeLessThanOrEqual(10.0);

    player.dispose();
  });

  /* ========================================================================= */
  /* Test 2: Zero Heap Allocation Profiling across 10,000 Hot Frames          */
  /* ========================================================================= */
  test("2. Zero heap allocations during update() calls across thousands of frames", () => {
    const player = new World3DPlayer();
    const input = new THREE.Vector2(1.0, 0.0);
    const testDest = new THREE.Vector3(10, 1.0, 10);
    player.setDestination(testDest);

    // Warm-up JIT and pools
    for (let i = 0; i < 500; i++) {
      player.update(0.016, input);
    }

    // Instrument Three.js common heap constructors to trap any allocations in update loop
    let interceptedAllocations = 0;
    const trackedClasses = [
      "Vector3",
      "Vector2",
      "Vector4",
      "Matrix4",
      "Matrix3",
      "Quaternion",
      "Euler",
      "BoxGeometry",
      "SphereGeometry",
      "CylinderGeometry",
      "RingGeometry",
      "Mesh",
      "Group",
      "Points",
    ];

    const unpatches: Array<() => void> = [];
    for (const className of trackedClasses) {
      const OriginalClass = (THREE as any)[className];
      if (typeof OriginalClass === "function") {
        const PatchedClass = function (...args: any[]) {
          interceptedAllocations++;
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

    // Run 10,000 frames of active locomotion with alternating directions and click-to-move pathing
    const PROFILING_FRAMES = 10000;

    try {
      for (let i = 0; i < PROFILING_FRAMES; i++) {
        // Toggle between keyboard input and click-to-move pathing
        if (i % 200 === 0) {
          player.setDestination(testDest);
          input.set(0, 0);
        } else if (i % 50 === 0) {
          input.set(i % 100 === 0 ? 1.0 : -1.0, 0);
        }

        player.update(0.016, input);
      }

      console.log(`=== ZERO ALLOCATION PROFILING (10,000 FRAMES) ===`);
      console.log(`Intercepted Allocations: ${interceptedAllocations}`);

      // Verify STRICT ZERO new Three.js heap allocations across 10,000 frames!
      expect(interceptedAllocations).toBe(0);
    } finally {
      unpatches.forEach((unpatch) => unpatch());
      player.dispose();
    }
  });

  /* ========================================================================= */
  /* Test 3: Settling Oscillation & Idle Transition Discontinuity Check        */
  /* ========================================================================= */
  test("3. Stopping settle oscillation decays cleanly to zero within 0.45s", () => {
    const player = new World3DPlayer();
    const input = new THREE.Vector2(1.0, 0.0);

    // Move for 60 frames to reach top speed
    for (let i = 0; i < 60; i++) {
      player.update(0.016, input);
    }
    expect(player.isMoving).toBe(true);

    // Stop moving
    input.set(0, 0);
    player.update(0.016, input);
    expect(player.isMoving).toBe(false);

    const anyPlayer = player as any;
    let maxSettleMagnitude = 0;

    // Follow the 0.45s settling window (approx 28 frames at 60 FPS)
    for (let f = 0; f < 40; f++) {
      player.update(0.016, input);
      const settleY = anyPlayer.settleY;
      maxSettleMagnitude = Math.max(maxSettleMagnitude, Math.abs(settleY));

      expect(isFinite(settleY)).toBe(true);
      expect(isNaN(settleY)).toBe(false);
      // Settle sink should never drop deeper than -0.05m
      expect(settleY).toBeGreaterThanOrEqual(-0.05);
      expect(settleY).toBeLessThanOrEqual(0.05);
    }

    // After 0.45s + margin (40 frames = 0.64s), settleY must be exactly 0
    expect(anyPlayer.settleY).toBe(0);
    expect(anyPlayer.settleTimer).toBe(-1);
    expect(maxSettleMagnitude).toBeGreaterThan(0.01); // verified that oscillation actually took place!

    player.dispose();
  });

  /* ========================================================================= */
  /* Test 4: Diorama Perimeter Boundary Clamping                               */
  /* ========================================================================= */
  test("4. Player position stays strictly bounded within diorama perimeter", () => {
    const player = new World3DPlayer();
    const input = new THREE.Vector2(1.0, 0.0);

    // Attempt to run continuously east far past perimeter (boundary is x = 22)
    for (let i = 0; i < 2000; i++) {
      player.update(0.05, input);
    }
    expect(player.position.x).toBeLessThanOrEqual(22.0);
    expect(player.position.x).toBe(22.0);

    // Run west far past perimeter (boundary is x = -26)
    input.set(-1.0, 0.0);
    for (let i = 0; i < 2000; i++) {
      player.update(0.05, input);
    }
    expect(player.position.x).toBeGreaterThanOrEqual(-26.0);
    expect(player.position.x).toBe(-26.0);

    // Run north (boundary is z = -22)
    input.set(0.0, -1.0);
    for (let i = 0; i < 2000; i++) {
      player.update(0.05, input);
    }
    expect(player.position.z).toBeGreaterThanOrEqual(-22.0);
    expect(player.position.z).toBe(-22.0);

    // Run south (boundary is z = 20)
    input.set(0.0, 1.0);
    for (let i = 0; i < 2000; i++) {
      player.update(0.05, input);
    }
    expect(player.position.z).toBeLessThanOrEqual(20.0);
    expect(player.position.z).toBe(20.0);

    player.dispose();
  });
});
