import * as THREE from "three";

export type CryptexRing = {
  index: number;
  group: THREE.Group;
  currentAngle: number;
  targetAngle: number;
  options: string[];
  selectedIndex: number;
};

export type CryptexWorkshopHandle = {
  root: THREE.Group;
  rings: CryptexRing[];
  update: (time: number, delta: number) => void;
  selectRing: (index: number | null) => void;
  rotateRing: (index: number, step: 1 | -1) => void;
  getCombination: () => string[];
  isComplete: () => boolean;
  dispose: () => void;
};

function createBronzeTexture(): { diffuse: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#3a2d1f";
  ctx.fillRect(0, 0, 512, 512);

  // Bronze patina specks
  for (let i = 0; i < 2000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = Math.random() * 2 + 1;
    const isVerdigris = Math.random() < 0.25;
    ctx.fillStyle = isVerdigris ? "rgba(42, 133, 119, 0.45)" : "rgba(180, 140, 70, 0.3)";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Lathe concentric metallic scratches
  ctx.strokeStyle = "rgba(220, 180, 100, 0.15)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 20; i++) {
    const y = Math.random() * 512;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  const diffuse = new THREE.CanvasTexture(canvas);

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = 512;
  bumpCanvas.height = 512;
  const bctx = bumpCanvas.getContext("2d")!;
  bctx.fillStyle = "#808080";
  bctx.fillRect(0, 0, 512, 512);

  bctx.strokeStyle = "#252525";
  bctx.lineWidth = 2;
  for (let i = 0; i < 20; i++) {
    const y = Math.random() * 512;
    bctx.beginPath();
    bctx.moveTo(0, y);
    bctx.lineTo(512, y);
    bctx.stroke();
  }

  const bump = new THREE.CanvasTexture(bumpCanvas);
  return { diffuse, bump };
}

function createRuneFaceTexture(rune: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#1e1710";
  ctx.fillRect(0, 0, 128, 128);

  // Border groove
  ctx.strokeStyle = "#5a452c";
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, 116, 116);

  // Golden Inscribed Glyph
  ctx.font = "bold 68px 'Microsoft YaHei', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffd572";
  ctx.shadowColor = "#ffaa00";
  ctx.shadowBlur = 6;
  ctx.fillText(rune, 64, 64);

  return new THREE.CanvasTexture(canvas);
}

const CIPHER_SOLUTION = ["海", "狮", "门", "月"];

const RING_OPTIONS: string[][] = [
  ["山", "海", "川", "洲"],
  ["龙", "狮", "虎", "象"],
  ["关", "门", "户", "阀"],
  ["日", "月", "星", "辰"]
];

