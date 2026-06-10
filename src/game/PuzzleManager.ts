import type Phaser from "phaser";
import { gameState } from "./state";

export type PuzzleId = "jigsaw" | "runes" | "lock";

export function startPuzzle(scene: Phaser.Scene, puzzleId: PuzzleId) {
  const map: Record<PuzzleId, string> = {
    jigsaw: "JigsawPuzzle",
    runes: "RunesPuzzle",
    lock: "LockPuzzle"
  };

  transitionTo(scene, map[puzzleId]);
}

export function transitionTo(scene: Phaser.Scene, target: string) {
  if (gameState.settings.reduceMotion) {
    scene.scene.start(target);
    return;
  }
  const veil = scene.add.rectangle(640, 360, 1280, 720, 0x020606, 0).setDepth(200);
  scene.tweens.add({
    targets: veil,
    alpha: 1,
    duration: 220,
    ease: "Sine.easeIn",
    onComplete: () => scene.scene.start(target)
  });
}
