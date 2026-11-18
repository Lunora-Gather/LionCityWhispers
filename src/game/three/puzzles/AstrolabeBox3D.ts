import * as THREE from "three";

export type Astrolabe3DRing = {
  index: number;
  label: string;
  group: THREE.Group;
  currentAngle: number;
  targetAngle: number;
  isAligned: boolean;
};

export type AstrolabeWorkshopHandle = {
  root: THREE.Group;
  rings: Astrolabe3DRing[];
  update: (time: number, delta: number) => void;
  selectRing: (index: number | null) => void;
  rotateRing: (index: number, angleDelta: number) => void;
  tryAlignRing: (index: number, force?: boolean) => boolean;
  getRingAnglesDeg: () => { current: number; target: number }[];
  isComplete: () => boolean;
  dispose: () => void;
};

function createAstrolabeDialTexture(ringIndex: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  ctx.clearRect(0, 0, 512, 512);

  // Subtle engraved concentric rings
  for (const r of [188, 212, 238]) {
    ctx.strokeStyle = "rgba(68, 42, 12, 0.55)";
    ctx.lineWidth = r === 212 ? 2.2 : 1.3;
    ctx.beginPath();
    ctx.arc(256, 256, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Precision division graduations + bright inlaid gold major markers
  const count = ringIndex === 0 ? 48 : ringIndex === 1 ? 32 : 24;
  for (let i = 0; i < count; i++) {
    const angle = (i * Math.PI * 2) / count;
    const major = i % 4 === 0;
    const r1 = major ? 186 : 208;
    const r2 = 240;
    ctx.strokeStyle = major ? "rgba(255, 226, 132, 0.92)" : "rgba(74, 46, 14, 0.68)";
    ctx.lineWidth = major ? 3.2 : 1.6;
    ctx.beginPath();
    ctx.moveTo(256 + Math.cos(angle) * r1, 256 + Math.sin(angle) * r1);
    ctx.lineTo(256 + Math.cos(angle) * r2, 256 + Math.sin(angle) * r2);
    ctx.stroke();
  }

  return new THREE.CanvasTexture(canvas);
}

function createStarWellTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  const grad = ctx.createRadialGradient(256, 256, 20, 256, 256, 256);
  grad.addColorStop(0, "#1c2827");
  grad.addColorStop(0.65, "#111a19");
  grad.addColorStop(1, "#090f0f");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Engraved celestial azimuth circles & rhumb lines
  ctx.strokeStyle = "rgba(212, 172, 92, 0.34)";
  ctx.lineWidth = 1.4;
  for (const r of [64, 118, 174, 226]) {
    ctx.beginPath();
    ctx.arc(256, 256, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let a = 0; a < 16; a++) {
    const ang = (a * Math.PI) / 8;
    ctx.beginPath();
    ctx.moveTo(256 + Math.cos(ang) * 42, 256 + Math.sin(ang) * 42);
    ctx.lineTo(256 + Math.cos(ang) * 244, 256 + Math.sin(ang) * 244);
    ctx.stroke();
  }

  return new THREE.CanvasTexture(canvas);
}

function createRosewoodTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;

  const grad = ctx.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0, "#3a2016");
  grad.addColorStop(0.5, "#2b160e");
  grad.addColorStop(1, "#1e0f09");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 256; y += 4) {
    ctx.strokeStyle = y % 8 === 0 ? "rgba(92, 48, 30, 0.34)" : "rgba(20, 9, 5, 0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y + Math.sin(y * 0.08) * 6);
    ctx.stroke();
  }

  return new THREE.CanvasTexture(canvas);
}

