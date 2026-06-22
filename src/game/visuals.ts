import Phaser from "phaser";
import { gameState, type ArtifactId } from "./state";
import { artifactGlyphCopy } from "@/data/i18n";

export const artifactColors: Record<ArtifactId, number> = {
  "badang-stone": 0xd1a95d,
  "rune-plaque": 0xc6523d,
  "harbor-seal": 0x6f7772,
  "spirit-chime": 0x2bc7ab
};

type PuzzleBackdropConfig = {
  title: string;
  subtitle: string;
  clue: string;
  accent?: number;
  backgroundAlpha?: number;
  overlayAlpha?: number;
};

function drawCornerTicks(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  color: number,
  alpha: number
) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const length = 24;
  const thickness = 2;
  for (const xSide of [-1, 1]) {
    for (const ySide of [-1, 1]) {
      scene.add.rectangle(x + xSide * (halfWidth - length / 2), y + ySide * halfHeight, length, thickness, color, alpha);
      scene.add.rectangle(x + xSide * halfWidth, y + ySide * (halfHeight - length / 2), thickness, length, color, alpha);
    }
  }
}

export function drawPuzzleBackdrop(scene: Phaser.Scene, config: PuzzleBackdropConfig) {
  const accent = config.accent ?? 0xd1a95d;
  scene.add.rectangle(640, 360, 1280, 720, 0x050c0a);
  const bg = scene.add.image(640, 360, "world-cinematic");
  const scale = Math.max(1280 / bg.width, 720 / bg.height);
  bg.setScale(scale).setAlpha(0.24).setTint(0x123f36);
  scene.add.rectangle(640, 360, 1280, 720, 0x060e0d, config.overlayAlpha ?? 0.52);

  // Outer glowing panel
  scene.add.rectangle(640, 372, 1018, 584, 0x020605, 0.4);
  const panel = scene.add.rectangle(640, 360, 980, 560, 0x0c1b18, 0.92);
  panel.setStrokeStyle(3, 0x1f8f82, 0.72);

  // Inner golden border
  scene.add.rectangle(640, 360, 968, 548).setStrokeStyle(1.5, 0xd1a95d, 0.36);

  scene.add.rectangle(640, 152, 920, 2, accent, 0.28);
  scene.add.rectangle(640, 560, 920, 2, accent, 0.24);
  scene.add.rectangle(640, 356, 900, 370, 0x2bc7ab, 0.015);
  drawCornerTicks(scene, 640, 360, 980, 560, accent, 0.36);

  // Glowing guidelines
  for (let index = 0; index < 7; index += 1) {
    const y = 312 + index * 34;
    scene.add.line(640, y, -405, 0, 405, 0, 0xd1a95d, index % 2 === 0 ? 0.06 : 0.03);
  }

  // Floating animated motes
  for (const mote of [
    [218, 172, 3],
    [1028, 198, 4],
    [1114, 530, 3],
    [236, 520, 4],
    [998, 438, 3]
  ]) {
    const circle = scene.add.circle(mote[0], mote[1], mote[2], accent, 0.28);
    if (!gameState.settings.reduceMotion) {
      scene.tweens.add({
        targets: circle,
        scale: { from: 1, to: 1.6 },
        alpha: { from: 0.18, to: 0.62 },
        y: mote[1] - 16,
        duration: 2200 + Math.random() * 1600,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      });
    }
  }

  // Premium text formatting
  scene.add.text(170, 182, config.title, {
    fontFamily: "Microsoft YaHei, Noto Sans SC, sans-serif",
    fontSize: "35px",
    fontStyle: "800",
    color: "#fff4d6",
    shadow: { offsetX: 1, offsetY: 2, color: "#000000", blur: 4, fill: true }
  });
  scene.add.text(170, 228, config.subtitle, {
    fontFamily: "Microsoft YaHei, Noto Sans SC, sans-serif",
    fontSize: "18px",
    fontStyle: "600",
    color: "#d1a95d",
    shadow: { offsetX: 1, offsetY: 1, color: "#000000", blur: 2, fill: true }
  });
  scene.add.text(170, 258, config.clue, {
    fontFamily: "Microsoft YaHei, Noto Sans SC, sans-serif",
    fontSize: "15px",
    color: "#a8c0ba"
  });
  scene.add.rectangle(288, 290, 236, 2, accent, 0.46);
}

export function drawArtifactIcon(
  scene: Phaser.Scene,
  id: ArtifactId,
  x: number,
  y: number,
  size = 44
) {
  const group = scene.add.container(x, y);
  const color = artifactColors[id];
  const glow = scene.add.circle(0, 0, size * 0.64, color, 0.16);
  const disc = scene.add.circle(0, 0, size * 0.42, color, 0.95).setStrokeStyle(2, 0xfff4d6, 0.5);
  const glyph = scene.add.text(0, 0, artifactGlyphCopy[id][gameState.settings.locale], {
    fontFamily: "Microsoft YaHei, sans-serif",
    fontSize: `${Math.round(size * (gameState.settings.locale === "en" ? 0.28 : 0.4))}px`,
    color: "#fff4d6"
  }).setOrigin(0.5);
  group.add([glow, disc, glyph]);
  return group;
}

export function showRewardBanner(scene: Phaser.Scene, text: string, tone: number) {
  const banner = scene.add.container(640, 520).setDepth(180).setAlpha(0);
  const panel = scene.add.rectangle(0, 0, 680, 78, tone, 0.94).setStrokeStyle(1, 0xfff4d6, 0.32);
  const label = scene.add.text(0, 0, text, {
    fontFamily: "Microsoft YaHei, sans-serif",
    fontSize: "24px",
    color: "#fff4d6"
  }).setOrigin(0.5);
  banner.add([panel, label]);
  if (gameState.settings.reduceMotion) {
    banner.setAlpha(1).setY(500);
    return banner;
  }
  scene.tweens.add({
    targets: banner,
    alpha: 1,
    y: 500,
    duration: 240,
    ease: "Back.easeOut"
  });
  return banner;
}

export function burst(scene: Phaser.Scene, x: number, y: number, color = 0xd1a95d, count = 18, baseSize = 4) {
  if (gameState.settings.reduceMotion) {
    const flash = scene.add.circle(x, y, 28, color, 0.28).setDepth(170);
    scene.time.delayedCall(180, () => flash.destroy());
    return;
  }
  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / count;
    const size = Phaser.Math.Between(Math.max(1, baseSize - 2), baseSize + 2);
    const dot = scene.add.circle(x, y, size, color, 0.86).setDepth(170);
    scene.tweens.add({
      targets: dot,
      x: x + Math.cos(angle) * Phaser.Math.Between(48, 120),
      y: y + Math.sin(angle) * Phaser.Math.Between(30, 96),
      alpha: 0,
      scale: 0.2,
      duration: Phaser.Math.Between(500, 750),
      ease: "Sine.easeOut",
      onComplete: () => dot.destroy()
    });
  }
}
