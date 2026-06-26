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

const kindGlyphs: Record<InteractableKind, string> = {
  npc: "人",
  puzzle: "谜",
  ritual: "铃",
  museum: "馆"
};

export class NPC {
  readonly marker: Phaser.GameObjects.Container;
  private guide: Phaser.GameObjects.Container;
  private halo: Phaser.GameObjects.Arc;
  private label: Phaser.GameObjects.Container;
  private base: Phaser.GameObjects.Arc;
  private guided = false;
  private proximityFocused = false;
  private hovered = false;
  private focused = false;
  private labelVisible = false;
  private guideVisible = false;

  constructor(private scene: Phaser.Scene, readonly config: InteractableConfig) {
    this.marker = scene.add.container(config.x, config.y);
    const guideGlow = scene.add.circle(0, 0, 72, config.color, 0.13).setStrokeStyle(2, 0xd0a84c, 0.42);
    const guideRing = scene.add.circle(0, 0, 52, config.color, 0).setStrokeStyle(2, config.color, 0.72);
    const guideNeedle = scene.add.triangle(0, -61, -10, -13, 10, -13, 0, 10, 0xd0a84c, 0.86);
    const guideSpark = scene.add.circle(0, -61, 5, 0xf8edd2, 0.74);
    this.guide = scene.add.container(0, 0, [guideGlow, guideRing, guideNeedle, guideSpark]).setAlpha(0);
    this.halo = scene.add.circle(0, 0, 34, config.color, 0.14).setStrokeStyle(2, 0xf8efd5, 0.48);
    const pulse = scene.add.circle(0, 0, 50, config.color, 0.08).setStrokeStyle(1, config.color, 0.34);
    const outer = scene.add.circle(0, 0, 23, 0x07100f, 0.48).setStrokeStyle(2, 0xf8efd5, 0.64);
    this.base = scene.add.circle(0, 0, 15, 0xf8efd5, 0.94).setStrokeStyle(2, config.color, 0.96);
    const diamond = scene.add.rectangle(0, 0, 13, 13, config.color, 0.9).setRotation(Math.PI / 4);
    const glint = scene.add.rectangle(0, -10, 15, 2, 0xffffff, 0.48).setRotation(-0.5);
    const glyph = scene.add.text(0, -1, kindGlyphs[config.kind], {
      fontFamily: "Microsoft YaHei, sans-serif",
      fontSize: "13px",
      fontStyle: "bold",
      color: "#07100f"
    }).setOrigin(0.5);
    const plaqueWidth = Math.max(112, config.label.length * 20 + 22);
    const plaque = scene.add.rectangle(0, -74, plaqueWidth, 36, 0x07100f, 0.91);
    plaque.setStrokeStyle(1, 0xd0a84c, 0.72);
    const plaqueAccent = scene.add.rectangle(-plaqueWidth / 2 + 5, -74, 4, 25, config.color, 0.95);
    const text = scene.add.text(0, 36, config.label, {
      fontFamily: "Microsoft YaHei, sans-serif",
      fontSize: "15px",
      color: "#fff6dc",
      stroke: "#07100f",
      strokeThickness: 3
    }).setOrigin(0.5);

    text.setPosition(0, -72);
    this.label = scene.add.container(0, 0, [plaque, plaqueAccent, text]).setAlpha(0);
    this.marker.add([this.guide, pulse, this.halo, outer, this.base, diamond, glyph, glint, this.label]);
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
        scale: 1.25,
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
      scene.tweens.add({
        targets: [guideNeedle, guideSpark],
        y: "-=6",
        duration: 800,
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
    const labelVisible = this.proximityFocused || this.hovered || this.guided;
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

    this.scene.tweens.killTweensOf([this.guide, this.label, this.halo, this.base]);

    this.scene.tweens.add({
      targets: this.guide,
      alpha: guideVisible ? 1 : 0,
      duration: gameState.settings.reduceMotion ? 0 : 150,
      ease: "Sine.easeOut"
    });
    this.scene.tweens.add({
      targets: this.label,
      alpha: labelVisible ? 1 : 0,
      y: labelVisible ? -4 : 0,
      duration: gameState.settings.reduceMotion ? 0 : 140,
      ease: "Sine.easeOut"
    });
    this.scene.tweens.add({
      targets: this.halo,
      scale: focused ? 1.24 : 1,
      strokeAlpha: focused ? 0.88 : 0.48,
      duration: gameState.settings.reduceMotion ? 0 : 160,
      ease: "Back.easeOut"
    });
    this.scene.tweens.add({
      targets: this.base,
      scale: focused ? 1.14 : 1,
      alpha: focused ? 1 : 0.94,
      duration: gameState.settings.reduceMotion ? 0 : 150,
      ease: "Back.easeOut"
    });
  }
}
