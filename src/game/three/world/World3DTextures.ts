import * as THREE from "three";

/**
 * Procedural in-memory Canvas Textures for museum-grade 3D miniature diorama.
 * Generates zero network payload and adds 0 bytes to static image budgets.
 */

// Cache textures to avoid redundant allocations
const textureCache = new Map<string, THREE.CanvasTexture>();

function createOffscreenCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  if (typeof document === "undefined") {
    const noop = () => {};
    const mockCtx: any = {
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      lineCap: "butt",
      lineJoin: "miter",
      font: "",
      textAlign: "left",
      textBaseline: "alphabetic",
      globalAlpha: 1,
      clearRect: noop,
      fillRect: noop,
      strokeRect: noop,
      beginPath: noop,
      closePath: noop,
      moveTo: noop,
      lineTo: noop,
      arc: noop,
      ellipse: noop,
      quadraticCurveTo: noop,
      bezierCurveTo: noop,
      fill: noop,
      stroke: noop,
      save: noop,
      restore: noop,
      translate: noop,
      rotate: noop,
      scale: noop,
      fillText: noop,
      strokeText: noop,
      createLinearGradient: () => ({ addColorStop: noop }),
      createRadialGradient: () => ({ addColorStop: noop }),
    };
    const mockCanvas: any = { width, height, getContext: () => mockCtx };
    return { canvas: mockCanvas, ctx: mockCtx };
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  if (ctx && typeof ctx.clearRect !== "function") {
    (ctx as any).clearRect = () => {};
  }
  return { canvas, ctx };
}

/**
 * 1. Warm Colonial Cobblestone Paving Texture (新加坡河畔花岗岩石板路面)
 */
