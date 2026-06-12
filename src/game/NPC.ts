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
  private guide: Phaser.GameObjects.Container;
  private halo: Phaser.GameObjects.Arc;
  private label: Phaser.GameObjects.Container;
  private guided = false;
  private proximityFocused = false;
  private hovered = false;
  private focused = false;
  private labelVisible = false;
  private guideVisible = false;

  constructor(private scene: Phaser.Scene, readonly config: InteractableConfig) {
    this.marker = scene.add.container(config.x, config.y);
    const guideGlow = scene.add.circle(0, 0, 68, config.color, 0.14).setStrokeStyle(2, 0xd0a84c, 0.42);
    const guideRing = scene.add.circle(0, 0, 50, config.color, 0).setStrokeStyle(2, config.color, 0.72);
    const guideNeedle = scene.add.triangle(0, -58, -9, -13, 9, -13, 0, 10, 0xd0a84c, 0.82);
    this.guide = scene.add.container(0, 0, [guideGlow, guideRing, guideNeedle]).setAlpha(0);
    this.halo = scene.add.circle(0, 0, 32, config.color, 0.14).setStrokeStyle(2, 0xf8efd5, 0.48);
    const pulse = scene.add.circle(0, 0, 48, config.color, 0.08).setStrokeStyle(1, config.color, 0.34);
    const outer = scene.add.circle(0, 0, 21, 0x07100f, 0.42).setStrokeStyle(2, 0xf8efd5, 0.62);
    const base = scene.add.circle(0, 0, 14, 0xf8efd5, 0.92).setStrokeStyle(2, config.color, 0.96);
    const diamond = scene.add.rectangle(0, 0, 13, 13, config.color, 0.9).setRotation(Math.PI / 4);
    const glint = scene.add.rectangle(0, -9, 14, 2, 0xffffff, 0.44).setRotation(-0.5);
    const plaqueWidth = Math.max(104, config.label.length * 20 + 18);
    const plaque = scene.add.rectangle(0, -72, plaqueWidth, 34, 0x07100f, 0.9);
    plaque.setStrokeStyle(1, 0xd0a84c, 0.72);
    const plaqueAccent = scene.add.rectangle(-plaqueWidth / 2 + 5, -72, 4, 24, config.color, 0.95);
    const text = scene.add.text(0, 36, config.label, {
      fontFamily: "Microsoft YaHei, sans-serif",
      fontSize: "15px",
      color: "#fff6dc",
      stroke: "#07100f",
      strokeThickness: 3
    }).setOrigin(0.5);

    text.setPosition(0, -70);
    this.label = scene.add.container(0, 0, [plaque, plaqueAccent, text]).setAlpha(0);
    this.marker.add([this.guide, pulse, this.halo, outer, base, diamond, glint, this.label]);
    this.marker.setDepth(16);
    this.marker.setInteractive(
      new Phaser.Geom.Circle(0, 0, config.radius),
      Phaser.Geom.Circle.Contains
    );
    this.marker.on("pointerover", () => this.setHover(true));
    this.marker.on("pointerout", () => this.setHover(false));
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
      scene.tweens.add({
        targets: guideRing,
        scale: 1.14,
        alpha: 0.22,
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      });
    }
  }

  isNear(x: number, y: number) {
    return Phaser.Math.Distance.Between(x, y, this.config.x, this.config.y) <= this.config.radius;
  }

  setFocus(focused: boolean) {
    if (this.proximityFocused === focused) {
      return;
    }
    this.proximityFocused = focused;
    this.updateFocus();
  }

  setGuided(guided: boolean) {
    if (this.guided === guided) {
      return;
    }
    this.guided = guided;
    this.updateFocus();
  }

  private setHover(hovered: boolean) {
    if (this.hovered === hovered) {
      return;
    }
    this.hovered = hovered;
    this.updateFocus();
  }

  private updateFocus() {
    const focused = this.proximityFocused || this.hovered || this.guided;
    const labelVisible = this.hovered || this.guided;
    const guideVisible = this.guided;
    if (
      this.focused === focused &&
      this.labelVisible === labelVisible &&
      this.guideVisible === guideVisible
    ) {
      return;
    }
    this.focused = focused;
    this.labelVisible = labelVisible;
    this.guideVisible = guideVisible;

    this.scene.tweens.killTweensOf([this.guide, this.label, this.halo]);

    this.scene.tweens.add({
      targets: this.guide,
      alpha: guideVisible ? 1 : 0,
      duration: gameState.settings.reduceMotion ? 0 : 150,
      ease: "Sine.easeOut"
    });
    this.scene.tweens.add({
      targets: [this.label],
      alpha: labelVisible ? 1 : 0,
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
