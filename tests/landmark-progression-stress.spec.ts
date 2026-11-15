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

import { World3DEnvironment } from "../src/game/three/world/World3DEnvironment";

test.describe("Empirical Challenger M1: Landmark Progression State Transitions", () => {
  test("1. Handles empty array and default parameters gracefully", () => {
    const env = new World3DEnvironment();

    env.setProgressionState([], false, false);

    const cues = (env as any).landmarkCueRecords;
    expect(cues).toBeDefined();
    expect(cues.length).toBe(5);

    for (const cue of cues) {
      expect(cue.status).toBe("pending");
      expect(cue.beaconStar.material.color.getHex()).toBe(cue.pendingBeaconColor);
      expect(cue.beaconRing.material.color.getHex()).toBe(cue.pendingBeaconColor);
    }

    env.dispose();
  });

  test("2. Handles invalid strings, unexpected tokens, and unknown IDs gracefully", () => {
    const env = new World3DEnvironment();

    const invalidInputs = [
      ["unknown-artifact", "gibberish", "", "   ", "null", "undefined", "__proto__"],
      ["stone", "plaque", "chime", "seal"],
      [123 as unknown as string, {} as unknown as string],
    ];

    for (const input of invalidInputs) {
      expect(() => {
        env.setProgressionState(input, false, false);
      }).not.toThrow();

      const cues = (env as any).landmarkCueRecords;
      for (const cue of cues) {
        expect(cue.status).toBe("pending");
      }
    }

    env.dispose();
  });

  test("3. Handles partial completions and sequential landmark progression correctly", () => {
    const env = new World3DEnvironment();
    const cuesMap: Record<string, any> = {};
    for (const cue of (env as any).landmarkCueRecords) {
      cuesMap[cue.id] = cue;
    }

    // Step 1: Badang stone restored
    env.setProgressionState(["badang-stone"], false, false);
    expect(cuesMap["badang-stone"].status).toBe("restored");
    expect(cuesMap["badang-stone"].beaconStar.material.color.getHex()).toBe(0xffd700);
    expect(cuesMap["rune-plaque"].status).toBe("pending");
    expect(cuesMap["harbor-seal"].status).toBe("pending");
    expect(cuesMap["spirit-chime"].status).toBe("pending");
    expect(cuesMap["museum"].status).toBe("pending");

    // Step 2: Badang + Rune restored
    env.setProgressionState(["badang-stone", "rune-plaque"], false, false);
    expect(cuesMap["badang-stone"].status).toBe("restored");
    expect(cuesMap["rune-plaque"].status).toBe("restored");
    expect(cuesMap["rune-plaque"].beaconStar.material.color.getHex()).toBe(0x3de0c8);
    expect(cuesMap["harbor-seal"].status).toBe("pending");
    expect(cuesMap["spirit-chime"].status).toBe("pending");
    expect(cuesMap["museum"].status).toBe("pending");

    // Step 3: Badang + Rune + Harbor restored
    env.setProgressionState(["badang-stone", "rune-plaque", "harbor-seal"], false, false);
    expect(cuesMap["badang-stone"].status).toBe("restored");
    expect(cuesMap["rune-plaque"].status).toBe("restored");
    expect(cuesMap["harbor-seal"].status).toBe("restored");
    expect(cuesMap["harbor-seal"].beaconStar.material.color.getHex()).toBe(0xff2255);
    expect(cuesMap["spirit-chime"].status).toBe("pending");
    expect(cuesMap["museum"].status).toBe("pending");

    // Step 4: All 4 restored via ritualComplete -> Museum becomes ready
    env.setProgressionState(["badang-stone", "rune-plaque", "harbor-seal"], true, false);
    expect(cuesMap["spirit-chime"].status).toBe("restored");
    expect(cuesMap["spirit-chime"].beaconStar.material.color.getHex()).toBe(0x66ffcc);
    expect(cuesMap["museum"].status).toBe("ready");
    expect(cuesMap["museum"].beaconStar.material.color.getHex()).toBe(0xffe680);
    expect(cuesMap["museum"].beaconStar.scale.x).toBeCloseTo(1.35, 2);

    // Step 5: Museum complete
    env.setProgressionState(["badang-stone", "rune-plaque", "harbor-seal", "spirit-chime"], true, true);
    expect(cuesMap["museum"].status).toBe("restored");
    expect(cuesMap["museum"].beaconStar.material.color.getHex()).toBe(0xffd700);

    env.dispose();
  });

  test("4. Alias compatibility with 2D puzzle flag names", () => {
    const env = new World3DEnvironment();
    const cuesMap: Record<string, any> = {};
    for (const cue of (env as any).landmarkCueRecords) {
      cuesMap[cue.id] = cue;
    }

    env.setProgressionState(["jigsaw", "runes", "lock", "rhythm"], false, false);

    expect(cuesMap["badang-stone"].status).toBe("restored");
    expect(cuesMap["rune-plaque"].status).toBe("restored");
    expect(cuesMap["harbor-seal"].status).toBe("restored");
    expect(cuesMap["spirit-chime"].status).toBe("restored");
    expect(cuesMap["museum"].status).toBe("ready");

    env.dispose();
  });

  test("5. Zero allocations during repeated setProgressionState transitions", () => {
    const env = new World3DEnvironment();

    // Warm-up calls
    env.setProgressionState([], false, false);
    env.setProgressionState(["badang-stone"], false, false);

    const constructors = [
      "Vector2", "Vector3", "Vector4",
      "Matrix3", "Matrix4",
      "Quaternion", "Euler",
      "Box3", "Sphere", "Color",
      "Group", "Mesh", "Points",
      "BufferGeometry", "MeshStandardMaterial", "MeshBasicMaterial"
    ];

    let allocations = 0;
    const originalConstructors: Record<string, any> = {};
    for (const name of constructors) {
      if ((THREE as any)[name]) {
        originalConstructors[name] = (THREE as any)[name];
        (THREE as any)[name] = function (...args: any[]) {
          allocations++;
          return new originalConstructors[name](...args);
        };
      }
    }

    const testStates = [
      { ids: [], ritual: false, museum: false },
      { ids: ["badang-stone"], ritual: false, museum: false },
      { ids: ["badang-stone", "rune-plaque"], ritual: false, museum: false },
      { ids: ["badang-stone", "rune-plaque", "harbor-seal"], ritual: false, museum: false },
      { ids: ["badang-stone", "rune-plaque", "harbor-seal"], ritual: true, museum: false },
      { ids: ["badang-stone", "rune-plaque", "harbor-seal", "spirit-chime"], ritual: true, museum: true },
      { ids: ["jigsaw", "runes"], ritual: false, museum: false },
      { ids: ["lock", "rhythm"], ritual: true, museum: false },
    ];

    for (let i = 0; i < 2000; i++) {
      const state = testStates[i % testStates.length];
      env.setProgressionState(state.ids, state.ritual, state.museum);
    }

    // Restore constructors
    for (const name of constructors) {
      if (originalConstructors[name]) {
        (THREE as any)[name] = originalConstructors[name];
      }
    }

    expect(allocations).toBe(0);
    env.dispose();
  });

  test("6. Zero allocations during frame updates across restored landmark states", () => {
    const env = new World3DEnvironment();

    // Set all landmarks restored
    env.setProgressionState(["badang-stone", "rune-plaque", "harbor-seal", "spirit-chime"], true, true);

    // Warm-up 10 frames
    for (let f = 0; f < 10; f++) {
      env.update(f * 0.016, 0.016);
    }

    const constructors = [
      "Vector2", "Vector3", "Vector4",
      "Matrix3", "Matrix4",
      "Quaternion", "Euler",
      "Box3", "Sphere", "Color",
      "Group", "Mesh", "Points",
      "BufferGeometry", "MeshStandardMaterial", "MeshBasicMaterial"
    ];

    let allocations = 0;
    const originalConstructors: Record<string, any> = {};
    for (const name of constructors) {
      if ((THREE as any)[name]) {
        originalConstructors[name] = (THREE as any)[name];
        (THREE as any)[name] = function (...args: any[]) {
          allocations++;
          return new originalConstructors[name](...args);
        };
      }
    }

    const dt = 0.016;
    for (let f = 10; f < 610; f++) {
      env.update(f * dt, dt);
    }

    for (const name of constructors) {
      if (originalConstructors[name]) {
        (THREE as any)[name] = originalConstructors[name];
      }
    }

    expect(allocations).toBe(0);
    env.dispose();
  });
});
