import Phaser from "phaser";
import { gameState, type ArtifactId } from "./state";
import { artifactGlyphCopy } from "@/data/i18n";

export const artifactColors: Record<ArtifactId, number> = {
  "badang-stone": 0xd1a95d,
  "rune-plaque": 0xc6523d,
  "harbor-seal": 0x6f7772,
  "spirit-chime": 0x2bc7ab
};

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

export function burst(scene: Phaser.Scene, x: number, y: number, color = 0xd1a95d) {
  if (gameState.settings.reduceMotion) {
    const flash = scene.add.circle(x, y, 28, color, 0.28).setDepth(170);
    scene.time.delayedCall(180, () => flash.destroy());
    return;
  }
  for (let index = 0; index < 18; index += 1) {
    const angle = (Math.PI * 2 * index) / 18;
    const dot = scene.add.circle(x, y, 4, color, 0.86).setDepth(170);
    scene.tweens.add({
      targets: dot,
      x: x + Math.cos(angle) * Phaser.Math.Between(48, 96),
      y: y + Math.sin(angle) * Phaser.Math.Between(30, 72),
      alpha: 0,
      scale: 0.25,
      duration: 620,
      ease: "Sine.easeOut",
      onComplete: () => dot.destroy()
    });
  }
}
