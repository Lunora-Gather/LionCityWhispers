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

// Warm terracotta-ochre riverbed sandstone with stratified sedimentary bands & incised Kawi script rows
function createStoneTexture(): { diffuse: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, "#9b6447");
  grad.addColorStop(0.38, "#ad7453");
  grad.addColorStop(0.72, "#8c573d");
  grad.addColorStop(1, "#9f694b");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Subtle diagonal sedimentary strata bands
  for (let band = -120; band < 620; band += 26) {
    ctx.strokeStyle = band % 52 === 0 ? "rgba(196, 144, 104, 0.18)" : "rgba(74, 41, 26, 0.16)";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(0, band);
    ctx.lineTo(512, band + 68);
    ctx.stroke();
  }

  // Fine quartz & ironstone mineral grain
  for (let i = 0; i < 3200; i++) {
    const x = (i * 137.5) % 512;
    const y = ((i * 293.7) % 512 + Math.sin(i) * 9 + 512) % 512;
    const r = (i % 3) * 0.7 + 0.6;
    const warm = 120 + (i % 75);
    ctx.fillStyle = i % 5 === 0 ? "rgba(235, 198, 152, 0.25)" : `rgba(${warm}, ${Math.floor(warm * 0.66)}, ${Math.floor(warm * 0.46)}, 0.24)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = 512;
  bumpCanvas.height = 512;
  const bctx = bumpCanvas.getContext("2d")!;
  bctx.fillStyle = "#848484";
  bctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 2200; i++) {
    const x = (i * 173.3) % 512;
    const y = (i * 311.9) % 512;
    const v = i % 2 === 0 ? 158 : 102;
    bctx.fillStyle = `rgba(${v}, ${v}, ${v}, 0.28)`;
    bctx.beginPath();
    bctx.arc(x, y, 1.4, 0, Math.PI * 2);
    bctx.fill();
  }

  // Carved horizontal Kawi / Old Javanese paleographic inscription rows
  for (let row = 42; row < 476; row += 28) {
    // Faint ruled mason's guideline
    ctx.strokeStyle = "rgba(62, 33, 20, 0.28)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(24, row - 9);
    ctx.lineTo(488, row - 9);
    ctx.stroke();

    for (let col = 28; col < 476; col += 22) {
      const seed = row * 31 + col * 17;
      const glyphType = seed % 5;
      // Sunlit lower bevel highlight
      ctx.strokeStyle = "rgba(238, 196, 148, 0.52)";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(col + 8, row + 1.5, 6.5, 0.2, Math.PI * 1.35);
      ctx.stroke();

      // Recessed dark cinnabar-shadowed Kawi glyph stroke
      ctx.strokeStyle = "rgba(56, 26, 15, 0.78)";
      ctx.lineWidth = 2.4;
      bctx.strokeStyle = "#1c1c1c";
      bctx.lineWidth = 3.4;

      for (const targetCtx of [ctx, bctx]) {
        targetCtx.beginPath();
        if (glyphType === 0) {
          targetCtx.arc(col + 8, row, 6, 0.15, Math.PI * 1.55);
          targetCtx.moveTo(col + 14, row - 6);
          targetCtx.lineTo(col + 14, row + 7);
        } else if (glyphType === 1) {
          targetCtx.moveTo(col + 3, row + 6);
          targetCtx.lineTo(col + 5, row - 6);
          targetCtx.lineTo(col + 12, row - 6);
          targetCtx.lineTo(col + 14, row + 6);
          targetCtx.moveTo(col + 8, row - 6);
          targetCtx.lineTo(col + 8, row + 4);
        } else if (glyphType === 2) {
          targetCtx.arc(col + 6, row - 1, 4.5, 0, Math.PI * 1.8);
          targetCtx.moveTo(col + 11, row - 5);
          targetCtx.lineTo(col + 15, row + 6);
        } else if (glyphType === 3) {
          targetCtx.moveTo(col + 2, row - 5);
          targetCtx.lineTo(col + 15, row - 5);
          targetCtx.moveTo(col + 7, row - 5);
          targetCtx.lineTo(col + 5, row + 6);
          targetCtx.lineTo(col + 13, row + 6);
        } else {
          targetCtx.arc(col + 9, row + 1, 5.5, Math.PI * 0.6, Math.PI * 2.1);
          targetCtx.moveTo(col + 5, row - 7);
          targetCtx.lineTo(col + 13, row - 7);
        }
        targetCtx.stroke();
      }
    }
  }

  const diffuse = new THREE.CanvasTexture(canvas);
  diffuse.wrapS = THREE.RepeatWrapping;
  diffuse.wrapT = THREE.RepeatWrapping;
  diffuse.repeat.set(0.45, 0.45);

  const bump = new THREE.CanvasTexture(bumpCanvas);
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(0.45, 0.45);

  return { diffuse, bump };
}

function createBronzeTexture(): { diffuse: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  const grad = ctx.createRadialGradient(256, 220, 40, 256, 256, 340);
  grad.addColorStop(0, "#7c6038");
  grad.addColorStop(0.6, "#5d4628");
  grad.addColorStop(1, "#3f301b");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Subtle verdigris & warm burnished bronze highlights
  for (let i = 0; i < 2400; i++) {
    const x = (i * 191.7) % 512;
    const y = (i * 277.3) % 512;
    const r = (i % 4) * 0.8 + 1.0;
    ctx.fillStyle = i % 4 === 0 ? "rgba(48, 138, 114, 0.24)" : "rgba(224, 180, 96, 0.22)";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fine brushed satin grain
  ctx.strokeStyle = "rgba(245, 204, 125, 0.1)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 36; i++) {
    const y = i * 14 + 6;
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

  bctx.strokeStyle = "#b5b5b5";
  bctx.lineWidth = 2;
  for (let r = 48; r < 240; r += 32) {
    bctx.beginPath();
    bctx.arc(256, 256, r, 0, Math.PI * 2);
    bctx.stroke();
  }

  const bump = new THREE.CanvasTexture(bumpCanvas);
  return { diffuse, bump };
}

function createAstrolabeDialTexture(): { diffuse: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  const grad = ctx.createRadialGradient(256, 256, 30, 256, 256, 256);
  grad.addColorStop(0, "#e5be6b");
  grad.addColorStop(0.65, "#cda049");
  grad.addColorStop(1, "#9d742c");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Concentric engraved latitude circles
  for (const r of [92, 136, 182, 222, 242]) {
    ctx.strokeStyle = "rgba(72, 46, 14, 0.65)";
    ctx.lineWidth = r === 182 ? 2.5 : 1.4;
    ctx.beginPath();
    ctx.arc(256, 256, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 72 precision degree graduations
  for (let a = 0; a < 72; a++) {
    const rad = (a * Math.PI) / 36;
    const major = a % 6 === 0;
    const inner = major ? 184 : 206;
    ctx.strokeStyle = major ? "rgba(52, 31, 8, 0.85)" : "rgba(78, 50, 16, 0.55)";
    ctx.lineWidth = major ? 2.4 : 1.2;
    ctx.beginPath();
    ctx.moveTo(256 + Math.cos(rad) * inner, 256 + Math.sin(rad) * inner);
    ctx.lineTo(256 + Math.cos(rad) * 240, 256 + Math.sin(rad) * 240);
    ctx.stroke();
  }

  const diffuse = new THREE.CanvasTexture(canvas);

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = 512;
  bumpCanvas.height = 512;
  const bctx = bumpCanvas.getContext("2d")!;
  bctx.fillStyle = "#808080";
  bctx.fillRect(0, 0, 512, 512);

  bctx.strokeStyle = "#262626";
  for (let a = 0; a < 72; a++) {
    const rad = (a * Math.PI) / 36;
    const inner = a % 6 === 0 ? 184 : 206;
    bctx.lineWidth = a % 6 === 0 ? 2.8 : 1.4;
    bctx.beginPath();
    bctx.moveTo(256 + Math.cos(rad) * inner, 256 + Math.sin(rad) * inner);
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

  const grad = ctx.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0, "#688d59");
  grad.addColorStop(0.35, "#8ab072");
  grad.addColorStop(0.7, "#769d63");
  grad.addColorStop(1, "#5e8250");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 512);

  // Siliceous vascular bamboo fibers
  for (let x = 0; x < 256; x += 2) {
    const delta = ((x * 29) % 26) - 13;
    ctx.strokeStyle = delta > 0 ? `rgba(182, 212, 140, 0.26)` : `rgba(48, 76, 42, 0.24)`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }

  // Natural culm node rings
  for (const nodeY of [136, 272, 408]) {
    ctx.fillStyle = "rgba(44, 62, 34, 0.62)";
    ctx.fillRect(0, nodeY - 5, 256, 10);
    ctx.fillStyle = "rgba(216, 224, 156, 0.55)";
    ctx.fillRect(0, nodeY + 5, 256, 3);
  }

  const diffuse = new THREE.CanvasTexture(canvas);

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = 256;
  bumpCanvas.height = 512;
  const bctx = bumpCanvas.getContext("2d")!;
  bctx.fillStyle = "#808080";
  bctx.fillRect(0, 0, 256, 512);

  for (let x = 0; x < 256; x += 4) {
    bctx.strokeStyle = x % 8 === 0 ? "#969696" : "#6c6c6c";
    bctx.lineWidth = 1;
    bctx.beginPath();
    bctx.moveTo(x, 0);
    bctx.lineTo(x, 512);
    bctx.stroke();
  }

  const bump = new THREE.CanvasTexture(bumpCanvas);
  return { diffuse, bump };
}

function createJadeCloudTexture(): { diffuse: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;

  const grad = ctx.createRadialGradient(128, 128, 24, 128, 128, 132);
  grad.addColorStop(0, "#6ef0cf");
  grad.addColorStop(0.55, "#36c9a5");
  grad.addColorStop(1, "#1e8f75");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  // Translucent emerald jadeite mottling
  for (let i = 0; i < 420; i++) {
    const x = (i * 97.3) % 256;
    const y = (i * 151.7) % 256;
    ctx.fillStyle = i % 3 === 0 ? "rgba(205, 255, 238, 0.16)" : "rgba(18, 108, 86, 0.15)";
    ctx.beginPath();
    ctx.arc(x, y, (i % 6) + 3, 0, Math.PI * 2);
    ctx.fill();
  }

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = 256;
  bumpCanvas.height = 256;
  const bctx = bumpCanvas.getContext("2d")!;
  bctx.fillStyle = "#808080";
  bctx.fillRect(0, 0, 256, 256);

  // Carved archaic yunwen cloud-scroll spirals
  for (let s = 0; s < 8; s++) {
    const ang = (s * Math.PI) / 4;
    const cx = 128 + Math.cos(ang) * 84;
    const cy = 128 + Math.sin(ang) * 84;
    ctx.strokeStyle = "rgba(216, 255, 242, 0.45)";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(cx, cy, 16, ang, ang + Math.PI * 1.65);
    ctx.stroke();

    bctx.strokeStyle = "#d8d8d8";
    bctx.lineWidth = 3;
    bctx.beginPath();
    bctx.arc(cx, cy, 16, ang, ang + Math.PI * 1.65);
    bctx.stroke();
  }

  return {
    diffuse: new THREE.CanvasTexture(canvas),
    bump: new THREE.CanvasTexture(bumpCanvas)
  };
}

// Chiseled geological edge relief preserving flat inscribed front/back stele faces
function sculptSteleSlab(geo: THREE.BufferGeometry, halfDepth: number, edgeAmp = 0.032) {
  geo.center();
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const faceFactor = Math.min(1, Math.abs(vz) / Math.max(0.01, halfDepth));
    // Side fracture facets get stronger rock-chisel undulation; front face gets gentle hand-dressed stone undulation
    const sideWeight = 1 - faceFactor * 0.72;
    const strata = Math.sin(vy * 8.5 + vx * 3.2) * Math.cos(vx * 7.1 - vz * 5.4);
    const dx = strata * edgeAmp * sideWeight;
    const dy = Math.cos(vx * 9.2 + vy * 5.7) * edgeAmp * 0.65 * sideWeight;
    const dz = Math.sin(vx * 6.4 + vy * 6.8) * 0.012;
    pos.setXYZ(i, vx + dx, vy + dy, vz + dz);
  }
  geo.computeVertexNormals();
}

function createPolygonShape(points: Array<[number, number]>): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i][0], points[i][1]);
  }
  shape.closePath();
  return shape;
}

function createSealTabletTexture(glyph: string, subLabel: string, uvStyle = false): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 192;
  const ctx = canvas.getContext("2d")!;

  if (uvStyle) {
    ctx.fillStyle = "rgba(0, 32, 38, 0.85)";
    ctx.fillRect(0, 0, 160, 192);
    ctx.strokeStyle = "#00f5ff";
    ctx.lineWidth = 5;
    ctx.strokeRect(10, 10, 140, 172);
    ctx.font = "bold 88px 'Songti SC', 'SimSun', 'Microsoft YaHei', serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#8affff";
    ctx.shadowColor = "#00f2fe";
    ctx.shadowBlur = 16;
    ctx.fillText(glyph, 80, 88);
  } else {
    const grad = ctx.createLinearGradient(0, 0, 160, 192);
    grad.addColorStop(0, "#2b1c12");
    grad.addColorStop(0.5, "#3b2617");
    grad.addColorStop(1, "#21150d");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 160, 192);

    ctx.strokeStyle = "#d9ae59";
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, 140, 172);
    ctx.strokeStyle = "rgba(217, 174, 89, 0.45)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(18, 18, 124, 156);

    ctx.font = "bold 84px 'Songti SC', 'SimSun', 'Microsoft YaHei', serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#f7d47c";
    ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
    ctx.shadowBlur = 6;
    ctx.fillText(glyph, 80, 84);

    ctx.shadowBlur = 0;
    ctx.font = "bold 18px sans-serif";
    ctx.fillStyle = "rgba(229, 190, 112, 0.78)";
    ctx.fillText(subLabel, 80, 152);
  }

  return new THREE.CanvasTexture(canvas);
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

  let resonancePulse = 0;

  if (id === "badang-stone") {
    // 3D Singapore Stone: 3 Interlocking Chiseled Red-Ochre Sandstone Stele Wedges + Flush Kintsugi Gold Lacquer Seams
    const { diffuse: stoneTex, bump: stoneBump } = createStoneTexture();
    trackTex(stoneTex);
    trackTex(stoneBump);

    const stoneMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: stoneTex,
        bumpMap: stoneBump,
        bumpScale: 0.055,
        color: 0xd9b396,
        roughness: 0.78,
        metalness: 0.08
      })
    );

    const darkChiselMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x5c3928,
        roughness: 0.86,
        metalness: 0.12
      })
    );

    const goldMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffd666,
        emissive: 0xd98a16,
        emissiveIntensity: 0.55,
        roughness: 0.2,
        metalness: 0.92
      })
    );
    emissiveMaterials.push(goldMat);

    const cinnabarInlayMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xd44b34,
        emissive: 0x7a1c10,
        emissiveIntensity: 0.45,
        roughness: 0.34,
        metalness: 0.28
      })
    );
    emissiveMaterials.push(cinnabarInlayMat);

    // Three interlocking wedge silhouettes forming the iconic fractured Singapore Stone slab
    // Seam A runs from (-0.52, -1.28) -> (-0.18, -0.18) -> (-0.42, 0.92)
    // Seam B runs from (-0.18, -0.18) -> (0.46, 0.88) & downward (-0.18, -0.18) -> (0.24, -1.28)
    const wedgeDefs: Array<{
      pts: Array<[number, number]>;
      pos: [number, number, number];
      explodeDir: [number, number, number];
      glyph: string;
      sub: string;
      badgeOffset: [number, number];
      depth: number;
    }> = [
      {
        pts: [
          [-1.56, -1.22],
          [-0.55, -1.26],
          [-0.21, -0.18],
          [-0.45, 0.90],
          [-1.12, 1.12],
          [-1.62, 0.38],
          [-1.68, -0.58]
        ],
        pos: [-0.94, -0.07, 0],
        explodeDir: [-1, -0.12, 0.15],
        glyph: "力",
        sub: "KAWI · I",
        badgeOffset: [-0.02, -0.08],
        depth: 0.44
      },
      {
        pts: [
          [-0.42, 0.93],
          [-0.17, -0.14],
          [0.45, 0.89],
          [0.72, 1.24],
          [0.06, 1.56],
          [-0.68, 1.26]
        ],
        pos: [-0.01, 0.71, 0.01],
        explodeDir: [0, 0.95, 0.25],
        glyph: "石",
        sub: "MAJAPAHIT",
        badgeOffset: [0.02, 0.04],
        depth: 0.46
      },
      {
        pts: [
          [-0.51, -1.26],
          [0.58, -1.26],
          [1.54, -1.04],
          [1.64, -0.14],
          [1.36, 0.74],
          [0.48, 0.86],
          [-0.15, -0.18]
        ],
        pos: [0.56, -0.20, 0],
        explodeDir: [1, -0.15, 0.15],
        glyph: "潮",
        sub: "TEMASEK",
        badgeOffset: [0.22, -0.06],
        depth: 0.44
      }
    ];

    for (let w = 0; w < wedgeDefs.length; w++) {
      const def = wedgeDefs[w];
      const wedgeGroup = new THREE.Group();

      // Convert world-space polygon vertices around def.pos so each piece pivots around its own centroid
      const localPts: Array<[number, number]> = def.pts.map(([px, py]) => [px - def.pos[0], py - def.pos[1]]);
      const shape = createPolygonShape(localPts);
      const slabGeo = trackGeo(
        new THREE.ExtrudeGeometry(shape, {
          depth: def.depth,
          bevelEnabled: true,
          bevelThickness: 0.055,
          bevelSize: 0.045,
          bevelSegments: 3,
          curveSegments: 8
        })
      );
      // Center Z only so local X/Y match the exact interlocking seam coordinates
      slabGeo.translate(0, 0, -def.depth * 0.5);
      const posAttr = slabGeo.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        const vx = posAttr.getX(i);
        const vy = posAttr.getY(i);
        const vz = posAttr.getZ(i);
        const edgeWeight = 1 - Math.min(1, Math.abs(vz) / (def.depth * 0.52)) * 0.75;
        const n = Math.sin((vx + def.pos[0]) * 8.2 + (vy + def.pos[1]) * 5.4) * 0.022 * edgeWeight;
        posAttr.setXYZ(i, vx + n, vy + n * 0.7, vz + Math.cos(vx * 6.5 + vy * 6.1) * 0.01);
      }
      slabGeo.computeVertexNormals();

      const slabMesh = new THREE.Mesh(slabGeo, stoneMat);
      slabMesh.castShadow = true;
      slabMesh.receiveShadow = true;
      wedgeGroup.add(slabMesh);

      // Sunken chiseled epigraphic cartouche displaying the deciphered Kawi seal character
      const cartGroup = new THREE.Group();
      cartGroup.position.set(def.badgeOffset[0], def.badgeOffset[1], def.depth * 0.5 + 0.048);

      const bezelMesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.46, 0.54, 0.028)), goldMat);
      cartGroup.add(bezelMesh);

      const recessMesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.40, 0.48, 0.034)), darkChiselMat);
      recessMesh.position.z = 0.006;
      cartGroup.add(recessMesh);

      const sealTex = trackTex(createSealTabletTexture(def.glyph, def.sub, false));
      const sealMat = trackMat(
        new THREE.MeshStandardMaterial({
          map: sealTex,
          roughness: 0.38,
          metalness: 0.45
        })
      );
      const sealPlane = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(0.37, 0.45)), sealMat);
      sealPlane.position.z = 0.025;
      cartGroup.add(sealPlane);

      // UV fluorescent cinnabar pigment overlay on each cartouche
      const uvTex = trackTex(createSealTabletTexture(def.glyph, def.sub, true));
      const uvMat = trackMat(
        new THREE.MeshBasicMaterial({
          map: uvTex,
          transparent: true,
          opacity: 0
        })
      );
      uvOverlayMaterials.push(uvMat);
      const uvPlane = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(0.38, 0.46)), uvMat);
      uvPlane.position.z = 0.028;
      cartGroup.add(uvPlane);

      wedgeGroup.add(cartGroup);

      // Apex fragment carries a carved Majapahit 8-rayed Surya sun-lotus crest above the Kawi rows
      if (w === 1) {
        const sunRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.19, 0.018, 10, 28)), cinnabarInlayMat);
        sunRing.position.set(0.02, 0.48, def.depth * 0.5 + 0.052);
        wedgeGroup.add(sunRing);
        const rayGeo = trackGeo(new THREE.ConeGeometry(0.028, 0.09, 6));
        for (let r = 0; r < 8; r++) {
          const ang = (r * Math.PI) / 4;
          const ray = new THREE.Mesh(rayGeo, goldMat);
          ray.position.set(0.02 + Math.cos(ang) * 0.24, 0.48 + Math.sin(ang) * 0.24, def.depth * 0.5 + 0.052);
          ray.rotation.z = ang - Math.PI / 2;
          wedgeGroup.add(ray);
        }
      }

      wedgeGroup.position.set(def.pos[0], def.pos[1] + 0.08, def.pos[2]);
      root.add(wedgeGroup);
      movableParts.push({
        mesh: wedgeGroup,
        direction: new THREE.Vector3(...def.explodeDir).normalize(),
        distance: 0.95
      });
    }

    // Flush 3D Kintsugi Gold Lacquer Fracture Seams routed precisely along the Y-shaped fracture clefts (front & back)
    const frontZ = 0.275;
    const backZ = -0.275;
    const seamCurves: Array<Array<[number, number, number]>> = [
      // Left-to-junction lower fracture (front)
      [
        [-0.53, -1.18, frontZ],
        [-0.36, -0.68, frontZ + 0.01],
        [-0.19, -0.10, frontZ + 0.015]
      ],
      // Junction-to-upper-left fracture (front)
      [
        [-0.19, -0.10, frontZ + 0.015],
        [-0.31, 0.42, frontZ + 0.01],
        [-0.43, 0.98, frontZ],
        [-0.54, 1.24, 0.12]
      ],
      // Junction-to-upper-right fracture (front)
      [
        [-0.19, -0.10, frontZ + 0.015],
        [0.14, 0.40, frontZ + 0.012],
        [0.46, 0.96, frontZ],
        [0.62, 1.22, 0.10]
      ],
      // Rear fracture veins (back)
      [
        [-0.53, -1.18, backZ],
        [-0.19, -0.10, backZ - 0.012],
        [-0.43, 0.98, backZ]
      ],
      [
        [-0.19, -0.10, backZ - 0.012],
        [0.16, 0.42, backZ - 0.01],
        [0.46, 0.96, backZ]
      ]
    ];

    const seamGroup = new THREE.Group();
    for (let s = 0; s < seamCurves.length; s++) {
      const curve = new THREE.CatmullRomCurve3(seamCurves[s].map((p) => new THREE.Vector3(p[0], p[1], p[2])));
      const tubeGeo = trackGeo(new THREE.TubeGeometry(curve, 20, s < 3 ? 0.026 : 0.022, 8, false));
      seamGroup.add(new THREE.Mesh(tubeGeo, goldMat));
    }

    // 5 Hammered Gold Repair Staples (Juci / 锔钉) bridging the fracture lines
    const stapleGeo = trackGeo(new THREE.BoxGeometry(0.16, 0.028, 0.024));
    const rivetGeo = trackGeo(new THREE.SphereGeometry(0.022, 8, 8));
    const stapleSpots: Array<[number, number, number, number]> = [
      [-0.36, -0.66, frontZ + 0.02, -0.32],
      [-0.31, 0.42, frontZ + 0.02, 0.24],
      [0.15, 0.42, frontZ + 0.02, -0.55],
      [-0.34, -0.58, backZ - 0.02, 0.32],
      [0.16, 0.42, backZ - 0.02, 0.55]
    ];
    for (const [sx, sy, sz, rotZ] of stapleSpots) {
      const staple = new THREE.Group();
      staple.position.set(sx, sy, sz);
      staple.rotation.z = rotZ;
      staple.add(new THREE.Mesh(stapleGeo, goldMat));
      for (const rx of [-0.065, 0.065]) {
        const pin = new THREE.Mesh(rivetGeo, cinnabarInlayMat);
        pin.position.x = rx;
        staple.add(pin);
      }
      seamGroup.add(staple);
    }
    root.add(seamGroup);
    movableParts.push({
      mesh: seamGroup,
      direction: new THREE.Vector3(0, 0, 1),
      distance: 0.45
    });

    // Dark Bronze Museum Cradle Claws supporting the stone slab base
    const cradleMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x222c2a,
        roughness: 0.38,
        metalness: 0.78
      })
    );
    const barMesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.55, 0.09, 0.62)), cradleMat);
    barMesh.position.set(0, -1.26, 0);
    root.add(barMesh);
    const clawGeo = trackGeo(new THREE.BoxGeometry(0.14, 0.28, 0.68));
    for (const cx of [-1.02, 0, 1.02]) {
      const claw = new THREE.Mesh(clawGeo, cradleMat);
      claw.position.set(cx, -1.16, 0);
      root.add(claw);
    }

    // Subtle floating golden relic dust motes
    const dustGeo = trackGeo(new THREE.BufferGeometry());
    const dustCount = 90;
    const dustPos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      const theta = (i / dustCount) * Math.PI * 2 * 3.7;
      const radius = 1.65 + (i % 7) * 0.12;
      dustPos[i * 3] = Math.cos(theta) * radius;
      dustPos[i * 3 + 1] = ((i % 19) / 9.5 - 1) * 1.25;
      dustPos[i * 3 + 2] = Math.sin(theta) * radius * 0.65;
    }
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
    const dustMat = trackMat(
      new THREE.PointsMaterial({
        color: 0xffe29a,
        map: getSoftParticleTexture(),
        alphaTest: 0.02,
        depthWrite: false,
        size: 0.075,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending
      })
    );
    root.add(new THREE.Points(dustGeo, dustMat));
  } else if (id === "rune-plaque") {
    // 3D Srivijaya Royal Lion Gate Bronze Plaque: Temple-Arch Stele, Sculpted Singa Medallion & 4 Seal Cartouches
    const { diffuse: bronzeTex, bump: bronzeBump } = createBronzeTexture();
    trackTex(bronzeTex);
    trackTex(bronzeBump);

    const bronzeMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: bronzeTex,
        bumpMap: bronzeBump,
        bumpScale: 0.045,
        color: 0xb6905c,
        roughness: 0.36,
        metalness: 0.68
      })
    );

    const recessedPatinaMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: bronzeTex,
        color: 0x37594e,
        roughness: 0.54,
        metalness: 0.42
      })
    );

    const goldTrimMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf4c963,
        emissive: 0x4a3008,
        emissiveIntensity: 0.25,
        roughness: 0.24,
        metalness: 0.86
      })
    );

    const emeraldEyeMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x3de0c8,
        emissive: 0x169482,
        emissiveIntensity: 0.75,
        roughness: 0.16,
        metalness: 0.35
      })
    );
    emissiveMaterials.push(emeraldEyeMat);

    // Unified Lotus-Shouldered Srivijaya Ogee Temple-Arch Stele Backing Frame
    const outerSteleShape = new THREE.Shape();
    outerSteleShape.moveTo(-1.14, -1.46);
    outerSteleShape.lineTo(1.14, -1.46);
    outerSteleShape.lineTo(1.14, -1.26);
    outerSteleShape.lineTo(1.06, -1.18);
    outerSteleShape.lineTo(1.06, 0.78);
    outerSteleShape.quadraticCurveTo(1.06, 1.06, 0.82, 1.14);
    outerSteleShape.quadraticCurveTo(0.46, 1.24, 0, 1.56);
    outerSteleShape.quadraticCurveTo(-0.46, 1.24, -0.82, 1.14);
    outerSteleShape.quadraticCurveTo(-1.06, 1.06, -1.06, 0.78);
    outerSteleShape.lineTo(-1.06, -1.18);
    outerSteleShape.lineTo(-1.14, -1.26);
    outerSteleShape.closePath();

    const backSteleGeo = trackGeo(
      new THREE.ExtrudeGeometry(outerSteleShape, {
        depth: 0.16,
        bevelEnabled: true,
        bevelThickness: 0.035,
        bevelSize: 0.03,
        bevelSegments: 3,
        curveSegments: 24
      })
    );
    backSteleGeo.translate(0, 0, -0.14);
    const backSteleGroup = new THREE.Group();
    const backSteleMesh = new THREE.Mesh(backSteleGeo, bronzeMat);
    backSteleMesh.castShadow = true;
    backSteleMesh.receiveShadow = true;
    backSteleGroup.add(backSteleMesh);

    // Crown Chudamani Flame Finial & Moulded Temple Base Plinth
    const finialBase = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.11, 0.16, 0.10, 16)), goldTrimMat);
    finialBase.position.set(0, 1.61, -0.05);
    backSteleGroup.add(finialBase);
    const finialFlame = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.09, 0.24, 16)), goldTrimMat);
    finialFlame.position.set(0, 1.76, -0.05);
    backSteleGroup.add(finialFlame);

    root.add(backSteleGroup);
    movableParts.push({ mesh: backSteleGroup, direction: new THREE.Vector3(0, 0, -1), distance: 0.65 });

    // Recessed Verdigris-Bronze Coffered Inner Panel + Raised Gilt Pearl Border
    const innerPanelShape = new THREE.Shape();
    innerPanelShape.moveTo(-0.90, -1.18);
    innerPanelShape.lineTo(0.90, -1.18);
    innerPanelShape.lineTo(0.90, 0.74);
    innerPanelShape.quadraticCurveTo(0.88, 0.96, 0, 1.34);
    innerPanelShape.quadraticCurveTo(-0.88, 0.96, -0.90, 0.74);
    innerPanelShape.closePath();

    const innerPanelGeo = trackGeo(
      new THREE.ExtrudeGeometry(innerPanelShape, {
        depth: 0.06,
        bevelEnabled: true,
        bevelThickness: 0.015,
        bevelSize: 0.015,
        bevelSegments: 2,
        curveSegments: 20
      })
    );
    const innerPanelMesh = new THREE.Mesh(innerPanelGeo, recessedPatinaMat);
    innerPanelMesh.position.z = 0.01;
    root.add(innerPanelMesh);

    // Gilt Pearl Studs & 4 Sculpted Corner Cloud Clasps along the Stele Perimeter
    const pearlGeo = trackGeo(new THREE.SphereGeometry(0.028, 10, 10));
    for (let py = -1.12; py <= 0.72; py += 0.23) {
      for (const px of [-0.97, 0.97]) {
        const pearl = new THREE.Mesh(pearlGeo, goldTrimMat);
        pearl.position.set(px, py, 0.065);
        root.add(pearl);
      }
    }
    for (let px = -0.80; px <= 0.80; px += 0.266) {
      const pearl = new THREE.Mesh(pearlGeo, goldTrimMat);
      pearl.position.set(px, -1.28, 0.065);
      root.add(pearl);
    }

    const cornerScrollGeo = trackGeo(new THREE.TorusGeometry(0.085, 0.024, 8, 16, Math.PI * 1.45));
    for (const [cx, cy, rz] of [
      [-0.88, 0.78, 0.4],
      [0.88, 0.78, Math.PI - 0.4],
      [-0.88, -1.14, -0.4],
      [0.88, -1.14, Math.PI + 0.4]
    ] as const) {
      const clasp = new THREE.Mesh(cornerScrollGeo, goldTrimMat);
      clasp.position.set(cx, cy, 0.08);
      clasp.rotation.z = rz;
      root.add(clasp);
    }

    // High-Relief Sculpted Srivijaya Roaring Lion (Singa) Medallion
    const lionGroup = new THREE.Group();
    lionGroup.position.set(0, 0.36, 0.09);

    // Medallion outer lotus-petal sunburst halo + stepped bronze shield
    const lotusPetalGeo = trackGeo(new THREE.ConeGeometry(0.085, 0.20, 6));
    lotusPetalGeo.scale(1, 1, 0.38);
    for (let p = 0; p < 16; p++) {
      const ang = (p * Math.PI * 2) / 16;
      const petal = new THREE.Mesh(lotusPetalGeo, p % 2 === 0 ? goldTrimMat : bronzeMat);
      petal.position.set(Math.cos(ang) * 0.66, Math.sin(ang) * 0.66, 0.01);
      petal.rotation.z = ang - Math.PI / 2;
      lionGroup.add(petal);
    }

    const outerMedallionRim = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.60, 0.042, 12, 40)), goldTrimMat);
    outerMedallionRim.position.z = 0.03;
    lionGroup.add(outerMedallionRim);

    const shieldDisc = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.58, 0.60, 0.07, 40)), bronzeMat);
    shieldDisc.rotation.x = Math.PI / 2;
    shieldDisc.position.z = 0.02;
    lionGroup.add(shieldDisc);

    // Two concentric crowns of sculpted S-volute mane locks
    const outerManeGeo = trackGeo(new THREE.TorusGeometry(0.095, 0.032, 8, 16, Math.PI * 1.35));
    for (let m = 0; m < 12; m++) {
      const ang = (m * Math.PI * 2) / 12 + Math.PI / 12;
      const lock = new THREE.Mesh(outerManeGeo, goldTrimMat);
      lock.position.set(Math.cos(ang) * 0.44, Math.sin(ang) * 0.44, 0.07);
      lock.rotation.z = ang + 0.45;
      lionGroup.add(lock);
    }

    // Sculpted 3D Lion Cranium, Cheekbones, Nose Bridge, Whisker Muzzle & Roaring Jaws
    const craniumGeo = trackGeo(new THREE.SphereGeometry(0.28, 24, 20));
    craniumGeo.scale(1.06, 0.98, 0.62);
    const cranium = new THREE.Mesh(craniumGeo, goldTrimMat);
    cranium.position.set(0, 0.08, 0.08);
    lionGroup.add(cranium);

    // Sculpted ears
    const earGeo = trackGeo(new THREE.ConeGeometry(0.085, 0.16, 8));
    earGeo.scale(1, 1, 0.55);
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(earGeo, bronzeMat);
      ear.position.set(sx * 0.24, 0.28, 0.08);
      ear.rotation.z = -sx * 0.42;
      lionGroup.add(ear);
    }

    // Swept flame-brow ridges & glowing emerald eyes
    const browGeo = trackGeo(new THREE.TorusGeometry(0.10, 0.026, 8, 16, Math.PI * 0.95));
    const eyeSocketGeo = trackGeo(new THREE.SphereGeometry(0.048, 12, 12));
    eyeSocketGeo.scale(1.25, 0.78, 0.7);
    for (const sx of [-1, 1]) {
      const brow = new THREE.Mesh(browGeo, bronzeMat);
      brow.position.set(sx * 0.12, 0.12, 0.21);
      brow.rotation.z = sx < 0 ? 0.18 : -0.18;
      lionGroup.add(brow);

      const eye = new THREE.Mesh(eyeSocketGeo, emeraldEyeMat);
      eye.position.set(sx * 0.12, 0.10, 0.22);
      lionGroup.add(eye);
    }

    // Nasal bridge & broad triangular lion nose
    const bridgeGeo = trackGeo(new THREE.CylinderGeometry(0.042, 0.068, 0.18, 12));
    bridgeGeo.scale(1, 1, 0.7);
    const noseBridge = new THREE.Mesh(bridgeGeo, goldTrimMat);
    noseBridge.position.set(0, 0.05, 0.23);
    lionGroup.add(noseBridge);

    const noseTipGeo = trackGeo(new THREE.ConeGeometry(0.075, 0.07, 4));
    const noseTip = new THREE.Mesh(noseTipGeo, bronzeMat);
    noseTip.rotation.x = Math.PI;
    noseTip.rotation.y = Math.PI / 4;
    noseTip.position.set(0, -0.02, 0.27);
    lionGroup.add(noseTip);

    // Paired rounded leonine whisker pads (no boxy snout!)
    const padGeo = trackGeo(new THREE.SphereGeometry(0.11, 16, 14));
    padGeo.scale(1.15, 0.78, 0.72);
    for (const sx of [-1, 1]) {
      const pad = new THREE.Mesh(padGeo, goldTrimMat);
      pad.position.set(sx * 0.095, -0.06, 0.22);
      lionGroup.add(pad);
    }

    // Open roaring mouth recess, lower jaw, chin beard & 4 curved canine fangs
    const mouthCavity = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.12, 0.10, 0.08, 16)),
      recessedPatinaMat
    );
    mouthCavity.rotation.x = Math.PI / 2;
    mouthCavity.scale.set(1.2, 1, 0.85);
    mouthCavity.position.set(0, -0.14, 0.19);
    lionGroup.add(mouthCavity);

    const lowerJawGeo = trackGeo(new THREE.TorusGeometry(0.11, 0.036, 10, 18, Math.PI));
    const lowerJaw = new THREE.Mesh(lowerJawGeo, goldTrimMat);
    lowerJaw.rotation.z = Math.PI;
    lowerJaw.position.set(0, -0.13, 0.21);
    lionGroup.add(lowerJaw);

    const fangGeo = trackGeo(new THREE.ConeGeometry(0.022, 0.075, 8));
    for (const sx of [-1, 1]) {
      const upperFang = new THREE.Mesh(fangGeo, goldTrimMat);
      upperFang.rotation.x = Math.PI;
      upperFang.position.set(sx * 0.085, -0.11, 0.24);
      lionGroup.add(upperFang);

      const lowerFang = new THREE.Mesh(fangGeo, goldTrimMat);
      lowerFang.position.set(sx * 0.068, -0.18, 0.23);
      lionGroup.add(lowerFang);
    }

    root.add(lionGroup);
    movableParts.push({ mesh: lionGroup, direction: new THREE.Vector3(0, 0.15, 1).normalize(), distance: 0.85 });

    // Horizontal Ornamental Lotus Divider Bar between Medallion & Cipher Cartouches
    const dividerBar = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.68, 0.055, 0.045)), goldTrimMat);
    dividerBar.position.set(0, -0.40, 0.085);
    root.add(dividerBar);

    // 4 Cast-Bronze & Gilt Seal-Script Maritime Cipher Cartouches ("海 · 狮 · 门 · 月")
    const plaqueRunes = [
      { char: "海", sub: "SEA" },
      { char: "狮", sub: "SINGA" },
      { char: "门", sub: "GATE" },
      { char: "月", sub: "MOON" }
    ];
    const outerBezelGeo = trackGeo(new THREE.BoxGeometry(0.39, 0.48, 0.045));
    const innerCofferGeo = trackGeo(new THREE.BoxGeometry(0.34, 0.43, 0.052));
    const runePlaneGeo = trackGeo(new THREE.PlaneGeometry(0.31, 0.40));

    for (let c = 0; c < 4; c++) {
      const cx = -0.63 + c * 0.42;
      const cartGroup = new THREE.Group();
      cartGroup.position.set(cx, -0.80, 0.085);

      cartGroup.add(new THREE.Mesh(outerBezelGeo, goldTrimMat));

      const coffer = new THREE.Mesh(innerCofferGeo, bronzeMat);
      coffer.position.z = 0.01;
      cartGroup.add(coffer);

      const normalTex = trackTex(createSealTabletTexture(plaqueRunes[c].char, plaqueRunes[c].sub, false));
      const normalMat = trackMat(
        new THREE.MeshStandardMaterial({
          map: normalTex,
          roughness: 0.34,
          metalness: 0.52
        })
      );
      const runePlane = new THREE.Mesh(runePlaneGeo, normalMat);
      runePlane.position.z = 0.038;
      cartGroup.add(runePlane);

      const uvTex = trackTex(createSealTabletTexture(plaqueRunes[c].char, plaqueRunes[c].sub, true));
      const uvMat = trackMat(
        new THREE.MeshBasicMaterial({
          map: uvTex,
          transparent: true,
          opacity: 0
        })
      );
      uvOverlayMaterials.push(uvMat);
      const uvPlane = new THREE.Mesh(runePlaneGeo, uvMat);
      uvPlane.position.z = 0.041;
      cartGroup.add(uvPlane);

      root.add(cartGroup);
      movableParts.push({
        mesh: cartGroup,
        direction: new THREE.Vector3((c - 1.5) * 0.35, -0.35, 0.9).normalize(),
        distance: 0.72
      });
    }

    // UV fluorescent meridian seal ring around the Singa Medallion
    const uvSealMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x00f2fe,
        transparent: true,
        opacity: 0
      })
    );
    uvOverlayMaterials.push(uvSealMat);
    const uvSealMesh = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.74, 0.018, 10, 48)), uvSealMat);
    uvSealMesh.position.set(0, 0.36, 0.18);
    root.add(uvSealMesh);
  } else if (id === "harbor-seal") {
    // 3D Openwork Mariner's Astrolabe & Celestial Harbor Seal Lock
    const { diffuse: dialTex, bump: dialBump } = createAstrolabeDialTexture();
    trackTex(dialTex);
    trackTex(dialBump);

    const brassMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: dialTex,
        bumpMap: dialBump,
        bumpScale: 0.04,
        color: 0xe0b55c,
        roughness: 0.28,
        metalness: 0.72
      })
    );

    const brightGoldMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf7cf6d,
        emissive: 0x452d08,
        emissiveIntensity: 0.22,
        roughness: 0.22,
        metalness: 0.84
      })
    );

    const gunmetalMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x243134,
        roughness: 0.42,
        metalness: 0.68
      })
    );

    const copperMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xc9703d,
        roughness: 0.30,
        metalness: 0.74
      })
    );

    const rubyGlowMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xd9261c,
        emissive: 0x80120b,
        emissiveIntensity: 0.65,
        roughness: 0.12,
        metalness: 0.32
      })
    );
    emissiveMaterials.push(rubyGlowMat);

    // 1. Rear Octagonal Gunmetal Seal Plate & Top Mariner's Suspension Throne ("Kursi")
    const caseGroup = new THREE.Group();
    caseGroup.position.z = -0.14;
    const octPlate = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.56, 1.60, 0.10, 8)), gunmetalMat);
    octPlate.rotation.x = Math.PI / 2;
    octPlate.rotation.y = Math.PI / 8;
    octPlate.castShadow = true;
    caseGroup.add(octPlate);

    const octRim = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(1.54, 0.032, 10, 8)), copperMat);
    octRim.rotation.z = Math.PI / 8;
    octRim.position.z = 0.04;
    caseGroup.add(octRim);

    // Top Astrolabe Throne Bracket & Naval Swivel Ring
    const throneShape = createPolygonShape([
      [-0.44, 1.44],
      [0.44, 1.44],
      [0.24, 1.72],
      [0, 1.84],
      [-0.24, 1.72]
    ]);
    const throneGeo = trackGeo(
      new THREE.ExtrudeGeometry(throneShape, {
        depth: 0.10,
        bevelEnabled: true,
        bevelThickness: 0.02,
        bevelSize: 0.02,
        bevelSegments: 2
      })
    );
    throneGeo.translate(0, 0, -0.05);
    caseGroup.add(new THREE.Mesh(throneGeo, brightGoldMat));

    const swivelRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.20, 0.032, 12, 32)), brightGoldMat);
    swivelRing.position.set(0, 1.98, 0);
    caseGroup.add(swivelRing);

    root.add(caseGroup);
    movableParts.push({ mesh: caseGroup, direction: new THREE.Vector3(0, 0, -1), distance: 0.85 });

    // 2. Outer Engraved Monsoon & Zodiac Gear Ring (24 involute teeth + 8 rivet bosses)
    const outerGroup = new THREE.Group();
    const outerRingShape = new THREE.Shape();
    outerRingShape.absarc(0, 0, 1.48, 0, Math.PI * 2, false);
    const outerRingHole = new THREE.Path();
    outerRingHole.absarc(0, 0, 1.22, 0, Math.PI * 2, true);
    outerRingShape.holes.push(outerRingHole);

    const outerExtrudeGeo = trackGeo(
      new THREE.ExtrudeGeometry(outerRingShape, {
        depth: 0.12,
        bevelEnabled: true,
        bevelThickness: 0.024,
        bevelSize: 0.02,
        bevelSegments: 2,
        curveSegments: 56
      })
    );
    outerExtrudeGeo.translate(0, 0, -0.06);
    outerGroup.add(new THREE.Mesh(outerExtrudeGeo, brassMat));

    const outerToothGeo = trackGeo(new THREE.BoxGeometry(0.11, 0.13, 0.11));
    for (let t = 0; t < 24; t++) {
      const angle = (t * Math.PI * 2) / 24;
      const tooth = new THREE.Mesh(outerToothGeo, copperMat);
      tooth.position.set(Math.cos(angle) * 1.53, Math.sin(angle) * 1.53, 0);
      tooth.rotation.z = angle;
      outerGroup.add(tooth);
    }

    const bossGeo = trackGeo(new THREE.CylinderGeometry(0.042, 0.048, 0.05, 8));
    for (let b = 0; b < 8; b++) {
      const ang = (b * Math.PI) / 4 + Math.PI / 8;
      const boss = new THREE.Mesh(bossGeo, brightGoldMat);
      boss.rotation.x = Math.PI / 2;
      boss.position.set(Math.cos(ang) * 1.35, Math.sin(ang) * 1.35, 0.075);
      outerGroup.add(boss);
    }

    root.add(outerGroup);
    movableParts.push({ mesh: outerGroup, direction: new THREE.Vector3(0, 0, -0.35), distance: 0.55 });

    // 3. Middle Openwork Rete Star-Chart Ring (with offset Ecliptic Circle & 8 Radial Spokes)
    const midGroup = new THREE.Group();
    midGroup.position.z = 0.06;
    const midRingShape = new THREE.Shape();
    midRingShape.absarc(0, 0, 1.16, 0, Math.PI * 2, false);
    const midRingHole = new THREE.Path();
    midRingHole.absarc(0, 0, 0.92, 0, Math.PI * 2, true);
    midRingShape.holes.push(midRingHole);

    const midExtrudeGeo = trackGeo(
      new THREE.ExtrudeGeometry(midRingShape, {
        depth: 0.10,
        bevelEnabled: true,
        bevelThickness: 0.02,
        bevelSize: 0.016,
        bevelSegments: 2,
        curveSegments: 48
      })
    );
    midExtrudeGeo.translate(0, 0, -0.05);
    midGroup.add(new THREE.Mesh(midExtrudeGeo, brassMat));

    // Offset Ecliptic Zodiac Ring characteristic of real astrolabes
    const eclipticRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.66, 0.032, 10, 44)), brightGoldMat);
    eclipticRing.position.set(0, 0.22, 0.03);
    midGroup.add(eclipticRing);

    const spokeGeo = trackGeo(new THREE.BoxGeometry(0.045, 0.92, 0.05));
    for (let s = 0; s < 4; s++) {
      const spoke = new THREE.Mesh(spokeGeo, copperMat);
      spoke.rotation.z = (s * Math.PI) / 4;
      spoke.scale.y = 2.0;
      midGroup.add(spoke);
    }

    const midToothGeo = trackGeo(new THREE.BoxGeometry(0.08, 0.10, 0.09));
    for (let t = 0; t < 16; t++) {
      const angle = (t * Math.PI * 2) / 16;
      const tooth = new THREE.Mesh(midToothGeo, brightGoldMat);
      tooth.position.set(Math.cos(angle) * 0.88, Math.sin(angle) * 0.88, 0);
      tooth.rotation.z = angle;
      midGroup.add(tooth);
    }
    root.add(midGroup);
    movableParts.push({ mesh: midGroup, direction: new THREE.Vector3(0, 0, 0.45), distance: 0.65 });

    // 4. Inner Sculpted 8-Point Compass Rose & Alhidade Sighting Rule
    const alhidadeGroup = new THREE.Group();
    alhidadeGroup.position.z = 0.15;

    const innerHub = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.56, 0.60, 0.09, 36)), gunmetalMat);
    innerHub.rotation.x = Math.PI / 2;
    alhidadeGroup.add(innerHub);

    // 8-point faceted 3D Compass Rose star
    const starRayShape = createPolygonShape([
      [0, 0.78],
      [0.11, 0.16],
      [0, 0],
      [-0.11, 0.16]
    ]);
    const starRayGeo = trackGeo(
      new THREE.ExtrudeGeometry(starRayShape, {
        depth: 0.045,
        bevelEnabled: true,
        bevelThickness: 0.015,
        bevelSize: 0.012,
        bevelSegments: 2
      })
    );
    for (let r = 0; r < 8; r++) {
      const ray = new THREE.Mesh(starRayGeo, r % 2 === 0 ? brightGoldMat : copperMat);
      ray.rotation.z = (r * Math.PI) / 4;
      if (r % 2 === 1) ray.scale.set(0.75, 0.75, 0.85);
      ray.position.z = 0.02;
      alhidadeGroup.add(ray);
    }

    // Diagonal Mariner's Alhidade Sighting Bar with twin sighting vanes
    const ruleGroup = new THREE.Group();
    ruleGroup.rotation.z = Math.PI / 5;
    const ruleShape = createPolygonShape([
      [-1.36, -0.04],
      [-0.26, -0.09],
      [0.26, -0.09],
      [1.36, -0.04],
      [1.48, 0.02],
      [1.30, 0.06],
      [0.26, 0.09],
      [-0.26, 0.09],
      [-1.30, 0.06],
      [-1.48, -0.02]
    ]);
    const ruleGeo = trackGeo(
      new THREE.ExtrudeGeometry(ruleShape, {
        depth: 0.035,
        bevelEnabled: true,
        bevelThickness: 0.01,
        bevelSize: 0.01,
        bevelSegments: 2
      })
    );
    ruleGroup.add(new THREE.Mesh(ruleGeo, brightGoldMat));

    const vaneGeo = trackGeo(new THREE.BoxGeometry(0.035, 0.14, 0.13));
    for (const vx of [-0.95, 0.95]) {
      const vane = new THREE.Mesh(vaneGeo, copperMat);
      vane.position.set(vx, 0, 0.08);
      ruleGroup.add(vane);
    }
    ruleGroup.position.z = 0.055;
    alhidadeGroup.add(ruleGroup);

    root.add(alhidadeGroup);
    movableParts.push({ mesh: alhidadeGroup, direction: new THREE.Vector3(0, 0, 0.85), distance: 0.85 });

    // 5. Center Lathe-Sculpted Cinnabar-Ruby Cabochon inside an 8-Petal Lotus Collet
    const rubyGroup = new THREE.Group();
    rubyGroup.position.z = 0.24;

    const cabochonPts = [
      new THREE.Vector2(0.001, 0.16),
      new THREE.Vector2(0.14, 0.14),
      new THREE.Vector2(0.24, 0.08),
      new THREE.Vector2(0.28, 0.0),
      new THREE.Vector2(0.25, -0.05),
      new THREE.Vector2(0.001, -0.05)
    ];
    const cabochonGeo = trackGeo(new THREE.LatheGeometry(cabochonPts, 24));
    cabochonGeo.rotateX(Math.PI / 2);
    rubyGroup.add(new THREE.Mesh(cabochonGeo, rubyGlowMat));

    const colletRim = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.29, 0.032, 10, 32)), brightGoldMat);
    rubyGroup.add(colletRim);

    const clawProngGeo = trackGeo(new THREE.ConeGeometry(0.035, 0.11, 6));
    for (let p = 0; p < 8; p++) {
      const ang = (p * Math.PI * 2) / 8;
      const prong = new THREE.Mesh(clawProngGeo, brightGoldMat);
      prong.position.set(Math.cos(ang) * 0.28, Math.sin(ang) * 0.28, 0.05);
      prong.rotation.z = ang + Math.PI / 2;
      prong.rotation.x = -0.35;
      rubyGroup.add(prong);
    }
    root.add(rubyGroup);
    movableParts.push({ mesh: rubyGroup, direction: new THREE.Vector3(0, 0, 1), distance: 1.15 });

    // 6. 4 Sculpted Beveled Spearhead Cardinal Lock Bolts
    const spearShape = createPolygonShape([
      [0, 0.26],
      [0.11, 0.04],
      [0.05, -0.02],
      [0.05, -0.22],
      [-0.05, -0.22],
      [-0.05, -0.02],
      [-0.11, 0.04]
    ]);
    const spearGeo = trackGeo(
      new THREE.ExtrudeGeometry(spearShape, {
        depth: 0.055,
        bevelEnabled: true,
        bevelThickness: 0.016,
        bevelSize: 0.014,
        bevelSegments: 2
      })
    );
    spearGeo.translate(0, 0, -0.027);
    const inlayGemGeo = trackGeo(new THREE.OctahedronGeometry(0.045, 0));

    for (let p = 0; p < 4; p++) {
      const angle = (p * Math.PI) / 2;
      const pinGroup = new THREE.Group();
      pinGroup.position.set(Math.cos(angle) * 1.36, Math.sin(angle) * 1.36, 0.11);
      pinGroup.rotation.z = angle - Math.PI / 2;

      pinGroup.add(new THREE.Mesh(spearGeo, brightGoldMat));
      const gem = new THREE.Mesh(inlayGemGeo, rubyGlowMat);
      gem.position.set(0, 0.05, 0.038);
      pinGroup.add(gem);

      root.add(pinGroup);
      movableParts.push({
        mesh: pinGroup,
        direction: new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0.25).normalize(),
        distance: 0.72
      });
    }

    // Phosphorescent UV Calibration Rings (90° / 180° / 270° markers)
    for (const r of [0.92, 1.22, 1.50]) {
      const uvMat = trackMat(
        new THREE.MeshBasicMaterial({
          color: 0x00f2fe,
          transparent: true,
          opacity: 0
        })
      );
      uvOverlayMaterials.push(uvMat);
      const uvRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(r, 0.015, 8, 48)), uvMat);
      uvRing.position.z = 0.14;
      root.add(uvRing);
    }
  } else {
    // 3D Sacred Nanyang Jade Bi-Disc & Angklung-Cut Resonant Bamboo Spirit Chime
    const { diffuse: bambooTex, bump: bambooBump } = createBambooTexture();
    const { diffuse: jadeTex, bump: jadeBump } = createJadeCloudTexture();
    trackTex(bambooTex);
    trackTex(bambooBump);
    trackTex(jadeTex);
    trackTex(jadeBump);

    const bambooMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: bambooTex,
        bumpMap: bambooBump,
        bumpScale: 0.045,
        color: 0xa4c88c,
        emissive: 0x162918,
        emissiveIntensity: 0.16,
        roughness: 0.44,
        metalness: 0.06,
        side: THREE.DoubleSide
      })
    );

    const bambooInnerMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x4b5e38,
        roughness: 0.72,
        metalness: 0.04,
        side: THREE.DoubleSide
      })
    );

    const jadeMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: jadeTex,
        bumpMap: jadeBump,
        bumpScale: 0.035,
        color: 0x5ce6c2,
        emissive: 0x115e4b,
        emissiveIntensity: 0.30,
        roughness: 0.15,
        metalness: 0.10
      })
    );
    emissiveMaterials.push(jadeMat);

    const waveHaloMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x4ae8cc,
        transparent: true,
        opacity: 0.32,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );

    const brassBellMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf0c45c,
        emissive: 0x3d2806,
        emissiveIntensity: 0.18,
        roughness: 0.24,
        metalness: 0.86
      })
    );

    const silkCordMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xb82824,
        roughness: 0.68,
        metalness: 0.08
      })
    );

    // 1. Crown Group: Suspension Hook, Mystic Endless Knot & Cloud-Carved Emerald Jade Bi-Disc
    const crownGroup = new THREE.Group();
    crownGroup.position.y = 1.24;

    // Top Brass Suspension Ring & Mystic Silk Knot (Pan Chang)
    const topHook = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.11, 0.022, 10, 24)), brassBellMat);
    topHook.position.y = 0.56;
    crownGroup.add(topHook);

    const knotLoopGeo = trackGeo(new THREE.TorusGeometry(0.068, 0.018, 8, 18));
    for (const [kx, ky] of [
      [0, 0.38],
      [-0.06, 0.32],
      [0.06, 0.32],
      [0, 0.26]
    ] as const) {
      const loop = new THREE.Mesh(knotLoopGeo, silkCordMat);
      loop.position.set(kx, ky, 0);
      crownGroup.add(loop);
    }

    // 4 Silk Harness Cords angling down from the Mystic Knot to the Jade Bi-Disc clasps
    for (let h = 0; h < 4; h++) {
      const ang = (h * Math.PI) / 2 + Math.PI / 4;
      const harnessPts = [
        new THREE.Vector3(0, 0.26, 0),
        new THREE.Vector3(Math.cos(ang) * 0.36, 0.14, Math.sin(ang) * 0.36),
        new THREE.Vector3(Math.cos(ang) * 0.72, 0.03, Math.sin(ang) * 0.72)
      ];
      const harnessGeo = trackGeo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(harnessPts), 12, 0.014, 6, false));
      crownGroup.add(new THREE.Mesh(harnessGeo, silkCordMat));
    }

    const biShape = new THREE.Shape();
    biShape.absarc(0, 0, 0.94, 0, Math.PI * 2, false);
    const biHole = new THREE.Path();
    biHole.absarc(0, 0, 0.38, 0, Math.PI * 2, true);
    biShape.holes.push(biHole);

    const jadeCrownGeo = trackGeo(
      new THREE.ExtrudeGeometry(biShape, {
        depth: 0.11,
        bevelEnabled: true,
        bevelThickness: 0.028,
        bevelSize: 0.024,
        bevelSegments: 3,
        curveSegments: 48
      })
    );
    const crownMesh = new THREE.Mesh(jadeCrownGeo, jadeMat);
    crownMesh.rotation.x = Math.PI / 2;
    crownMesh.position.y = 0.055;
    crownGroup.add(crownMesh);

    // Gilt Filigree Inner/Outer Collars & 5 Sculpted Ruyi Cloud Clasps
    const innerRim = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.38, 0.026, 10, 36)), brassBellMat);
    innerRim.rotation.x = Math.PI / 2;
    crownGroup.add(innerRim);

    const outerRim = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.94, 0.026, 10, 48)), brassBellMat);
    outerRim.rotation.x = Math.PI / 2;
    crownGroup.add(outerRim);

    const ruyiBossGeo = trackGeo(new THREE.TorusGeometry(0.10, 0.024, 8, 16, Math.PI * 1.4));
    for (let rb = 0; rb < 5; rb++) {
      const rAng = (rb * Math.PI * 2) / 5;
      const boss = new THREE.Mesh(ruyiBossGeo, brassBellMat);
      boss.rotation.x = Math.PI / 2;
      boss.rotation.z = rAng;
      boss.position.set(Math.cos(rAng) * 0.66, 0.075, Math.sin(rAng) * 0.66);
      crownGroup.add(boss);
    }

    root.add(crownGroup);
    movableParts.push({ mesh: crownGroup, direction: new THREE.Vector3(0, 1, 0), distance: 0.82 });

    // 2. 5 Pentatonic Angklung-Cut Resonant Bamboo Chime Tubes
    const lengths = [1.48, 1.78, 2.08, 1.66, 1.36];
    const nodeFlaredGeo = trackGeo(new THREE.TorusGeometry(0.132, 0.022, 10, 24));
    const lashingRingGeo = trackGeo(new THREE.TorusGeometry(0.136, 0.012, 8, 24));
    const topCapGeo = trackGeo(new THREE.CylinderGeometry(0.128, 0.128, 0.028, 20));

    for (let t = 0; t < 5; t++) {
      const angle = (t * Math.PI * 2) / 5;
      const len = lengths[t];
      const upperLen = len * 0.62;
      const tongueLen = len * 0.38;
      const radius = 0.56;

      const tubeGroup = new THREE.Group();
      tubeGroup.position.set(Math.cos(angle) * radius, 0.42 - len / 2, Math.sin(angle) * radius);

      // Rotate tube group locally so its carved Angklung acoustic opening faces outward
      const acousticShell = new THREE.Group();
      acousticShell.rotation.y = -angle + Math.PI / 2;

      // Upper closed cylindrical resonant chamber
      const upperOuterGeo = trackGeo(new THREE.CylinderGeometry(0.124, 0.128, upperLen, 20, 1, true));
      const upperOuter = new THREE.Mesh(upperOuterGeo, bambooMat);
      upperOuter.position.y = len / 2 - upperLen / 2;
      upperOuter.castShadow = true;
      acousticShell.add(upperOuter);

      const upperInnerGeo = trackGeo(new THREE.CylinderGeometry(0.104, 0.108, upperLen, 16, 1, true));
      const upperInner = new THREE.Mesh(upperInnerGeo, bambooInnerMat);
      upperInner.position.y = len / 2 - upperLen / 2;
      acousticShell.add(upperInner);

      // Top bamboo node diaphragm cap + brass suspension eyelet
      const topCap = new THREE.Mesh(topCapGeo, bambooInnerMat);
      topCap.position.y = len / 2;
      acousticShell.add(topCap);

      // Lower carved half-pipe Angklung acoustic tongue (reveals hollow interior & creates rich silhouette)
      const lowerTongueOuterGeo = trackGeo(
        new THREE.CylinderGeometry(0.128, 0.126, tongueLen, 16, 1, true, Math.PI * 0.55, Math.PI * 1.1)
      );
      const lowerTongueOuter = new THREE.Mesh(lowerTongueOuterGeo, bambooMat);
      lowerTongueOuter.position.y = -len / 2 + tongueLen / 2;
      lowerTongueOuter.castShadow = true;
      acousticShell.add(lowerTongueOuter);

      const lowerTongueInnerGeo = trackGeo(
        new THREE.CylinderGeometry(0.106, 0.104, tongueLen, 16, 1, true, Math.PI * 0.55, Math.PI * 1.1)
      );
      const lowerTongueInner = new THREE.Mesh(lowerTongueInnerGeo, bambooInnerMat);
      lowerTongueInner.position.y = -len / 2 + tongueLen / 2;
      acousticShell.add(lowerTongueInner);

      // Flared organic culm nodes + crimson silk lashings & gilt collars
      const nodeOffsets = [len / 2 - 0.08, len / 2 - upperLen];
      for (const ny of nodeOffsets) {
        const node = new THREE.Mesh(nodeFlaredGeo, bambooMat);
        node.rotation.x = Math.PI / 2;
        node.position.y = ny;
        acousticShell.add(node);

        const lash = new THREE.Mesh(lashingRingGeo, silkCordMat);
        lash.rotation.x = Math.PI / 2;
        lash.position.y = ny + 0.025;
        acousticShell.add(lash);

        const giltRing = new THREE.Mesh(lashingRingGeo, brassBellMat);
        giltRing.rotation.x = Math.PI / 2;
        giltRing.position.y = ny - 0.025;
        acousticShell.add(giltRing);
      }

      tubeGroup.add(acousticShell);

      // Crimson silk cord connecting Jade Bi-disc (y = 1.24) down to tube top (y = 0.42)
      const cordLen = 0.84;
      const cordGeo = trackGeo(new THREE.CylinderGeometry(0.015, 0.015, cordLen, 8));
      const cordMesh = new THREE.Mesh(cordGeo, silkCordMat);
      cordMesh.position.set(0, len / 2 + cordLen / 2, 0);
      tubeGroup.add(cordMesh);

      root.add(tubeGroup);
      chimeTubes.push(tubeGroup);
      movableParts.push({
        mesh: tubeGroup,
        direction: new THREE.Vector3(Math.cos(angle), -0.35, Math.sin(angle)).normalize(),
        distance: 0.95
      });
    }

    // 3. Central Lathe-Profiled Cast-Bronze Lotus Clapper & Openwork Talisman Wind-Catcher Sail
    const clapperGroup = new THREE.Group();
    clapperGroup.position.set(0, -0.22, 0);
    chimeClapper = clapperGroup;

    // Central suspension cord from crown down to clapper
    const centerCord = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.016, 0.016, 1.46, 8)), silkCordMat);
    centerCord.position.y = 0.73;
    clapperGroup.add(centerCord);

    // Lathe-profiled bronze temple striker disc
    const strikerPts = [
      new THREE.Vector2(0.001, 0.14),
      new THREE.Vector2(0.12, 0.12),
      new THREE.Vector2(0.24, 0.04),
      new THREE.Vector2(0.29, 0.0),
      new THREE.Vector2(0.24, -0.04),
      new THREE.Vector2(0.10, -0.11),
      new THREE.Vector2(0.001, -0.13)
    ];
    const strikerGeo = trackGeo(new THREE.LatheGeometry(strikerPts, 28));
    clapperGroup.add(new THREE.Mesh(strikerGeo, brassBellMat));

    // Pierced Gilt-Bronze Maritime Talisman Wind-Catcher Plaque with Square Coin Window
    const sailShape = createPolygonShape([
      [0, -0.18],
      [0.20, -0.34],
      [0.16, -0.86],
      [0, -1.04],
      [-0.16, -0.86],
      [-0.20, -0.34]
    ]);
    const coinHole = createPolygonShape([
      [-0.055, -0.52],
      [0.055, -0.52],
      [0.055, -0.63],
      [-0.055, -0.63]
    ]);
    sailShape.holes.push(coinHole);
    const sailGeo = trackGeo(
      new THREE.ExtrudeGeometry(sailShape, {
        depth: 0.024,
        bevelEnabled: true,
        bevelThickness: 0.008,
        bevelSize: 0.008,
        bevelSegments: 2
      })
    );
    sailGeo.translate(0, 0, -0.012);
    clapperGroup.add(new THREE.Mesh(sailGeo, brassBellMat));

    // Crimson silk bottom tassel
    const tasselCap = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.036, 10, 10)), brassBellMat);
    tasselCap.position.y = -1.10;
    clapperGroup.add(tasselCap);
    const tasselSkirt = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.055, 0.24, 12)), silkCordMat);
    tasselSkirt.position.y = -1.24;
    clapperGroup.add(tasselSkirt);

    root.add(clapperGroup);
    movableParts.push({ mesh: clapperGroup, direction: new THREE.Vector3(0, -1, 0), distance: 0.65 });

    // Delicate translucent harmonic resonance wave rings + UV pentatonic standing-wave rings
    for (let r = 0; r < 2; r++) {
      const waveGeo = trackGeo(new THREE.TorusGeometry(0.88 + r * 0.32, 0.009, 8, 48));
      const waveMesh = new THREE.Mesh(waveGeo, waveHaloMat);
      waveMesh.rotation.x = Math.PI / 2;
      waveMesh.position.y = -0.28 + r * 0.38;
      root.add(waveMesh);
      harmonicWaveRings.push(waveMesh);
    }

    const uvWaveMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x00f2fe,
        transparent: true,
        opacity: 0
      })
    );
    uvOverlayMaterials.push(uvWaveMat);
    const uvCrownHalo = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(1.04, 0.016, 10, 48)), uvWaveMat);
    uvCrownHalo.rotation.x = Math.PI / 2;
    uvCrownHalo.position.y = 1.28;
    root.add(uvCrownHalo);
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
        mat.emissiveIntensity = enabled ? 1.95 : 0.55;
      }
      for (const uvMat of uvOverlayMaterials) {
        uvMat.opacity = enabled ? 0.92 : 0;
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
