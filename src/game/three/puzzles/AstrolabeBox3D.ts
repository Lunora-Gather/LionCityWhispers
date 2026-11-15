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

  // Concentric division marks
  ctx.strokeStyle = "rgba(255, 215, 0, 0.75)";
  ctx.lineWidth = 3;

  const count = ringIndex === 0 ? 24 : ringIndex === 1 ? 16 : 8;
  for (let i = 0; i < count; i++) {
    const angle = (i * Math.PI * 2) / count;
    const r1 = 200;
    const r2 = 235;
    ctx.beginPath();
    ctx.moveTo(256 + Math.cos(angle) * r1, 256 + Math.sin(angle) * r1);
    ctx.lineTo(256 + Math.cos(angle) * r2, 256 + Math.sin(angle) * r2);
    ctx.stroke();
  }

  // Target pointer star marker at target position
  ctx.fillStyle = "#ffd700";
  ctx.shadowColor = "#ffaa00";
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(256, 38, 10, 0, Math.PI * 2);
  ctx.fill();

  return new THREE.CanvasTexture(canvas);
}

export function createAstrolabeWorkshop(onSolved?: () => void): AstrolabeWorkshopHandle {
  const root = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  const brassMaterial = new THREE.MeshStandardMaterial({
    color: 0xc8963e,
    roughness: 0.35,
    metalness: 0.85
  });
  materials.push(brassMaterial);

  const goldAccentMaterial = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    emissive: 0x553300,
    roughness: 0.2,
    metalness: 0.95
  });
  materials.push(goldAccentMaterial);

  const boxWoodMaterial = new THREE.MeshStandardMaterial({
    color: 0x1f140e,
    roughness: 0.65,
    metalness: 0.2
  });
  materials.push(boxWoodMaterial);

  const jadeJewelMaterial = new THREE.MeshStandardMaterial({
    color: 0x1d7f73,
    emissive: 0x0a4038,
    emissiveIntensity: 0.5,
    roughness: 0.1,
    metalness: 0.3
  });
  materials.push(jadeJewelMaterial);

  // Octagonal Box Base with Stepped Plinth & Recessed Dial Bed
  const lowerPlinthGeo = new THREE.CylinderGeometry(3.85, 4.05, 0.26, 8);
  geometries.push(lowerPlinthGeo);
  const lowerPlinthMesh = new THREE.Mesh(lowerPlinthGeo, boxWoodMaterial);
  lowerPlinthMesh.position.y = -0.98;
  lowerPlinthMesh.receiveShadow = true;
  root.add(lowerPlinthMesh);

  const boxGeo = new THREE.CylinderGeometry(3.6, 3.8, 0.76, 8);
  geometries.push(boxGeo);
  const boxMesh = new THREE.Mesh(boxGeo, boxWoodMaterial);
  boxMesh.position.y = -0.52;
  boxMesh.receiveShadow = true;
  root.add(boxMesh);

  // Recessed Dark Bronze Dial Well Bed
  const dialWellGeo = new THREE.CylinderGeometry(3.32, 3.32, 0.08, 48);
  geometries.push(dialWellGeo);
  const dialWellMat = new THREE.MeshStandardMaterial({
    color: 0x120d09,
    roughness: 0.45,
    metalness: 0.72
  });
  materials.push(dialWellMat);
  const dialWellMesh = new THREE.Mesh(dialWellGeo, dialWellMat);
  dialWellMesh.position.y = -0.14;
  root.add(dialWellMesh);

  // 8 Brass Octagonal Corner Mount Brackets
  const bracketGeo = new THREE.BoxGeometry(0.32, 0.82, 0.24);
  geometries.push(bracketGeo);
  for (let b = 0; b < 8; b++) {
    const bAng = (b * Math.PI) / 4 + Math.PI / 8;
    const bracket = new THREE.Mesh(bracketGeo, brassMaterial);
    bracket.position.set(Math.cos(bAng) * 3.64, -0.50, Math.sin(bAng) * 3.64);
    bracket.rotation.y = -bAng + Math.PI / 2;
    root.add(bracket);
  }

  // Brass Rim Bezel with 32 Knurled Tactile Ridges
  const rimGeo = new THREE.TorusGeometry(3.52, 0.11, 16, 48);
  geometries.push(rimGeo);
  const rimMesh = new THREE.Mesh(rimGeo, goldAccentMaterial);
  rimMesh.rotation.x = Math.PI / 2;
  rimMesh.position.y = -0.12;
  root.add(rimMesh);

  const knurlGeo = new THREE.BoxGeometry(0.08, 0.14, 0.16);
  geometries.push(knurlGeo);
  for (let k = 0; k < 32; k++) {
    const kAng = (k * Math.PI * 2) / 32;
    const knurl = new THREE.Mesh(knurlGeo, brassMaterial);
    knurl.position.set(Math.cos(kAng) * 3.60, -0.12, Math.sin(kAng) * 3.60);
    knurl.rotation.y = -kAng;
    root.add(knurl);
  }

  // Meridian Zero Guide Line
  const meridianGeo = new THREE.BoxGeometry(0.08, 0.06, 5.8);
  geometries.push(meridianGeo);
  const meridianMat = new THREE.MeshStandardMaterial({
    color: 0x3de0c8,
    emissive: 0x1d7f73,
    emissiveIntensity: 0.7,
    roughness: 0.2
  });
  materials.push(meridianMat);
  const meridian = new THREE.Mesh(meridianGeo, meridianMat);
  meridian.position.set(0, 0.12, 0);
  root.add(meridian);

  // Center Faceted Jade Cabochon & 6-Prong Gold Bezel Core
  const coreBaseGeo = new THREE.CylinderGeometry(0.52, 0.58, 0.22, 24);
  geometries.push(coreBaseGeo);
  const coreBaseMesh = new THREE.Mesh(coreBaseGeo, goldAccentMaterial);
  coreBaseMesh.position.y = 0.08;
  root.add(coreBaseMesh);

  const coreGeo = new THREE.DodecahedronGeometry(0.42, 1);
  coreGeo.scale(1.0, 0.62, 1.0);
  geometries.push(coreGeo);
  const coreMesh = new THREE.Mesh(coreGeo, jadeJewelMaterial);
  coreMesh.position.y = 0.22;
  root.add(coreMesh);

  const prongGeo = new THREE.BoxGeometry(0.06, 0.22, 0.08);
  geometries.push(prongGeo);
  for (let p = 0; p < 6; p++) {
    const pAng = (p * Math.PI * 2) / 6;
    const prong = new THREE.Mesh(prongGeo, goldAccentMaterial);
    prong.position.set(Math.cos(pAng) * 0.44, 0.20, Math.sin(pAng) * 0.44);
    prong.rotation.y = -pAng;
    prong.rotation.x = 0.22;
    root.add(prong);
  }

  // 3 Concentric Rings Config:
  // Target angles matching LockPuzzle.ts logic: 90 deg (PI/2), 180 deg (PI), 270 deg (3PI/2)
  const ringConfigs = [
    { index: 0, label: "外环·星宿 (Outer)", innerR: 2.3, outerR: 3.1, target: Math.PI / 2, initial: 0 },
    { index: 1, label: "中环·度规 (Middle)", innerR: 1.45, outerR: 2.2, target: Math.PI, initial: Math.PI / 3 },
    { index: 2, label: "内环·潮相 (Inner)", innerR: 0.6, outerR: 1.35, target: (3 * Math.PI) / 2, initial: (2 * Math.PI) / 3 }
  ];

  const rings: Astrolabe3DRing[] = [];
  const selectionHalos: THREE.Mesh[] = [];
  const pinMaterials: THREE.MeshStandardMaterial[] = [];
  let selectedIndex: number | null = 0;
  let solved = false;

  for (const cfg of ringConfigs) {
    const ringGroup = new THREE.Group();
    ringGroup.position.y = 0.05 + cfg.index * 0.04;
    ringGroup.rotation.y = cfg.initial;

    // True 3D Extruded & Beveled Annular Mechanical Ring Body (zero edge-on vanishing)
    const annularShape = new THREE.Shape();
    annularShape.absarc(0, 0, cfg.outerR, 0, Math.PI * 2, false);
    const holePath = new THREE.Path();
    holePath.absarc(0, 0, cfg.innerR, 0, Math.PI * 2, true);
    annularShape.holes.push(holePath);

    const extrudedRingGeo = new THREE.ExtrudeGeometry(annularShape, {
      depth: 0.08,
      bevelEnabled: true,
      bevelThickness: 0.018,
      bevelSize: 0.016,
      bevelSegments: 2,
      curveSegments: 48
    });
    geometries.push(extrudedRingGeo);
    const extrudedRingMesh = new THREE.Mesh(extrudedRingGeo, brassMaterial);
    extrudedRingMesh.rotation.x = Math.PI / 2;
    extrudedRingMesh.position.y = 0.04;
    extrudedRingMesh.castShadow = true;
    extrudedRingMesh.receiveShadow = true;
    ringGroup.add(extrudedRingMesh);

    // Top engraved dial scale face positioned cleanly atop the 3D beveled ring
    const discGeo = new THREE.RingGeometry(cfg.innerR + 0.02, cfg.outerR - 0.02, 48);
    geometries.push(discGeo);

    const dialTex = createAstrolabeDialTexture(cfg.index);
    textures.push(dialTex);

    const discMat = new THREE.MeshStandardMaterial({
      map: dialTex,
      color: 0xd8a64e,
      roughness: 0.28,
      metalness: 0.88,
      transparent: true
    });
    materials.push(discMat);

    const discMesh = new THREE.Mesh(discGeo, discMat);
    discMesh.rotation.x = -Math.PI / 2;
    discMesh.position.y = 0.062;
    ringGroup.add(discMesh);

    // Outer & inner decorative beveled brass borders
    const borderGeo = new THREE.TorusGeometry(cfg.outerR, 0.032, 10, 48);
    geometries.push(borderGeo);
    const borderMesh = new THREE.Mesh(borderGeo, goldAccentMaterial);
    borderMesh.rotation.x = Math.PI / 2;
    borderMesh.position.y = 0.045;
    ringGroup.add(borderMesh);

    const innerBorderGeo = new THREE.TorusGeometry(cfg.innerR, 0.026, 10, 48);
    geometries.push(innerBorderGeo);
    const innerBorderMesh = new THREE.Mesh(innerBorderGeo, goldAccentMaterial);
    innerBorderMesh.rotation.x = Math.PI / 2;
    innerBorderMesh.position.y = 0.045;
    ringGroup.add(innerBorderMesh);

    // Extruded mechanical gear teeth on ALL 3 concentric rings (24 outer, 16 middle, 12 inner)
    if (cfg.index === 0) {
      const toothGeo = new THREE.BoxGeometry(0.13, 0.09, 0.14);
      geometries.push(toothGeo);
      for (let t = 0; t < 24; t++) {
        const tAngle = (t * Math.PI * 2) / 24;
        const tooth = new THREE.Mesh(toothGeo, goldAccentMaterial);
        tooth.position.set(Math.cos(tAngle) * (cfg.outerR + 0.06), 0.02, Math.sin(tAngle) * (cfg.outerR + 0.06));
        tooth.rotation.y = -tAngle;
        ringGroup.add(tooth);
      }
    } else if (cfg.index === 1) {
      const toothGeo = new THREE.BoxGeometry(0.10, 0.08, 0.11);
      geometries.push(toothGeo);
      for (let t = 0; t < 16; t++) {
        const tAngle = (t * Math.PI * 2) / 16;
        const tooth = new THREE.Mesh(toothGeo, goldAccentMaterial);
        tooth.position.set(Math.cos(tAngle) * (cfg.innerR - 0.045), 0.02, Math.sin(tAngle) * (cfg.innerR - 0.045));
        tooth.rotation.y = -tAngle;
        ringGroup.add(tooth);
      }
    } else if (cfg.index === 2) {
      const toothGeo = new THREE.BoxGeometry(0.085, 0.075, 0.095);
      geometries.push(toothGeo);
      for (let t = 0; t < 12; t++) {
        const tAngle = (t * Math.PI * 2) / 12;
        const tooth = new THREE.Mesh(toothGeo, goldAccentMaterial);
        tooth.position.set(Math.cos(tAngle) * (cfg.outerR + 0.045), 0.02, Math.sin(tAngle) * (cfg.outerR + 0.045));
        tooth.rotation.y = -tAngle;
        ringGroup.add(tooth);
      }
    }

    // Indicator needle node on the ring positioned at -cfg.target so when ring.rotation.y === cfg.target,
    // all 3 indicator needles physically align along the front (+Z) Meridian Zero Guide Line!
    const pinGeo = new THREE.ConeGeometry(0.13, 0.34, 16);
    geometries.push(pinGeo);
    const pinMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0x664400,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.95
    });
    materials.push(pinMat);
    pinMaterials.push(pinMat);
    const pinMesh = new THREE.Mesh(pinGeo, pinMat);
    const pinR = cfg.outerR - 0.2;
    pinMesh.position.set(
      -Math.sin(cfg.target) * pinR,
      0.11,
      Math.cos(cfg.target) * pinR
    );
    pinMesh.rotation.order = "YXZ";
    pinMesh.rotation.y = -cfg.target;
    pinMesh.rotation.x = -Math.PI / 2;
    ringGroup.add(pinMesh);

    // Glowing turquoise selection ring indicator
    const selHaloGeo = new THREE.TorusGeometry((cfg.innerR + cfg.outerR) * 0.5, 0.032, 12, 48);
    geometries.push(selHaloGeo);
    const selHaloMat = new THREE.MeshBasicMaterial({
      color: 0x3de0c8,
      transparent: true,
      opacity: cfg.index === 0 ? 0.8 : 0
    });
    materials.push(selHaloMat);
    const selHalo = new THREE.Mesh(selHaloGeo, selHaloMat);
    selHalo.rotation.x = Math.PI / 2;
    selHalo.position.y = 0.08;
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

  // 4 Corner Hydraulic Retractable Locking Bolts
  const boltMeshes: THREE.Mesh[] = [];
  const boltPositions = [
    [-2.5, 0.1, -2.5],
    [2.5, 0.1, -2.5],
    [-2.5, 0.1, 2.5],
    [2.5, 0.1, 2.5]
  ];

  for (const bp of boltPositions) {
    const boltGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.6, 16);
    geometries.push(boltGeo);
    const boltMesh = new THREE.Mesh(boltGeo, goldAccentMaterial);
    boltMesh.position.set(bp[0], bp[1], bp[2]);
    root.add(boltMesh);
    boltMeshes.push(boltMesh);
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
    // Alignment tolerance: ~18 degrees (0.32 radians)
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
      // Gentle jewel pulse
      if (solved) {
        jadeJewelMaterial.emissiveIntensity = 0.8 + Math.sin(_time * 0.005) * 0.3;
        // Retract bolts downward smoothly
        for (const bolt of boltMeshes) {
          if (bolt.position.y > -0.2) {
            bolt.position.y -= _delta * 0.5;
          }
        }
      }
    },
    selectRing: (index: number | null) => {
      selectedIndex = index;
      for (let i = 0; i < selectionHalos.length; i++) {
        const mat = selectionHalos[i].material as THREE.MeshBasicMaterial;
        mat.opacity = i === index ? 0.8 : 0;
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
