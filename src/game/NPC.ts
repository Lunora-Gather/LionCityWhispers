import Phaser from "phaser";
import { gameState } from "./state";

export type InteractableKind = "npc" | "puzzle" | "ritual" | "museum";

export type InteractableConfig = {
  id: string;
  kind: InteractableKind;
  x: number;
  y: number;
  radius: number;
  label: string;
  color: number;
  onInteract: () => void;
};

export class NPC {
  readonly marker: Phaser.GameObjects.Container;
  private halo: Phaser.GameObjects.Arc;
  private label: Phaser.GameObjects.Container;
  private focused = false;

  constructor(private scene: Phaser.Scene, readonly config: InteractableConfig) {
    this.marker = scene.add.container(config.x, config.y);
    this.halo = scene.add.circle(0, 0, 34, config.color, 0.18).setStrokeStyle(2, 0xf8efd5, 0.5);
    const pulse = scene.add.circle(0, 0, 54, config.color, 0.08).setStrokeStyle(1, config.color, 0.35);
    const base = scene.add.circle(0, 0, 18, 0xf8efd5, 0.92).setStrokeStyle(3, config.color, 0.95);
    const diamond = scene.add.rectangle(0, 0, 17, 17, config.color, 0.9).setRotation(Math.PI / 4);
    const plaque = scene.add.rectangle(0, -70, Math.max(88, config.label.length * 20), 32, 0x101817, 0.74);
    plaque.setStrokeStyle(1, 0xd0a84c, 0.55);
    const text = scene.add.text(0, 36, config.label, {
      fontFamily: "Microsoft YaHei, sans-serif",
      fontSize: "15px",
      color: "#fff6dc"
    }).setOrigin(0.5);

    text.setPosition(0, -70);
    this.label = scene.add.container(0, 0, [plaque, text]).setAlpha(0);
    this.marker.add([pulse, this.halo, base, diamond, this.label]);
    this.marker.setDepth(16);
    this.marker.setInteractive(
      new Phaser.Geom.Circle(0, 0, config.radius),
      Phaser.Geom.Circle.Contains
    );
    this.marker.on("pointerover", () => this.setFocus(true));
    this.marker.on("pointerout", () => this.setFocus(false));
    if (!gameState.settings.reduceMotion) {
      scene.tweens.add({
        targets: pulse,
        scale: 1.22,
        alpha: 0,
        duration: 1800,
        yoyo: false,
        repeat: -1,
        ease: "Sine.easeInOut"
      });
    }
  }

  isNear(x: number, y: number) {
    return Phaser.Math.Distance.Between(x, y, this.config.x, this.config.y) <= this.config.radius;
  }

  setFocus(focused: boolean) {
    if (this.focused === focused) {
      return;
    }
    this.focused = focused;
    this.scene.tweens.add({
      targets: [this.label],
      alpha: focused ? 1 : 0,
      duration: gameState.settings.reduceMotion ? 0 : 120,
      ease: "Sine.easeOut"
    });
    this.scene.tweens.add({
      targets: this.halo,
      scale: focused ? 1.22 : 1,
      duration: gameState.settings.reduceMotion ? 0 : 160,
      ease: "Back.easeOut"
    });
  }
}
