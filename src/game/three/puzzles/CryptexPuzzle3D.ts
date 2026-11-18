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

  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, "#7c5f37");
  grad.addColorStop(0.5, "#9a7848");
  grad.addColorStop(1, "#6b502d");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 1800; i++) {
    const x = (i * 179.3) % 512;
    const y = (i * 293.1) % 512;
    const r = (i % 3) * 0.7 + 0.8;
    ctx.fillStyle = i % 5 === 0 ? "rgba(44, 138, 118, 0.25)" : "rgba(232, 192, 112, 0.22)";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fine lathe-turned circumferential grain
  ctx.strokeStyle = "rgba(245, 208, 135, 0.16)";
  ctx.lineWidth = 1;
  for (let y = 8; y < 512; y += 12) {
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

  bctx.strokeStyle = "#3a3a3a";
  bctx.lineWidth = 1.5;
  for (let y = 8; y < 512; y += 12) {
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
  canvas.width = 160;
  canvas.height = 176;
  const ctx = canvas.getContext("2d")!;

  const grad = ctx.createLinearGradient(0, 0, 160, 176);
  grad.addColorStop(0, "#1d140d");
  grad.addColorStop(0.5, "#2d2015");
  grad.addColorStop(1, "#160f09");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 160, 176);

  // Double gilt border with corner notches
  ctx.strokeStyle = "#d9af5b";
  ctx.lineWidth = 5;
  ctx.strokeRect(8, 8, 144, 160);
  ctx.strokeStyle = "rgba(217, 175, 91, 0.42)";
  ctx.lineWidth = 1.8;
  ctx.strokeRect(17, 17, 126, 142);

  // Crisp Golden Inscribed Maritime Cipher Glyph
  ctx.font = "bold 88px 'Songti SC', 'SimSun', 'Microsoft YaHei', serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffe086";
  ctx.shadowColor = "rgba(255, 170, 20, 0.55)";
  ctx.shadowBlur = 8;
  ctx.fillText(rune, 80, 90);

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

  const { diffuse: bronzeTex, bump: bronzeBump } = createBronzeTexture();
  trackTex(bronzeTex);
  trackTex(bronzeBump);

  const bronzeMaterial = trackMat(
    new THREE.MeshStandardMaterial({
      map: bronzeTex,
      bumpMap: bronzeBump,
      bumpScale: 0.04,
      color: 0xc29b61,
      roughness: 0.34,
      metalness: 0.72
    })
  );

  const goldFiligreeMaterial = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf5ca63,
      emissive: 0x4a3108,
      emissiveIntensity: 0.25,
      roughness: 0.22,
      metalness: 0.86
    })
  );

  const rosewoodMaterial = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x2c1810,
      roughness: 0.46,
      metalness: 0.18
    })
  );

  const innerCoreMaterial = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1c1712,
      roughness: 0.56,
      metalness: 0.58
    })
  );

  // Reading angle: rotating around +X by negative angle (-0.21 rad ≈ 12° upward) tilts +Z face up toward camera!
  const READ_ROT_X = -0.21;

  // 1. Central Rosewood & Gunmetal Core Barrel
  const axle = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.12, 1.12, 5.6, 36)), rosewoodMaterial);
  axle.rotation.z = Math.PI / 2;
  root.add(axle);

  // 2. Lathe-Turned Stepped Rosewood & Gilt-Bronze Scroll End-Caps with Finials
  const capProfile = [
    new THREE.Vector2(0.001, 0.92),
    new THREE.Vector2(0.28, 0.88),
    new THREE.Vector2(0.36, 0.72),
    new THREE.Vector2(0.26, 0.58),
    new THREE.Vector2(0.72, 0.50),
    new THREE.Vector2(1.18, 0.38),
    new THREE.Vector2(1.48, 0.28),
    new THREE.Vector2(1.56, 0.14),
    new THREE.Vector2(1.52, 0.0),
    new THREE.Vector2(1.36, -0.06),
    new THREE.Vector2(0.95, -0.06)
  ];
  const latheCapGeo = trackGeo(new THREE.LatheGeometry(capProfile, 40));

  for (const side of [-1, 1] as const) {
    const capGroup = new THREE.Group();
    capGroup.position.x = side * 2.42;
    // Lathe axis is +Y; rotate so +Y points outward along -X (left) or +X (right)
    capGroup.rotation.z = side < 0 ? Math.PI / 2 : -Math.PI / 2;

    const capMesh = new THREE.Mesh(latheCapGeo, bronzeMaterial);
    capMesh.castShadow = true;
    capMesh.receiveShadow = true;
    capGroup.add(capMesh);

    const collarRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(1.53, 0.042, 12, 40)), goldFiligreeMaterial);
    collarRing.rotation.x = Math.PI / 2;
    collarRing.position.y = 0.18;
    capGroup.add(collarRing);

    const medRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.96, 0.032, 10, 32)), goldFiligreeMaterial);
    medRing.rotation.x = Math.PI / 2;
    medRing.position.y = 0.44;
    capGroup.add(medRing);

    // 8 decorative axial flutes along each end-cap crown
    const fluteGeo = trackGeo(new THREE.BoxGeometry(0.055, 0.24, 0.06));
    for (let f = 0; f < 8; f++) {
      const ang = (f * Math.PI) / 4;
      const flute = new THREE.Mesh(fluteGeo, goldFiligreeMaterial);
      flute.position.set(Math.cos(ang) * 1.48, 0.16, Math.sin(ang) * 1.48);
      flute.rotation.y = -ang;
      capGroup.add(flute);
    }

    root.add(capGroup);
  }

  // 3. Ornate Openwork Brass & Turquoise Reading Window Bridge (shares exact READ_ROT_X pivot!)
  const bridgePivot = new THREE.Group();
  bridgePivot.rotation.x = READ_ROT_X;
  root.add(bridgePivot);

  const guideMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x3de0c8,
      emissive: 0x167a6e,
      emissiveIntensity: 0.68,
      roughness: 0.22,
      metalness: 0.65
    })
  );

  const railBrassGeo = trackGeo(new THREE.BoxGeometry(4.92, 0.085, 0.12));
  const railInlayGeo = trackGeo(new THREE.BoxGeometry(4.86, 0.034, 0.135));
  for (const ry of [0.58, -0.58]) {
    const brassRail = new THREE.Mesh(railBrassGeo, goldFiligreeMaterial);
    brassRail.position.set(0, ry, 1.45);
    bridgePivot.add(brassRail);

    const inlayRail = new THREE.Mesh(railInlayGeo, guideMat);
    inlayRail.position.set(0, ry, 1.46);
    bridgePivot.add(inlayRail);
  }

  // 5 Vertical Bridge Stile Dividers framing each of the 4 active cipher windows + 8 Pointer Chevrons
  const stileGeo = trackGeo(new THREE.BoxGeometry(0.065, 1.22, 0.09));
  for (const sx of [-2.34, -1.16, 0, 1.16, 2.34]) {
    const stile = new THREE.Mesh(stileGeo, goldFiligreeMaterial);
    stile.position.set(sx, 0, 1.45);
    bridgePivot.add(stile);
  }

  const ringXPositions = [-1.74, -0.58, 0.58, 1.74];
  const chevronGeo = trackGeo(new THREE.ConeGeometry(0.065, 0.11, 4));
  for (const rx of ringXPositions) {
    const topChevron = new THREE.Mesh(chevronGeo, goldFiligreeMaterial);
    topChevron.rotation.z = Math.PI;
    topChevron.rotation.y = Math.PI / 4;
    topChevron.position.set(rx, 0.50, 1.50);
    bridgePivot.add(topChevron);

    const botChevron = new THREE.Mesh(chevronGeo, goldFiligreeMaterial);
    botChevron.rotation.y = Math.PI / 4;
    botChevron.position.set(rx, -0.50, 1.50);
    bridgePivot.add(botChevron);
  }

  // 4. Four Rotating Bronze & Gilt Cipher Dial Drums
  const rings: CryptexRing[] = [];
  const selectionHaloMats: THREE.MeshBasicMaterial[] = [];

  const bodyGeo = trackGeo(new THREE.CylinderGeometry(1.32, 1.32, 0.98, 36));
  const ringBorderGeo = trackGeo(new THREE.TorusGeometry(1.34, 0.038, 12, 40));
  const knurlToothGeo = trackGeo(new THREE.BoxGeometry(0.065, 0.048, 0.075));
  const dividerGeo = trackGeo(new THREE.CylinderGeometry(1.24, 1.24, 0.14, 32));
  const ratchetToothGeo = trackGeo(new THREE.BoxGeometry(0.055, 0.09, 0.08));
  const cartoucheBoxGeo = trackGeo(new THREE.BoxGeometry(0.86, 0.92, 0.075));
  const filletRimGeo = trackGeo(new THREE.BoxGeometry(0.94, 1.00, 0.045));
  const facetPlaneGeo = trackGeo(new THREE.PlaneGeometry(0.80, 0.86));
  const rosetteRingGeo = trackGeo(new THREE.TorusGeometry(0.22, 0.024, 8, 20));
  const rosetteStudGeo = trackGeo(new THREE.OctahedronGeometry(0.07, 0));

  for (let r = 0; r < 4; r++) {
    const ringGroup = new THREE.Group();
    ringGroup.position.x = ringXPositions[r];

    const body = new THREE.Mesh(bodyGeo, bronzeMaterial);
    body.rotation.z = Math.PI / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    ringGroup.add(body);

    for (const bOffset of [-0.46, 0.46]) {
      const ringBorder = new THREE.Mesh(ringBorderGeo, goldFiligreeMaterial);
      ringBorder.rotation.y = Math.PI / 2;
      ringBorder.position.x = bOffset;
      ringGroup.add(ringBorder);

      for (let k = 0; k < 24; k++) {
        const kAng = (k * Math.PI * 2) / 24;
        // Place knurl via pivot around +X for clean radial normal
        const kPivot = new THREE.Group();
        kPivot.rotation.x = kAng;
        const knurl = new THREE.Mesh(knurlToothGeo, bronzeMaterial);
        knurl.position.set(bOffset, 0, 1.36);
        kPivot.add(knurl);
        ringGroup.add(kPivot);
      }
    }

    if (r < 3) {
      const divider = new THREE.Mesh(dividerGeo, innerCoreMaterial);
      divider.rotation.z = Math.PI / 2;
      divider.position.x = 0.58;
      ringGroup.add(divider);

      for (let rt = 0; rt < 16; rt++) {
        const rtPivot = new THREE.Group();
        rtPivot.rotation.x = (rt * Math.PI * 2) / 16;
        const rTooth = new THREE.Mesh(ratchetToothGeo, goldFiligreeMaterial);
        rTooth.position.set(0.58, 0, 1.26);
        rtPivot.add(rTooth);
        ringGroup.add(rtPivot);
      }
    }

    // 4 Upright Outward-Facing Rune Cartouches via exact X-axis Pivot Groups!
    // When ringGroup.rotation.x === READ_ROT_X - selectedIndex * (PI / 2),
    // facet f === selectedIndex has total X rotation === READ_ROT_X, facing straight out into bridgePivot!
    const options = RING_OPTIONS[r];
    for (let f = 0; f < 4; f++) {
      const facetPivot = new THREE.Group();
      facetPivot.rotation.x = f * (Math.PI / 2);

      const runeTex = trackTex(createRuneFaceTexture(options[f]));
      const facetMat = trackMat(
        new THREE.MeshStandardMaterial({
          map: runeTex,
          roughness: 0.32,
          metalness: 0.48
        })
      );

      const filletMesh = new THREE.Mesh(filletRimGeo, goldFiligreeMaterial);
      filletMesh.position.z = 1.325;
      facetPivot.add(filletMesh);

      const cartoucheMesh = new THREE.Mesh(cartoucheBoxGeo, bronzeMaterial);
      cartoucheMesh.position.z = 1.345;
      facetPivot.add(cartoucheMesh);

      const facet = new THREE.Mesh(facetPlaneGeo, facetMat);
      facet.position.z = 1.386;
      facetPivot.add(facet);

      ringGroup.add(facetPivot);

      // Decorative filigree compass rosette at each 45° intermediate facet around the drum
      const midPivot = new THREE.Group();
      midPivot.rotation.x = (f + 0.5) * (Math.PI / 2);
      const rosette = new THREE.Mesh(rosetteRingGeo, goldFiligreeMaterial);
      rosette.position.z = 1.33;
      midPivot.add(rosette);
      const stud = new THREE.Mesh(rosetteStudGeo, bronzeMaterial);
      stud.position.z = 1.34;
      midPivot.add(stud);
      ringGroup.add(midPivot);
    }

    // Initial combination: ["川", "龙", "户", "日"] (unsolved), perfectly centered in the reading bridge!
    const initialIndex = (r * 2 + 2) % 4;
    const initialAngle = READ_ROT_X - initialIndex * (Math.PI / 2);
    ringGroup.rotation.x = initialAngle;

    // Dual flanking turquoise bezel halos on left & right rims of the selected drum (never cuts through the active glyph!)
    const selHaloGeo = trackGeo(new THREE.TorusGeometry(1.40, 0.032, 12, 48));
    const selHaloMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x3de0c8,
        transparent: true,
        opacity: r === 0 ? 0.90 : 0
      })
    );
    for (const hOff of [-0.48, 0.48]) {
      const selHalo = new THREE.Mesh(selHaloGeo, selHaloMat);
      selHalo.rotation.y = Math.PI / 2;
      selHalo.position.x = ringXPositions[r] + hOff;
      root.add(selHalo);
    }
    selectionHaloMats.push(selHaloMat);

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

  let solved = false;

  // 5. Stepped Museum Rosewood & Brass Display Stand with True U-Shaped Saddle Cradles
  const standMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x121d1c,
      roughness: 0.42,
      metalness: 0.56
    })
  );

  const standLower = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.5, 0.22, 2.75)), standMat);
  standLower.position.y = -2.02;
  standLower.receiveShadow = true;
  root.add(standLower);

  const standUpper = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(5.95, 0.20, 2.35)), rosewoodMaterial);
  standUpper.position.y = -1.82;
  standUpper.receiveShadow = true;
  root.add(standUpper);

  const standTrim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.02, 0.05, 2.42)), goldFiligreeMaterial);
  standTrim.position.y = -1.72;
  root.add(standTrim);

  // Extruded U-shaped saddle cradles hugging the X-axis end-caps at x = ±2.52 (oriented in YZ plane!)
  const saddleShape = new THREE.Shape();
  saddleShape.moveTo(-1.76, -1.72);
  saddleShape.lineTo(1.76, -1.72);
  saddleShape.lineTo(1.76, -0.45);
  saddleShape.lineTo(1.48, -0.45);
  saddleShape.absarc(0, 0, 1.54, -0.28, -Math.PI + 0.28, true);
  saddleShape.lineTo(-1.76, -0.45);
  saddleShape.closePath();

  const saddleGeo = trackGeo(
    new THREE.ExtrudeGeometry(saddleShape, {
      depth: 0.28,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 2,
      curveSegments: 28
    })
  );
  saddleGeo.translate(0, 0, -0.14);
  // Rotate so XY shape lies in YZ plane (hugging cylinder whose axis is X!)
  saddleGeo.rotateY(Math.PI / 2);

  for (const cx of [-2.52, 2.52]) {
    const saddle = new THREE.Mesh(saddleGeo, standMat);
    saddle.position.x = cx;
    saddle.castShadow = true;
    saddle.receiveShadow = true;
    root.add(saddle);
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

      if (solved) {
        guideMat.emissiveIntensity = 0.85 + Math.sin(_time * 0.006) * 0.38;
      }
    },
    selectRing: (index: number | null) => {
      for (let i = 0; i < selectionHaloMats.length; i++) {
        selectionHaloMats[i].opacity = i === index ? 0.90 : 0;
      }
    },
    rotateRing: (index: number, step: 1 | -1) => {
      if (index < 0 || index >= rings.length) return;
      const ring = rings[index];

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
