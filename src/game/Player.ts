import Phaser from "phaser";
import { gameState } from "./state";

const SPEED = 224;
const MAX_FRAME_DELTA = 34;
const STEP_TRAIL_INTERVAL = 118;

export class Player {
  readonly root: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Container;
  private figure: Phaser.GameObjects.Container;
  private leftLeg: Phaser.GameObjects.Container;
  private rightLeg: Phaser.GameObjects.Container;
  private backArm: Phaser.GameObjects.Container;
  private frontArm: Phaser.GameObjects.Container;
  private lanternRig: Phaser.GameObjects.Container;
  private scarfTail: Phaser.GameObjects.Graphics;
  private cursor: Phaser.GameObjects.Triangle;
  private shadow: Phaser.GameObjects.Ellipse;
  private lanternGlow: Phaser.GameObjects.Arc;
  private moveVector = new Phaser.Math.Vector2();
  private trailCooldown = 0;
  private walkTime = 0;

  constructor(private scene: Phaser.Scene, x: number, y: number) {
    this.root = scene.add.container(x, y);
    this.shadow = scene.add.ellipse(0, 31, 42, 13, 0x020504, 0.54);
    this.lanternGlow = scene.add.circle(0, 2, 44, 0xd9ad55, 0.14);

    // Subtle diegetic ground compass ring under the explorer's boots
    const groundRing = scene.add.ellipse(0, 31, 34, 10, 0x3de0c8, 0)
      .setStrokeStyle(1, 0xd1a95d, 0.36);

    // 1. Back arm (swings counter to front arm)
    const backArmGfx = scene.add.graphics();
    backArmGfx.fillStyle(0xb59b6d, 1);
    backArmGfx.fillRoundedRect(-4, 0, 8, 18, 3);
    backArmGfx.fillStyle(0x4a321f, 1);
    backArmGfx.fillRect(-4, 13, 8, 3);
    backArmGfx.fillStyle(0xe8c39e, 1);
    backArmGfx.fillCircle(0, 19, 3.2);
    this.backArm = scene.add.container(-9, -12, [backArmGfx]);

    // 2. Articulated Left & Right Legs (trousers + leather puttees + expedition boots)
    const makeLeg = (isLeft: boolean) => {
      const g = scene.add.graphics();
      const tint = isLeft ? 0x3a463d : 0x2f3a32;
      const bootColor = isLeft ? 0x3b2416 : 0x2d1b10;
      // Upper trouser
      g.fillStyle(tint, 1);
      g.fillRoundedRect(-4.5, 0, 9, 12, 3);
      // Puttee wrap
      g.fillStyle(0x5c422c, 1);
      g.fillRoundedRect(-4, 10, 8, 8, 2);
      g.lineStyle(1, 0xd1a95d, 0.75);
      g.strokeRect(-4, 12, 8, 3);
      // Boot + sole
      g.fillStyle(bootColor, 1);
      g.fillRoundedRect(-4.5, 16, 11, 6, 2.5);
      g.fillStyle(0x170d08, 1);
      g.fillRect(-4.5, 20.5, 11, 2);
      return scene.add.container(isLeft ? -5 : 5, 8, [g]);
    };
    this.leftLeg = makeLeg(true);
    this.rightLeg = makeLeg(false);

    // 3. Fluttering emerald Peranakan scarf tail
    this.scarfTail = scene.add.graphics();
    this.scarfTail.fillStyle(0x1f8f82, 1);
    this.scarfTail.fillTriangle(-6, -12, -18, -4, -12, 4);
    this.scarfTail.lineStyle(1, 0x62f2db, 0.8);
    this.scarfTail.lineBetween(-7, -11, -16, -3);

    // 4. Tailored Nanyang Explorer Trench Coat & Torso
    const torsoGfx = scene.add.graphics();
    // Coat skirt flare
    torsoGfx.fillStyle(0xcab286, 1);
    torsoGfx.fillPoints(
      [
        new Phaser.Math.Vector2(-11, -2),
        new Phaser.Math.Vector2(11, -2),
        new Phaser.Math.Vector2(14, 12),
        new Phaser.Math.Vector2(-14, 12)
      ],
      true
    );
    // Upper tailored jacket
    torsoGfx.fillStyle(0xd8c398, 1);
    torsoGfx.fillRoundedRect(-11, -16, 22, 16, 4);
    // Inner waistcoat & shirt V-neck
    torsoGfx.fillStyle(0x28423c, 1);
    torsoGfx.fillTriangle(-5, -16, 5, -16, 0, -5);
    // Coat lapels
    torsoGfx.lineStyle(1.5, 0x8c7248, 0.9);
    torsoGfx.lineBetween(-6, -15, -1, -4);
    torsoGfx.lineBetween(6, -15, 1, -4);
    // Center seam & brass buttons
    torsoGfx.lineStyle(1, 0x78603b, 0.8);
    torsoGfx.lineBetween(0, -4, 0, 11);
    torsoGfx.fillStyle(0xffd685, 1);
    torsoGfx.fillCircle(-3, -3, 1.3);
    torsoGfx.fillCircle(3, -3, 1.3);
    torsoGfx.fillCircle(-3, 4, 1.3);
    torsoGfx.fillCircle(3, 4, 1.3);
    // Leather expedition belt, diagonal baldric strap & side satchel pouch
    torsoGfx.lineStyle(2.2, 0x4a2e1b, 0.95);
    torsoGfx.lineBetween(-8, -15, 8, 2);
    torsoGfx.fillStyle(0x3d2616, 1);
    torsoGfx.fillRect(-12, -1, 24, 3.5);
    torsoGfx.fillRoundedRect(-13.5, 0, 5.5, 7.5, 1.5);
    torsoGfx.lineStyle(1.2, 0xffd685, 0.95);
    torsoGfx.strokeRect(-3, -1.5, 6, 4.5);
    // Emerald heritage scarf wrap at collar
    torsoGfx.fillStyle(0x1f8f82, 1);
    torsoGfx.fillRoundedRect(-9.5, -18, 19, 5.5, 2.5);
    torsoGfx.lineStyle(1, 0x62f2db, 0.75);
    torsoGfx.strokeRoundedRect(-9.5, -18, 19, 5.5, 2.5);

    // 5. Sculpted Head & Nanyang Fedora Hat with Kingfisher Feather
    const headGfx = scene.add.graphics();
    // Back hair bun / nape
    headGfx.fillStyle(0x1e140f, 1);
    headGfx.fillCircle(-4, -25, 7);
    // Warm face oval
    headGfx.fillStyle(0xf1cba8, 1);
    headGfx.fillEllipse(1, -25, 13, 14);
    // Subtle cheek warmth, eyebrows, eyes with catchlight & gentle smile
    headGfx.fillStyle(0xd99578, 0.45);
    headGfx.fillCircle(4, -23, 2);
    headGfx.fillStyle(0x1b120e, 1);
    headGfx.fillCircle(4.2, -25.5, 1.25);
    headGfx.fillCircle(-0.5, -25.5, 1.15);
    headGfx.fillStyle(0xffffff, 0.9);
    headGfx.fillCircle(4.5, -25.9, 0.45);
    headGfx.lineStyle(1, 0x2b1b12, 0.85);
    headGfx.lineBetween(2.8, -27.5, 5.4, -27.2);
    headGfx.lineBetween(-1.8, -27.2, 0.6, -27.5);
    headGfx.lineStyle(1, 0xa85844, 0.85);
    headGfx.lineBetween(0.5, -21.2, 3.2, -21.2);
    // Side hair sweep
    headGfx.fillStyle(0x231711, 1);
    headGfx.fillEllipse(-3, -27, 8, 10);
    // Explorer Fedora Hat brim & pinched crown
    headGfx.fillStyle(0x4f3622, 1);
    headGfx.fillEllipse(0, -31, 24, 5.5);
    headGfx.fillStyle(0x66472e, 1);
    headGfx.fillRoundedRect(-8.5, -38, 17, 8, 3.5);
    // Crimson & gold Peranakan hatband + kingfisher feather
    headGfx.fillStyle(0xa8382b, 1);
    headGfx.fillRect(-8.5, -33, 17, 2.5);
    headGfx.fillStyle(0xffd685, 1);
    headGfx.fillRect(3, -33.5, 3, 3);
    headGfx.fillStyle(0x28b8a4, 1);
    headGfx.fillTriangle(-6, -33, -11, -39, -4, -36);

    // 6. Front Arm + Handheld Brass Heritage Lantern
    const frontArmGfx = scene.add.graphics();
    frontArmGfx.fillStyle(0xd8c398, 1);
    frontArmGfx.fillRoundedRect(-3.5, -2, 14, 7, 3);
    frontArmGfx.fillStyle(0x4a321f, 1);
    frontArmGfx.fillRect(7, -2, 2.5, 7);
    frontArmGfx.fillStyle(0xf1cba8, 1);
    frontArmGfx.fillCircle(11.5, 1.5, 3);
    this.frontArm = scene.add.container(4, -11, [frontArmGfx]);

    const lanternHalo = scene.add.circle(0, 9, 14, 0xffb84d, 0.28);
    const lanternGfx = scene.add.graphics();
    // Brass wire handle
    lanternGfx.lineStyle(1.2, 0xd1a95d, 0.95);
    lanternGfx.strokeCircle(0, 2, 3);
    // Pagoda top cap
    lanternGfx.fillStyle(0xb8893a, 1);
    lanternGfx.fillTriangle(-5, 5, 5, 5, 0, 1.5);
    // Warm glass body & glowing wick core
    lanternGfx.fillStyle(0xffcf70, 0.88);
    lanternGfx.fillRoundedRect(-3.5, 5, 7, 8, 1.5);
    lanternGfx.fillStyle(0xffffff, 0.95);
    lanternGfx.fillCircle(0, 9, 2);
    // Brass cage ribs & base
    lanternGfx.lineStyle(1, 0x593c18, 0.85);
    lanternGfx.strokeRoundedRect(-3.5, 5, 7, 8, 1.5);
    lanternGfx.fillStyle(0x9e7129, 1);
    lanternGfx.fillRect(-4.5, 13, 9, 2.5);
    this.lanternRig = scene.add.container(15, -10, [lanternHalo, lanternGfx]);

    this.figure = scene.add.container(0, 0, [
      this.scarfTail,
      this.backArm,
      this.leftLeg,
      this.rightLeg,
      torsoGfx,
      headGfx,
      this.frontArm,
      this.lanternRig
    ]);

    this.cursor = scene.add.triangle(0, -48, 0, 0, 6, 10, -6, 10, 0xd1a95d, 0.92);
    this.body = scene.add.container(0, 0, [
      this.lanternGlow,
      groundRing,
      this.figure
    ]);
    this.root.add([this.shadow, this.body, this.cursor]);
    this.root.setDepth(20);
    if (!gameState.settings.reduceMotion) {
      scene.tweens.add({
        targets: this.lanternGlow,
        alpha: { from: 0.12, to: 0.28 },
        scale: { from: 0.94, to: 1.1 },
        duration: 1080,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      });
      scene.tweens.add({
        targets: this.cursor,
        y: -52,
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
        this.figure.scaleX = this.moveVector.x < 0 ? -1 : 1;
      }
      this.walkTime += safeDelta;
      const phase = this.walkTime / 78;
      const stride = gameState.settings.reduceMotion ? 0 : Math.sin(phase);
      const bob = gameState.settings.reduceMotion ? 0 : Math.abs(Math.cos(phase)) * -2.2;
      this.body.y = bob;
      this.leftLeg.y = 8 + Math.max(0, stride) * -2.5;
      this.leftLeg.rotation = stride * 0.28;
      this.rightLeg.y = 8 + Math.max(0, -stride) * -2.5;
      this.rightLeg.rotation = -stride * 0.28;
      this.backArm.rotation = -stride * 0.32;
      this.frontArm.rotation = stride * 0.12;
      this.lanternRig.rotation = Math.sin(phase - 0.5) * 0.16;
      this.scarfTail.rotation = -0.12 + Math.sin(phase * 1.3) * 0.14;
      this.shadow.scaleX = 1.04 + Math.abs(bob) * 0.02;
      this.shadow.scaleY = 0.96 - Math.abs(bob) * 0.01;
      this.cursor.setAlpha(0.95);
      this.emitStepTrail(safeDelta);
    } else {
      this.walkTime = 0;
      this.trailCooldown = 0;
      this.body.y = Phaser.Math.Linear(this.body.y, 0, 0.24);
      this.leftLeg.y = Phaser.Math.Linear(this.leftLeg.y, 8, 0.24);
      this.leftLeg.rotation = Phaser.Math.Linear(this.leftLeg.rotation, 0, 0.24);
      this.rightLeg.y = Phaser.Math.Linear(this.rightLeg.y, 8, 0.24);
      this.rightLeg.rotation = Phaser.Math.Linear(this.rightLeg.rotation, 0, 0.24);
      this.backArm.rotation = Phaser.Math.Linear(this.backArm.rotation, 0, 0.24);
      this.frontArm.rotation = Phaser.Math.Linear(this.frontArm.rotation, 0, 0.24);
      this.lanternRig.rotation = Phaser.Math.Linear(this.lanternRig.rotation, 0, 0.2);
      this.scarfTail.rotation = Phaser.Math.Linear(this.scarfTail.rotation, 0, 0.2);
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
      this.root.y + 31,
      18,
      7,
      0xd1a95d,
      0.16
    ).setDepth(12);
    this.scene.tweens.add({
      targets: trail,
      alpha: 0,
      scaleX: 1.7,
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
