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
    const guideGlow = scene.add.circle(0, 0, 52, config.color, 0.1).setStrokeStyle(1, 0xd0a84c, 0.32);
    const guideRing = scene.add.circle(0, 0, 38, config.color, 0).setStrokeStyle(1, config.color, 0.55);
    const guideNeedle = scene.add.triangle(0, -44, -8, -10, 8, -10, 0, 6, 0xd0a84c, 0.86);
    const guideSpark = scene.add.circle(0, -44, 4, 0xf8edd2, 0.74);
    this.guide = scene.add.container(0, 0, [guideGlow, guideRing, guideNeedle, guideSpark]).setAlpha(0);
    this.halo = scene.add.circle(0, 0, 34, config.color, 0.14).setStrokeStyle(2, 0xf8efd5, 0.48);
    
    // Tight, subtle pulse ring (32px radius, much smaller footprint)
    const pulse = scene.add.circle(0, 0, 32, config.color, 0.04).setStrokeStyle(1, config.color, 0.28);
    const outer = scene.add.circle(0, 0, 23, 0x07100f, 0.48).setStrokeStyle(2, 0xf8efd5, 0.64);
    this.base = scene.add.circle(0, 0, 15, 0xf8efd5, 0.94).setStrokeStyle(2, config.color, 0.96);
    const diamond = scene.add.rectangle(0, 0, 13, 13, config.color, 0.9).setRotation(Math.PI / 4);
    const glint = scene.add.rectangle(0, -10, 15, 2, 0xffffff, 0.48).setRotation(-0.5);
    const glyph = scene.add.text(0, -1, kindGlyphs[config.kind], {
      fontFamily: "Microsoft YaHei, sans-serif",
      fontSize: "26px",
      fontStyle: "bold",
      color: "#07100f"
    }).setOrigin(0.5).setScale(0.5);

    // Sleek rounded rectangle plaque with crisp bold text
    const plaqueWidth = Math.max(100, config.label.length * 16 + 24);
    const plaque = scene.add.graphics();
    plaque.fillStyle(0x07100f, 0.94);
    plaque.fillRoundedRect(-plaqueWidth / 2, -92, plaqueWidth, 32, 6);
    plaque.lineStyle(1.5, 0xd0a84c, 0.85);
    plaque.strokeRoundedRect(-plaqueWidth / 2, -92, plaqueWidth, 32, 6);

    const text = scene.add.text(0, -76, config.label, {
      fontFamily: "Microsoft YaHei, Noto Sans SC, Noto Sans, sans-serif",
      fontSize: "28px",
      fontStyle: "bold",
      color: "#fffcf0",
      stroke: "#07100f",
      strokeThickness: 4
    }).setOrigin(0.5).setScale(0.5);

    this.label = scene.add.container(0, 0, [plaque, text]).setAlpha(0);
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
        scale: 1.15,
        alpha: 0,
        duration: 1500,
        yoyo: false,
        repeat: -1,
        ease: "Sine.easeInOut"
      });
      scene.tweens.add({
        targets: guideRing,
        scale: 1.12,
        alpha: 0.18,
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      });
      scene.tweens.add({
        targets: [guideNeedle, guideSpark],
        y: -49,
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
    const isDialogueOpen = (this.scene as any).activeDialogue !== null;
    const focused = this.proximityFocused || this.hovered || this.guided;
    const labelVisible = (this.proximityFocused || this.hovered || this.guided) && !isDialogueOpen;
    const guideVisible = this.guided && !isDialogueOpen;
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
