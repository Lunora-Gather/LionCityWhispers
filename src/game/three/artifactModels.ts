import * as THREE from "three";
import type { ArtifactId } from "../state";
import { getSoftParticleTexture } from "./world/World3DTextures";

export type Artifact3DHandle = {
  root: THREE.Group;
  update: (time: number, delta: number) => void;
  setExploded: (progress: number) => void;
  setUvMode: (enabled: boolean) => void;
  pulseResonance: () => void;
  dispose: () => void;
};

// Generates procedural canvas textures for authentic aged patina, bump maps, and inscription maps
function createStoneTexture(): { diffuse: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  // Diffuse
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#3e3a34";
  ctx.fillRect(0, 0, 512, 512);

  // Weathered basalt grain
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = Math.random() * 2.5 + 0.5;
    const shade = Math.floor(Math.random() * 55 + 45);
    ctx.fillStyle = `rgba(${shade + 5}, ${shade}, ${shade - 5}, 0.35)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ancient inscription grooves in ochre/gold wash
  ctx.strokeStyle = "rgba(200, 160, 80, 0.45)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let row = 60; row < 460; row += 36) {
    ctx.moveTo(35, row);
    for (let col = 35; col < 475; col += 25) {
      ctx.lineTo(col + Math.random() * 10, row + Math.sin(col * 0.1) * 6);
    }
  }
  ctx.stroke();

  const diffuse = new THREE.CanvasTexture(canvas);
  diffuse.wrapS = THREE.RepeatWrapping;
  diffuse.wrapT = THREE.RepeatWrapping;

  // Bump map
  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = 512;
  bumpCanvas.height = 512;
  const bctx = bumpCanvas.getContext("2d")!;
  bctx.fillStyle = "#808080";
  bctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 3000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = Math.random() * 3 + 1;
    const v = Math.random() > 0.5 ? 200 : 60;
    bctx.fillStyle = `rgba(${v}, ${v}, ${v}, 0.4)`;
    bctx.beginPath();
    bctx.arc(x, y, r, 0, Math.PI * 2);
    bctx.fill();
  }

  // Deep carved inscriptions in bump
  bctx.strokeStyle = "#101010";
  bctx.lineWidth = 4;
  for (let row = 60; row < 460; row += 36) {
    bctx.beginPath();
    bctx.moveTo(35, row);
    for (let col = 35; col < 475; col += 25) {
      bctx.lineTo(col + Math.random() * 10, row + Math.sin(col * 0.1) * 6);
    }
    bctx.stroke();
  }

  const bump = new THREE.CanvasTexture(bumpCanvas);
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;

  return { diffuse, bump };
}

function createBronzeTexture(): { diffuse: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#4a3b26";
  ctx.fillRect(0, 0, 512, 512);

  // Verdigris and patina patches
  for (let i = 0; i < 3000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = Math.random() * 3.5 + 1;
    const isGreen = Math.random() > 0.45;
    ctx.fillStyle = isGreen ? "rgba(40, 125, 105, 0.35)" : "rgba(210, 165, 75, 0.25)";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Lathe concentric micro-scratches
  ctx.strokeStyle = "rgba(240, 190, 100, 0.12)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 25; i++) {
    const y = Math.random() * 512;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  const diffuse = new THREE.CanvasTexture(canvas);

  // Bump for repousse relief and filigree
  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = 512;
  bumpCanvas.height = 512;
  const bctx = bumpCanvas.getContext("2d")!;
  bctx.fillStyle = "#808080";
  bctx.fillRect(0, 0, 512, 512);

  // Rivet studs along border
  bctx.fillStyle = "#ffffff";
  bctx.shadowColor = "#000000";
  bctx.shadowBlur = 4;
  for (let s = 16; s < 512; s += 32) {
    bctx.beginPath();
    bctx.arc(s, 16, 6, 0, Math.PI * 2);
    bctx.arc(s, 496, 6, 0, Math.PI * 2);
    bctx.arc(16, s, 6, 0, Math.PI * 2);
    bctx.arc(496, s, 6, 0, Math.PI * 2);
    bctx.fill();
  }

  const bump = new THREE.CanvasTexture(bumpCanvas);

  return { diffuse, bump };
}

function createAstrolabeDialTexture(): { diffuse: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#c89a42";
  ctx.fillRect(0, 0, 512, 512);

  // Radial guilloche lines
  ctx.strokeStyle = "rgba(90, 60, 20, 0.6)";
  ctx.lineWidth = 1.5;
  for (let a = 0; a < 72; a++) {
    const rad = (a * Math.PI) / 36;
    ctx.beginPath();
    ctx.moveTo(256 + Math.cos(rad) * 120, 256 + Math.sin(rad) * 120);
    ctx.lineTo(256 + Math.cos(rad) * 240, 256 + Math.sin(rad) * 240);
    ctx.stroke();
  }

  // Constellation stars
  ctx.fillStyle = "#fff8d0";
  for (let s = 0; s < 40; s++) {
    const r = Math.random() * 180 + 40;
    const theta = Math.random() * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(256 + Math.cos(theta) * r, 256 + Math.sin(theta) * r, Math.random() * 3 + 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const diffuse = new THREE.CanvasTexture(canvas);

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = 512;
  bumpCanvas.height = 512;
  const bctx = bumpCanvas.getContext("2d")!;
  bctx.fillStyle = "#808080";
  bctx.fillRect(0, 0, 512, 512);

  bctx.strokeStyle = "#202020";
  bctx.lineWidth = 2;
  for (let a = 0; a < 72; a++) {
    const rad = (a * Math.PI) / 36;
    bctx.beginPath();
    bctx.moveTo(256 + Math.cos(rad) * 120, 256 + Math.sin(rad) * 120);
    bctx.lineTo(256 + Math.cos(rad) * 240, 256 + Math.sin(rad) * 240);
    bctx.stroke();
  }

  const bump = new THREE.CanvasTexture(bumpCanvas);
  return { diffuse, bump };
}

function createBambooTexture(): { diffuse: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#3a563e";
  ctx.fillRect(0, 0, 256, 512);

  // Longitudinal fibrous grain
  for (let x = 0; x < 256; x += 3) {
    const shade = Math.floor(Math.random() * 30 + 45);
    ctx.strokeStyle = `rgba(${shade}, ${shade + 30}, ${shade}, 0.4)`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }

  // Bamboo node bands
  for (const nodeY of [128, 256, 384]) {
    ctx.fillStyle = "rgba(25, 40, 25, 0.7)";
    ctx.fillRect(0, nodeY - 6, 256, 12);
    ctx.fillStyle = "rgba(180, 195, 120, 0.5)";
    ctx.fillRect(0, nodeY + 6, 256, 3);
  }

  const diffuse = new THREE.CanvasTexture(canvas);

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = 256;
  bumpCanvas.height = 512;
  const bctx = bumpCanvas.getContext("2d")!;
  bctx.fillStyle = "#808080";
  bctx.fillRect(0, 0, 256, 512);

  for (const nodeY of [128, 256, 384]) {
    bctx.fillStyle = "#ffffff";
    bctx.fillRect(0, nodeY - 4, 256, 8);
    bctx.fillStyle = "#303030";
    bctx.fillRect(0, nodeY + 5, 256, 4);
  }

  const bump = new THREE.CanvasTexture(bumpCanvas);

  return { diffuse, bump };
}

// Procedural organic vertex disturbance to turn computer-rigid shapes into weathered archaeological relics
function sculptRelicMesh(geo: THREE.BufferGeometry, noiseScale = 0.08) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const noise = (Math.sin(vx * 6.5) * Math.cos(vy * 6.5) * Math.sin(vz * 6.5)) * noiseScale;
    pos.setXYZ(i, vx + noise, vy + noise, vz + noise);
  }
  geo.computeVertexNormals();
}

export function createArtifact3D(id: ArtifactId): Artifact3DHandle {
  const root = new THREE.Group();
  const movableParts: Array<{ mesh: THREE.Object3D; direction: THREE.Vector3; distance: number }> = [];
  const emissiveMaterials: THREE.MeshStandardMaterial[] = [];
  const uvOverlayMaterials: THREE.MeshBasicMaterial[] = [];
  const chimeTubes: THREE.Group[] = [];
  const harmonicWaveRings: THREE.Mesh[] = [];
  let chimeClapper: THREE.Group | null = null;
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  let resonancePulse = 0;

  if (id === "badang-stone") {
    // 3D Badang Stone Megalith with Organic Weathered Fractures & Kintsugi Veins
    const { diffuse: stoneTex, bump: stoneBump } = createStoneTexture();
    textures.push(stoneTex, stoneBump);

    const stoneMat = new THREE.MeshStandardMaterial({
      map: stoneTex,
      bumpMap: stoneBump,
      bumpScale: 0.08,
      color: 0x948877,
      roughness: 0.88,
      metalness: 0.12
    });
    materials.push(stoneMat);

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffaa00,
      emissiveIntensity: 0.65,
      roughness: 0.18,
      metalness: 0.96
    });
    materials.push(goldMat);
    emissiveMaterials.push(goldMat);

    // Left megalith segment with organic chiseling
    const leftGeo = new THREE.DodecahedronGeometry(1.4, 2);
    leftGeo.scale(0.85, 1.45, 0.7);
    sculptRelicMesh(leftGeo, 0.07);
    geometries.push(leftGeo);
    const leftMesh = new THREE.Mesh(leftGeo, stoneMat);
    leftMesh.position.set(-0.7, 0, 0);
    leftMesh.rotation.set(0.1, 0.3, -0.08);
    leftMesh.castShadow = true;
    leftMesh.receiveShadow = true;
    root.add(leftMesh);
    movableParts.push({ mesh: leftMesh, direction: new THREE.Vector3(-1, 0.2, 0).normalize(), distance: 1.2 });

    // Right megalith segment with organic chiseling
    const rightGeo = new THREE.DodecahedronGeometry(1.3, 2);
    rightGeo.scale(0.8, 1.4, 0.75);
    sculptRelicMesh(rightGeo, 0.07);
    geometries.push(rightGeo);
    const rightMesh = new THREE.Mesh(rightGeo, stoneMat);
    rightMesh.position.set(0.7, 0, 0);
    rightMesh.rotation.set(-0.08, -0.25, 0.1);
    rightMesh.castShadow = true;
    rightMesh.receiveShadow = true;
    root.add(rightMesh);
    movableParts.push({ mesh: rightMesh, direction: new THREE.Vector3(1, -0.1, 0).normalize(), distance: 1.2 });

    // Central ancient core shard
    const coreGeo = new THREE.OctahedronGeometry(0.75, 2);
    coreGeo.scale(0.65, 1.15, 0.65);
    sculptRelicMesh(coreGeo, 0.05);
    geometries.push(coreGeo);
    const coreMesh = new THREE.Mesh(coreGeo, stoneMat);
    coreMesh.position.set(0, 0.2, 0.1);
    coreMesh.castShadow = true;
    root.add(coreMesh);
    movableParts.push({ mesh: coreMesh, direction: new THREE.Vector3(0, 0.8, 1).normalize(), distance: 0.9 });

    const celadonInlayMat = new THREE.MeshStandardMaterial({
      color: 0x3de0c8,
      emissive: 0x188c7a,
      emissiveIntensity: 0.65,
      roughness: 0.2,
      metalness: 0.45
    });
    materials.push(celadonInlayMat);
    emissiveMaterials.push(celadonInlayMat);

    // Surface-conforming multi-branching 3D gold & celadon Kintsugi fracture inlays
    const veinPaths = [
      [
        new THREE.Vector3(-0.42, -1.35, 0.48),
        new THREE.Vector3(-0.28, -0.55, 0.72),
        new THREE.Vector3(-0.36, 0.25, 0.76),
        new THREE.Vector3(-0.18, 1.05, 0.56),
        new THREE.Vector3(-0.08, 1.52, 0.18)
      ],
      [
        new THREE.Vector3(0.38, -1.28, 0.52),
        new THREE.Vector3(0.24, -0.42, 0.74),
        new THREE.Vector3(0.32, 0.38, 0.72),
        new THREE.Vector3(0.16, 1.12, 0.50),
        new THREE.Vector3(0.06, 1.48, -0.15)
      ],
      [
        new THREE.Vector3(-0.78, -0.35, -0.58),
        new THREE.Vector3(-0.22, -0.12, -0.72),
        new THREE.Vector3(0.35, 0.14, -0.68),
        new THREE.Vector3(0.82, 0.45, -0.46)
      ],
      [
        new THREE.Vector3(-0.85, 0.22, 0.44),
        new THREE.Vector3(-0.32, 0.08, 0.68),
        new THREE.Vector3(0.28, -0.06, 0.69),
        new THREE.Vector3(0.84, -0.28, 0.45)
      ]
    ];

    for (let b = 0; b < veinPaths.length; b++) {
      const curve = new THREE.CatmullRomCurve3(veinPaths[b]);
      const veinGeo = new THREE.TubeGeometry(curve, 24, b < 2 ? 0.042 : 0.032, 8, false);
      geometries.push(veinGeo);
      const veinMesh = new THREE.Mesh(veinGeo, b === 2 ? celadonInlayMat : goldMat);
      root.add(veinMesh);
      movableParts.push({
        mesh: veinMesh,
        direction: new THREE.Vector3(0, (b - 1.5) * 0.35, b === 2 ? -0.6 : 0.6).normalize(),
        distance: 0.65
      });
    }

    // Floating archaeological relic dust halo
    const dustGeo = new THREE.BufferGeometry();
    const dustCount = 120;
    const dustPos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const radius = 1.5 + Math.random() * 1.1;
      dustPos[i * 3] = Math.cos(theta) * radius;
      dustPos[i * 3 + 1] = (Math.random() - 0.5) * 2.4;
      dustPos[i * 3 + 2] = Math.sin(theta) * radius;
    }
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
    geometries.push(dustGeo);
    const dustMat = new THREE.PointsMaterial({
      color: 0xffd97d,
      map: getSoftParticleTexture(),
      alphaTest: 0.02,
      depthWrite: false,
      size: 0.09,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });
    materials.push(dustMat);
    const dustParticles = new THREE.Points(dustGeo, dustMat);
    root.add(dustParticles);

    // Hidden UV fluorescent inscription halo ring (visible under UV inspection)
    const uvRingGeo = new THREE.TorusGeometry(1.38, 0.022, 12, 48);
    geometries.push(uvRingGeo);
    const uvRingMat = new THREE.MeshBasicMaterial({
      color: 0x00f2fe,
      transparent: true,
      opacity: 0
    });
    materials.push(uvRingMat);
    uvOverlayMaterials.push(uvRingMat);
    const uvRingMesh = new THREE.Mesh(uvRingGeo, uvRingMat);
    uvRingMesh.rotation.x = Math.PI / 3;
    root.add(uvRingMesh);
  } else if (id === "rune-plaque") {
    // 3D Ancient Lion Gate Bronze Plaque with Pediment, Corner Brackets & High Relief
    const { diffuse: bronzeTex, bump: bronzeBump } = createBronzeTexture();
    textures.push(bronzeTex, bronzeBump);

    const bronzeMat = new THREE.MeshStandardMaterial({
      map: bronzeTex,
      bumpMap: bronzeBump,
      bumpScale: 0.06,
      color: 0xa88652,
      roughness: 0.36,
      metalness: 0.84
    });
    materials.push(bronzeMat);

    const goldTrimMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      roughness: 0.22,
      metalness: 0.92
    });
    materials.push(goldTrimMat);

    const runeGlowMat = new THREE.MeshStandardMaterial({
      color: 0x3de0c8,
      emissive: 0x1db9a4,
      emissiveIntensity: 0.75,
      roughness: 0.2,
      metalness: 0.7
    });
    materials.push(runeGlowMat);
    emissiveMaterials.push(runeGlowMat);

    // Main stele slab
    const slabGeo = new THREE.BoxGeometry(2.1, 2.7, 0.22);
    geometries.push(slabGeo);
    const slabMesh = new THREE.Mesh(slabGeo, bronzeMat);
    slabMesh.castShadow = true;
    slabMesh.receiveShadow = true;
    root.add(slabMesh);

    // Arched pediment crown on top
    const pedimentGeo = new THREE.CylinderGeometry(1.05, 1.05, 0.22, 32, 1, false, 0, Math.PI);
    geometries.push(pedimentGeo);
    const pedimentMesh = new THREE.Mesh(pedimentGeo, bronzeMat);
    pedimentMesh.position.set(0, 1.35, 0);
    pedimentMesh.rotation.z = Math.PI;
    pedimentMesh.rotation.y = Math.PI;
    root.add(pedimentMesh);

    // Ornate decorative border frame with gold fillet
    const frameGeo = new THREE.BoxGeometry(2.35, 2.95, 0.26);
    geometries.push(frameGeo);
    const frameMesh = new THREE.Mesh(frameGeo, bronzeMat);
    frameMesh.position.z = -0.03;
    root.add(frameMesh);
    movableParts.push({ mesh: frameMesh, direction: new THREE.Vector3(0, 0, -1), distance: 0.8 });

    // 4 Corner Brackets with Dome Rivets
    const cornerPositions = [
      [-1.0, 1.3, 0.12],
      [1.0, 1.3, 0.12],
      [-1.0, -1.3, 0.12],
      [1.0, -1.3, 0.12]
    ];
    for (const cp of cornerPositions) {
      const bracketGeo = new THREE.BoxGeometry(0.24, 0.24, 0.08);
      geometries.push(bracketGeo);
      const bracketMesh = new THREE.Mesh(bracketGeo, goldTrimMat);
      bracketMesh.position.set(cp[0], cp[1], cp[2]);
      root.add(bracketMesh);

      const rivetGeo = new THREE.SphereGeometry(0.06, 12, 12);
      geometries.push(rivetGeo);
      const rivetMesh = new THREE.Mesh(rivetGeo, goldTrimMat);
      rivetMesh.position.set(cp[0], cp[1], cp[2] + 0.04);
      root.add(rivetMesh);
    }

    // High-Relief Sculpted Lion Medallion
    const lionGroup = new THREE.Group();
    lionGroup.position.set(0, 0.5, 0.16);

    // Medallion rim
    const rimGeo = new THREE.TorusGeometry(0.68, 0.06, 12, 32);
    geometries.push(rimGeo);
    const rimMesh = new THREE.Mesh(rimGeo, goldTrimMat);
    lionGroup.add(rimMesh);

    // Lion base disc
    const lionDiscGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.12, 32);
    geometries.push(lionDiscGeo);
    const lionDisc = new THREE.Mesh(lionDiscGeo, bronzeMat);
    lionDisc.rotation.x = Math.PI / 2;
    lionGroup.add(lionDisc);

    // 3D Sculpted Lion Cranium, Brow Ridges, Snout & Fangs
    const craniumGeo = new THREE.SphereGeometry(0.32, 16, 16);
    craniumGeo.scale(1.05, 0.95, 0.65);
    geometries.push(craniumGeo);
    const cranium = new THREE.Mesh(craniumGeo, goldTrimMat);
    cranium.position.set(0, 0.06, 0.08);
    lionGroup.add(cranium);

    const snoutGeo = new THREE.BoxGeometry(0.34, 0.24, 0.22);
    geometries.push(snoutGeo);
    const snout = new THREE.Mesh(snoutGeo, runeGlowMat);
    snout.position.set(0, -0.06, 0.16);
    lionGroup.add(snout);

    const browGeo = new THREE.BoxGeometry(0.18, 0.07, 0.14);
    geometries.push(browGeo);
    for (const bx of [-0.12, 0.12]) {
      const brow = new THREE.Mesh(browGeo, bronzeMat);
      brow.position.set(bx, 0.14, 0.20);
      brow.rotation.z = bx < 0 ? 0.22 : -0.22;
      lionGroup.add(brow);
    }

    // Radiating sculpted mane volute curls & tufts
    const curlGeo = new THREE.TorusGeometry(0.11, 0.038, 8, 14, Math.PI * 1.4);
    geometries.push(curlGeo);
    for (let m = 0; m < 12; m++) {
      const angle = (m * Math.PI * 2) / 12;
      const tuft = new THREE.Mesh(curlGeo, goldTrimMat);
      tuft.position.set(Math.cos(angle) * 0.50, Math.sin(angle) * 0.50, 0.08);
      tuft.rotation.z = angle;
      lionGroup.add(tuft);
    }

    root.add(lionGroup);
    movableParts.push({ mesh: lionGroup, direction: new THREE.Vector3(0, 0, 1), distance: 0.9 });

    // Four ancient inscription cartouches with beveled sunken bronze frames, gold fillets & engraved cipher runes
    const plaqueRunes = ["海", "狮", "门", "月"];
    const cartFrameGeo = new THREE.BoxGeometry(0.44, 0.50, 0.07);
    const cartFilletGeo = new THREE.BoxGeometry(0.47, 0.53, 0.04);
    const cartGeo = new THREE.BoxGeometry(0.36, 0.42, 0.09);
    const runePlaneGeo = new THREE.PlaneGeometry(0.32, 0.36);
    geometries.push(cartFrameGeo, cartFilletGeo, cartGeo, runePlaneGeo);
    for (let c = 0; c < 4; c++) {
      const cartGroup = new THREE.Group();
      cartGroup.position.set(-0.66 + c * 0.44, -0.65, 0.13);

      const fillet = new THREE.Mesh(cartFilletGeo, goldTrimMat);
      cartGroup.add(fillet);

      const frame = new THREE.Mesh(cartFrameGeo, bronzeMat);
      frame.position.z = 0.015;
      cartGroup.add(frame);

      const cartMesh = new THREE.Mesh(cartGeo, runeGlowMat);
      cartMesh.position.z = 0.03;
      cartGroup.add(cartMesh);

      const rCanvas = document.createElement("canvas");
      rCanvas.width = 128;
      rCanvas.height = 128;
      const rCtx = rCanvas.getContext("2d")!;
      rCtx.fillStyle = "#0e221f";
      rCtx.fillRect(0, 0, 128, 128);
      rCtx.strokeStyle = "#3de0c8";
      rCtx.lineWidth = 4;
      rCtx.strokeRect(8, 8, 112, 112);
      rCtx.font = "bold 68px 'Microsoft YaHei', sans-serif";
      rCtx.textAlign = "center";
      rCtx.textBaseline = "middle";
      rCtx.fillStyle = "#ffe596";
      rCtx.shadowColor = "#3de0c8";
      rCtx.shadowBlur = 10;
      rCtx.fillText(plaqueRunes[c], 64, 66);
      const rTex = new THREE.CanvasTexture(rCanvas);
      textures.push(rTex);
      const rMat = new THREE.MeshBasicMaterial({ map: rTex });
      materials.push(rMat);
      const runePlane = new THREE.Mesh(runePlaneGeo, rMat);
      runePlane.position.z = 0.078;
      cartGroup.add(runePlane);

      root.add(cartGroup);
      movableParts.push({
        mesh: cartGroup,
        direction: new THREE.Vector3(-0.66 + c * 0.44, -0.65, 0.8).normalize(),
        distance: 0.7
      });
    }

    // UV fluorescent meridian seal ring around the Lion Medallion
    const uvSealGeo = new THREE.TorusGeometry(0.84, 0.02, 10, 48);
    geometries.push(uvSealGeo);
    const uvSealMat = new THREE.MeshBasicMaterial({
      color: 0x00f2fe,
      transparent: true,
      opacity: 0
    });
    materials.push(uvSealMat);
    uvOverlayMaterials.push(uvSealMat);
    const uvSealMesh = new THREE.Mesh(uvSealGeo, uvSealMat);
    uvSealMesh.position.set(0, 0.5, 0.22);
    root.add(uvSealMesh);
  } else if (id === "harbor-seal") {
    // 3D Concentric Astrolabe and Harbor Mechanism Seal with Physical Gear Teeth
    const { diffuse: dialTex, bump: dialBump } = createAstrolabeDialTexture();
    textures.push(dialTex, dialBump);

    const brassMat = new THREE.MeshStandardMaterial({
      map: dialTex,
      bumpMap: dialBump,
      bumpScale: 0.05,
      color: 0xd4a246,
      roughness: 0.3,
      metalness: 0.92
    });
    materials.push(brassMat);

    const darkBrassMat = new THREE.MeshStandardMaterial({
      color: 0x8a6324,
      roughness: 0.4,
      metalness: 0.85
    });
    materials.push(darkBrassMat);

    const rubyGlowMat = new THREE.MeshStandardMaterial({
      color: 0xe6291a,
      emissive: 0x99180d,
      emissiveIntensity: 0.8,
      roughness: 0.1,
      metalness: 0.4
    });
    materials.push(rubyGlowMat);
    emissiveMaterials.push(rubyGlowMat);

    // Outer astronomical navigation ring with true 3D beveled annular plate & physical gear teeth
    const outerGroup = new THREE.Group();
    const outerRingShape = new THREE.Shape();
    outerRingShape.absarc(0, 0, 1.48, 0, Math.PI * 2, false);
    const outerRingHole = new THREE.Path();
    outerRingHole.absarc(0, 0, 1.24, 0, Math.PI * 2, true);
    outerRingShape.holes.push(outerRingHole);

    const outerExtrudeGeo = new THREE.ExtrudeGeometry(outerRingShape, {
      depth: 0.14,
      bevelEnabled: true,
      bevelThickness: 0.025,
      bevelSize: 0.02,
      bevelSegments: 2,
      curveSegments: 48
    });
    geometries.push(outerExtrudeGeo);
    const outerRingMesh = new THREE.Mesh(outerExtrudeGeo, brassMat);
    outerRingMesh.position.z = -0.07;
    outerGroup.add(outerRingMesh);

    const outerBezelGeo = new THREE.TorusGeometry(1.48, 0.035, 10, 48);
    geometries.push(outerBezelGeo);
    const outerBezel = new THREE.Mesh(outerBezelGeo, darkBrassMat);
    outerBezel.position.z = 0.07;
    outerGroup.add(outerBezel);

    // 24 extruded brass spur gear teeth
    const outerToothGeo = new THREE.BoxGeometry(0.12, 0.14, 0.14);
    geometries.push(outerToothGeo);
    for (let t = 0; t < 24; t++) {
      const angle = (t * Math.PI * 2) / 24;
      const tooth = new THREE.Mesh(outerToothGeo, darkBrassMat);
      tooth.position.set(Math.cos(angle) * 1.54, Math.sin(angle) * 1.54, 0);
      tooth.rotation.z = angle;
      outerGroup.add(tooth);
    }
    root.add(outerGroup);
    movableParts.push({ mesh: outerGroup, direction: new THREE.Vector3(0, 0, -1), distance: 0.7 });

    // Intermediate tidal gear ring with true 3D beveled annular plate
    const midGroup = new THREE.Group();
    midGroup.position.z = 0.08;
    const midRingShape = new THREE.Shape();
    midRingShape.absarc(0, 0, 1.16, 0, Math.PI * 2, false);
    const midRingHole = new THREE.Path();
    midRingHole.absarc(0, 0, 0.92, 0, Math.PI * 2, true);
    midRingShape.holes.push(midRingHole);

    const midExtrudeGeo = new THREE.ExtrudeGeometry(midRingShape, {
      depth: 0.12,
      bevelEnabled: true,
      bevelThickness: 0.022,
      bevelSize: 0.018,
      bevelSegments: 2,
      curveSegments: 40
    });
    geometries.push(midExtrudeGeo);
    const midRingMesh = new THREE.Mesh(midExtrudeGeo, brassMat);
    midRingMesh.position.z = -0.06;
    midGroup.add(midRingMesh);

    // 16 inner teeth
    const midToothGeo = new THREE.BoxGeometry(0.09, 0.11, 0.12);
    geometries.push(midToothGeo);
    for (let t = 0; t < 16; t++) {
      const angle = (t * Math.PI * 2) / 16;
      const tooth = new THREE.Mesh(midToothGeo, darkBrassMat);
      tooth.position.set(Math.cos(angle) * 0.88, Math.sin(angle) * 0.88, 0);
      tooth.rotation.z = angle;
      midGroup.add(tooth);
    }
    root.add(midGroup);
    movableParts.push({ mesh: midGroup, direction: new THREE.Vector3(0, 0, 0.5), distance: 0.8 });

    // Inner mechanical astrolabe quadrant dial
    const dialGeo = new THREE.CylinderGeometry(0.74, 0.74, 0.18, 36);
    geometries.push(dialGeo);
    const dialMesh = new THREE.Mesh(dialGeo, brassMat);
    dialMesh.rotation.x = Math.PI / 2;
    root.add(dialMesh);

    // Faceted ruby cabochon core with 8-prong gold bezel
    const rubyGroup = new THREE.Group();
    rubyGroup.position.z = 0.12;

    const coreGeo = new THREE.DodecahedronGeometry(0.36, 1);
    geometries.push(coreGeo);
    const coreMesh = new THREE.Mesh(coreGeo, rubyGlowMat);
    rubyGroup.add(coreMesh);

    for (let p = 0; p < 8; p++) {
      const angle = (p * Math.PI * 2) / 8;
      const prongGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.28, 8);
      geometries.push(prongGeo);
      const prong = new THREE.Mesh(prongGeo, darkBrassMat);
      prong.position.set(Math.cos(angle) * 0.35, Math.sin(angle) * 0.35, 0.06);
      prong.rotation.z = angle;
      rubyGroup.add(prong);
    }
    root.add(rubyGroup);
    movableParts.push({ mesh: rubyGroup, direction: new THREE.Vector3(0, 0, 1), distance: 1.1 });

    // 4 Cardinal Pointer Pins with Arrowheads
    for (let p = 0; p < 4; p++) {
      const angle = (p * Math.PI) / 2;
      const pinGroup = new THREE.Group();
      pinGroup.position.set(Math.cos(angle) * 1.35, Math.sin(angle) * 1.35, 0.06);
      pinGroup.rotation.z = angle - Math.PI / 2;

      const pinGeo = new THREE.ConeGeometry(0.12, 0.45, 12);
      geometries.push(pinGeo);
      const pinMesh = new THREE.Mesh(pinGeo, rubyGlowMat);
      pinGroup.add(pinMesh);

      const shaftGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.4, 8);
      geometries.push(shaftGeo);
      const shaft = new THREE.Mesh(shaftGeo, darkBrassMat);
      shaft.position.y = -0.3;
      pinGroup.add(shaft);

      root.add(pinGroup);
      movableParts.push({
        mesh: pinGroup,
        direction: new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0.2).normalize(),
        distance: 0.8
      });
    }
  } else {
    // 3D Sacred Bamboo Spirit Chime with Bulging Joint Nodes, Bi-disc Jade Ring & Braided Cords
    const { diffuse: bambooTex, bump: bambooBump } = createBambooTexture();
    textures.push(bambooTex, bambooBump);

    const bambooMat = new THREE.MeshStandardMaterial({
      map: bambooTex,
      bumpMap: bambooBump,
      bumpScale: 0.06,
      color: 0x4f7258,
      roughness: 0.62,
      metalness: 0.08
    });
    materials.push(bambooMat);

    const jadeMat = new THREE.MeshStandardMaterial({
      color: 0x2bc7ab,
      emissive: 0x12705f,
      emissiveIntensity: 0.72,
      roughness: 0.12,
      metalness: 0.35
    });
    materials.push(jadeMat);
    emissiveMaterials.push(jadeMat);

    const brassBellMat = new THREE.MeshStandardMaterial({
      color: 0xebbe56,
      roughness: 0.25,
      metalness: 0.9
    });
    materials.push(brassBellMat);

    const silkCordMat = new THREE.MeshStandardMaterial({
      color: 0xaa2222,
      roughness: 0.7,
      metalness: 0.1
    });
    materials.push(silkCordMat);

    // Crown: True Flat Carved Chinese/Nanyang Jade Bi-disc Ring with Beveled Chamfers & Ruyi Relief
    const crownGroup = new THREE.Group();
    crownGroup.position.y = 1.35;

    const biShape = new THREE.Shape();
    biShape.absarc(0, 0, 0.96, 0, Math.PI * 2, false);
    const biHole = new THREE.Path();
    biHole.absarc(0, 0, 0.42, 0, Math.PI * 2, true);
    biShape.holes.push(biHole);

    const jadeCrownGeo = new THREE.ExtrudeGeometry(biShape, {
      depth: 0.12,
      bevelEnabled: true,
      bevelThickness: 0.028,
      bevelSize: 0.025,
      bevelSegments: 2,
      curveSegments: 40
    });
    geometries.push(jadeCrownGeo);
    const crownMesh = new THREE.Mesh(jadeCrownGeo, jadeMat);
    crownMesh.rotation.x = Math.PI / 2;
    crownMesh.position.y = 0.06;
    crownGroup.add(crownMesh);

    // Gold Filigree Inner & Outer Rim Collars + 4 Carved Ruyi Cloud Bosses
    const innerRimGeo = new THREE.TorusGeometry(0.42, 0.028, 10, 32);
    const outerRimGeo = new THREE.TorusGeometry(0.96, 0.028, 10, 40);
    const ruyiBossGeo = new THREE.TorusGeometry(0.11, 0.026, 8, 16, Math.PI * 1.35);
    geometries.push(innerRimGeo, outerRimGeo, ruyiBossGeo);

    const innerRim = new THREE.Mesh(innerRimGeo, brassBellMat);
    innerRim.rotation.x = Math.PI / 2;
    crownGroup.add(innerRim);

    const outerRim = new THREE.Mesh(outerRimGeo, brassBellMat);
    outerRim.rotation.x = Math.PI / 2;
    crownGroup.add(outerRim);

    for (let rb = 0; rb < 4; rb++) {
      const rAng = (rb * Math.PI) / 2;
      const boss = new THREE.Mesh(ruyiBossGeo, brassBellMat);
      boss.rotation.x = Math.PI / 2;
      boss.rotation.z = rAng;
      boss.position.set(Math.cos(rAng) * 0.69, 0.08, Math.sin(rAng) * 0.69);
      crownGroup.add(boss);
    }

    root.add(crownGroup);
    movableParts.push({ mesh: crownGroup, direction: new THREE.Vector3(0, 1, 0), distance: 0.9 });

    // 5 Resonant Bamboo Chime Tubes with Flared Culm Nodes & Natural Diaphragms
    const lengths = [1.7, 2.1, 2.4, 1.9, 1.5];
    const nodeFlaredGeo = new THREE.CylinderGeometry(0.148, 0.148, 0.045, 16);
    const diaphragmGeo = new THREE.CylinderGeometry(0.122, 0.122, 0.02, 16);
    geometries.push(nodeFlaredGeo, diaphragmGeo);

    for (let t = 0; t < 5; t++) {
      const angle = (t * Math.PI * 2) / 5;
      const len = lengths[t];
      const radius = 0.55;

      const tubeGroup = new THREE.Group();
      tubeGroup.position.set(Math.cos(angle) * radius, 0.3 - len / 2, Math.sin(angle) * radius);

      // Main cylinder body
      const tubeGeo = new THREE.CylinderGeometry(0.12, 0.13, len, 16, 1, true);
      geometries.push(tubeGeo);
      const tubeMesh = new THREE.Mesh(tubeGeo, bambooMat);
      tubeMesh.castShadow = true;
      tubeGroup.add(tubeMesh);

      // Flared organic bamboo culm nodes & brass resonance bands
      const numNodes = Math.floor(len / 0.75);
      for (let n = 1; n <= numNodes; n++) {
        const ny = -len / 2 + (n * len) / (numNodes + 1);
        const flaredNode = new THREE.Mesh(nodeFlaredGeo, bambooMat);
        flaredNode.position.y = ny;
        tubeGroup.add(flaredNode);

        const diaphragm = new THREE.Mesh(diaphragmGeo, bambooMat);
        diaphragm.position.y = ny;
        tubeGroup.add(diaphragm);

        const nodeRingGeo = new THREE.TorusGeometry(0.145, 0.018, 8, 16);
        geometries.push(nodeRingGeo);
        const nodeRing = new THREE.Mesh(nodeRingGeo, brassBellMat);
        nodeRing.rotation.x = Math.PI / 2;
        nodeRing.position.y = ny;
        tubeGroup.add(nodeRing);
      }

      // Red silk cord hanging continuously from jade crown (y = 1.35) to tube top (y = 0.30)
      const cordGeo = new THREE.CylinderGeometry(0.016, 0.016, 1.08, 8);
      geometries.push(cordGeo);
      const cordMesh = new THREE.Mesh(cordGeo, silkCordMat);
      cordMesh.position.set(0, len / 2 + 0.54, 0);
      tubeGroup.add(cordMesh);

      root.add( tubeGroup );
      chimeTubes.push(tubeGroup);
      movableParts.push({
        mesh: tubeGroup,
        direction: new THREE.Vector3(Math.cos(angle), -0.4, Math.sin(angle)).normalize(),
        distance: 1.1
      });
    }

    // Central Brass Acoustic Clapper with Hanging Gold Wind-Catcher Blade
    const clapperGroup = new THREE.Group();
    clapperGroup.position.set(0, -0.4, 0);
    chimeClapper = clapperGroup;

    const clapperGeo = new THREE.SphereGeometry(0.24, 24, 24);
    geometries.push(clapperGeo);
    const clapperMesh = new THREE.Mesh(clapperGeo, brassBellMat);
    clapperGroup.add(clapperMesh);

    // Gold talisman pendant blade dangling below
    const pendantGeo = new THREE.BoxGeometry(0.16, 0.65, 0.02);
    geometries.push(pendantGeo);
    const pendantMesh = new THREE.Mesh(pendantGeo, brassBellMat);
    pendantMesh.position.y = -0.55;
    clapperGroup.add(pendantMesh);

    root.add(clapperGroup);
    movableParts.push({ mesh: clapperGroup, direction: new THREE.Vector3(0, -1, 0), distance: 0.7 });

    // Floating harmonic wave rings
    for (let r = 0; r < 2; r++) {
      const waveGeo = new THREE.TorusGeometry(0.95 + r * 0.35, 0.02, 8, 32);
      geometries.push(waveGeo);
      const waveMesh = new THREE.Mesh(waveGeo, jadeMat);
      waveMesh.rotation.x = Math.PI / 2;
      waveMesh.position.y = -0.4 + r * 0.4;
      root.add(waveMesh);
      harmonicWaveRings.push(waveMesh);
    }
  }

  // Store initial local positions for exploded-view animations
  const basePositions = movableParts.map((item) => item.mesh.position.clone());

  return {
    root,
    update: (time: number, delta: number) => {
      if (resonancePulse > 0) {
        resonancePulse = Math.max(0, resonancePulse - delta * 0.0018);
        const env = Math.sin(resonancePulse * Math.PI);
        const scale = 1 + Math.sin(resonancePulse * Math.PI * 3) * 0.06 * env;
        root.scale.set(scale, scale, scale);

        // Physical chime tube & clapper oscillation during acoustic resonance
        if (chimeClapper) {
          chimeClapper.rotation.z = Math.sin(time * 0.018) * 0.28 * env;
          chimeClapper.rotation.x = Math.cos(time * 0.014) * 0.22 * env;
        }
        for (let i = 0; i < chimeTubes.length; i++) {
          const tube = chimeTubes[i];
          tube.rotation.z = Math.sin(time * 0.022 + i * 1.25) * 0.12 * env;
          tube.rotation.x = Math.cos(time * 0.019 + i * 1.25) * 0.10 * env;
        }
        for (let r = 0; r < harmonicWaveRings.length; r++) {
          const ring = harmonicWaveRings[r];
          const rippleScale = 1 + ((1 - resonancePulse + r * 0.35) % 1) * 0.45 * env;
          ring.scale.set(rippleScale, rippleScale, 1);
        }
      } else {
        if (chimeClapper) {
          chimeClapper.rotation.set(0, 0, 0);
        }
        for (let i = 0; i < chimeTubes.length; i++) {
          chimeTubes[i].rotation.set(0, 0, 0);
        }
        for (let r = 0; r < harmonicWaveRings.length; r++) {
          harmonicWaveRings[r].scale.set(1, 1, 1);
        }
      }
    },
    setExploded: (progress: number) => {
      const p = Math.min(1, Math.max(0, progress));
      for (let i = 0; i < movableParts.length; i++) {
        const item = movableParts[i];
        const base = basePositions[i];
        item.mesh.position.copy(base).addScaledVector(item.direction, item.distance * p);
      }
    },
    setUvMode: (enabled: boolean) => {
      for (const mat of emissiveMaterials) {
        mat.emissiveIntensity = enabled ? 2.1 : 0.65;
      }
      for (const uvMat of uvOverlayMaterials) {
        uvMat.opacity = enabled ? 0.88 : 0;
      }
    },
    pulseResonance: () => {
      resonancePulse = 1.0;
    },
    dispose: () => {
      for (const geo of geometries) {
        geo.dispose();
      }
      for (const mat of materials) {
        mat.dispose();
      }
      for (const tex of textures) {
        tex.dispose();
      }
    }
  };
}
