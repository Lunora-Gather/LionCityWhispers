import Phaser from "phaser";
import { gameState } from "./state";

const SPEED = 224;
const MAX_FRAME_DELTA = 34;
const STEP_TRAIL_INTERVAL = 118;

export class Player {
  readonly root: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Container;
  private cursor: Phaser.GameObjects.Triangle;
  private shadow: Phaser.GameObjects.Ellipse;
  private portrait: Phaser.GameObjects.Image;
  private lanternGlow: Phaser.GameObjects.Arc;
  private moveVector = new Phaser.Math.Vector2();
  private trailCooldown = 0;
  private walkTime = 0;

  constructor(private scene: Phaser.Scene, x: number, y: number) {
    this.root = scene.add.container(x, y);
    this.shadow = scene.add.ellipse(0, 31, 66, 16, 0x020504, 0.5);
    this.lanternGlow = scene.add.circle(0, -1, 42, 0xd9ad55, 0.13);
    const outerFrame = scene.add.rectangle(0, -2, 66, 76, 0x06100f, 0.92)
      .setStrokeStyle(2, 0xd1a95d, 0.78);
    const innerFrame = scene.add.rectangle(0, -2, 58, 68, 0x000000, 0)
      .setStrokeStyle(1, 0x3de0c8, 0.28);
    this.portrait = scene.add.image(0, -2, "curator-lin").setDisplaySize(54, 64);
    const portrait = this.portrait;
    const nameplate = scene.add.rectangle(0, 29, 52, 14, 0x07100f, 0.9);
    const initials = scene.add.text(0, 29, gameState.settings.locale === "en" ? "CURATOR" : "馆长", {
      fontFamily: "Microsoft YaHei, sans-serif",
      fontSize: "8px",
      fontStyle: "bold",
      color: "#f2d79b",
      letterSpacing: 1
    }).setOrigin(0.5);
    this.cursor = scene.add.triangle(0, -51, 0, 0, 8, 13, -8, 13, 0xd1a95d, 0.92);
    this.body = scene.add.container(0, 0, [
      this.lanternGlow,
      outerFrame,
      portrait,
      innerFrame,
      nameplate,
      initials
    ]);
    this.root.add([this.shadow, this.body, this.cursor]);
    this.root.setDepth(20);
    if (!gameState.settings.reduceMotion) {
      scene.tweens.add({
        targets: this.lanternGlow,
        alpha: { from: 0.14, to: 0.32 },
        scale: { from: 0.92, to: 1.12 },
        duration: 1080,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      });
      scene.tweens.add({
        targets: this.cursor,
        y: -55,
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
    const safeDelta = Math.min(Math.max(delta, 0), MAX_FRAME_DELTA);
    this.moveVector.set(
      Number(keys.right) - Number(keys.left),
      Number(keys.down) - Number(keys.up)
    );

    if (this.moveVector.lengthSq() > 0) {
      this.moveVector.normalize().scale((SPEED * safeDelta) / 1000);
      this.root.x = Phaser.Math.Clamp(this.root.x + this.moveVector.x, 80, 1200);
      this.root.y = Phaser.Math.Clamp(this.root.y + this.moveVector.y, 250, 585);
      if (this.moveVector.x !== 0) {
        // Flip only the portrait; mirroring the whole body would mirror the nameplate text.
        this.portrait.setFlipX(this.moveVector.x < 0);
      }
      this.walkTime += safeDelta;
      const bob = gameState.settings.reduceMotion ? 0 : Math.sin(this.walkTime / 92) * 1.4;
      this.body.y = bob;
      this.shadow.scaleX = 1.05 + Math.abs(bob) * 0.018;
      this.shadow.scaleY = 0.96 - Math.abs(bob) * 0.008;
      this.cursor.setAlpha(0.95);
      this.emitStepTrail(safeDelta);
    } else {
      this.walkTime = 0;
      this.trailCooldown = 0;
      this.body.y = Phaser.Math.Linear(this.body.y, 0, 0.24);
      this.shadow.scaleX = Phaser.Math.Linear(this.shadow.scaleX, 1, 0.18);
      this.shadow.scaleY = Phaser.Math.Linear(this.shadow.scaleY, 1, 0.18);
      this.cursor.setAlpha(0.55);
    }
  }

  private emitStepTrail(delta: number) {
    if (gameState.settings.reduceMotion) {
      return;
    }
    this.trailCooldown -= delta;
    if (this.trailCooldown > 0) {
      return;
    }
    this.trailCooldown = STEP_TRAIL_INTERVAL;
    const trail = this.scene.add.ellipse(
      this.root.x,
      this.root.y + 34,
      22,
      8,
      0xd1a95d,
      0.16
    ).setDepth(12);
    this.scene.tweens.add({
      targets: trail,
      alpha: 0,
      scaleX: 1.8,
      scaleY: 1.25,
      duration: 460,
      ease: "Sine.easeOut",
      onComplete: () => trail.destroy()
    });
  }

  get x() {
    return this.root.x;
  }

  get y() {
    return this.root.y;
  }
}
