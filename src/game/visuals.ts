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
  const length = 18;
  const thickness = 1;
  for (const xSide of [-1, 1]) {
    for (const ySide of [-1, 1]) {
      scene.add.rectangle(x + xSide * (halfWidth - length / 2), y + ySide * halfHeight, length, thickness, color, alpha);
      scene.add.rectangle(x + xSide * halfWidth, y + ySide * (halfHeight - length / 2), thickness, length, color, alpha);
    }
  }
}

export function drawPuzzleBackdrop(scene: Phaser.Scene, config: PuzzleBackdropConfig) {
  const accent = config.accent ?? 0xd1a95d;
  scene.add.rectangle(640, 360, 1280, 720, 0x030807);
  const bg = scene.add.image(640, 360, "world-cinematic");
  const scale = Math.max(1280 / bg.width, 720 / bg.height);
  bg.setScale(scale).setAlpha(0.34).setTint(0x6c8278);
  scene.add.rectangle(640, 360, 1280, 720, 0x04100e, config.overlayAlpha ?? 0.58);

  const ambientLeft = scene.add.circle(214, 220, 170, 0xd1a95d, 0.045);
  const ambientRight = scene.add.circle(1070, 470, 220, 0x2bc7ab, 0.035);
  const frame = scene.add.graphics();
  frame.lineStyle(1, 0xd1a95d, 0.22);
  frame.strokeRoundedRect(58, 104, 1164, 570, 22);
  frame.lineStyle(1, 0x2bc7ab, 0.13);
  frame.strokeRoundedRect(68, 114, 1144, 550, 18);
  frame.fillStyle(0x050c0b, 0.72);
  frame.fillRoundedRect(112, 250, 1056, 368, 24);
  frame.lineStyle(1, accent, 0.24);
  frame.strokeRoundedRect(112, 250, 1056, 368, 24);
  drawCornerTicks(scene, 640, 386, 1032, 340, accent, 0.28);

  scene.add.text(118, 122, gameState.settings.locale === "en" ? "RESTORATION WORKBENCH" : "文物修复工作台", {
    fontFamily: "Georgia, Microsoft YaHei, sans-serif",
    fontSize: "12px",
    fontStyle: "bold",
    color: "#d1a95d",
    letterSpacing: 3
  });
  scene.add.rectangle(232, 145, 228, 1, accent, 0.34);

  // Floating animated motes
  for (const mote of [
    [84, 188, 2],
    [1188, 210, 3],
    [1148, 606, 2],
    [94, 584, 3],
    [1092, 446, 2]
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

  scene.add.text(118, 158, config.title, {
    fontFamily: "Microsoft YaHei, Noto Sans SC, sans-serif",
    fontSize: "36px",
    fontStyle: "800",
    color: "#fff4d6",
    shadow: { offsetX: 1, offsetY: 2, color: "#000000", blur: 8, fill: true }
  });
  scene.add.text(118, 205, config.subtitle, {
    fontFamily: "Microsoft YaHei, Noto Sans SC, sans-serif",
    fontSize: "17px",
    fontStyle: "600",
    color: "#efe1bd",
    shadow: { offsetX: 1, offsetY: 1, color: "#000000", blur: 2, fill: true }
  });
  scene.add.text(118, 231, config.clue, {
    fontFamily: "Microsoft YaHei, Noto Sans SC, sans-serif",
    fontSize: "13px",
    color: "#91aaa3",
    wordWrap: { width: 760 }
  });
  scene.add.rectangle(640, 642, 820, 1, accent, 0.18);

  if (!gameState.settings.reduceMotion) {
    scene.tweens.add({
      targets: [ambientLeft, ambientRight],
      alpha: { from: 0.025, to: 0.075 },
      scale: { from: 0.92, to: 1.08 },
      duration: 4200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
  }
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