export function createCryptexWorkshop(onSolved?: () => void): CryptexWorkshopHandle {
  const root = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  const { diffuse: bronzeTex, bump: bronzeBump } = createBronzeTexture();
  textures.push(bronzeTex, bronzeBump);

  const bronzeMaterial = new THREE.MeshStandardMaterial({
    map: bronzeTex,
    bumpMap: bronzeBump,
    bumpScale: 0.05,
    color: 0x8a6e46,
    roughness: 0.42,
    metalness: 0.82
  });
  materials.push(bronzeMaterial);

  const goldFiligreeMaterial = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    emissive: 0x664400,
    roughness: 0.25,
    metalness: 0.9
  });
  materials.push(goldFiligreeMaterial);

  const innerCoreMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a1510,
    roughness: 0.7,
    metalness: 0.5
  });
  materials.push(innerCoreMaterial);

  // Central Axle
  const axleGeo = new THREE.CylinderGeometry(0.7, 0.7, 6.2, 32);
  geometries.push(axleGeo);
  const axle = new THREE.Mesh(axleGeo, innerCoreMaterial);
  axle.rotation.z = Math.PI / 2;
  root.add(axle);

  // Left & Right Ornate End Caps
  const endCapGeo = new THREE.CylinderGeometry(1.5, 1.6, 0.7, 32);
  geometries.push(endCapGeo);

  const leftCap = new THREE.Mesh(endCapGeo, bronzeMaterial);
  leftCap.rotation.z = Math.PI / 2;
  leftCap.position.x = -2.7;
  root.add(leftCap);

  const rightCap = new THREE.Mesh(endCapGeo, bronzeMaterial);
  rightCap.rotation.z = Math.PI / 2;
  rightCap.position.x = 2.7;
  root.add(rightCap);

  // End cap gold lion crest rings
  const crestRingGeo = new THREE.TorusGeometry(1.3, 0.08, 16, 32);
  geometries.push(crestRingGeo);

  const leftCrest = new THREE.Mesh(crestRingGeo, goldFiligreeMaterial);
  leftCrest.position.x = -2.75;
  leftCrest.rotation.y = Math.PI / 2;
  root.add(leftCrest);

  const rightCrest = new THREE.Mesh(crestRingGeo, goldFiligreeMaterial);
  rightCrest.position.x = 2.75;
  rightCrest.rotation.y = Math.PI / 2;
  root.add(rightCrest);

  // Dual Alignment Meridian Framing Bars around the front-upper reading line (angle = +30°)
  const READ_ANGLE = Math.PI / 6;
  const guideGeo = new THREE.BoxGeometry(4.65, 0.065, 0.16);
  geometries.push(guideGeo);
  const guideMat = new THREE.MeshStandardMaterial({
    color: 0x3de0c8,
    emissive: 0x1d7f73,
    emissiveIntensity: 0.75,
    roughness: 0.2,
    metalness: 0.8
  });
  materials.push(guideMat);
  const upperGuideBar = new THREE.Mesh(guideGeo, guideMat);
  upperGuideBar.position.set(0, 1.14, 0.96);
  upperGuideBar.rotation.x = READ_ANGLE;
  root.add(upperGuideBar);

  const lowerGuideBar = new THREE.Mesh(guideGeo, guideMat);
  lowerGuideBar.position.set(0, 0.20, 1.40);
  lowerGuideBar.rotation.x = READ_ANGLE;
  root.add(lowerGuideBar);

  // 4 Cryptex Dial Rings
  const rings: CryptexRing[] = [];
  const selectionHalos: THREE.Mesh[] = [];
  const ringXPositions = [-1.725, -0.575, 0.575, 1.725];

  for (let r = 0; r < 4; r++) {
    const ringGroup = new THREE.Group();
    ringGroup.position.x = ringXPositions[r];

    // Cylinder ring body
    const bodyGeo = new THREE.CylinderGeometry(1.35, 1.35, 1.0, 32, 1, true);
    geometries.push(bodyGeo);
    const body = new THREE.Mesh(bodyGeo, bronzeMaterial);
    body.rotation.z = Math.PI / 2;
    ringGroup.add(body);

    // Decorative ring borders & 24 Knurled Bronze Bezel Ridges per ring
    const knurlToothGeo = new THREE.BoxGeometry(0.07, 0.055, 0.08);
    geometries.push(knurlToothGeo);
    for (const bOffset of [-0.48, 0.48]) {
      const ringBorderGeo = new THREE.TorusGeometry(1.38, 0.045, 10, 32);
      geometries.push(ringBorderGeo);
      const ringBorder = new THREE.Mesh(ringBorderGeo, goldFiligreeMaterial);
      ringBorder.rotation.y = Math.PI / 2;
      ringBorder.position.x = bOffset;
      ringGroup.add(ringBorder);

      for (let k = 0; k < 24; k++) {
        const kAng = (k * Math.PI * 2) / 24;
        const knurl = new THREE.Mesh(knurlToothGeo, bronzeMaterial);
        knurl.position.set(bOffset, Math.sin(kAng) * 1.41, Math.cos(kAng) * 1.41);
        knurl.rotation.x = kAng;
        ringGroup.add(knurl);
      }
    }

    // Internal Ratchet Cogs & Tumbler Divider Ring at ring interface
    const dividerGeo = new THREE.CylinderGeometry(1.26, 1.26, 0.08, 24);
    geometries.push(dividerGeo);
    const divider = new THREE.Mesh(dividerGeo, innerCoreMaterial);
    divider.rotation.z = Math.PI / 2;
    divider.position.x = 0.52;
    ringGroup.add(divider);

    const ratchetToothGeo = new THREE.BoxGeometry(0.06, 0.12, 0.10);
    geometries.push(ratchetToothGeo);
    for (let rt = 0; rt < 12; rt++) {
      const rtAng = (rt * Math.PI * 2) / 12;
      const rTooth = new THREE.Mesh(ratchetToothGeo, goldFiligreeMaterial);
      rTooth.position.set(0.52, Math.sin(rtAng) * 1.29, Math.cos(rtAng) * 1.29);
      rTooth.rotation.x = rtAng + 0.25;
      ringGroup.add(rTooth);
    }

    // 4 Sunken 3D Bronze Rune Cartouches with Beveled Gold Fillets around the perimeter
    const options = RING_OPTIONS[r];
    const cartoucheBoxGeo = new THREE.BoxGeometry(0.92, 1.02, 0.08);
    const filletRimGeo = new THREE.BoxGeometry(0.98, 1.08, 0.05);
    geometries.push(cartoucheBoxGeo, filletRimGeo);

    for (let f = 0; f < 4; f++) {
      const angle = (f * Math.PI) / 2;
      const runeTex = createRuneFaceTexture(options[f]);
      textures.push(runeTex);

      const facetMat = new THREE.MeshStandardMaterial({
        map: runeTex,
        roughness: 0.36,
        metalness: 0.68
      });
      materials.push(facetMat);

      const facetGroup = new THREE.Group();
      const radius = 1.36;
      facetGroup.position.set(0, Math.sin(angle) * radius, Math.cos(angle) * radius);
      facetGroup.rotation.x = angle;

      // Beveled gold fillet outer rim
      const filletMesh = new THREE.Mesh(filletRimGeo, goldFiligreeMaterial);
      filletMesh.position.z = 0.01;
      facetGroup.add(filletMesh);

      // 3D Sunken bronze cartouche block
      const cartoucheMesh = new THREE.Mesh(cartoucheBoxGeo, bronzeMaterial);
      cartoucheMesh.position.z = 0.025;
      facetGroup.add(cartoucheMesh);

      // Rune glyph plate inset cleanly on the cartouche face
      const facetGeo = new THREE.PlaneGeometry(0.84, 0.94);
      geometries.push(facetGeo);
      const facet = new THREE.Mesh(facetGeo, facetMat);
      facet.position.z = 0.068;
      facetGroup.add(facet);

      ringGroup.add(facetGroup);
    }

    // Initial shuffle: not solved initially, aligned with READ_ANGLE so active rune faces camera
    const initialIndex = (r * 2 + 2) % 4;
    const initialAngle = READ_ANGLE - initialIndex * (Math.PI / 2);
    ringGroup.rotation.x = initialAngle;

    // Glowing turquoise selection ring indicator
    const selHaloGeo = new THREE.TorusGeometry(1.45, 0.036, 12, 36);
    geometries.push(selHaloGeo);
    const selHaloMat = new THREE.MeshBasicMaterial({
      color: 0x3de0c8,
      transparent: true,
      opacity: r === 0 ? 0.85 : 0
    });
    materials.push(selHaloMat);
    const selHalo = new THREE.Mesh(selHaloGeo, selHaloMat);
    selHalo.rotation.y = Math.PI / 2;
    selHalo.position.x = ringXPositions[r];
    root.add(selHalo);
    selectionHalos.push(selHalo);

    root.add(ringGroup);

    rings.push({
      index: r,
      group: ringGroup,
      currentAngle: initialAngle,
      targetAngle: initialAngle,
      options,
      selectedIndex: initialIndex
    });
  }

  let selectedRingIndex: number | null = 0;
  let solved = false;

  // Pedestal stand for cryptex
  const standBaseGeo = new THREE.BoxGeometry(6.6, 0.4, 2.8);
  geometries.push(standBaseGeo);
  const standMat = new THREE.MeshStandardMaterial({
    color: 0x0c1317,
    roughness: 0.6,
    metalness: 0.5
  });
  materials.push(standMat);
  const standBase = new THREE.Mesh(standBaseGeo, standMat);
  standBase.position.y = -1.8;
  root.add(standBase);

  // Stand Cradles
  for (const cx of [-2.4, 2.4]) {
    const cradleGeo = new THREE.CylinderGeometry(1.6, 1.7, 0.3, 16, 1, false, 0, Math.PI);
    geometries.push(cradleGeo);
    const cradle = new THREE.Mesh(cradleGeo, standMat);
    cradle.position.set(cx, -1.0, 0);
    cradle.rotation.z = Math.PI;
    root.add(cradle);
  }

  function checkSolved(): boolean {
    const currentCombination = rings.map((r) => r.options[r.selectedIndex]);
    const matches = currentCombination.every((char, i) => char === CIPHER_SOLUTION[i]);
    if (matches && !solved) {
      solved = true;
      if (onSolved) onSolved();
    }
    return matches;
  }

  return {
    root,
    rings,
    update: (_time: number, delta: number) => {
      // Smoothly interpolate ring rotation towards target angle
      for (const ring of rings) {
        const diff = ring.targetAngle - ring.currentAngle;
        if (Math.abs(diff) > 0.001) {
          ring.currentAngle += diff * Math.min(1, delta * 12);
          ring.group.rotation.x = ring.currentAngle;
        } else {
          ring.currentAngle = ring.targetAngle;
          ring.group.rotation.x = ring.targetAngle;
        }
      }

      // Solved pulse effect on guide bar
      if (solved) {
        guideMat.emissiveIntensity = 0.8 + Math.sin(_time * 0.006) * 0.4;
      }
    },
    selectRing: (index: number | null) => {
      selectedRingIndex = index;
      for (let i = 0; i < selectionHalos.length; i++) {
        const mat = selectionHalos[i].material as THREE.MeshBasicMaterial;
        mat.opacity = i === index ? 0.85 : 0;
      }
    },
    rotateRing: (index: number, step: 1 | -1) => {
      if (index < 0 || index >= rings.length) return;
      const ring = rings[index];

      // Update selected index in circular range [0..3]
      ring.selectedIndex = (ring.selectedIndex + step + 4) % 4;
      ring.targetAngle -= step * (Math.PI / 2);

      checkSolved();
    },
    getCombination: () => {
      return rings.map((r) => r.options[r.selectedIndex]);
    },
    isComplete: () => {
      return solved || checkSolved();
    },
    dispose: () => {
      for (const geo of geometries) geo.dispose();
      for (const mat of materials) mat.dispose();
      for (const tex of textures) tex.dispose();
    }
  };
}