export function getCobblestoneTexture(): THREE.CanvasTexture {
  if (textureCache.has("cobble")) return textureCache.get("cobble")!;

  const { canvas, ctx } = createOffscreenCanvas(512, 512);

  // Soft muted sandstone granite base
  ctx.fillStyle = "#5c5449";
  ctx.fillRect(0, 0, 512, 512);

  // Fine mineral grain across base bed
  for (let i = 0; i < 4800; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const tone = Math.random() > 0.5 ? "rgba(218, 208, 192, 0.08)" : "rgba(42, 37, 30, 0.11)";
    ctx.fillStyle = tone;
    ctx.fillRect(x, y, 1.5 + Math.random() * 2.5, 1.5 + Math.random() * 2.5);
  }

  // Draw tightly laid Straits heritage granite paving slabs
  const rows = 16;
  const cols = 16;
  const rh = 512 / rows;
  const cw = 512 / cols;

  ctx.strokeStyle = "rgba(48, 42, 34, 0.68)"; // Soft weathered mortar seam
  ctx.lineWidth = 2;

  for (let r = 0; r < rows; r++) {
    const offsetX = (r % 2) * (cw / 2);
    for (let c = -1; c < cols + 1; c++) {
      const bx = c * cw + offsetX;
      const by = r * rh;
      const bw = cw - 2;
      const bh = rh - 2;

      // Subtle warm granite stone tint variation without harsh checkerboard steps
      const tint = (Math.random() - 0.5) * 18;
      const rVal = Math.max(95, Math.min(142, Math.round(118 + tint)));
      const gVal = Math.max(90, Math.min(136, Math.round(112 + tint * 0.95)));
      const bVal = Math.max(82, Math.min(126, Math.round(103 + tint * 0.9)));

      ctx.fillStyle = `rgb(${rVal}, ${gVal}, ${bVal})`;
      ctx.fillRect(bx + 1, by + 1, bw - 2, bh - 2);

      // Gentle internal mineral speckle per paver
      for (let s = 0; s < 5; s++) {
        ctx.fillStyle = s % 2 === 0 ? "rgba(235, 226, 210, 0.09)" : "rgba(50, 44, 36, 0.09)";
        ctx.fillRect(
          bx + 3 + Math.random() * Math.max(4, bw - 8),
          by + 3 + Math.random() * Math.max(4, bh - 8),
          2 + Math.random() * 3,
          2 + Math.random() * 2
        );
      }

      // Soft warm top-left chamfer highlight & muted lower shadow
      ctx.fillStyle = "rgba(255, 246, 232, 0.11)";
      ctx.fillRect(bx + 2, by + 2, bw - 4, 2);
      ctx.fillRect(bx + 2, by + 2, 2, bh - 4);

      ctx.fillStyle = "rgba(32, 27, 21, 0.17)";
      ctx.fillRect(bx + 2, by + bh - 3, bw - 4, 2);
      ctx.fillRect(bx + bw - 3, by + 2, 2, bh - 4);

      ctx.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 4);
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set("cobble", texture);
  return texture;
}

/**
 * 2. Terracotta Clay Barrel Roof Tiles Texture (南洋骑楼经典筒板瓦垄)
 * Alternating convex barrel tiles (筒瓦) and concave pan tiles (板瓦) with earthenware glaze.
 */
export function getRoofTileTexture(): THREE.CanvasTexture {
  if (textureCache.has("roof")) return textureCache.get("roof")!;

  const { canvas, ctx } = createOffscreenCanvas(512, 512);

  // Terracotta earthenware base
  ctx.fillStyle = "#6d2c1b";
  ctx.fillRect(0, 0, 512, 512);

  // Clay mineral speckles
  for (let i = 0; i < 3000; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? "rgba(40, 15, 8, 0.18)" : "rgba(180, 95, 60, 0.16)";
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }

  const courseWidth = 32;
  const numCourses = 512 / courseWidth;
  const lapLength = 40;

  for (let c = 0; c < numCourses; c++) {
    const cx = c * courseWidth;
    const isConvexBarrel = c % 2 === 0;

    for (let y = 0; y < 512; y += lapLength) {
      if (isConvexBarrel) {
        // Cylindrical Convex Barrel Tile (筒瓦) - High curved relief
        const grad = ctx.createLinearGradient(cx, y, cx + courseWidth, y);
        grad.addColorStop(0.0, "#4a180b");
        grad.addColorStop(0.18, "#853520");
        grad.addColorStop(0.5, "#bd5b3e");
        grad.addColorStop(0.82, "#853520");
        grad.addColorStop(1.0, "#3e1208");

        ctx.fillStyle = grad;
        ctx.fillRect(cx + 1, y, courseWidth - 2, lapLength - 3);

        // Lower lip highlight and drop shadow
        ctx.fillStyle = "rgba(255, 200, 160, 0.28)";
        ctx.fillRect(cx + 2, y, courseWidth - 4, 3);
        ctx.fillStyle = "rgba(20, 6, 2, 0.5)";
        ctx.fillRect(cx, y + lapLength - 4, courseWidth, 4);

        // Circular Eaves Drip Tile medallion (瓦当)
        ctx.fillStyle = "#8a3622";
        ctx.beginPath();
        ctx.arc(cx + courseWidth / 2, y + lapLength - 3, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#401308";
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else {
        // Concave Pan Tile Trough (板瓦 / 瓦沟)
        const grad = ctx.createLinearGradient(cx, y, cx + courseWidth, y);
        grad.addColorStop(0.0, "#2c0e06");
        grad.addColorStop(0.3, "#542114");
        grad.addColorStop(0.5, "#68291a");
        grad.addColorStop(0.7, "#542114");
        grad.addColorStop(1.0, "#2c0e06");

        ctx.fillStyle = grad;
        ctx.fillRect(cx, y, courseWidth, lapLength);

        // Mortar joint line
        ctx.fillStyle = "rgba(15, 5, 2, 0.4)";
        ctx.fillRect(cx, y + lapLength - 2, courseWidth, 2);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 4);
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set("roof", texture);
  return texture;
}

/**
 * 3. Weathered Teak Wood Planks Texture (古风柚木板条纹理 - 桥面、码头、木箱)
 */
export function getWoodPlankTexture(): THREE.CanvasTexture {
  if (textureCache.has("wood")) return textureCache.get("wood")!;

  const { canvas, ctx } = createOffscreenCanvas(512, 512);

  ctx.fillStyle = "#5c432d";
  ctx.fillRect(0, 0, 512, 512);

  // Draw 8 vertical planks
  const plankW = 64;
  for (let p = 0; p < 8; p++) {
    const px = p * plankW;

    // Plank base color variation
    const baseTone = 80 + (p % 3) * 8;
    ctx.fillStyle = `rgb(${baseTone + 15}, ${baseTone - 5}, ${baseTone - 25})`;
    ctx.fillRect(px + 1, 0, plankW - 2, 512);

    // Wood grain fibers
    for (let g = 0; g < 180; g++) {
      const gx = px + Math.random() * plankW;
      const gy = Math.random() * 512;
      const gh = 20 + Math.random() * 60;
      ctx.fillStyle = Math.random() > 0.5 ? "rgba(35, 20, 10, 0.12)" : "rgba(140, 105, 75, 0.15)";
      ctx.fillRect(gx, gy, 1 + Math.random() * 2, gh);
    }

    // Plank gap shadow
    ctx.fillStyle = "#1e130a";
    ctx.fillRect(px, 0, 3, 512);

    // Plank highlight edge
    ctx.fillStyle = "rgba(180, 145, 110, 0.25)";
    ctx.fillRect(px + 3, 0, 2, 512);

    // Iron nail rivets at ends
    for (const ny of [28, 512 - 28]) {
      ctx.fillStyle = "#15100c";
      ctx.beginPath();
      ctx.arc(px + plankW / 2, ny, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set("wood", texture);
  return texture;
}

/**
 * 4. Ancient Inscribed Sanskrit/Kawi Rune Texture (巴当巨石铭文刻痕)
 */
export function getMegalithRuneTexture(): THREE.CanvasTexture {
  if (textureCache.has("runes")) return textureCache.get("runes")!;

  const { canvas, ctx } = createOffscreenCanvas(512, 512);

  // Deep red sandstone base
  ctx.fillStyle = "#582f25";
  ctx.fillRect(0, 0, 512, 512);

  // Weathered rock speckles
  for (let i = 0; i < 3000; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? "rgba(40, 18, 14, 0.25)" : "rgba(130, 80, 65, 0.2)";
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 3, 3);
  }

  // Draw ancient Sanskrit-like carved script lines with glowing gold insets
  ctx.font = "bold 22px 'Courier New', serif";
  ctx.textBaseline = "middle";

  const glyphs = [
    "ꦯꦿꦷ ꦮꦶꦗꦪ ꦥꦸꦫ ꦯꦶꦁꦲ",
    "ᬲᬗ᭄ᬓᬭ ᬭᬵᬚᬵ ᬲᬶᬗ᭄ᬳ",
    "OM MANI PADME HUM",
    "ꦱꦶꦁꦲꦥꦸꦫ ꧑꧘꧑꧙ ꦱꦒꦫ",
    "ᬲᬫᬸᬤ᭄ᬭ ᬲᬶᬗ᭄ᬳᬧᬸᬭ",
    "SANSKRIT MEGALIТH 1819",
    "ꦮꦶꦯ꧀ꦮꦴꦱ ꦢꦷꦥ ꦩꦤ꧀ꦠ꧀ꦫ"
  ];

  for (let r = 0; r < glyphs.length; r++) {
    const y = 50 + r * 65;

    // Carved dark shadow incision
    ctx.fillStyle = "rgba(18, 8, 5, 0.85)";
    ctx.fillText(glyphs[r], 28, y + 2);

    // Glowing golden ink inlay
    ctx.fillStyle = "#f5c352";
    ctx.shadowColor = "#ffb82e";
    ctx.shadowBlur = 12;
    ctx.fillText(glyphs[r], 26, y);
    ctx.shadowBlur = 0;
  }

  // Gold fracture veins (Kintsugi)
  ctx.strokeStyle = "#ffd700";
  ctx.lineWidth = 4;
  ctx.shadowColor = "#ffaa00";
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.moveTo(40, 0);
  ctx.lineTo(120, 150);
  ctx.lineTo(260, 280);
  ctx.lineTo(440, 512);
  ctx.stroke();
  ctx.shadowBlur = 0;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set("runes", texture);
  return texture;
}

/**
 * 5. Commemorative Brass Plaque Texture (展示底座纯铜典藏铭牌)
 */
export function getBrassPlaqueTexture(): THREE.CanvasTexture {
  if (textureCache.has("plaque")) return textureCache.get("plaque")!;

  const { canvas, ctx } = createOffscreenCanvas(512, 128);

  // Brushed brass metallic gradient
  const grad = ctx.createLinearGradient(0, 0, 512, 128);
  grad.addColorStop(0.0, "#d8b257");
  grad.addColorStop(0.25, "#fff0a3");
  grad.addColorStop(0.5, "#c4983a");
  grad.addColorStop(0.75, "#edd17a");
  grad.addColorStop(1.0, "#b88a2e");

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 128);

  // Double engraved border
  ctx.strokeStyle = "#5a4115";
  ctx.lineWidth = 3;
  ctx.strokeRect(8, 8, 496, 112);
  ctx.strokeRect(14, 14, 484, 100);

  // Corner ornaments
  for (const [cx, cy] of [[20, 20], [492, 20], [20, 108], [492, 108]]) {
    ctx.fillStyle = "#4a350f";
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Etched Typography
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Engraved bevel shadow
  ctx.fillStyle = "rgba(45, 30, 8, 0.75)";
  ctx.font = "bold 26px 'Georgia', serif";
  ctx.fillText("SINGAPORE RIVER · 1819", 256, 52);

  ctx.font = "italic 16px 'Georgia', serif";
  ctx.fillText("HISTORIC DIORAMA REALM · NATIONAL HERITAGE", 256, 86);

  // Crisp gold highlight on letters
  ctx.fillStyle = "#fffcd6";
  ctx.font = "bold 26px 'Georgia', serif";
  ctx.fillText("SINGAPORE RIVER · 1819", 255, 50);

  ctx.font = "italic 16px 'Georgia', serif";
  ctx.fillText("HISTORIC DIORAMA REALM · NATIONAL HERITAGE", 255, 84);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set("plaque", texture);
  return texture;
}

/**
 * 6. Shophouse Facade & Signboard Texture (南洋骑楼牌匾与窗雕花纹)
 */
export function getShophouseSignTexture(textZh: string, textEn: string, mainColor: string): THREE.CanvasTexture {
  const cacheKey = `shophouse_${textZh}`;
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey)!;

  const { canvas, ctx } = createOffscreenCanvas(512, 128);

  // Dark lacquered timber plaque with gold border
  ctx.fillStyle = "#1c140d";
  ctx.fillRect(0, 0, 512, 128);

  ctx.fillStyle = mainColor;
  ctx.fillRect(6, 6, 500, 116);

  ctx.strokeStyle = "#d4af37"; // Gold border
  ctx.lineWidth = 4;
  ctx.strokeRect(12, 12, 488, 104);

  // Traditional Gold Leaf Calligraphy
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Drop shadow
  ctx.fillStyle = "rgba(10, 6, 2, 0.8)";
  ctx.font = "bold 34px 'KaiTi', 'SimSun', serif";
  ctx.fillText(textZh, 258, 52);

  ctx.font = "bold 15px 'Georgia', serif";
  ctx.fillText(textEn.toUpperCase(), 258, 92);

  // Gold text
  ctx.fillStyle = "#ffd966";
  ctx.font = "bold 34px 'KaiTi', 'SimSun', serif";
  ctx.fillText(textZh, 256, 50);

  ctx.font = "bold 15px 'Georgia', serif";
  ctx.fillText(textEn.toUpperCase(), 256, 90);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * 7. Peranakan Encaustic Majolica Tiles (娘惹彩釉花砖腰线墙裙)
 * Authentic Straits Chinese 4-fold floral geometric majolica glazed ceramic tiles.
 */
export function getPeranakanTileTexture(
  palette: "terracotta" | "mint" | "navy" | "rose" = "mint"
): THREE.CanvasTexture {
  const cacheKey = `peranakan_tile_${palette}`;
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey)!;

  const { canvas, ctx } = createOffscreenCanvas(512, 512);

  const colors = {
    terracotta: {
      bg: "#ecd9c6",
      border: "#8c3b23",
      floret: "#d4583b",
      petal: "#3b6b55",
      accent: "#f4b942",
      grout: "#5c3321"
    },
    mint: {
      bg: "#e4f2ee",
      border: "#20594f",
      floret: "#2d8a7b",
      petal: "#e2847a",
      accent: "#f7d560",
      grout: "#173b34"
    },
    navy: {
      bg: "#eef2f7",
      border: "#1d3557",
      floret: "#457b9d",
      petal: "#e63946",
      accent: "#e9c46a",
      grout: "#14213d"
    },
    rose: {
      bg: "#fcedf0",
      border: "#8b263e",
      floret: "#c44569",
      petal: "#3d7068",
      accent: "#f8c291",
      grout: "#4a1220"
    }
  }[palette];

  ctx.fillStyle = colors.grout;
  ctx.fillRect(0, 0, 512, 512);

  const tileSize = 128;
  const numTiles = 4;

  for (let row = 0; row < numTiles; row++) {
    for (let col = 0; col < numTiles; col++) {
      const tx = col * tileSize;
      const ty = row * tileSize;
      const inset = 4;
      const innerSize = tileSize - inset * 2;

      // Tile ceramic base
      ctx.fillStyle = colors.bg;
      ctx.fillRect(tx + inset, ty + inset, innerSize, innerSize);

      // Outer decorative border
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(tx + inset + 4, ty + inset + 4, innerSize - 8, innerSize - 8);

      const cx = tx + tileSize / 2;
      const cy = ty + tileSize / 2;

      // 4 Corner florets
      const cornerOffsets = [
        [tx + inset + 12, ty + inset + 12],
        [tx + tileSize - inset - 12, ty + inset + 12],
        [tx + inset + 12, ty + tileSize - inset - 12],
        [tx + tileSize - inset - 12, ty + tileSize - inset - 12]
      ];
      for (const [fx, fy] of cornerOffsets) {
        ctx.fillStyle = colors.petal;
        ctx.beginPath();
        ctx.arc(fx, fy, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = colors.accent;
        ctx.beginPath();
        ctx.arc(fx, fy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Central 8-petal Peranakan star rosette
      const numPetals = 8;
      const outerR = 36;
      const innerR = 14;

      for (let p = 0; p < numPetals; p++) {
        const angle = (p * Math.PI) / 4;
        const px = cx + Math.cos(angle) * outerR * 0.72;
        const py = cy + Math.sin(angle) * outerR * 0.72;

        ctx.fillStyle = p % 2 === 0 ? colors.floret : colors.petal;
        ctx.beginPath();
        ctx.ellipse(px, py, 11, 6, angle, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Center octagonal flower core
      ctx.fillStyle = colors.accent;
      ctx.beginPath();
      ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = colors.border;
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();

      // Glaze diagonal sheen highlight
      const glazeGrad = ctx.createLinearGradient(tx + inset, ty + inset, tx + tileSize, ty + tileSize);
      glazeGrad.addColorStop(0.0, "rgba(255, 255, 255, 0.45)");
      glazeGrad.addColorStop(0.35, "rgba(255, 255, 255, 0.0)");
      glazeGrad.addColorStop(0.7, "rgba(0, 0, 0, 0.0)");
      glazeGrad.addColorStop(1.0, "rgba(0, 0, 0, 0.15)");
      ctx.fillStyle = glazeGrad;
      ctx.fillRect(tx + inset, ty + inset, innerSize, innerSize);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * 8. Solid Timber Batten Doors & Folding Panels (老字号实木排门板)
 */
export function getShophouseTimberDoorTexture(): THREE.CanvasTexture {
  if (textureCache.has("timber_door")) return textureCache.get("timber_door")!;

  const { canvas, ctx } = createOffscreenCanvas(512, 512);

  // Deep aged teak wood background
  ctx.fillStyle = "#3a2518";
  ctx.fillRect(0, 0, 512, 512);

  // 6 Folding door leaves (battens)
  const leaves = 6;
  const leafW = 512 / leaves;

  for (let i = 0; i < leaves; i++) {
    const lx = i * leafW;

    // Wood base variation
    const baseVal = 48 + (i % 2) * 8;
    ctx.fillStyle = `rgb(${baseVal + 14}, ${baseVal}, ${baseVal - 16})`;
    ctx.fillRect(lx + 2, 0, leafW - 4, 512);

    // Fine wood grain fibers
    for (let g = 0; g < 140; g++) {
      const gx = lx + 3 + Math.random() * (leafW - 6);
      const gy = Math.random() * 512;
      const gh = 30 + Math.random() * 80;
      ctx.fillStyle = Math.random() > 0.5 ? "rgba(20, 10, 5, 0.18)" : "rgba(110, 80, 50, 0.15)";
      ctx.fillRect(gx, gy, 1.2, gh);
    }

    // Leaf recessed border frame
    ctx.strokeStyle = "#1a0f08";
    ctx.lineWidth = 3;
    ctx.strokeRect(lx + 4, 8, leafW - 8, 496);

    // Lower raised panel (裙板)
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.fillRect(lx + 8, 320, leafW - 16, 170);
    ctx.strokeStyle = "#5a3a22";
    ctx.lineWidth = 2;
    ctx.strokeRect(lx + 8, 320, leafW - 16, 170);

    // Upper carved fretwork panel (绦环板)
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.fillRect(lx + 8, 20, leafW - 16, 80);
    ctx.strokeStyle = "#5a3a22";
    ctx.strokeRect(lx + 8, 20, leafW - 16, 80);

    // Brass/iron studs (门钉)
    ctx.fillStyle = "#cca24b";
    for (const sy of [40, 80, 200, 340, 470]) {
      ctx.beginPath();
      ctx.arc(lx + leafW / 2, sy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Antique pull rings on central pair of doors
    if (i === 2 || i === 3) {
      const hx = i === 2 ? lx + leafW - 14 : lx + 14;
      ctx.fillStyle = "#d4af37";
      ctx.beginPath();
      ctx.arc(hx, 256, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a0f08";
      ctx.beginPath();
      ctx.arc(hx, 256, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Shadow joint between folding leaves
    ctx.fillStyle = "#120a05";
    ctx.fillRect(lx, 0, 3, 512);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set("timber_door", texture);
  return texture;
}

/**
 * 9. Carved Hanging Valances / Fretwork Fascia (骑楼雕花挂落透空纹样)
 */
export function getFloralValanceTexture(tintColor = "#2b1911"): THREE.CanvasTexture {
  const cacheKey = `valance_${tintColor}`;
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey)!;

  const { canvas, ctx } = createOffscreenCanvas(512, 128);

  ctx.clearRect(0, 0, 512, 128);

  ctx.fillStyle = tintColor;
  ctx.strokeStyle = "#d4af37";
  ctx.lineWidth = 1.5;

  // Top hanging mounting bar
  ctx.fillRect(0, 0, 512, 14);

  // Auspicious cloud & lotus scrolling fretwork repeat
  const numBays = 8;
  const bayW = 512 / numBays;

  for (let b = 0; b < numBays; b++) {
    const bx = b * bayW;

    // Hanging pendant drop
    ctx.fillRect(bx + bayW / 2 - 3, 14, 6, 80);
    ctx.beginPath();
    ctx.arc(bx + bayW / 2, 98, 7, 0, Math.PI * 2);
    ctx.fill();

    // Curved carved openwork arches
    ctx.beginPath();
    ctx.arc(bx + bayW / 2, 14, bayW / 2 - 4, 0, Math.PI);
    ctx.lineWidth = 5;
    ctx.strokeStyle = tintColor;
    ctx.stroke();

    // Ruyi cloud scrollwork
    ctx.beginPath();
    ctx.arc(bx + bayW / 4, 52, 10, 0, Math.PI * 2);
    ctx.arc(bx + (3 * bayW) / 4, 52, 10, 0, Math.PI * 2);
    ctx.fillStyle = tintColor;
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * 10. Heritage Storefront Pediment Crest Relief Medallions (老字号山花雕刻徽章)
 */
export function getHeritageCrestTexture(crestType: "herbal" | "spice" | "maritime" | "tea"): THREE.CanvasTexture {
  const cacheKey = `crest_${crestType}`;
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey)!;

  const { canvas, ctx } = createOffscreenCanvas(256, 256);

  ctx.clearRect(0, 0, 256, 256);

  // Outer medallion ring with beaded edge
  const cx = 128;
  const cy = 128;

  // Metallic gold relief gradient
  const grad = ctx.createRadialGradient(cx - 25, cy - 25, 10, cx, cy, 110);
  grad.addColorStop(0.0, "#fff0a3");
  grad.addColorStop(0.45, "#d4af37");
  grad.addColorStop(0.85, "#967520");
  grad.addColorStop(1.0, "#543e0e");

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, 115, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#ffe885";
  ctx.lineWidth = 4;
  ctx.stroke();

  // Beaded pearls border
  for (let i = 0; i < 28; i++) {
    const angle = (i * Math.PI * 2) / 28;
    const px = cx + Math.cos(angle) * 105;
    const py = cy + Math.sin(angle) * 105;
    ctx.fillStyle = "#fff4bd";
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Inner inset disk
  ctx.fillStyle = "#1e140a";
  ctx.beginPath();
  ctx.arc(cx, cy, 94, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffd966";
  ctx.strokeStyle = "#ffd966";
  ctx.lineWidth = 3;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (crestType === "herbal") {
    // Chinese medicine mortar & pestle + Lingzhi herbs
    ctx.font = "bold 26px 'KaiTi', 'SimSun', serif";
    ctx.fillText("同德堂", cx, cy - 35);

    // Mortar bowl
    ctx.beginPath();
    ctx.arc(cx, cy + 20, 36, 0, Math.PI);
    ctx.fill();
    // Pestle
    ctx.fillRect(cx - 6, cy - 22, 12, 50);

    ctx.font = "bold 13px 'Georgia', serif";
    ctx.fillText("EST. 1888", cx, cy + 62);
  } else if (crestType === "spice") {
    // Nutmeg & spice trade galleon ship
    ctx.font = "bold 24px 'KaiTi', 'SimSun', serif";
    ctx.fillText("源發號", cx, cy - 38);

    // Spice galleon hull
    ctx.beginPath();
    ctx.moveTo(cx - 36, cy + 10);
    ctx.lineTo(cx + 36, cy + 10);
    ctx.lineTo(cx + 26, cy + 32);
    ctx.lineTo(cx - 26, cy + 32);
    ctx.closePath();
    ctx.fill();

    // 3 sails
    for (let s = -1; s <= 1; s++) {
      ctx.fillRect(cx + s * 22 - 2, cy - 14, 4, 24);
      ctx.beginPath();
      ctx.arc(cx + s * 22 + 6, cy - 4, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.font = "bold 13px 'Georgia', serif";
    ctx.fillText("SPICE 1892", cx, cy + 62);
  } else if (crestType === "maritime") {
    // Admiralty anchor & ship helm
    ctx.font = "bold 24px 'KaiTi', 'SimSun', serif";
    ctx.fillText("南洋航運", cx, cy - 40);

    // Anchor stock & ring
    ctx.beginPath();
    ctx.arc(cx, cy - 8, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillRect(cx - 3, cy, 6, 42);
    ctx.fillRect(cx - 24, cy + 12, 48, 5);
    // Flukes
    ctx.beginPath();
    ctx.arc(cx, cy + 24, 26, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.font = "bold 13px 'Georgia', serif";
    ctx.fillText("SHIPPING", cx, cy + 62);
  } else if (crestType === "tea") {
    // Classical teapot & swirling steam
    ctx.font = "bold 24px 'KaiTi', 'SimSun', serif";
    ctx.fillText("合興茶莊", cx, cy - 40);

    // Teapot body
    ctx.beginPath();
    ctx.arc(cx, cy + 16, 26, 0, Math.PI * 2);
    ctx.fill();
    // Spout & handle
    ctx.fillRect(cx + 20, cy + 6, 16, 8);
    ctx.beginPath();
    ctx.arc(cx - 24, cy + 16, 12, 0, Math.PI * 2);
    ctx.stroke();

    // Lid finial
    ctx.beginPath();
    ctx.arc(cx, cy - 14, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = "bold 13px 'Georgia', serif";
    ctx.fillText("HERITAGE TEA", cx, cy + 62);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * Procedural Engraved Bronze Inscription Plaque for the Merlion Base Plinth.
 */
export function getMerlionPlaqueTexture(): THREE.CanvasTexture {
  if (textureCache.has("merlion_plaque")) return textureCache.get("merlion_plaque")!;

  const { canvas, ctx } = createOffscreenCanvas(512, 256);

  // Dark patinated bronze background
  const grad = ctx.createLinearGradient(0, 0, 512, 256);
  grad.addColorStop(0.0, "#242d27");
  grad.addColorStop(0.5, "#344037");
  grad.addColorStop(1.0, "#1d231e");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  // Chiseled gold double border
  ctx.strokeStyle = "#c99e46";
  ctx.lineWidth = 4;
  ctx.strokeRect(12, 12, 488, 232);
  ctx.strokeStyle = "#7e622b";
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, 472, 216);

  // Corner rosettes
  for (const [cx, cy] of [
    [28, 28],
    [484, 28],
    [28, 228],
    [484, 228]
  ]) {
    ctx.fillStyle = "#dfb657";
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Wave crest motif at top center
  ctx.strokeStyle = "#dfb657";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(256, 55, 14, Math.PI, 0);
  ctx.arc(228, 55, 14, Math.PI, 0);
  ctx.arc(284, 55, 14, Math.PI, 0);
  ctx.stroke();

  // Typography
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = "#f5d47a";
  ctx.font = "bold 34px 'KaiTi', 'SimSun', serif";
  ctx.fillText("新加坡鱼尾狮 · 1972", 256, 110);

  ctx.font = "bold 20px 'Georgia', serif";
  ctx.fillText("THE SINGAPORE MERLION", 256, 155);

  ctx.font = "italic 15px 'Georgia', serif";
  ctx.fillStyle = "#c5ab6d";
  ctx.fillText("GUARDIAN OF SINGAPURA · TEMASEK MYTH", 256, 195);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set("merlion_plaque", texture);
  return texture;
}

/**
 * Procedural Woven Bamboo Straw Texture for Boatman's Conical Hat (斗笠).
 */
export function getWovenBambooTexture(): THREE.CanvasTexture {
  if (textureCache.has("woven_bamboo")) return textureCache.get("woven_bamboo")!;

  const { canvas, ctx } = createOffscreenCanvas(256, 256);
  ctx.fillStyle = "#b88a4b";
  ctx.fillRect(0, 0, 256, 256);

  // Woven bamboo concentric rings
  ctx.strokeStyle = "#8a612d";
  ctx.lineWidth = 1.6;
  for (let r = 8; r < 140; r += 10) {
    ctx.beginPath();
    ctx.arc(128, 128, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Radiating woven split-bamboo ribs
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 16) {
    ctx.beginPath();
    ctx.moveTo(128, 128);
    ctx.lineTo(128 + Math.cos(a) * 140, 128 + Math.sin(a) * 140);
    ctx.stroke();
  }

  // Cross-hatch interlacing
  ctx.strokeStyle = "rgba(75, 48, 18, 0.25)";
  ctx.lineWidth = 1.0;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
    ctx.beginPath();
    const r1 = 30;
    const r2 = 120;
    ctx.moveTo(128 + Math.cos(a) * r1, 128 + Math.sin(a) * r1);
    ctx.lineTo(128 + Math.cos(a + 0.4) * r2, 128 + Math.sin(a + 0.4) * r2);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set("woven_bamboo", texture);
  return texture;
}

/**
 * 13. Ashlar Masonry Retaining Wall Texture (规整花岗岩驳岸条石砌筑与潮水苔痕)
 */
export function getAshlarWallTexture(): THREE.CanvasTexture {
  if (textureCache.has("ashlar_wall")) return textureCache.get("ashlar_wall")!;

  const { canvas, ctx } = createOffscreenCanvas(512, 256);

  // Weathered granite base tone
  ctx.fillStyle = "#696356";
  ctx.fillRect(0, 0, 512, 256);

  // Granite crystalline speckles
  for (let i = 0; i < 3000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 256;
    ctx.fillStyle = Math.random() > 0.5 ? "rgba(225, 215, 200, 0.15)" : "rgba(30, 25, 20, 0.2)";
    ctx.fillRect(x, y, 2 + Math.random() * 3, 2 + Math.random() * 2);
  }

  // Ashlar block courses
  const courseHeight = 32;
  const numCourses = 8;
  ctx.strokeStyle = "#2b2721"; // Mortar line
  ctx.lineWidth = 3;

  for (let c = 0; c < numCourses; c++) {
    const y = c * courseHeight;
    // Horizontal joint
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();

    // Vertical joints
    const blockWidth = 64;
    const offset = (c % 2) * (blockWidth / 2);
    for (let x = offset; x < 512 + blockWidth; x += blockWidth) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + courseHeight);
      ctx.stroke();
    }
  }

  // Waterline tide mark & green algae gradient at bottom
  const algaeGrad = ctx.createLinearGradient(0, 160, 0, 256);
  algaeGrad.addColorStop(0.0, "rgba(25, 55, 45, 0.0)");
  algaeGrad.addColorStop(0.4, "rgba(25, 55, 45, 0.35)");
  algaeGrad.addColorStop(1.0, "rgba(15, 40, 32, 0.75)");
  ctx.fillStyle = algaeGrad;
  ctx.fillRect(0, 160, 512, 96);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set("ashlar_wall", texture);
  return texture;
}

/**
 * 13b. Neoclassical Colonial Stucco & Dressed Limestone Ashlar Texture
 * (英国殖民地新古典主义暖象牙白石灰石琢石墙面与浅色灰缝，无水藻污渍)
 */
export function getColonialStuccoTexture(): THREE.CanvasTexture {
  if (textureCache.has("colonial_stucco")) return textureCache.get("colonial_stucco")!;

  const { canvas, ctx } = createOffscreenCanvas(512, 256);

  // Warm colonial ivory/cream limestone base
  ctx.fillStyle = "#f2ead9";
  ctx.fillRect(0, 0, 512, 256);

  // Fine dressed limestone grain speckles
  for (let i = 0; i < 1800; i++) {
    const x = (i * 97) % 512;
    const y = (i * 53) % 256;
    ctx.fillStyle = i % 2 === 0 ? "rgba(255, 252, 245, 0.22)" : "rgba(185, 172, 150, 0.14)";
    ctx.fillRect(x, y, 2, 2);
  }

  // Horizontal dressed ashlar stone courses with alternating warm tints
  const courseHeight = 32;
  const numCourses = 8;
  for (let c = 0; c < numCourses; c++) {
    const y = c * courseHeight;
    if (c % 2 === 1) {
      ctx.fillStyle = "rgba(232, 222, 204, 0.28)";
      ctx.fillRect(0, y, 512, courseHeight);
    }
  }

  // Crisp fine lime mortar joints
  ctx.strokeStyle = "#d2c5ae";
  ctx.lineWidth = 2;
  for (let c = 0; c < numCourses; c++) {
    const y = c * courseHeight;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();

    const blockWidth = 64;
    const offset = (c % 2) * (blockWidth / 2);
    for (let x = offset; x < 512 + blockWidth; x += blockWidth) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + courseHeight);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set("colonial_stucco", texture);
  return texture;
}

/**
 * 14. Burlap Jute Spice Sack Texture with Vintage Stenciled Cargo Stamp
 */
export function getSpiceSackTexture(brand = "GUAN HUAT · SPICES"): THREE.CanvasTexture {
  const cacheKey = `sack_${brand}`;
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey)!;

  const { canvas, ctx } = createOffscreenCanvas(256, 256);

  // Burlap jute woven background
  ctx.fillStyle = "#a88e63";
  ctx.fillRect(0, 0, 256, 256);

  // Cross-weave fabric threads
  ctx.strokeStyle = "rgba(80, 60, 35, 0.2)";
  ctx.lineWidth = 1;
  for (let x = 0; x < 256; x += 3) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }
  for (let y = 0; y < 256; y += 3) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }

  // Stenciled vintage cargo stamp in center
  ctx.fillStyle = "rgba(40, 30, 20, 0.7)";
  ctx.font = "bold 16px 'Georgia', serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.strokeStyle = "rgba(40, 30, 20, 0.65)";
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 70, 216, 116);
  ctx.strokeRect(24, 74, 208, 108);

  if (typeof ctx.fillText === "function") {
    ctx.fillText("NANYANG CARGO", 128, 95);
    ctx.font = "bold 18px 'KaiTi', 'SimSun', serif";
    ctx.fillText("源發號 · 特選肉桂", 128, 128);
    ctx.font = "italic 13px 'Georgia', serif";
    ctx.fillText(brand, 128, 155);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * 15. Classical Coffered Ceiling Texture for Grand Museum Portico (古典藻井天花)
 */
export function getCofferedCeilingTexture(): THREE.CanvasTexture {
  if (textureCache.has("coffered_ceiling")) return textureCache.get("coffered_ceiling")!;

  const { canvas, ctx } = createOffscreenCanvas(512, 128);

  ctx.fillStyle = "#ede3cb";
  ctx.fillRect(0, 0, 512, 128);

  // 4 square recessed coffer panels
  const panelW = 112;
  const panelH = 96;
  const gap = 16;

  for (let i = 0; i < 4; i++) {
    const x = gap + i * (panelW + gap);
    const y = 16;

    // Recessed bevel gradient
    const grad = ctx.createLinearGradient(x, y, x + panelW, y + panelH);
    grad.addColorStop(0.0, "#a8997a");
    grad.addColorStop(0.5, "#d9cbb2");
    grad.addColorStop(1.0, "#f7f0df");
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, panelW, panelH);

    // Inner sunken panel
    ctx.fillStyle = "#c2b291";
    ctx.fillRect(x + 12, y + 12, panelW - 24, panelH - 24);

    // Central gilded rosette
    ctx.fillStyle = "#d4af37";
    ctx.beginPath();
    ctx.arc(x + panelW / 2, y + panelH / 2, 14, 0, Math.PI * 2);
    ctx.fill();

    // Rosette petals
    ctx.fillStyle = "#f5d47a";
    for (let p = 0; p < 8; p++) {
      const ang = (p / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(x + panelW / 2 + Math.cos(ang) * 9, y + panelH / 2 + Math.sin(ang) * 9, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set("coffered_ceiling", texture);
  return texture;
}

/**
 * 16. Procedural Undulating Sunlight Caustics Texture for Riverbed and Shallows
 * (新加坡河底与水生浅滩波动焦散光斑)
 */
export function getWaterCausticsTexture(): THREE.CanvasTexture {
  if (textureCache.has("water_caustics")) return textureCache.get("water_caustics")!;

  const { canvas, ctx } = createOffscreenCanvas(512, 512);

  // Deep aquatic background tone
  ctx.fillStyle = "#0c3b3e";
  ctx.fillRect(0, 0, 512, 512);

  // Cellular caustic filaments network
  ctx.strokeStyle = "rgba(180, 248, 255, 0.45)";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Multi-octave overlapping web loops
  const numRings = 48;
  for (let r = 0; r < numRings; r++) {
    const cx = (r * 73) % 512;
    const cy = (r * 137) % 512;
    const radius = 24 + ((r * 17) % 36);

    ctx.beginPath();
    for (let a = 0; a <= 8; a++) {
      const angle = (a / 8) * Math.PI * 2;
      const radWobble = radius + Math.sin(a * 2.3 + r) * 6;
      const px = cx + Math.cos(angle) * radWobble;
      const py = cy + Math.sin(angle) * radWobble;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();

    // Secondary inner high-intensity glow
    ctx.fillStyle = "rgba(140, 240, 250, 0.08)";
    ctx.fill();
  }

  // Intense caustic nexus focal points
  ctx.fillStyle = "rgba(220, 255, 255, 0.75)";
  for (let p = 0; p < 96; p++) {
    const px = (p * 47) % 512;
    const py = (p * 109) % 512;
    ctx.beginPath();
    ctx.arc(px, py, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set("water_caustics", texture);
  return texture;
}

/**
 * 17. Procedural Wave Crest Breaking & Shoreline Foam Texture
 * (动态水岸碎浪、开尔文尾波浪沫与波峰白浪花网)
 */
export function getWaterFoamTexture(): THREE.CanvasTexture {
  if (textureCache.has("water_foam")) return textureCache.get("water_foam")!;

  const { canvas, ctx } = createOffscreenCanvas(512, 512);

  // Clear transparent base
  ctx.clearRect(0, 0, 512, 512);

  // Multi-scale micro-bubble foam cluster patterns
  for (let f = 0; f < 360; f++) {
    const fx = (f * 59) % 512;
    const fy = (f * 83) % 512;
    const size = 3 + (f % 11);
    const alpha = 0.25 + (f % 5) * 0.15;

    ctx.fillStyle = `rgba(245, 252, 255, ${alpha.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(fx, fy, size, 0, Math.PI * 2);
    ctx.fill();

    // Bubble rim outline
    ctx.strokeStyle = `rgba(255, 255, 255, ${(alpha * 0.7).toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Lacy interconnected foam tendrils
  ctx.strokeStyle = "rgba(240, 250, 255, 0.55)";
  ctx.lineWidth = 2.5;
  for (let t = 0; t < 32; t++) {
    const sx = (t * 89) % 512;
    const sy = (t * 131) % 512;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    const segs = 6;
    for (let s = 1; s <= segs; s++) {
      const nx = sx + Math.cos(s * 1.1 + t) * (s * 14);
      const ny = sy + Math.sin(s * 0.9 + t) * (s * 14);
      ctx.lineTo(nx, ny);
    }
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set("water_foam", texture);
  return texture;
}

/**
 * 18. Authentic Singapore River Twakow Hull Strake Planking
 * (传统驳船青佳木船体外板、朱红吃水带与桐油黑漆捻缝)
 */
export function getTwakowHullTexture(): THREE.CanvasTexture {
  if (textureCache.has("twakow_hull")) return textureCache.get("twakow_hull")!;

  const { canvas, ctx } = createOffscreenCanvas(512, 512);

  // Hardwood background tone
  ctx.fillStyle = "#3a281a";
  ctx.fillRect(0, 0, 512, 512);

  // 8 horizontal carvel strakes
  const strakeH = 64;
  for (let s = 0; s < 8; s++) {
    const sy = s * strakeH;

    // Auspicious painted sheer strake at top (s === 0)
    if (s === 0) {
      ctx.fillStyle = "#a82e22"; // Vermilion red sheer band
      ctx.fillRect(0, sy, 512, strakeH - 4);

      // Gold accent pinstripe
      ctx.fillStyle = "#d4a43b";
      ctx.fillRect(0, sy + 18, 512, 6);
      ctx.fillRect(0, sy + 40, 512, 4);

      // Dark shadow caulking seam
      ctx.fillStyle = "#180e08";
      ctx.fillRect(0, sy + strakeH - 4, 512, 4);
      continue;
    }

    // Weathered chengal / balau timber variation
    const baseTone = 55 + (s % 3) * 6;
    ctx.fillStyle = `rgb(${baseTone + 16}, ${baseTone + 2}, ${baseTone - 14})`;
    ctx.fillRect(0, sy, 512, strakeH - 4);

    // Fine wood grain fibers running horizontally
    for (let g = 0; g < 140; g++) {
      const gx = Math.random() * 512;
      const gy = sy + Math.random() * (strakeH - 4);
      const gw = 25 + Math.random() * 75;
      ctx.fillStyle = Math.random() > 0.5 ? "rgba(25, 15, 8, 0.18)" : "rgba(125, 95, 65, 0.16)";
      ctx.fillRect(gx, gy, gw, 1 + Math.random() * 2);
    }

    // Caulked pitch seam (桐油石灰捻缝)
    ctx.fillStyle = "#150d08";
    ctx.fillRect(0, sy + strakeH - 4, 512, 4);

    // Top bevel highlight on plank edge
    ctx.fillStyle = "rgba(160, 125, 90, 0.22)";
    ctx.fillRect(0, sy, 512, 2);

    // Copper fastening rivets along each strake
    for (let rx = 32; rx < 512; rx += 64) {
      ctx.fillStyle = "#1b120c";
      ctx.beginPath();
      ctx.arc(rx, sy + strakeH / 2, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#8c5a32"; // Copper rivet glint
      ctx.beginPath();
      ctx.arc(rx - 0.8, sy + strakeH / 2 - 0.8, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Waterline tide mark & algae patina gradient at bottom strakes
  const waterMark = ctx.createLinearGradient(0, 320, 0, 512);
  waterMark.addColorStop(0.0, "rgba(20, 45, 30, 0.0)");
  waterMark.addColorStop(0.6, "rgba(18, 40, 26, 0.35)");
  waterMark.addColorStop(1.0, "rgba(12, 28, 18, 0.65)");
  ctx.fillStyle = waterMark;
  ctx.fillRect(0, 320, 512, 192);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set("twakow_hull", texture);
  return texture;
}

/**
 * 19. Colonial Singapore River Cargo Shipping Tea Crate Texture
 * (海峡殖民地海港局防损茶箱与铁皮包角木箱)
 */
export function getCargoCrateTexture(crateType: "tea" | "spices" = "tea"): THREE.CanvasTexture {
  const cacheKey = `crate_${crateType}`;
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey)!;

  const { canvas, ctx } = createOffscreenCanvas(512, 512);

  // Weathered pine timber background
  ctx.fillStyle = "#7b5e3f";
  ctx.fillRect(0, 0, 512, 512);

  // Draw 5 horizontal wooden slats
  const slatH = 512 / 5;
  for (let s = 0; s < 5; s++) {
    const sy = s * slatH;
    const tone = 90 + (s % 2) * 10;
    ctx.fillStyle = `rgb(${tone + 15}, ${tone - 5}, ${tone - 25})`;
    ctx.fillRect(0, sy + 2, 512, slatH - 4);

    // Wood grain
    for (let g = 0; g < 90; g++) {
      const gx = Math.random() * 512;
      const gy = sy + Math.random() * slatH;
      ctx.fillStyle = "rgba(40, 25, 15, 0.12)";
      ctx.fillRect(gx, gy, 30 + Math.random() * 80, 1.5);
    }

    // Slat gap groove
    ctx.fillStyle = "#26190e";
    ctx.fillRect(0, sy, 512, 3);
  }

  // Wooden outer framing batten border
  ctx.fillStyle = "#5d442b";
  ctx.fillRect(0, 0, 512, 36);
  ctx.fillRect(0, 476, 512, 36);
  ctx.fillRect(0, 0, 36, 512);
  ctx.fillRect(476, 0, 36, 512);

  // Diagonal reinforcing batten
  if (typeof ctx.save === "function") ctx.save();
  ctx.beginPath();
  ctx.moveTo(36, 44);
  ctx.lineTo(468, 476);
  ctx.strokeStyle = "rgba(70, 50, 30, 0.85)";
  ctx.lineWidth = 32;
  ctx.stroke();
  if (typeof ctx.restore === "function") ctx.restore();

  // Dark forged iron corner brackets
  ctx.fillStyle = "#1e1a17";
  const cornerSize = 75;
  // Top-left
  ctx.fillRect(0, 0, cornerSize, 24);
  ctx.fillRect(0, 0, 24, cornerSize);
  // Top-right
  ctx.fillRect(512 - cornerSize, 0, cornerSize, 24);
  ctx.fillRect(488, 0, 24, cornerSize);
  // Bottom-left
  ctx.fillRect(0, 488, cornerSize, 24);
  ctx.fillRect(0, 512 - cornerSize, 24, cornerSize);
  // Bottom-right
  ctx.fillRect(512 - cornerSize, 488, cornerSize, 24);
  ctx.fillRect(488, 512 - cornerSize, 24, cornerSize);

  // Corner rivets
  ctx.fillStyle = "#a89078";
  for (const [cx, cy] of [
    [12, 12], [48, 12], [12, 48],
    [500, 12], [464, 12], [500, 48],
    [12, 500], [48, 500], [12, 464],
    [500, 500], [464, 500], [500, 464]
  ]) {
    ctx.beginPath();
    ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Vintage Stenciled Shipping Text
  ctx.fillStyle = "rgba(25, 18, 12, 0.82)";
  ctx.font = "bold 20px 'Georgia', serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.strokeStyle = "rgba(25, 18, 12, 0.7)";
  ctx.lineWidth = 2.5;
  ctx.strokeRect(65, 120, 382, 272);
  ctx.strokeRect(71, 126, 370, 260);

  if (typeof ctx.fillText === "function") {
    ctx.fillText("SINGAPORE RIVER", 256, 160);
    ctx.font = "bold 15px 'Georgia', serif";
    ctx.fillText("STRAITS SETTLEMENTS · 1887", 256, 192);

    ctx.font = "bold 28px 'KaiTi', 'SimSun', serif";
    ctx.fillText(crateType === "tea" ? "南洋源發號 · 普洱香茗" : "合興行 · 頂級胡椒肉桂", 256, 252);

    ctx.font = "bold 17px 'Georgia', serif";
    ctx.fillText(crateType === "tea" ? "FINE BENGAL TEA · 60 LBS" : "MALACCA SPICES · 80 LBS", 256, 308);

    ctx.font = "14px monospace";
    ctx.fillText("FRAGILE ↑↑ KEEP DRY", 256, 348);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * 20. Authentic Weathered Canvas Awning with Bamboo Slats
 * (驳船传统防雨油布、竹压条与缆绳绑扎扣)
 */
export function getCanvasAwningTexture(): THREE.CanvasTexture {
  if (textureCache.has("canvas_awning")) return textureCache.get("canvas_awning")!;

  const { canvas, ctx } = createOffscreenCanvas(512, 512);

  // Weathered oilcloth canvas background
  ctx.fillStyle = "#8a7356";
  ctx.fillRect(0, 0, 512, 512);

  // Canvas weave micro-texture
  ctx.strokeStyle = "rgba(50, 38, 25, 0.12)";
  ctx.lineWidth = 1;
  for (let x = 0; x < 512; x += 3) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }
  for (let y = 0; y < 512; y += 3) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  // 6 transverse bamboo batten slats
  const battenCount = 6;
  const battenSpacing = 512 / battenCount;
  for (let b = 0; b < battenCount; b++) {
    const by = b * battenSpacing;

    // Batten timber strip
    ctx.fillStyle = "#5a4328";
    ctx.fillRect(0, by, 512, 8);

    // Highlight
    ctx.fillStyle = "rgba(220, 190, 150, 0.25)";
    ctx.fillRect(0, by, 512, 2);

    // Double stitch lines
    ctx.strokeStyle = "rgba(35, 25, 15, 0.55)";
    ctx.lineWidth = 1.2;
    if (typeof ctx.setLineDash === "function") {
      ctx.setLineDash([4, 4]);
    }
    ctx.beginPath();
    ctx.moveTo(0, by - 4);
    ctx.lineTo(512, by - 4);
    ctx.moveTo(0, by + 12);
    ctx.lineTo(512, by + 12);
    ctx.stroke();
    if (typeof ctx.setLineDash === "function") {
      ctx.setLineDash([]);
    }

    // Brass grommet rings at ends
    for (const gx of [16, 512 - 16]) {
      ctx.fillStyle = "#caa04a";
      ctx.beginPath();
      ctx.arc(gx, by + 4, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#2c2014";
      ctx.beginPath();
      ctx.arc(gx, by + 4, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Weathering water streaks
  for (let i = 0; i < 24; i++) {
    const sx = Math.random() * 512;
    const sy = Math.random() * 400;
    const h = 40 + Math.random() * 80;
    ctx.fillStyle = "rgba(35, 25, 15, 0.08)";
    ctx.fillRect(sx, sy, 3 + Math.random() * 5, h);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set("canvas_awning", texture);
  return texture;
}

/**
 * 21. Procedural Nanyang Batik Fabric Texture
 * (南洋娘惹蜡染印花面料、金粉点缀与深靛蓝底色)
 */
export function getBatikFabricTexture(): THREE.CanvasTexture {
  const cacheKey = "batik_fabric";
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey)!;

  const { canvas, ctx } = createOffscreenCanvas(256, 256);

  // Background: Deep midnight indigo blue
  ctx.fillStyle = "#1b2838";
  ctx.fillRect(0, 0, 256, 256);

  // Top & bottom ornamental border stripes (terracotta gold & madder crimson)
  ctx.fillStyle = "#c68b45";
  ctx.fillRect(0, 0, 256, 10);
  ctx.fillRect(0, 246, 256, 10);

  ctx.fillStyle = "#8b3a2b";
  ctx.fillRect(0, 10, 256, 5);
  ctx.fillRect(0, 241, 256, 5);

  // Repeating 8-petal Peranakan floral rosettes with scrolling vines
  const stepX = 64;
  for (let x = 32; x < 256; x += stepX) {
    for (const y of [48, 128, 208]) {
      // Golden pollen center
      ctx.fillStyle = "#f2ca65";
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();

      // 8 Petals in coral/crimson
      ctx.fillStyle = "#d15241";
      for (let p = 0; p < 8; p++) {
        const angle = (p * Math.PI) / 4;
        const px = x + Math.cos(angle) * 11;
        const py = y + Math.sin(angle) * 11;
        ctx.beginPath();
        ctx.arc(px, py, 3.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Micro-stippling dot work (cecek)
      ctx.fillStyle = "#ffd580";
      for (let p = 0; p < 8; p++) {
        const angle = (p * Math.PI) / 4 + Math.PI / 8;
        const dotX = x + Math.cos(angle) * 17;
        const dotY = y + Math.sin(angle) * 17;
        ctx.beginPath();
        ctx.arc(dotX, dotY, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Emerald tendril scrollwork (kerawang)
      ctx.strokeStyle = "#3d735a";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x - 14, y);
      if (typeof ctx.bezierCurveTo === "function") {
        ctx.bezierCurveTo(x - 18, y - 12, x - 22, y + 12, x - 26, y);
      } else {
        ctx.lineTo(x - 20, y - 6);
        ctx.lineTo(x - 26, y);
      }
      ctx.stroke();
    }
  }

  // Gold metallic dust flecks
  ctx.fillStyle = "rgba(242, 202, 101, 0.45)";
  for (let i = 0; i < 40; i++) {
    const fx = Math.random() * 256;
    const fy = Math.random() * 256;
    ctx.beginPath();
    ctx.arc(fx, fy, 0.8 + Math.random() * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * 22. Soft Radial-Gradient Circle Particle Texture (eliminates square ■ point sprites)
 */
export function getSoftParticleTexture(): THREE.CanvasTexture {
  const cacheKey = "soft_particle_circle";
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey)!;

  const { canvas, ctx } = createOffscreenCanvas(64, 64);
  ctx.clearRect(0, 0, 64, 64);

  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0.0, "rgba(255, 255, 255, 1.0)");
  grad.addColorStop(0.45, "rgba(255, 255, 255, 0.85)");
  grad.addColorStop(0.78, "rgba(255, 255, 255, 0.28)");
  grad.addColorStop(1.0, "rgba(255, 255, 255, 0.0)");

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(32, 32, 30, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * 23. Carved Limestone Imbricated Fish-Scale Relief Texture for the Merlion Statue
 */
export function getMerlionScaleTexture(): THREE.CanvasTexture {
  const cacheKey = "merlion_scale_relief";
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey)!;

  const { canvas, ctx } = createOffscreenCanvas(512, 512);

  // Base warm ivory-alabaster limestone
  ctx.fillStyle = "#efe9dd";
  ctx.fillRect(0, 0, 512, 512);

  // Subtle limestone grain speckles
  for (let i = 0; i < 1800; i++) {
    const gx = Math.random() * 512;
    const gy = Math.random() * 512;
    ctx.fillStyle = i % 2 === 0 ? "rgba(255, 253, 248, 0.25)" : "rgba(165, 155, 138, 0.18)";
    ctx.fillRect(gx, gy, 2, 2);
  }

  // Overlapping imbricated scalloped fish scales from y = 110 (upper chest) down to y = 512 (tail base)
  // Note: in Three.js CanvasTexture (flipY = true), canvas y = 0 is v = 1 (top neck) and y = 512 is v = 0 (tail base).
  const cols = 14;
  const scaleW = 512 / cols;
  const rows = 14;
  const startY = 108;
  const rowH = (512 - startY) / rows;

  // Draw from top row to bottom row so each upper scale overlaps the one below it,
  // or bottom-to-top depending on scale orientation (fish scales point downward/tailward, so upper row overlaps lower row)
  for (let r = rows - 1; r >= 0; r--) {
    const cy = startY + r * rowH;
    const stagger = (r % 2) * (scaleW * 0.5);
    const fadeTop = Math.min(1.0, r / 2.2); // Smooth transition into lion chest at top rows

    for (let c = -1; c <= cols; c++) {
      const cx = c * scaleW + stagger + scaleW * 0.5;
      const rx = scaleW * 0.52;
      const ry = rowH * 0.88;

      // Deep carved shadow crescent beneath scale rim
      ctx.save();
      ctx.globalAlpha = 0.78 * fadeTop;
      ctx.beginPath();
      ctx.arc(cx, cy + 4, rx, 0.08 * Math.PI, 0.92 * Math.PI);
      ctx.strokeStyle = "#8c8270";
      ctx.lineWidth = 4.5;
      ctx.stroke();

      // Scale body gradient (warm highlight at crest, carved stone shade at base)
      const sGrad = ctx.createLinearGradient(cx, cy - ry * 0.4, cx, cy + ry);
      sGrad.addColorStop(0.0, "#dcd4c4");
      sGrad.addColorStop(0.55, "#f3eee3");
      sGrad.addColorStop(1.0, "#fbf8f2");
      ctx.fillStyle = sGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, rx * 0.96, 0, Math.PI);
      ctx.closePath();
      ctx.fill();

      // Crisp limestone highlight bevel along lower curve of scale
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.arc(cx, cy - 1, rx * 0.90, 0.12 * Math.PI, 0.88 * Math.PI);
      ctx.stroke();

      // Subtle radial flute ridges inside each carved scale
      ctx.strokeStyle = "rgba(150, 140, 124, 0.35)";
      ctx.lineWidth = 1.2;
      for (const ang of [0.32 * Math.PI, 0.5 * Math.PI, 0.68 * Math.PI]) {
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * (rx * 0.25), cy + Math.sin(ang) * (ry * 0.25));
        ctx.lineTo(cx + Math.cos(ang) * (rx * 0.82), cy + Math.sin(ang) * (ry * 0.82));
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // Carved pectoral collar wave molding at the transition between lion chest and fish body (y ≈ 108)
  ctx.strokeStyle = "#9b907d";
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  for (let x = 0; x <= 512; x += 8) {
    const wy = 106 + Math.sin((x / 512) * Math.PI * 14) * 5;
    if (x === 0) ctx.moveTo(x, wy);
    else ctx.lineTo(x, wy);
  }
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * 24. Furrowed Tropical Banyan Bark & Buttress Root Texture (百年古榕沧桑龟裂树皮纹理)
 */
export function getBanyanBarkTexture(): THREE.CanvasTexture {
  const cacheKey = "banyan_bark";
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey)!;

  const { canvas, ctx } = createOffscreenCanvas(512, 512);

  // Rich weathered sepia-bark gradient
  const grad = ctx.createLinearGradient(0, 0, 512, 0);
  grad.addColorStop(0.0, "#563d28");
  grad.addColorStop(0.28, "#6a4c32");
  grad.addColorStop(0.55, "#4d3622");
  grad.addColorStop(0.82, "#63462e");
  grad.addColorStop(1.0, "#563d28");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Longitudinal bark fissures and fibrous ridges
  for (let i = 0; i < 64; i++) {
    const baseX = (i / 64) * 512;
    const isShadow = i % 2 === 0;
    ctx.strokeStyle = isShadow ? "rgba(28, 18, 10, 0.42)" : "rgba(138, 104, 72, 0.28)";
    ctx.lineWidth = 1.5 + (i % 3) * 1.1;
    ctx.beginPath();
    ctx.moveTo(baseX, 0);
    for (let y = 16; y <= 512; y += 24) {
      const wave = Math.sin(y * 0.045 + i * 0.7) * 5 + Math.cos(y * 0.02 - i) * 3;
      ctx.lineTo(baseX + wave, y);
    }
    ctx.stroke();
  }

  // Lenticels & horizontal fig-bark ring scars
  for (let r = 0; r < 140; r++) {
    const rx = Math.random() * 512;
    const ry = Math.random() * 512;
    ctx.fillStyle = r % 3 === 0 ? "rgba(72, 92, 46, 0.20)" : "rgba(26, 17, 10, 0.25)";
    ctx.fillRect(rx, ry, 6 + Math.random() * 14, 2 + Math.random() * 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * 25. Dappled Tropical Banyan Canopy Leaf Texture (南洋细叶榕枝叶繁茂斑驳肌理)
 */
export function getBanyanLeafTexture(): THREE.CanvasTexture {
  const cacheKey = "banyan_leaf";
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey)!;

  const { canvas, ctx } = createOffscreenCanvas(512, 512);

  // Deep forest foliage base
  ctx.fillStyle = "#2b5e34";
  ctx.fillRect(0, 0, 512, 512);

  // Layered multi-tone leaf clusters breaking up uniform poly surfaces
  const tones = ["#1a3e20", "#24542c", "#326c3b", "#45844b", "#589957"];
  for (let i = 0; i < 650; i++) {
    const lx = Math.random() * 512;
    const ly = Math.random() * 512;
    const lr = 7 + Math.random() * 13;
    ctx.fillStyle = tones[i % tones.length];
    ctx.beginPath();
    ctx.arc(lx, ly, lr, 0, Math.PI * 2);
    ctx.fill();

    if (i % 4 === 0) {
      ctx.fillStyle = "rgba(182, 224, 138, 0.22)";
      ctx.beginPath();
      ctx.arc(lx - lr * 0.2, ly - lr * 0.25, lr * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * 26. Procedural Equirectangular Environment Map for IBL PBR Reflections (PBR环境反射天穹贴图)
 */
export function getEquirectEnvTexture(preset: "dawn" | "dusk" | "night" | "studio"): THREE.CanvasTexture {
  const cacheKey = `equirect_env_${preset}`;
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey)!;

  const { canvas, ctx } = createOffscreenCanvas(512, 256);
  const grad = ctx.createLinearGradient(0, 0, 0, 256);

  if (preset === "dawn") {
    grad.addColorStop(0.0, "#1f3c5c");
    grad.addColorStop(0.32, "#466e88");
    grad.addColorStop(0.49, "#f5be88");
    grad.addColorStop(0.54, "#ffe2b0");
    grad.addColorStop(0.68, "#455852");
    grad.addColorStop(1.0, "#192224");
  } else if (preset === "dusk") {
    grad.addColorStop(0.0, "#141d34");
    grad.addColorStop(0.30, "#2f3252");
    grad.addColorStop(0.48, "#cc6d49");
    grad.addColorStop(0.54, "#f4aa65");
    grad.addColorStop(0.66, "#3a454d");
    grad.addColorStop(1.0, "#161a20");
  } else if (preset === "night") {
    grad.addColorStop(0.0, "#060b16");
    grad.addColorStop(0.35, "#0d1a30");
    grad.addColorStop(0.50, "#1b334c");
    grad.addColorStop(0.58, "#294156");
    grad.addColorStop(0.74, "#132028");
    grad.addColorStop(1.0, "#090f16");
  } else {
    // Museum Studio softbox dome for ArtifactVault & PuzzleWorkshop
    grad.addColorStop(0.0, "#1d3835");
    grad.addColorStop(0.34, "#4b7268");
    grad.addColorStop(0.48, "#f0dfb6");
    grad.addColorStop(0.56, "#384e48");
    grad.addColorStop(1.0, "#0c1413");
  }

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  // Soft primary highlight lobe for metallic glint (sun or key studio softbox)
  const lobeX = preset === "dawn" ? 130 : preset === "dusk" ? 360 : preset === "night" ? 190 : 310;
  const lobeY = preset === "studio" ? 72 : 112;
  const lobeColor =
    preset === "night"
      ? "rgba(130, 175, 255, 0.55)"
      : preset === "studio"
      ? "rgba(255, 246, 224, 0.85)"
      : "rgba(255, 226, 168, 0.90)";

  const sunLobe = ctx.createRadialGradient(lobeX, lobeY, 4, lobeX, lobeY, 82);
  sunLobe.addColorStop(0.0, lobeColor);
  sunLobe.addColorStop(0.45, preset === "night" ? "rgba(70, 110, 175, 0.22)" : "rgba(255, 195, 130, 0.28)");
  sunLobe.addColorStop(1.0, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = sunLobe;
  ctx.fillRect(0, 0, 512, 256);

  if (preset === "studio") {
    // Secondary cool jade-cyan fill softbox opposite key light for crisp museum rim reflections
    const fillLobe = ctx.createRadialGradient(110, 110, 4, 110, 110, 96);
    fillLobe.addColorStop(0.0, "rgba(88, 224, 200, 0.55)");
    fillLobe.addColorStop(1.0, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = fillLobe;
    ctx.fillRect(0, 0, 512, 256);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * 27. Atmospheric Museum Sky Dome Texture (远景海港天穹渐变贴图)
 */
export function getSkyDomeTexture(preset: "dawn" | "dusk" | "night"): THREE.CanvasTexture {
  const cacheKey = `sky_dome_${preset}`;
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey)!;

  const { canvas, ctx } = createOffscreenCanvas(512, 256);
  const grad = ctx.createLinearGradient(0, 0, 0, 256);

  if (preset === "dawn") {
    grad.addColorStop(0.0, "#1c334c");
    grad.addColorStop(0.32, "#355872");
    grad.addColorStop(0.48, "#d4986d");
    grad.addColorStop(0.55, "#f0c18e");
    grad.addColorStop(0.68, "#29343b");
    grad.addColorStop(1.0, "#141a20");
  } else if (preset === "dusk") {
    grad.addColorStop(0.0, "#0e1526");
    grad.addColorStop(0.28, "#1e243d");
    grad.addColorStop(0.45, "#593545");
    grad.addColorStop(0.53, "#be6f4c");
    grad.addColorStop(0.62, "#2a2b36");
    grad.addColorStop(1.0, "#11141c");
  } else {
    grad.addColorStop(0.0, "#040812");
    grad.addColorStop(0.32, "#0a1528");
    grad.addColorStop(0.50, "#13263e");
    grad.addColorStop(0.62, "#0d1826");
    grad.addColorStop(1.0, "#060b14");
  }

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  // Subtle horizon twilight glow arc
  const horizonGlow = ctx.createRadialGradient(340, 128, 6, 340, 128, 140);
  horizonGlow.addColorStop(
    0.0,
    preset === "night"
      ? "rgba(75, 130, 195, 0.25)"
      : preset === "dawn"
      ? "rgba(255, 224, 175, 0.55)"
      : "rgba(255, 166, 98, 0.45)"
  );
  horizonGlow.addColorStop(1.0, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = horizonGlow;
  ctx.fillRect(0, 0, 512, 256);

  // Faint stars in upper zenith hemisphere for dusk & night
  if (preset !== "dawn") {
    const starCount = preset === "night" ? 95 : 42;
    for (let s = 0; s < starCount; s++) {
      const sx = (s * 73 + 19) % 512;
      const sy = (s * 41 + 11) % 88;
      ctx.fillStyle = preset === "night" ? "rgba(235, 245, 255, 0.55)" : "rgba(255, 240, 220, 0.32)";
      ctx.fillRect(sx, sy, s % 5 === 0 ? 2 : 1, s % 5 === 0 ? 2 : 1);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * 28. Museum Velvet Spotlight Backdrop Texture (博物馆微光展厅渐变背景)
 */
export function getMuseumBackdropTexture(uvMode = false): THREE.CanvasTexture {
  const cacheKey = `museum_backdrop_${uvMode ? "uv" : "std"}`;
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey)!;

  const { canvas, ctx } = createOffscreenCanvas(512, 512);
  const bg = ctx.createRadialGradient(256, 225, 24, 256, 256, 360);
  if (uvMode) {
    bg.addColorStop(0.0, "#14223a");
    bg.addColorStop(0.45, "#0a1026");
    bg.addColorStop(1.0, "#040610");
  } else {
    bg.addColorStop(0.0, "#19302a");
    bg.addColorStop(0.48, "#0d1a18");
    bg.addColorStop(1.0, "#050b0a");
  }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * Detect CPU software WebGL rasterizers (e.g., SwiftShader / llvmpipe in headless Linux VMs)
 * so heavy GPU-only passes (2048x2048 PCFSoftShadowMap, cubemap PMREM blurs, 16+ point lights)
 * do not stall main-thread event processing when no hardware GPU is present.
 * Returns false on all real desktop/mobile hardware GPUs.
 */
export function isSoftwareWebGLRenderer(renderer: THREE.WebGLRenderer): boolean {
  try {
    const gl = renderer.getContext();
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    const rendererName = String(
      (debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) ?? ""
    );
    return /SwiftShader|llvmpipe|Software|Basic Render/i.test(rendererName);
  } catch {
    return false;
  }
}





