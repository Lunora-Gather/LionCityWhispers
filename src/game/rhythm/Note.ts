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
    private travelMs: number,
    label: string,
    color: number
  ) {
    this.marker = scene.add.container(x, -80).setDepth(24);
    const shadow = scene.add.ellipse(5, 7, 54, 24, 0x020504, 0.2);
    const glow = scene.add.circle(0, 0, 38, color, 0.18);
    const string = scene.add.line(0, -44, 0, 0, 0, 28, 0xfff4d6, 0.32);
    const cap = scene.add.rectangle(0, -22, 42, 10, 0x111817, 0.62).setStrokeStyle(1, 0xfff4d6, 0.35);
    const body = scene.add.ellipse(0, 6, 46, 54, color, 0.96).setStrokeStyle(2, 0xfff4d6, 0.86);
    const lower = scene.add.ellipse(0, 22, 34, 14, 0x111817, 0.16).setStrokeStyle(1, 0xfff4d6, 0.28);
    const shine = scene.add.line(0, 0, -12, -10, 12, -20, 0xfff4d6, 0.3);
    const text = scene.add.text(0, 7, label, {
      fontFamily: "Georgia, serif",
      fontSize: `${label.length > 2 ? 13 : 18}px`,
      color: "#14201f"
    }).setOrigin(0.5);
    this.marker.add([shadow, glow, string, cap, body, lower, shine, text]);
  }

  update(elapsed: number) {
    if (this.hit || this.missed) {
      return;
    }
    const progress = (elapsed - (this.time - this.travelMs)) / this.travelMs;
    this.marker.y = Phaser.Math.Linear(166, this.hitY, progress);
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
    this.marker.setAlpha(0.3);
  }
}
