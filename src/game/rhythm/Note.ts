import Phaser from "phaser";

export class Note {
  readonly marker: Phaser.GameObjects.Container;
  hit = false;
  missed = false;

  constructor(
    scene: Phaser.Scene,
    readonly lane: number,
    readonly time: number,
    x: number,
    private hitY: number,
    private travelMs: number
  ) {
    this.marker = scene.add.container(x, -80);
    const glow = scene.add.circle(0, 0, 34, 0xd1a95d, 0.16);
    const body = scene.add.circle(0, 0, 23, 0xd1a95d, 0.96).setStrokeStyle(2, 0xfff4d6, 0.86);
    const text = scene.add.text(0, 0, ["A", "S", "D", "F"][lane], {
      fontFamily: "Georgia, serif",
      fontSize: "18px",
      color: "#14201f"
    }).setOrigin(0.5);
    this.marker.add([glow, body, text]);
    this.marker.setDepth(18);
  }

  update(elapsed: number) {
    if (this.hit || this.missed) {
      return;
    }
    const progress = (elapsed - (this.time - this.travelMs)) / this.travelMs;
    this.marker.y = Phaser.Math.Linear(74, this.hitY, progress);
    this.marker.setAlpha(Phaser.Math.Clamp(progress + 0.18, 0, 1));
    if (progress > 1.18) {
      this.missed = true;
      this.marker.setAlpha(0.2);
    }
  }

  diff(elapsed: number) {
    return Math.abs(elapsed - this.time);
  }

  markHit() {
    this.hit = true;
    this.marker.setScale(1.18);
    this.marker.setAlpha(0.35);
  }
}
