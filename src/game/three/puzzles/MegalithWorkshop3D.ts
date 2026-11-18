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

  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, "#9e6648");
  grad.addColorStop(0.45, "#b07756");
  grad.addColorStop(0.8, "#8b563c");
  grad.addColorStop(1, "#9f694b");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Sedimentary sandstone strata & mineral flecks
  for (let band = -100; band < 600; band += 28) {
    ctx.strokeStyle = band % 56 === 0 ? "rgba(218, 168, 124, 0.18)" : "rgba(68, 36, 22, 0.16)";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(0, band);
    ctx.lineTo(512, band + 60);
    ctx.stroke();
  }

  for (let i = 0; i < 2800; i++) {
    const x = (i * 157.3) % 512;
    const y = (i * 283.9) % 512;
    const r = (i % 3) * 0.75 + 0.6;
    const shade = 128 + (i % 70);
    ctx.fillStyle =
      i % 6 === 0
        ? "rgba(242, 206, 160, 0.25)"
        : `rgba(${shade}, ${Math.floor(shade * 0.66)}, ${Math.floor(shade * 0.46)}, 0.24)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = 512;
  bumpCanvas.height = 512;
  const bctx = bumpCanvas.getContext("2d")!;
  bctx.fillStyle = "#828282";
  bctx.fillRect(0, 0, 512, 512);

  // Carved horizontal Kawi paleographic script rows across the stele surface
  for (let row = 38; row < 482; row += 30) {
    ctx.strokeStyle = "rgba(62, 33, 20, 0.26)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, row - 9);
    ctx.lineTo(492, row - 9);
    ctx.stroke();

    for (let col = 26; col < 480; col += 24) {
      const g = (row * 19 + col * 13) % 4;
      ctx.strokeStyle = "rgba(240, 198, 150, 0.46)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(col + 8, row + 1.5, 6, 0.2, Math.PI * 1.3);
      ctx.stroke();

      ctx.strokeStyle = "rgba(54, 25, 14, 0.76)";
      ctx.lineWidth = 2.4;
      bctx.strokeStyle = "#1e1e1e";
      bctx.lineWidth = 3.2;

      for (const target of [ctx, bctx]) {
        target.beginPath();
        if (g === 0) {
          target.arc(col + 7, row, 5.8, 0.1, Math.PI * 1.55);
          target.moveTo(col + 13, row - 6);
          target.lineTo(col + 13, row + 7);
        } else if (g === 1) {
          target.moveTo(col + 2, row + 6);
          target.lineTo(col + 5, row - 6);
          target.lineTo(col + 12, row - 6);
          target.lineTo(col + 15, row + 6);
        } else if (g === 2) {
          target.moveTo(col + 2, row - 5);
          target.lineTo(col + 15, row - 5);
          target.moveTo(col + 8, row - 5);
          target.lineTo(col + 6, row + 6);
          target.lineTo(col + 13, row + 6);
        } else {
          target.arc(col + 8, row + 1, 5.2, Math.PI * 0.5, Math.PI * 2.1);
        }
        target.stroke();
      }
    }
  }

  const diffuse = new THREE.CanvasTexture(canvas);
  diffuse.wrapS = THREE.RepeatWrapping;
  diffuse.wrapT = THREE.RepeatWrapping;
  diffuse.repeat.set(0.48, 0.48);

  const bump = new THREE.CanvasTexture(bumpCanvas);
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(0.48, 0.48);

  return { diffuse, bump };
}

function createGlyphTabletTexture(label: string, tally: string, isFront: boolean): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 224;
  const ctx = canvas.getContext("2d")!;

  const grad = ctx.createLinearGradient(0, 0, 192, 224);
  if (isFront) {
    grad.addColorStop(0, "#311d13");
    grad.addColorStop(0.5, "#45291a");
    grad.addColorStop(1, "#26150d");
  } else {
    grad.addColorStop(0, "#27231e");
    grad.addColorStop(1, "#191613");
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 192, 224);

  ctx.strokeStyle = isFront ? "#e6be6a" : "#7c6c56";
  ctx.lineWidth = 5;
  ctx.strokeRect(12, 12, 168, 200);
  ctx.strokeStyle = isFront ? "rgba(230, 190, 106, 0.45)" : "rgba(124, 108, 86, 0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(22, 22, 148, 180);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (isFront) {
    ctx.font = "bold 96px 'Songti SC', 'SimSun', 'Microsoft YaHei', serif";
    ctx.fillStyle = "#ffe296";
    ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
    ctx.shadowBlur = 8;
    ctx.fillText(label, 96, 100);

    ctx.shadowBlur = 0;
    ctx.font = "bold 20px sans-serif";
    ctx.fillStyle = "#e0b663";
    ctx.fillText(`FRAGMENT · ${tally}`, 96, 176);
  } else {
    ctx.font = "bold 52px serif";
    ctx.fillStyle = "rgba(182, 158, 124, 0.72)";
    ctx.fillText(tally, 96, 102);
    ctx.font = "bold 18px sans-serif";
    ctx.fillStyle = "rgba(150, 130, 102, 0.65)";
    ctx.fillText("REVERSE", 96, 158);
  }

  return new THREE.CanvasTexture(canvas);
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

export function createMegalithWorkshop(onPieceSnapped?: (pieceId: string) => void): MegalithWorkshopHandle {
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

  const { diffuse: stoneTex, bump: stoneBump } = createSandstoneTexture();
  trackTex(stoneTex);
  trackTex(stoneBump);

  const stoneMaterial = trackMat(
    new THREE.MeshStandardMaterial({
      map: stoneTex,
      bumpMap: stoneBump,
      bumpScale: 0.055,
      color: 0xdcb699,
      roughness: 0.76,
      metalness: 0.08
    })
  );

  const darkStoneTrimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x4d3122,
      roughness: 0.84,
      metalness: 0.14
    })
  );

  const goldSeamMaterial = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffd566,
      emissive: 0xd88814,
      emissiveIntensity: 0.58,
      roughness: 0.2,
      metalness: 0.92
    })
  );

  const altarStoneMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x162624,
      roughness: 0.44,
      metalness: 0.56
    })
  );

  const bronzeTrimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xc99c49,
      roughness: 0.28,
      metalness: 0.82
    })
  );

  // 1. Multi-Tiered Carved Lotus Altar Plinth with Recessed Stele Mortise Channel
  const lowerStep = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(3.65, 3.92, 0.24, 64)), altarStoneMat);
  lowerStep.position.y = -1.78;
  lowerStep.receiveShadow = true;
  root.add(lowerStep);

  const pedestal = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(3.18, 3.48, 0.42, 64)), altarStoneMat);
  pedestal.position.y = -1.48;
  pedestal.receiveShadow = true;
  root.add(pedestal);

  // 24 Carved Lotus Petals crowning the upper altar rim
  const petalGeo = trackGeo(new THREE.ConeGeometry(0.18, 0.34, 6));
  petalGeo.scale(1.15, 1, 0.45);
  for (let p = 0; p < 24; p++) {
    const ang = (p * Math.PI * 2) / 24;
    const petal = new THREE.Mesh(petalGeo, p % 2 === 0 ? bronzeTrimMat : altarStoneMat);
    petal.position.set(Math.cos(ang) * 3.24, -1.36, Math.sin(ang) * 3.24);
    petal.rotation.y = -ang + Math.PI / 2;
    petal.rotation.x = 0.38;
    root.add(petal);
  }

  const altarRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(3.20, 0.038, 12, 64)), goldSeamMaterial);
  altarRing.rotation.x = Math.PI / 2;
  altarRing.position.y = -1.27;
  root.add(altarRing);

  // Recessed Stele Mortise Frame & 3 Sunken Fragment Beds + Front Alignment Arrow
  const socketRim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.56, 0.14, 0.96)), bronzeTrimMat);
  socketRim.position.set(0, -1.24, 0);
  socketRim.receiveShadow = true;
  root.add(socketRim);

  const socketWellMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x07100f,
      roughness: 0.85,
      metalness: 0.28
    })
  );
  for (const sx of [-1.08, 0, 1.08]) {
    const mortise = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.98, 0.16, 0.72)), socketWellMat);
    mortise.position.set(sx, -1.22, 0);
    root.add(mortise);
  }

  // Front Meridian Pointer on the Altar Rim indicating 0° Front Alignment (+Z)
  const frontPointer = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.14, 0.26, 4)), goldSeamMaterial);
  frontPointer.rotation.x = Math.PI / 2;
  frontPointer.rotation.y = Math.PI / 4;
  frontPointer.position.set(0, -1.20, 0.58);
  root.add(frontPointer);

  // 2. Three Interlocking Chiseled Sandstone Stele Slab Wedges ("力 · 石 · 潮")
  // When placed at targetPos (-1.08, 0, +1.08), their adjacent jagged edges interlock cleanly along x ≈ ±0.54!
  const configs: Array<{
    id: string;
    label: string;
    tally: string;
    targetPos: THREE.Vector3;
    startPos: THREE.Vector3;
    localPoly: Array<[number, number]>;
    depth: number;
  }> = [
    {
      id: "left",
      label: "力",
      tally: "I",
      targetPos: new THREE.Vector3(-1.08, 0.04, 0),
      startPos: new THREE.Vector3(-2.55, 0.04, 0.45),
      localPoly: [
        [-0.62, -1.22],
        [0.51, -1.22],
        [0.58, -0.42],
        [0.46, 0.34],
        [0.55, 1.06],
        [-0.08, 0.92],
        [-0.56, 0.44],
        [-0.68, -0.38]
      ],
      depth: 0.52
    },
    {
      id: "center",
      label: "石",
      tally: "II",
      targetPos: new THREE.Vector3(0, 0.04, 0),
      startPos: new THREE.Vector3(0, 0.12, 1.35),
      localPoly: [
        [-0.54, -1.22],
        [0.54, -1.22],
        [0.48, -0.36],
        [0.56, 0.42],
        [0.48, 1.08],
        [0.0, 1.54],
        [-0.49, 1.08],
        [-0.59, 0.34],
        [-0.47, -0.42]
      ],
      depth: 0.56
    },
    {
      id: "right",
      label: "潮",
      tally: "III",
      targetPos: new THREE.Vector3(1.08, 0.04, 0),
      startPos: new THREE.Vector3(2.55, 0.04, 0.45),
      localPoly: [
        [-0.51, -1.22],
        [0.62, -1.22],
        [0.68, -0.36],
        [0.54, 0.46],
        [0.08, 0.94],
        [-0.54, 1.08],
        [-0.47, 0.42],
        [-0.56, -0.36]
      ],
      depth: 0.52
    }
  ];

  const pieces: Megalith3DPiece[] = [];
  const selectionHalos: THREE.Mesh[] = [];
  let selectedPieceId: string | null = null;
  const kintsugiArcs: THREE.Group[] = [];

  // Exact multiples of 30 degrees (Math.PI / 6): -60°, +30°, -60° (shows 3/4 sculpted front & fracture bevels simultaneously!)
  const initialAngles = [-2 * (Math.PI / 6), 1 * (Math.PI / 6), -2 * (Math.PI / 6)];

  for (let i = 0; i < configs.length; i++) {
    const cfg = configs[i];
    const group = new THREE.Group();
    group.position.copy(cfg.startPos);

    const initRot = new THREE.Euler(0, initialAngles[i] ?? Math.PI / 3, 0);
    group.rotation.copy(initRot);

    // Chiseled sandstone stele wedge (child index 0)
    const slabShape = createPolygonShape(cfg.localPoly);
    const slabGeo = trackGeo(
      new THREE.ExtrudeGeometry(slabShape, {
        depth: cfg.depth,
        bevelEnabled: true,
        bevelThickness: 0.055,
        bevelSize: 0.045,
        bevelSegments: 3,
        curveSegments: 8
      })
    );
    slabGeo.translate(0, 0, -cfg.depth * 0.5);

    // Subtle hand-dressed rock-chisel undulation along fracture edges
    const pos = slabGeo.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      const vx = pos.getX(v);
      const vy = pos.getY(v);
      const vz = pos.getZ(v);
      const edgeFactor = 1 - Math.min(1, Math.abs(vz) / (cfg.depth * 0.52)) * 0.78;
      const chisel = Math.sin((vx + i * 1.7) * 8.5 + vy * 6.2) * 0.022 * edgeFactor;
      pos.setXYZ(v, vx + chisel, vy + chisel * 0.6, vz + Math.cos(vx * 6.0 + vy * 5.5) * 0.01);
    }
    slabGeo.computeVertexNormals();

    const slabMesh = new THREE.Mesh(slabGeo, stoneMaterial);
    slabMesh.castShadow = true;
    slabMesh.receiveShadow = true;
    group.add(slabMesh);

    // Sunken Carved Seal Cartouche on Front (+Z) & Mason's Tally on Back (-Z) + Top +Z Compass Chevron (child index 1)
    const cartoucheGroup = new THREE.Group();
    const frontFaceZ = cfg.depth * 0.5 + 0.052;

    const frontFrame = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.68, 0.80, 0.036)), bronzeTrimMat);
    frontFrame.position.set(0, -0.04, frontFaceZ);
    cartoucheGroup.add(frontFrame);

    const frontBed = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.60, 0.72, 0.042)), darkStoneTrimMat);
    frontBed.position.set(0, -0.04, frontFaceZ + 0.006);
    cartoucheGroup.add(frontBed);

    const frontTex = trackTex(createGlyphTabletTexture(cfg.label, cfg.tally, true));
    const frontMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: frontTex,
        roughness: 0.36,
        metalness: 0.45
      })
    );
    const frontPlane = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(0.56, 0.68)), frontMat);
    frontPlane.position.set(0, -0.04, frontFaceZ + 0.03);
    cartoucheGroup.add(frontPlane);

    // Back-face mason's tally tablet so rotated pieces look deliberately sculpted from all 360°
    const backTex = trackTex(createGlyphTabletTexture(cfg.label, cfg.tally, false));
    const backMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: backTex,
        roughness: 0.62,
        metalness: 0.25
      })
    );
    const backFrame = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.52, 0.60, 0.03)), darkStoneTrimMat);
    backFrame.position.set(0, -0.06, -frontFaceZ);
    cartoucheGroup.add(backFrame);

    const backPlane = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(0.46, 0.54)), backMat);
    backPlane.rotation.y = Math.PI;
    backPlane.position.set(0, -0.06, -frontFaceZ - 0.018);
    cartoucheGroup.add(backPlane);

    // Center piece crown carries a sculpted Majapahit sun-medallion relief
    if (i === 1) {
      const sunCrest = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.20, 0.022, 10, 28)), goldSeamMaterial);
      sunCrest.position.set(0, 0.82, frontFaceZ + 0.01);
      cartoucheGroup.add(sunCrest);
    }

    // Golden Orientation Arrow inlaid on lower front plinth of each fragment (points +Z when at 0°)
    const alignPin = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.085, 0.16, 4)), goldSeamMaterial);
    alignPin.rotation.x = Math.PI / 2;
    alignPin.rotation.y = Math.PI / 4;
    alignPin.position.set(0, -0.92, frontFaceZ + 0.03);
    cartoucheGroup.add(alignPin);

    group.add(cartoucheGroup);

    // Ornate Concentric Turquoise Selection Halo Ring around base (child index 2)
    const haloGeo = trackGeo(new THREE.TorusGeometry(0.92, 0.038, 12, 48));
    const haloMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x3de0c8,
        transparent: true,
        opacity: 0
      })
    );
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    haloMesh.rotation.x = Math.PI / 2;
    haloMesh.position.y = -1.24;
    group.add(haloMesh);
    selectionHalos.push(haloMesh);

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

  // 3. Flush Surface-Routed 3D Golden Kintsugi Fracture Veins & Staples between Snapped Slabs
  const stapleGeo = trackGeo(new THREE.BoxGeometry(0.20, 0.032, 0.028));
  for (let s = 0; s < 2; s++) {
    const seamGroup = new THREE.Group();
    const sx = s === 0 ? -0.54 : 0.54;
    const sign = s === 0 ? 1 : -1;

    const frontPts = [
      new THREE.Vector3(sx - 0.03 * sign, -1.16, 0.335),
      new THREE.Vector3(sx + 0.04 * sign, -0.38, 0.345),
      new THREE.Vector3(sx - 0.06 * sign, 0.38, 0.345),
      new THREE.Vector3(sx + 0.02 * sign, 1.12, 0.33),
      new THREE.Vector3(sx + 0.02 * sign, 1.16, 0.0)
    ];
    const backPts = [
      new THREE.Vector3(sx - 0.03 * sign, -1.16, -0.335),
      new THREE.Vector3(sx + 0.04 * sign, -0.38, -0.345),
      new THREE.Vector3(sx - 0.06 * sign, 0.38, -0.345),
      new THREE.Vector3(sx + 0.02 * sign, 1.12, -0.33)
    ];

    seamGroup.add(
      new THREE.Mesh(
        trackGeo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(frontPts), 24, 0.032, 8, false)),
        goldSeamMaterial
      )
    );
    seamGroup.add(
      new THREE.Mesh(
        trackGeo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(backPts), 20, 0.028, 8, false)),
        goldSeamMaterial
      )
    );

    // Lateral golden lacquer capillary vein + 2 hammered gold repair staples
    const branchPts = [
      new THREE.Vector3(sx - 0.04 * sign, 0.28, 0.345),
      new THREE.Vector3(sx - 0.24 * sign, 0.48, 0.34),
      new THREE.Vector3(sx - 0.38 * sign, 0.58, 0.325)
    ];
    seamGroup.add(
      new THREE.Mesh(
        trackGeo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(branchPts), 12, 0.018, 6, false)),
        goldSeamMaterial
      )
    );

    for (const sy of [-0.46, 0.52]) {
      const staple = new THREE.Mesh(stapleGeo, goldSeamMaterial);
      staple.position.set(sx, sy, 0.35);
      staple.rotation.z = sy > 0 ? 0.14 * sign : -0.14 * sign;
      seamGroup.add(staple);
    }

    seamGroup.visible = false;
    root.add(seamGroup);
    kintsugiArcs.push(seamGroup);
  }

  // 4. Golden Kintsugi Particle Sparkles
  const sparkleGeo = trackGeo(new THREE.BufferGeometry());
  const sparkleCount = 64;
  const sparklePositions = new Float32Array(sparkleCount * 3);
  for (let i = 0; i < sparkleCount; i++) {
    sparklePositions[i * 3] = ((i * 73) % 100) / 50 - 1.0;
    sparklePositions[i * 3 + 1] = ((i * 131) % 100) / 45 - 1.1;
    sparklePositions[i * 3 + 2] = ((i * 47) % 100) / 140 - 0.35;
  }
  sparkleGeo.setAttribute("position", new THREE.BufferAttribute(sparklePositions, 3));
  const sparkleMat = trackMat(
    new THREE.PointsMaterial({
      color: 0xffe29a,
      map: getSoftParticleTexture(),
      alphaTest: 0.02,
      depthWrite: false,
      size: 0.13,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending
    })
  );
  const sparklePoints = new THREE.Points(sparkleGeo, sparkleMat);
  sparklePoints.position.set(0, 0.1, 0.2);
  root.add(sparklePoints);

  return {
    root,
    pieces,
    update: (_time: number, delta: number) => {
      for (const piece of pieces) {
        if (!piece.isPlaced && piece.id !== selectedPieceId) {
          piece.mesh.position.y = piece.basePosition.y + Math.sin(_time * 0.002 + piece.basePosition.x) * 0.06;
        }
      }
      if (kintsugiArcs.some((arc) => arc.visible)) {
        goldSeamMaterial.emissiveIntensity = 0.72 + Math.sin(_time * 0.005) * 0.32;
      }
      if (sparkleMat.opacity > 0) {
        sparkleMat.opacity = Math.max(0, sparkleMat.opacity - delta * 0.8);
      }
    },
    selectPiece: (id: string | null) => {
      selectedPieceId = id;
      for (let i = 0; i < pieces.length; i++) {
        const piece = pieces[i];
        const isSel = piece.id === id && !piece.isPlaced;
        const halo = selectionHalos[i];
        if (halo && halo.material instanceof THREE.MeshBasicMaterial) {
          halo.material.opacity = isSel ? 0.85 : 0;
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
      const pieceIdx = pieces.findIndex((p) => p.id === id);
      const piece = pieceIdx >= 0 ? pieces[pieceIdx] : undefined;
      if (!piece || piece.isPlaced) return false;

      const normRotY = Math.abs(piece.mesh.rotation.y % (Math.PI * 2));
      const angleTolerance = 0.65;
      const isAngleAligned = normRotY < angleTolerance || normRotY > Math.PI * 2 - angleTolerance;

      const dist = piece.mesh.position.distanceTo(piece.targetPosition);
      const isNearTarget = dist < 3.4;

      if (force || (isAngleAligned && isNearTarget)) {
        piece.isPlaced = true;
        piece.mesh.position.copy(piece.targetPosition);
        piece.mesh.rotation.set(0, 0, 0);
        piece.currentRotation.set(0, 0, 0);

        const halo = selectionHalos[pieceIdx];
        if (halo && halo.material instanceof THREE.MeshBasicMaterial) {
          halo.material.opacity = 0;
        }

        sparkleMat.opacity = 1.0;

        if (pieces[0].isPlaced && pieces[1].isPlaced && kintsugiArcs[0]) {
          kintsugiArcs[0].visible = true;
        }
        if (pieces[1].isPlaced && pieces[2].isPlaced && kintsugiArcs[1]) {
          kintsugiArcs[1].visible = true;
        }
        const placedCount = pieces.filter((p) => p.isPlaced).length;
        if (placedCount >= 2 && !kintsugiArcs[0].visible && !kintsugiArcs[1].visible) {
          kintsugiArcs[0].visible = true;
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
