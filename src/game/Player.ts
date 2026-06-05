import Phaser from "phaser";

const SPEED = 212;

export class Player {
  readonly root: Phaser.GameObjects.Container;
  private robe: Phaser.GameObjects.Ellipse;
  private face: Phaser.GameObjects.Ellipse;
  private cursor: Phaser.GameObjects.Triangle;

  constructor(private scene: Phaser.Scene, x: number, y: number) {
    this.root = scene.add.container(x, y);
    const shadow = scene.add.ellipse(0, 28, 52, 18, 0x0d1514, 0.28);
    const lanternGlow = scene.add.circle(23, 0, 20, 0xd9ad55, 0.2);
    this.robe = scene.add.ellipse(0, 7, 38, 56, 0x126d66, 0.96);
    this.face = scene.add.ellipse(0, -24, 24, 26, 0xf2d2b2, 1);
    const hair = scene.add.arc(0, -29, 16, 200, 340, false, 0x1c211f, 0.96);
    const sash = scene.add.rectangle(0, 10, 31, 6, 0xd0a84c, 0.95).setRotation(-0.3);
    const lantern = scene.add.circle(25, 3, 7, 0xffd783, 0.94).setStrokeStyle(2, 0x42261d, 0.7);
    this.cursor = scene.add.triangle(0, -55, 0, 0, 14, 24, -14, 24, 0xd25b45, 0.92);
    this.root.add([shadow, lanternGlow, this.robe, this.face, hair, sash, lantern, this.cursor]);
    this.root.setDepth(18);
  }

  update(keys: {
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
  }, delta: number) {
    const move = new Phaser.Math.Vector2(
      Number(keys.right) - Number(keys.left),
      Number(keys.down) - Number(keys.up)
    );

    if (move.lengthSq() > 0) {
      move.normalize().scale((SPEED * delta) / 1000);
      this.root.x = Phaser.Math.Clamp(this.root.x + move.x, 80, 1200);
      this.root.y = Phaser.Math.Clamp(this.root.y + move.y, 250, 585);
      this.robe.scaleX = move.x < 0 ? -1 : 1;
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
