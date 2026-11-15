import * as THREE from "three";
import { getSoftParticleTexture } from "../world/World3DTextures";

export type Megalith3DPiece = {
  id: string;
  label: string;
  mesh: THREE.Group;
  basePosition: THREE.Vector3;
  targetPosition: THREE.Vector3;
  targetRotation: THREE.Euler;
  currentRotation: THREE.Euler;
  isPlaced: boolean;
};

export type MegalithWorkshopHandle = {
  root: THREE.Group;
  pieces: Megalith3DPiece[];
  update: (time: number, delta: number) => void;
  selectPiece: (id: string | null) => void;
  rotateSelectedPiece: (axis: "x" | "y" | "z", angleDelta: number) => void;
  trySnapPiece: (id: string, force?: boolean) => boolean;
  getPieceAngleDeg: (id: string) => number;
  isComplete: () => boolean;
  dispose: () => void;
};

function createSandstoneTexture(): { diffuse: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#4a4237";
  ctx.fillRect(0, 0, 512, 512);

  // Weathering noise
  for (let i = 0; i < 3000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = Math.random() * 3 + 1;
    const shade = Math.floor(Math.random() * 50 + 50);
    ctx.fillStyle = `rgba(${shade + 10}, ${shade}, ${shade - 10}, 0.35)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ancient weathered fissures
  ctx.strokeStyle = "rgba(25, 20, 15, 0.45)";
  ctx.lineWidth = 2.5;
  for (let l = 0; l < 8; l++) {
    ctx.beginPath();
    let cx = Math.random() * 512;
    let cy = Math.random() * 512;
    ctx.moveTo(cx, cy);
    for (let s = 0; s < 6; s++) {
      cx += (Math.random() - 0.5) * 60;
      cy += (Math.random() - 0.5) * 60;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }

  const diffuse = new THREE.CanvasTexture(canvas);

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = 512;
  bumpCanvas.height = 512;
  const bctx = bumpCanvas.getContext("2d")!;
  bctx.fillStyle = "#808080";
  bctx.fillRect(0, 0, 512, 512);

  bctx.strokeStyle = "#1a1a1a";
  bctx.lineWidth = 4;
  for (let l = 0; l < 8; l++) {
    bctx.beginPath();
    let cx = Math.random() * 512;
    let cy = Math.random() * 512;
    bctx.moveTo(cx, cy);
    for (let s = 0; s < 6; s++) {
      cx += (Math.random() - 0.5) * 60;
      cy += (Math.random() - 0.5) * 60;
      bctx.lineTo(cx, cy);
    }
    bctx.stroke();
  }

  const bump = new THREE.CanvasTexture(bumpCanvas);
  return { diffuse, bump };
}

function sculptStoneMesh(geo: THREE.BufferGeometry, noiseScale = 0.06) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const noise = (Math.sin(vx * 7) * Math.cos(vy * 7) * Math.sin(vz * 7)) * noiseScale;
    pos.setXYZ(i, vx + noise, vy + noise, vz + noise);
  }
  geo.computeVertexNormals();
}

export function createMegalithWorkshop(onPieceSnapped?: (pieceId: string) => void): MegalithWorkshopHandle {
  const root = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  const { diffuse: stoneTex, bump: stoneBump } = createSandstoneTexture();
  textures.push(stoneTex, stoneBump);

  const stoneMaterial = new THREE.MeshStandardMaterial({
    map: stoneTex,
    bumpMap: stoneBump,
    bumpScale: 0.07,
    color: 0x92826e,
    roughness: 0.86,
    metalness: 0.14
  });
  materials.push(stoneMaterial);

  const goldSeamMaterial = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    emissive: 0xffaa00,
    emissiveIntensity: 0.8,
    roughness: 0.15,
    metalness: 0.95
  });
  materials.push(goldSeamMaterial);

  // Multi-Tiered Altar Pedestal with Recessed Mortise Socket
  const lowerStepGeo = new THREE.CylinderGeometry(3.6, 3.85, 0.24, 48);
  geometries.push(lowerStepGeo);
  const pedestalMat = new THREE.MeshStandardMaterial({
    color: 0x091413,
    roughness: 0.5,
    metalness: 0.7
  });
  materials.push(pedestalMat);
  const lowerStep = new THREE.Mesh(lowerStepGeo, pedestalMat);
  lowerStep.position.y = -1.82;
  lowerStep.receiveShadow = true;
  root.add(lowerStep);

  const pedestalGeo = new THREE.CylinderGeometry(3.2, 3.5, 0.45, 48);
  geometries.push(pedestalGeo);
  const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
  pedestal.position.y = -1.55;
  pedestal.receiveShadow = true;
  root.add(pedestal);

  // Recessed Mortise Socket Rim & Sunken Bed matching the 3 Megalith Fragments
  const socketRimGeo = new THREE.BoxGeometry(3.45, 0.14, 1.38);
  geometries.push(socketRimGeo);
  const socketRim = new THREE.Mesh(socketRimGeo, goldSeamMaterial);
  socketRim.position.set(0, -1.32, 0);
  root.add(socketRim);

  const socketWellMat = new THREE.MeshStandardMaterial({
    color: 0x040908,
    roughness: 0.85,
    metalness: 0.3
  });
  materials.push(socketWellMat);
  for (const sx of [-1.05, 0, 1.05]) {
    const mortiseGeo = new THREE.BoxGeometry(0.95, 0.16, 1.12);
    geometries.push(mortiseGeo);
    const mortise = new THREE.Mesh(mortiseGeo, socketWellMat);
    mortise.position.set(sx, -1.30, 0);
    root.add(mortise);
  }

  // Decorative Altar Gold Ring & 16 Lotus Petals
  const altarRingGeo = new THREE.TorusGeometry(3.3, 0.045, 12, 64);
  geometries.push(altarRingGeo);
  const altarRing = new THREE.Mesh(altarRingGeo, goldSeamMaterial);
  altarRing.rotation.x = Math.PI / 2;
  altarRing.position.y = -1.34;
  root.add(altarRing);

  // 3 Megalith Pieces Config
  const configs = [
    {
      id: "left",
      label: "力",
      targetPos: new THREE.Vector3(-1.05, 0, 0),
      startPos: new THREE.Vector3(-2.8, -0.2, 0.6),
      scale: new THREE.Vector3(1.1, 1.8, 0.9),
      glyphColor: 0x1d7f73
    },
    {
      id: "center",
      label: "石",
      targetPos: new THREE.Vector3(0, 0.15, 0),
      startPos: new THREE.Vector3(0, -0.2, 2.0),
      scale: new THREE.Vector3(1.2, 2.1, 0.95),
      glyphColor: 0xb88735
    },
    {
      id: "right",
      label: "潮",
      targetPos: new THREE.Vector3(1.05, 0, 0),
      startPos: new THREE.Vector3(2.8, -0.2, 0.6),
      scale: new THREE.Vector3(1.1, 1.8, 0.9),
      glyphColor: 0xb9402f
    }
  ];

  const pieces: Megalith3DPiece[] = [];
  let selectedPieceId: string | null = null;
  const kintsugiArcs: THREE.Mesh[] = [];

  for (let i = 0; i < configs.length; i++) {
    const cfg = configs[i];
    const group = new THREE.Group();
    group.position.copy(cfg.startPos);

    // Initial orientation: exact multiples of 30 degrees (Math.PI / 6) so +/-30° buttons align to 0°
    const initialAngles = [-2 * (Math.PI / 6), 3 * (Math.PI / 6), -4 * (Math.PI / 6)];
    const initRot = new THREE.Euler(0, initialAngles[i] ?? Math.PI / 3, 0);
    group.rotation.copy(initRot);

    // Irregular polygonal megalith fragment geometry with sculpted organic chiseling
    const geo = new THREE.DodecahedronGeometry(1.0, 2);
    geo.scale(cfg.scale.x, cfg.scale.y, cfg.scale.z);
    sculptStoneMesh(geo, 0.06);
    geometries.push(geo);

    const mesh = new THREE.Mesh(geo, stoneMaterial);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    // Embossed relief Ancient Character Glyphs on the front facet
    const glyphCanvas = document.createElement("canvas");
    glyphCanvas.width = 128;
    glyphCanvas.height = 128;
    const gctx = glyphCanvas.getContext("2d")!;
    gctx.fillStyle = "rgba(0,0,0,0)";
    gctx.fillRect(0, 0, 128, 128);
    gctx.font = "bold 72px 'Microsoft YaHei', sans-serif";
    gctx.textAlign = "center";
    gctx.textBaseline = "middle";
    gctx.fillStyle = "#ffe29a";
    gctx.shadowColor = "#000000";
    gctx.shadowBlur = 8;
    gctx.fillText(cfg.label, 64, 64);

    const glyphTex = new THREE.CanvasTexture(glyphCanvas);
    textures.push(glyphTex);

    const glyphMat = new THREE.MeshBasicMaterial({
      map: glyphTex,
      transparent: true,
      opacity: 0.9
    });
    materials.push(glyphMat);

    const glyphPlaneGeo = new THREE.PlaneGeometry(1.12, 1.12);
    geometries.push(glyphPlaneGeo);
    const glyphMesh = new THREE.Mesh(glyphPlaneGeo, glyphMat);
    glyphMesh.position.set(0, 0, 0.89);

    // 3D Beveled Stone Relief Tablet & Gold Cartouche Frame backing the glyph (child index 1)
    const cartoucheGroup = new THREE.Group();
    const reliefTabletGeo = new THREE.BoxGeometry(1.22, 1.22, 0.12);
    geometries.push(reliefTabletGeo);
    const reliefTablet = new THREE.Mesh(reliefTabletGeo, stoneMaterial);
    reliefTablet.position.set(0, 0, 0.82);
    cartoucheGroup.add(reliefTablet);

    const frameRimGeo = new THREE.BoxGeometry(1.28, 1.28, 0.08);
    geometries.push(frameRimGeo);
    const frameRim = new THREE.Mesh(frameRimGeo, goldSeamMaterial);
    frameRim.position.set(0, 0, 0.80);
    cartoucheGroup.add(frameRim);

    cartoucheGroup.add(glyphMesh);
    group.add(cartoucheGroup);

    // True 3D Concentric Runic Selection Halo Ring (child index 2)
    const haloGeo = new THREE.TorusGeometry(1.26, 0.045, 12, 36);
    geometries.push(haloGeo);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x3de0c8,
      transparent: true,
      opacity: 0
    });
    materials.push(haloMat);
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    haloMesh.rotation.x = Math.PI / 2;
    haloMesh.position.y = -1.1;
    group.add(haloMesh);

    root.add(group);

    pieces.push({
      id: cfg.id,
      label: cfg.label,
      mesh: group,
      basePosition: cfg.startPos.clone(),
      targetPosition: cfg.targetPos.clone(),
      targetRotation: new THREE.Euler(0, 0, 0),
      currentRotation: initRot,
      isPlaced: false
    });
  }

  // Organic Branching 3D Golden Kintsugi Fracture Veins between fragments
  for (let s = 0; s < 2; s++) {
    const sx = s === 0 ? -0.54 : 0.54;
    const tilt = s === 0 ? 1 : -1;
    const mainPts = [
      new THREE.Vector3(sx - 0.14 * tilt, -1.35, 0.18),
      new THREE.Vector3(sx + 0.06 * tilt, -0.65, 0.52),
      new THREE.Vector3(sx - 0.08 * tilt, 0.05, 0.68),
      new THREE.Vector3(sx + 0.09 * tilt, 0.75, 0.54),
      new THREE.Vector3(sx - 0.05 * tilt, 1.42, 0.20)
    ];
    const mainCurve = new THREE.CatmullRomCurve3(mainPts);
    const seamGeo = new THREE.TubeGeometry(mainCurve, 24, 0.042, 8, false);
    geometries.push(seamGeo);
    const seamMesh = new THREE.Mesh(seamGeo, goldSeamMaterial);

    // Lateral branching Kintsugi sub-veins attached to the main seam mesh
    const branch1Pts = [
      new THREE.Vector3(sx + 0.04 * tilt, -0.45, 0.55),
      new THREE.Vector3(sx + 0.28 * tilt, -0.22, 0.64),
      new THREE.Vector3(sx + 0.46 * tilt, -0.08, 0.52)
    ];
    const branch1Geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(branch1Pts), 10, 0.024, 6, false);
    geometries.push(branch1Geo);
    seamMesh.add(new THREE.Mesh(branch1Geo, goldSeamMaterial));

    const branch2Pts = [
      new THREE.Vector3(sx - 0.04 * tilt, 0.42, 0.62),
      new THREE.Vector3(sx - 0.26 * tilt, 0.64, 0.60),
      new THREE.Vector3(sx - 0.42 * tilt, 0.78, 0.46)
    ];
    const branch2Geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(branch2Pts), 10, 0.022, 6, false);
    geometries.push(branch2Geo);
    seamMesh.add(new THREE.Mesh(branch2Geo, goldSeamMaterial));

    seamMesh.visible = false;
    root.add(seamMesh);
    kintsugiArcs.push(seamMesh);
  }

  // Golden Kintsugi particle sparkles
  const sparkleGeo = new THREE.BufferGeometry();
  const sparkleCount = 60;
  const sparklePositions = new Float32Array(sparkleCount * 3);
  for (let i = 0; i < sparkleCount; i++) {
    sparklePositions[i * 3] = (Math.random() - 0.5) * 1.6;
    sparklePositions[i * 3 + 1] = (Math.random() - 0.5) * 2.2;
    sparklePositions[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
  }
  sparkleGeo.setAttribute("position", new THREE.BufferAttribute(sparklePositions, 3));
  geometries.push(sparkleGeo);
  const sparkleMat = new THREE.PointsMaterial({
    color: 0xffe29a,
    map: getSoftParticleTexture(),
    alphaTest: 0.02,
    depthWrite: false,
    size: 0.14,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending
  });
  materials.push(sparkleMat);
  const sparklePoints = new THREE.Points(sparkleGeo, sparkleMat);
  sparklePoints.position.set(0, 0.1, 0.1);
  root.add(sparklePoints);

  return {
    root,
    pieces,
    update: (_time: number, delta: number) => {
      // Gentle floating animation for unplaced pieces
      for (const piece of pieces) {
        if (!piece.isPlaced && piece.id !== selectedPieceId) {
          piece.mesh.position.y = piece.basePosition.y + Math.sin(_time * 0.002 + piece.basePosition.x) * 0.08;
        }
      }
      // Dynamic pulsating glow for kintsugi golden veins
      if (kintsugiArcs.some((arc) => arc.visible)) {
        goldSeamMaterial.emissiveIntensity = 0.85 + Math.sin(_time * 0.006) * 0.45;
      }
      if (sparkleMat.opacity > 0) {
        sparkleMat.opacity = Math.max(0, sparkleMat.opacity - delta * 0.8);
      }
    },
    selectPiece: (id: string | null) => {
      selectedPieceId = id;
      for (const piece of pieces) {
        const isSel = piece.id === id && !piece.isPlaced;
        const halo = piece.mesh.children[2] as THREE.Mesh;
        if (halo && halo.material instanceof THREE.MeshBasicMaterial) {
          halo.material.opacity = isSel ? 0.75 : 0;
        }
      }
    },
    rotateSelectedPiece: (axis: "x" | "y" | "z", angleDelta: number) => {
      if (!selectedPieceId) return;
      const piece = pieces.find((p) => p.id === selectedPieceId);
      if (!piece || piece.isPlaced) return;

      piece.mesh.rotation[axis] += angleDelta;
      piece.currentRotation.copy(piece.mesh.rotation);
    },
    trySnapPiece: (id: string, force = false) => {
      const piece = pieces.find((p) => p.id === id);
      if (!piece || piece.isPlaced) return false;

      // Check alignment tolerance: orientation around Y axis close to 0 (or multiple of 2PI)
      const normRotY = Math.abs(piece.mesh.rotation.y % (Math.PI * 2));
      const angleTolerance = 0.65; // ~37 degrees tolerance
      const isAngleAligned = normRotY < angleTolerance || normRotY > Math.PI * 2 - angleTolerance;

      // Distance to target
      const dist = piece.mesh.position.distanceTo(piece.targetPosition);
      const isNearTarget = dist < 3.2;

      if (force || (isAngleAligned && isNearTarget)) {
        // Snap into place
        piece.isPlaced = true;
        piece.mesh.position.copy(piece.targetPosition);
        piece.mesh.rotation.set(0, 0, 0);
        piece.currentRotation.set(0, 0, 0);

        // Turn off halo
        const halo = piece.mesh.children[2] as THREE.Mesh;
        if (halo && halo.material instanceof THREE.MeshBasicMaterial) {
          halo.material.opacity = 0;
        }

        // Trigger kintsugi sparkle burst
        sparkleMat.opacity = 1.0;

        // Show corresponding kintsugi seam
        const placedCount = pieces.filter((p) => p.isPlaced).length;
        if (placedCount >= 2 && kintsugiArcs[0]) {
          kintsugiArcs[0].visible = true;
        }
        if (placedCount >= 3 && kintsugiArcs[1]) {
          kintsugiArcs[1].visible = true;
        }

        if (onPieceSnapped) {
          onPieceSnapped(piece.id);
        }
        return true;
      }
      return false;
    },
    getPieceAngleDeg: (id: string) => {
      const piece = pieces.find((p) => p.id === id);
      if (!piece || piece.isPlaced) return 0;
      let deg = Math.round((piece.mesh.rotation.y * 180) / Math.PI) % 360;
      if (deg > 180) deg -= 360;
      if (deg <= -180) deg += 360;
      return deg;
    },
    isComplete: () => {
      return pieces.every((p) => p.isPlaced);
    },
    dispose: () => {
      for (const geo of geometries) geo.dispose();
      for (const mat of materials) mat.dispose();
      for (const tex of textures) tex.dispose();
    }
  };
}