export function createAstrolabeWorkshop(onSolved?: () => void): AstrolabeWorkshopHandle {
  const root = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };
  const trackTex = <T extends THREE.Texture>(t: T): T => {
    textures.push(t);
    return t;
  };

  const brassMaterial = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd6a64c,
      roughness: 0.30,
      metalness: 0.78
    })
  );

  const copperGearMaterial = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xc5713d,
      roughness: 0.32,
      metalness: 0.76
    })
  );

  const goldAccentMaterial = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf7cf68,
      emissive: 0x4a3008,
      emissiveIntensity: 0.24,
      roughness: 0.22,
      metalness: 0.88
    })
  );

  const woodTex = trackTex(createRosewoodTexture());
  const boxWoodMaterial = trackMat(
    new THREE.MeshStandardMaterial({
      map: woodTex,
      color: 0x5c3626,
      roughness: 0.46,
      metalness: 0.16
    })
  );

  const jadeJewelMaterial = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x2cd4b6,
      emissive: 0x0e5e4f,
      emissiveIntensity: 0.55,
      roughness: 0.12,
      metalness: 0.22
    })
  );

  // 1. Stepped Octagonal Rosewood & Brass Treasure Box Case
  const lowerPlinthMesh = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(3.88, 4.10, 0.26, 8)), boxWoodMaterial);
  lowerPlinthMesh.position.y = -0.98;
  lowerPlinthMesh.receiveShadow = true;
  root.add(lowerPlinthMesh);

  const boxMesh = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(3.62, 3.82, 0.76, 8)), boxWoodMaterial);
  boxMesh.position.y = -0.52;
  boxMesh.receiveShadow = true;
  root.add(boxMesh);

  // Engraved Celestial Star-Chart Well Bed
  const starWellTex = trackTex(createStarWellTexture());
  const dialWellMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: starWellTex,
      roughness: 0.42,
      metalness: 0.62
    })
  );
  const dialWellMesh = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(3.36, 3.36, 0.08, 56)), dialWellMat);
  dialWellMesh.position.y = -0.14;
  root.add(dialWellMesh);

  // 8 Sculpted Brass Octagonal Corner Clasps & Rivet Studs
  const bracketGeo = trackGeo(new THREE.BoxGeometry(0.34, 0.84, 0.26));
  const studGeo = trackGeo(new THREE.SphereGeometry(0.048, 10, 10));
  for (let b = 0; b < 8; b++) {
    const bAng = (b * Math.PI) / 4 + Math.PI / 8;
    const bracketGroup = new THREE.Group();
    bracketGroup.position.set(Math.cos(bAng) * 3.66, -0.50, Math.sin(bAng) * 3.66);
    bracketGroup.rotation.y = -bAng + Math.PI / 2;
    bracketGroup.add(new THREE.Mesh(bracketGeo, brassMaterial));
    for (const sy of [-0.26, 0.26]) {
      const stud = new THREE.Mesh(studGeo, goldAccentMaterial);
      stud.position.set(0, sy, 0.13);
      bracketGroup.add(stud);
    }
    root.add(bracketGroup);
  }

  // Outer Brass Bezel & 32 Knurled Tactile Grips
  const rimMesh = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(3.52, 0.11, 16, 56)), goldAccentMaterial);
  rimMesh.rotation.x = Math.PI / 2;
  rimMesh.position.y = -0.12;
  root.add(rimMesh);

  const knurlGeo = trackGeo(new THREE.BoxGeometry(0.08, 0.14, 0.16));
  for (let k = 0; k < 32; k++) {
    const kAng = (k * Math.PI * 2) / 32;
    const knurl = new THREE.Mesh(knurlGeo, copperGearMaterial);
    knurl.position.set(Math.cos(kAng) * 3.60, -0.12, Math.sin(kAng) * 3.60);
    knurl.rotation.y = -kAng;
    root.add(knurl);
  }

  // Front (+Z) Meridian Zero Alignment Bridge & Target Star Clasp
  const meridianMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x3de0c8,
      emissive: 0x187d70,
      emissiveIntensity: 0.72,
      roughness: 0.2,
      metalness: 0.65
    })
  );
  const meridian = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.065, 0.055, 3.35)), meridianMat);
  meridian.position.set(0, 0.16, 1.85);
  root.add(meridian);

  const frontClasp = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.18, 0.30, 4)), goldAccentMaterial);
  frontClasp.rotation.x = -Math.PI / 2;
  frontClasp.rotation.y = Math.PI / 4;
  frontClasp.position.set(0, 0.16, 3.48);
  root.add(frontClasp);

  // 2. Center Lathe-Cut Imperial Jade Cabochon & 8-Petal Lotus Collet
  const coreBaseMesh = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.50, 0.58, 0.22, 32)), goldAccentMaterial);
  coreBaseMesh.position.y = 0.08;
  root.add(coreBaseMesh);

  const cabochonPts = [
    new THREE.Vector2(0.001, 0.22),
    new THREE.Vector2(0.20, 0.20),
    new THREE.Vector2(0.36, 0.11),
    new THREE.Vector2(0.42, 0.0),
    new THREE.Vector2(0.001, 0.0)
  ];
  const coreMesh = new THREE.Mesh(trackGeo(new THREE.LatheGeometry(cabochonPts, 28)), jadeJewelMaterial);
  coreMesh.position.y = 0.17;
  root.add(coreMesh);

  const prongGeo = trackGeo(new THREE.BoxGeometry(0.055, 0.20, 0.075));
  for (let p = 0; p < 8; p++) {
    const pAng = (p * Math.PI * 2) / 8;
    const prong = new THREE.Mesh(prongGeo, goldAccentMaterial);
    prong.position.set(Math.cos(pAng) * 0.43, 0.22, Math.sin(pAng) * 0.43);
    prong.rotation.y = -pAng;
    prong.rotation.x = 0.25;
    root.add(prong);
  }

  // 3. Three Concentric Geared Astrolabe Rings (targets: 90°, 180°, 270°)
  const ringConfigs = [
    { index: 0, label: "外环·星宿 (Outer)", innerR: 2.3, outerR: 3.1, target: Math.PI / 2, initial: 0 },
    { index: 1, label: "中环·度规 (Middle)", innerR: 1.45, outerR: 2.2, target: Math.PI, initial: Math.PI / 3 },
    { index: 2, label: "内环·潮相 (Inner)", innerR: 0.6, outerR: 1.35, target: (3 * Math.PI) / 2, initial: (2 * Math.PI) / 3 }
  ];

  // Sculpted faceted diamond astrolabe star-pointer geometry
  const pointerShape = new THREE.Shape();
  pointerShape.moveTo(0, 0.24);
  pointerShape.lineTo(0.11, -0.02);
  pointerShape.lineTo(0, -0.14);
  pointerShape.lineTo(-0.11, -0.02);
  pointerShape.closePath();
  const pointerExtrudeGeo = trackGeo(
    new THREE.ExtrudeGeometry(pointerShape, {
      depth: 0.055,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.012,
      bevelSegments: 2
    })
  );
  pointerExtrudeGeo.rotateX(Math.PI / 2);

  const rings: Astrolabe3DRing[] = [];
  const selectionHalos: THREE.Mesh[] = [];
  const pinMaterials: THREE.MeshStandardMaterial[] = [];
  let solved = false;

  for (const cfg of ringConfigs) {
    const ringGroup = new THREE.Group();
    ringGroup.position.y = 0.05 + cfg.index * 0.04;
    ringGroup.rotation.y = cfg.initial;

    const annularShape = new THREE.Shape();
    annularShape.absarc(0, 0, cfg.outerR, 0, Math.PI * 2, false);
    const holePath = new THREE.Path();
    holePath.absarc(0, 0, cfg.innerR, 0, Math.PI * 2, true);
    annularShape.holes.push(holePath);

    const extrudedRingGeo = trackGeo(
      new THREE.ExtrudeGeometry(annularShape, {
        depth: 0.08,
        bevelEnabled: true,
        bevelThickness: 0.018,
        bevelSize: 0.016,
        bevelSegments: 2,
        curveSegments: 56
      })
    );
    const extrudedRingMesh = new THREE.Mesh(extrudedRingGeo, brassMaterial);
    extrudedRingMesh.rotation.x = Math.PI / 2;
    extrudedRingMesh.position.y = 0.04;
    extrudedRingMesh.castShadow = true;
    extrudedRingMesh.receiveShadow = true;
    ringGroup.add(extrudedRingMesh);

    const dialTex = trackTex(createAstrolabeDialTexture(cfg.index));
    const discMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: dialTex,
        color: 0xe6bb64,
        roughness: 0.28,
        metalness: 0.78,
        transparent: true
      })
    );
    const discMesh = new THREE.Mesh(trackGeo(new THREE.RingGeometry(cfg.innerR + 0.02, cfg.outerR - 0.02, 56)), discMat);
    discMesh.rotation.x = -Math.PI / 2;
    discMesh.position.y = 0.064;
    ringGroup.add(discMesh);

    const borderMesh = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(cfg.outerR, 0.028, 10, 56)), goldAccentMaterial);
    borderMesh.rotation.x = Math.PI / 2;
    borderMesh.position.y = 0.048;
    ringGroup.add(borderMesh);

    const innerBorderMesh = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(cfg.innerR, 0.024, 10, 56)), goldAccentMaterial);
    innerBorderMesh.rotation.x = Math.PI / 2;
    innerBorderMesh.position.y = 0.048;
    ringGroup.add(innerBorderMesh);

    // Physical gear teeth along meshing edges
    const toothCount = cfg.index === 0 ? 28 : cfg.index === 1 ? 20 : 14;
    const toothRadius = cfg.index === 1 ? cfg.innerR - 0.045 : cfg.outerR + 0.055;
    const toothGeo = trackGeo(new THREE.BoxGeometry(0.11, 0.08, 0.12));
    for (let t = 0; t < toothCount; t++) {
      const tAngle = (t * Math.PI * 2) / toothCount;
      const tooth = new THREE.Mesh(toothGeo, copperGearMaterial);
      tooth.position.set(Math.cos(tAngle) * toothRadius, 0.02, Math.sin(tAngle) * toothRadius);
      tooth.rotation.y = -tAngle;
      ringGroup.add(tooth);
    }

    // Faceted Golden Star-Pointer Pin positioned at -cfg.target so ring.rotation.y === cfg.target aligns on +Z!
    const pinMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffd700,
        emissive: 0x664400,
        emissiveIntensity: 0.65,
        roughness: 0.2,
        metalness: 0.92
      })
    );
    pinMaterials.push(pinMat);

    const pinR = (cfg.innerR + cfg.outerR) * 0.5;
    const pinHolder = new THREE.Group();
    pinHolder.position.set(-Math.sin(cfg.target) * pinR, 0.12, Math.cos(cfg.target) * pinR);
    pinHolder.rotation.y = -cfg.target;
    pinHolder.add(new THREE.Mesh(pointerExtrudeGeo, pinMat));
    ringGroup.add(pinHolder);

    // Turquoise Selection Halo
    const selHaloMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x3de0c8,
        transparent: true,
        opacity: cfg.index === 0 ? 0.82 : 0
      })
    );
    const selHalo = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry((cfg.innerR + cfg.outerR) * 0.5, 0.032, 12, 56)),
      selHaloMat
    );
    selHalo.rotation.x = Math.PI / 2;
    selHalo.position.y = 0.082;
    ringGroup.add(selHalo);
    selectionHalos.push(selHalo);

    root.add(ringGroup);

    rings.push({
      index: cfg.index,
      label: cfg.label,
      group: ringGroup,
      currentAngle: cfg.initial,
      targetAngle: cfg.target,
      isAligned: false
    });
  }

  // 4. Four Corner Stepped Hydraulic Locking Pistons inside Bolted Brass Sleeves
  const boltMeshes: THREE.Group[] = [];
  const sleeveGeo = trackGeo(new THREE.CylinderGeometry(0.28, 0.32, 0.24, 8));
  const pistonShaftGeo = trackGeo(new THREE.CylinderGeometry(0.16, 0.16, 0.52, 8));
  const pistonCapGeo = trackGeo(new THREE.CylinderGeometry(0.21, 0.18, 0.12, 8));
  const boltPositions: Array<[number, number, number]> = [
    [-2.42, -0.02, -2.42],
    [2.42, -0.02, -2.42],
    [-2.42, -0.02, 2.42],
    [2.42, -0.02, 2.42]
  ];

  for (const [bx, by, bz] of boltPositions) {
    const sleeve = new THREE.Mesh(sleeveGeo, copperGearMaterial);
    sleeve.position.set(bx, by, bz);
    root.add(sleeve);

    const pistonGroup = new THREE.Group();
    pistonGroup.position.set(bx, 0.16, bz);
    pistonGroup.add(new THREE.Mesh(pistonShaftGeo, goldAccentMaterial));
    const cap = new THREE.Mesh(pistonCapGeo, brassMaterial);
    cap.position.y = 0.28;
    pistonGroup.add(cap);
    root.add(pistonGroup);
    boltMeshes.push(pistonGroup);
  }

  function normalizeAngle(a: number): number {
    let norm = a % (Math.PI * 2);
    if (norm < 0) norm += Math.PI * 2;
    return norm;
  }

  function checkAlignment(ring: Astrolabe3DRing): boolean {
    const currentNorm = normalizeAngle(ring.currentAngle);
    const targetNorm = normalizeAngle(ring.targetAngle);
    const diff = Math.abs(currentNorm - targetNorm);
    const minDiff = Math.min(diff, Math.PI * 2 - diff);
    return minDiff < 0.32;
  }

  function checkAllSolved(): boolean {
    const allAligned = rings.every((r) => r.isAligned);
    if (allAligned && !solved) {
      solved = true;
      if (onSolved) onSolved();
    }
    return allAligned;
  }

  return {
    root,
    rings,
    update: (_time: number, _delta: number) => {
      if (solved) {
        jadeJewelMaterial.emissiveIntensity = 0.85 + Math.sin(_time * 0.005) * 0.3;
        for (const bolt of boltMeshes) {
          if (bolt.position.y > -0.22) {
            bolt.position.y -= _delta * 0.55;
          }
        }
      }
    },
    selectRing: (index: number | null) => {
      for (let i = 0; i < selectionHalos.length; i++) {
        const mat = selectionHalos[i].material as THREE.MeshBasicMaterial;
        mat.opacity = i === index ? 0.82 : 0;
      }
    },
    rotateRing: (index: number, angleDelta: number) => {
      if (index < 0 || index >= rings.length) return;
      const ring = rings[index];
      ring.currentAngle += angleDelta;
      ring.group.rotation.y = ring.currentAngle;
      ring.isAligned = checkAlignment(ring);
      if (pinMaterials[index]) {
        pinMaterials[index].color.setHex(ring.isAligned ? 0x3de0c8 : 0xffd700);
        pinMaterials[index].emissive.setHex(ring.isAligned ? 0x1d7f73 : 0x664400);
      }
      checkAllSolved();
    },
    tryAlignRing: (index: number, force = false) => {
      if (index < 0 || index >= rings.length) return false;
      const ring = rings[index];
      if (force || checkAlignment(ring)) {
        ring.currentAngle = ring.targetAngle;
        ring.group.rotation.y = ring.targetAngle;
        ring.isAligned = true;
        if (pinMaterials[index]) {
          pinMaterials[index].color.setHex(0x3de0c8);
          pinMaterials[index].emissive.setHex(0x1d7f73);
        }
        checkAllSolved();
        return true;
      }
      return false;
    },
    getRingAnglesDeg: () => {
      return rings.map((r) => ({
        current: Math.round((normalizeAngle(r.currentAngle) * 180) / Math.PI) % 360,
        target: Math.round((normalizeAngle(r.targetAngle) * 180) / Math.PI) % 360
      }));
    },
    isComplete: () => {
      return solved || checkAllSolved();
    },
    dispose: () => {
      for (const geo of geometries) geo.dispose();
      for (const mat of materials) mat.dispose();
      for (const tex of textures) tex.dispose();
    }
  };
}
