import Phaser from "phaser";
import { gameState } from "./state";

const SPEED = 212;

export class Player {
  readonly root: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Container;
  private cursor: Phaser.GameObjects.Triangle;
  private moveVector = new Phaser.Math.Vector2();

  constructor(private scene: Phaser.Scene, x: number, y: number) {
    this.root = scene.add.container(x, y);
    const shadow = scene.add.ellipse(0, 33, 58, 18, 0x050908, 0.34);
    const lanternGlow = scene.add.circle(31, 4, 29, 0xd9ad55, 0.18);
    const backHem = scene.add.ellipse(1, 18, 42, 25, 0x0b3b37, 0.98);
    const robe = scene.add.ellipse(0, 5, 36, 58, 0x126d66, 0.98);
    const coat = scene.add.polygon(0, 6, [-17, -19, 18, -18, 24, 29, -22, 30], 0x0f5d57, 0.98);
    const innerPanel = scene.add.polygon(0, 8, [-5, -17, 13, -14, 9, 25, -9, 25], 0xf8edd2, 0.14);
    const sash = scene.add.rectangle(0, 11, 35, 7, 0xd0a84c, 0.95).setRotation(-0.28);
    const collar = scene.add.triangle(0, -20, -18, 0, 0, 15, 18, 0, 0xf8edd2, 0.18);
    const neck = scene.add.rectangle(0, -23, 12, 9, 0xd7ad8d, 1);
    const face = scene.add.ellipse(0, -34, 25, 28, 0xf2d2b2, 1);
    const eye = scene.add.circle(-5, -35, 1.6, 0x15201d, 0.9);
    const eye2 = scene.add.circle(6, -35, 1.6, 0x15201d, 0.9);
    const hair = scene.add.arc(0, -40, 17, 205, 338, false, 0x171c1a, 0.98);
    const cap = scene.add.arc(0, -43, 18, 190, 350, false, 0xd1a95d, 0.42).setStrokeStyle(3, 0x302313, 0.5);
    const scarf = scene.add.rectangle(-13, -13, 7, 32, 0xc6523d, 0.9).setRotation(0.28);
    const arm = scene.add.rectangle(21, -2, 10, 34, 0x0d4a45, 0.95).setRotation(-0.28);
    const hand = scene.add.circle(29, 12, 5, 0xf2d2b2, 1);
    const lanternHandle = scene.add.line(0, 0, 29, 7, 34, -8, 0xf8edd2, 0.7).setLineWidth(2);
    const lanternBody = scene.add.circle(34, 8, 8, 0xffd783, 0.96).setStrokeStyle(2, 0x42261d, 0.8);
    const lanternFrame = scene.add.rectangle(34, 8, 18, 18, 0x3a2415, 0).setStrokeStyle(1, 0x3a2415, 0.75);
    const lanternCore = scene.add.circle(34, 8, 3, 0xffffff, 0.72);
    const legs = scene.add.rectangle(-8, 37, 8, 15, 0x111817, 0.88);
    const legs2 = scene.add.rectangle(8, 37, 8, 15, 0x111817, 0.88);
    this.cursor = scene.add.triangle(0, -69, 0, 0, 14, 24, -14, 24, 0xd25b45, 0.92);
    this.body = scene.add.container(0, 0, [
      lanternGlow,
      backHem,
      robe,
      coat,
      innerPanel,
      sash,
      collar,
      neck,
      face,
      eye,
      eye2,
      hair,
      cap,
      scarf,
      arm,
      hand,
      lanternHandle,
      lanternBody,
      lanternFrame,
      lanternCore,
      legs,
      legs2
    ]);
    this.root.add([shadow, this.body, this.cursor]);
    this.root.setDepth(20);
    if (!gameState.settings.reduceMotion) {
      scene.tweens.add({
        targets: lanternGlow,
        alpha: { from: 0.14, to: 0.32 },
        scale: { from: 0.92, to: 1.12 },
        duration: 1080,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      });
      scene.tweens.add({
        targets: this.cursor,
        y: -74,
        duration: 720,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      });
    }
  }

  update(keys: {
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
  }, delta: number) {
    this.moveVector.set(
      Number(keys.right) - Number(keys.left),
      Number(keys.down) - Number(keys.up)
    );

    if (this.moveVector.lengthSq() > 0) {
      this.moveVector.normalize().scale((SPEED * delta) / 1000);
      this.root.x = Phaser.Math.Clamp(this.root.x + this.moveVector.x, 80, 1200);
      this.root.y = Phaser.Math.Clamp(this.root.y + this.moveVector.y, 250, 585);
      if (this.moveVector.x !== 0) {
        this.body.scaleX = this.moveVector.x < 0 ? -1 : 1;
      }
      this.cursor.setAlpha(0.92);
    } else {
      this.cursor.setAlpha(0.55);
    }
  }

  distanceTo(x: number, y: number) {
    return Phaser.Math.Distance.Between(this.root.x, this.root.y, x, y);
  }

  get x() {
    return this.root.x;
  }

  get y() {
    return this.root.y;
  }
}
