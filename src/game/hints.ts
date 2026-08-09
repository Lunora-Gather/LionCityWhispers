import Phaser from "phaser";
import { gameState } from "./state";
import { onSceneTeardown } from "./sceneCleanup";

export function bindSceneHint(scene: Phaser.Scene, handler: () => void) {
  window.addEventListener("lcw:hint", handler);
  onSceneTeardown(scene, () => {
    window.removeEventListener("lcw:hint", handler);
  });
}

export function pulseSceneHint(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color = 0x3de0c8
) {
  const rings = [0, 1, 2].map((index) =>
    scene.add
      .circle(x, y, 34 + index * 8, color, index === 0 ? 0.12 : 0)
      .setStrokeStyle(3 - index * 0.5, color, 0.9 - index * 0.18)
      .setDepth(96)
  );

  if (gameState.settings.reduceMotion) {
    scene.time.delayedCall(900, () => rings.forEach((ring) => ring.destroy()));
    return;
  }

  rings.forEach((ring, index) => {
    ring.setScale(0.72).setAlpha(0);
    scene.tweens.add({
      targets: ring,
      scale: 1.55 + index * 0.12,
      alpha: { from: 0.95 - index * 0.16, to: 0 },
      duration: 900,
      delay: index * 150,
      ease: "Sine.easeOut",
      onComplete: () => ring.destroy()
    });
  });
}
