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
  private base: Phaser.GameObjects.Container;
  private guided = false;
  private proximityFocused = false;
  private hovered = false;
  private focused = false;
  private labelVisible = false;
  private guideVisible = false;

  constructor(private scene: Phaser.Scene, readonly config: InteractableConfig) {
    this.marker = scene.add.container(config.x, config.y);
    const isCharacter = config.kind === "npc";
    const ringY = isCharacter ? 20 : 0;

    const guideGlow = scene.add
      .ellipse(0, ringY, isCharacter ? 54 : 52, isCharacter ? 22 : 52, config.color, 0.1)
      .setStrokeStyle(1, 0xd0a84c, 0.28);
    const guideRing = scene.add
      .ellipse(0, ringY, isCharacter ? 44 : 42, isCharacter ? 18 : 42, config.color, 0)
      .setStrokeStyle(1.2, config.color, 0.55);
    const needleTopY = isCharacter ? -42 : -30;
    const guideNeedle = scene.add.triangle(0, needleTopY, -5, -8, 5, -8, 0, 3, 0xd0a84c, 0.88);
    const guideSpark = scene.add.circle(0, needleTopY, 2.5, 0xf8edd2, 0.78);
    this.guide = scene.add
      .container(0, 0, [guideGlow, guideRing, guideNeedle, guideSpark])
      .setAlpha(0);

    this.halo = scene.add
      .circle(0, ringY, isCharacter ? 20 : 19, config.color, 0.08)
      .setStrokeStyle(1.2, 0xf8efd5, 0.34);
    if (isCharacter) {
      this.halo.setScale(1.15, 0.48);
    }

    const pulse = scene.add
      .circle(0, ringY, isCharacter ? 19 : 18, config.color, 0.03)
      .setStrokeStyle(1, config.color, 0.22);
    if (isCharacter) {
      pulse.setScale(1.15, 0.48);
    }

    this.base = this.buildDiegeticEmblem(scene, config);

    // Sleek heritage lacquer plaque with brass border & diamond accents
    const plaqueY = isCharacter ? -66 : -54;
    const plaqueWidth = Math.max(84, config.label.length * 13 + 24);
    const plaque = scene.add.graphics();
    plaque.fillStyle(0x071210, 0.92);
    plaque.fillRoundedRect(-plaqueWidth / 2, plaqueY, plaqueWidth, 24, 6);
    plaque.lineStyle(1, 0xd0a84c, 0.74);
    plaque.strokeRoundedRect(-plaqueWidth / 2, plaqueY, plaqueWidth, 24, 6);
    plaque.fillStyle(0xd0a84c, 0.85);
    plaque.fillCircle(-plaqueWidth / 2 + 6, plaqueY + 12, 1.6);
    plaque.fillCircle(plaqueWidth / 2 - 6, plaqueY + 12, 1.6);

    const text = scene.add
      .text(0, plaqueY + 12, config.label, {
        fontFamily: "Microsoft YaHei, Noto Sans SC, Noto Sans, sans-serif",
        fontSize: "11.5px",
        fontStyle: "bold",
        color: "#fffcf0",
        stroke: "#07100f",
        strokeThickness: 2
      })
      .setOrigin(0.5);

    this.label = scene.add.container(0, 0, [plaque, text]).setAlpha(0);
    this.marker.add([this.guide, pulse, this.halo, this.base, this.label]);
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
        scaleX: isCharacter ? 1.38 : 1.18,
        scaleY: isCharacter ? 0.6 : 1.18,
        alpha: 0,
        duration: 1500,
        yoyo: false,
        repeat: -1,
        ease: "Sine.easeInOut"
      });
      scene.tweens.add({
        targets: guideRing,
        scale: 1.1,
        alpha: 0.2,
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      });
      scene.tweens.add({
        targets: [guideNeedle, guideSpark],
        y: needleTopY - 4,
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      });
    }
  }

  private buildDiegeticEmblem(scene: Phaser.Scene, config: InteractableConfig) {
    const g = scene.add.graphics();

    if (config.id === "curator") {
      // Curator Lin: Richly shaded Nanyang Heritage Figurine in Peranakan Kebaya, Trench & Gold Spectacles
      // Soft ambient occlusion ground shadow
      g.fillStyle(0x020605, 0.56);
      g.fillEllipse(0, 21, 34, 10);
      // Leather Oxford shoes
      g.fillStyle(0x2b170e, 1);
      g.fillEllipse(-4, 19.5, 6.5, 3.2);
      g.fillEllipse(4, 19.5, 6.5, 3.2);
      // Peranakan sarong skirt with pleated gold-batik center panel (kepala kain)
      g.fillStyle(0x134e46, 1);
      g.fillPoints(
        [
          new Phaser.Math.Vector2(-8.5, 0),
          new Phaser.Math.Vector2(8.5, 0),
          new Phaser.Math.Vector2(11, 18.5),
          new Phaser.Math.Vector2(-11, 18.5)
        ],
        true
      );
      g.fillStyle(0x7a1c28, 0.92);
      g.fillRect(-3.2, 1, 6.4, 17);
      g.lineStyle(1.2, 0xe2b857, 0.9);
      g.lineBetween(-10.5, 16, 10.5, 16);
      g.lineBetween(-3.2, 1, -3.2, 18);
      g.lineBetween(3.2, 1, 3.2, 18);
      // Tailored archival coat & Peranakan kebaya embroidery lapels
      g.fillStyle(0x524030, 1);
      g.fillRoundedRect(-10, -14, 20, 16, 4.5);
      // Sleeves & forearms curving inward to hold archival scroll
      g.fillStyle(0x453527, 1);
      g.fillRoundedRect(-13, -12, 4.5, 11, 2.2);
      g.fillRoundedRect(8.5, -12, 4.5, 11, 2.2);
      // Crimson & teal Kebaya collar inset
      g.fillStyle(0x8c1d2b, 1);
      g.fillTriangle(-5.5, -14, 5.5, -14, 0, -1);
      g.lineStyle(1.3, 0xe8c15a, 0.95);
      g.lineBetween(-5.5, -13.5, 0, -1);
      g.lineBetween(5.5, -13.5, 0, -1);
      // 3-tier gold Kerosang brooches down center
      g.fillStyle(0xffde7a, 1);
      g.fillCircle(0, -10, 1.3);
      g.fillCircle(0, -6.5, 1.1);
      g.fillCircle(0, -3.5, 1.1);
      // Warm cashmere scarf collar
      g.fillStyle(0xb5382b, 1);
      g.fillRoundedRect(-7.5, -15.5, 15, 3.8, 2);
      // Held heritage scroll & hands
      g.fillStyle(0xf8edd2, 1);
      g.fillRoundedRect(-7.5, -3.5, 15, 4.8, 2);
      g.lineStyle(1, 0xc7a356, 0.85);
      g.strokeRoundedRect(-7.5, -3.5, 15, 4.8, 2);
      g.fillStyle(0xb9402f, 1);
      g.fillRect(-1.6, -3.5, 3.2, 4.8);
      g.fillStyle(0xf0caa8, 1);
      g.fillCircle(-6.5, -1, 2.2);
      g.fillCircle(6.5, -1, 2.2);
      // Sculpted head, 1930s Marcel hair waves, chignon bun & jade hairpin
      g.fillStyle(0x18110d, 1);
      g.fillCircle(0, -24.5, 8);
      g.fillCircle(0, -30, 4.8);
      // Golden hairpin with jade finial
      g.lineStyle(1.5, 0xffd685, 0.95);
      g.lineBetween(-8, -29.5, 8, -27.5);
      g.fillStyle(0x3de0c8, 1);
      g.fillCircle(8, -27.5, 1.8);
      // Face contour & warm blush
      g.fillStyle(0xf2ccb0, 1);
      g.fillEllipse(0, -21.5, 12, 13);
      g.fillStyle(0xd98a73, 0.42);
      g.fillCircle(-3.8, -19.8, 1.8);
      g.fillCircle(3.8, -19.8, 1.8);
      // Parted 1930s wave bangs
      g.fillStyle(0x18110d, 1);
      g.fillEllipse(-3, -26.5, 7, 4.2);
      g.fillEllipse(3, -26.5, 7, 4.2);
      // Eyes, arched brows, round brass spectacles & warm smile
      g.fillStyle(0x18110d, 1);
      g.fillCircle(-2.8, -21.5, 1.1);
      g.fillCircle(2.8, -21.5, 1.1);
      g.lineStyle(1.1, 0xe0b548, 0.95);
      g.strokeCircle(-2.8, -21.5, 2.4);
      g.strokeCircle(2.8, -21.5, 2.4);
      g.lineBetween(-0.4, -21.5, 0.4, -21.5);
      g.lineStyle(1, 0xa84c3e, 0.9);
      g.lineBetween(-1.5, -17.5, 1.5, -17.5);
      return scene.add.container(0, 0, [g]);
    }

    if (config.id === "boatman") {
      // Old Boatman Chen: Weathered Nanyang River Boatman in Samfoo Tunic, Frog Buttons & Woven Bamboo Hat
      g.fillStyle(0x020605, 0.56);
      g.fillEllipse(0, 21, 36, 10);
      // Hand-carved bamboo sculling oar / punt pole & hanging storm lantern on right
      g.lineStyle(2.4, 0x8c6836, 0.98);
      g.lineBetween(12, -25, 9.5, 20);
      g.fillStyle(0xffb84d, 0.32);
      g.fillCircle(13, -15, 9.5);
      g.fillStyle(0xffdf88, 0.96);
      g.fillRoundedRect(10.5, -18.5, 5.2, 6.5, 1.5);
      g.lineStyle(1, 0x5c3c16, 0.9);
      g.strokeRoundedRect(10.5, -18.5, 5.2, 6.5, 1.5);
      // Rolled indigo trousers, white cuffs & bare muscular calves
      g.fillStyle(0x233345, 1);
      g.fillRoundedRect(-7, 3, 5.8, 11.5, 2);
      g.fillRoundedRect(1.2, 3, 5.8, 11.5, 2);
      g.fillStyle(0xe6dfd3, 1);
      g.fillRect(-7, 13, 5.8, 2);
      g.fillRect(1.2, 13, 5.8, 2);
      g.fillStyle(0xc9956b, 1);
      g.fillRect(-5.8, 15, 3.6, 4.5);
      g.fillRect(2.2, 15, 3.6, 4.5);
      // Traditional off-white/indigo Nanyang Samfoo tunic with red frog buttons (盘扣)
      g.fillStyle(0xe4dfd5, 1);
      g.fillRoundedRect(-10, -13.5, 20, 17.5, 4.5);
      // Sleeves & weathered hands
      g.fillStyle(0xd8d2c5, 1);
      g.fillRoundedRect(-13, -11.5, 4.2, 10, 2);
      g.fillRoundedRect(8.8, -11.5, 4.2, 10, 2);
      g.fillStyle(0xc9956b, 1);
      g.fillCircle(-11, -0.5, 2.2);
      g.fillCircle(11, -2.5, 2.2);
      // Diagonal Samfoo placket & 3 red frog buttons
      g.lineStyle(1.2, 0x8c2d22, 0.9);
      g.lineBetween(0, -13, 3, -2);
      g.fillStyle(0x9e3224, 1);
      g.fillCircle(1, -10.5, 1.2);
      g.fillCircle(2, -7.5, 1.2);
      g.fillCircle(2.6, -4.5, 1.2);
      // Broad cinnabar waist sash, knot & hanging brass coin pouch
      g.fillStyle(0x8f2d22, 1);
      g.fillRoundedRect(-10.2, -1.5, 20.4, 4.2, 1.5);
      g.fillTriangle(-6, 2, -3, 2, -5, 9);
      g.fillStyle(0xc49a45, 1);
      g.fillCircle(5, 3.5, 2.6);
      // Weathered head, silver eyebrows, mustache & goatee beard
      g.fillStyle(0xc9956b, 1);
      g.fillEllipse(0, -20, 11.5, 11.5);
      g.fillStyle(0x1c140f, 1);
      g.fillCircle(-2.6, -20.5, 1.0);
      g.fillCircle(2.6, -20.5, 1.0);
      // Silver mustache & tapered beard
      g.fillStyle(0xe8e4dc, 0.95);
      g.fillEllipse(-2.2, -17.5, 4.2, 1.8);
      g.fillEllipse(2.2, -17.5, 4.2, 1.8);
      g.fillTriangle(-3.2, -17, 3.2, -17, 0, -10.5);
      // Wide woven bamboo conical hat (斗笠) with radial bamboo ribs
      g.fillStyle(0xd1ab66, 1);
      g.fillTriangle(-16.5, -22.5, 16.5, -22.5, 0, -33.5);
      g.lineStyle(1.3, 0x785826, 0.92);
      g.strokeTriangle(-16.5, -22.5, 16.5, -22.5, 0, -33.5);
      g.lineStyle(0.9, 0x8c6830, 0.75);
      g.lineBetween(0, -33.5, -8, -22.5);
      g.lineBetween(0, -33.5, 0, -22.5);
      g.lineBetween(0, -33.5, 8, -22.5);
      return scene.add.container(0, 0, [g]);
    }

    // Diegetic Nanyang Octagonal Relic / Architectural Medallion (compact & refined)
    g.fillStyle(0x06100f, 0.76);
    g.fillCircle(0, 0, 14);
    g.lineStyle(1.5, 0xd1a95d, 0.82);
    g.strokeCircle(0, 0, 14);
    g.lineStyle(1, config.color, 0.75);
    g.strokeCircle(0, 0, 10.5);

    // 4 compass cardinal ticks
    g.fillStyle(0xf8efd5, 0.85);
    g.fillCircle(0, -14, 1.5);
    g.fillCircle(0, 14, 1.5);
    g.fillCircle(-14, 0, 1.5);
    g.fillCircle(14, 0, 1.5);

    const diamond = scene.add
      .rectangle(0, 0, 11, 11, config.color, 0.9)
      .setRotation(Math.PI / 4)
      .setStrokeStyle(1, 0xf8efd5, 0.65);
    const glyph = scene.add
      .text(0, 0, kindGlyphs[config.kind], {
        fontFamily: "Microsoft YaHei, sans-serif",
        fontSize: "9px",
        fontStyle: "bold",
        color: "#fffcf2"
      })
      .setOrigin(0.5);

    return scene.add.container(0, 0, [g, diamond, glyph]);
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
    const isDialogueOpen = Boolean((this.scene as { activeDialogue?: unknown }).activeDialogue);
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
      alpha: focused ? 0.95 : 0.45,
      duration: gameState.settings.reduceMotion ? 0 : 160,
      ease: "Back.easeOut"
    });
    this.scene.tweens.add({
      targets: this.base,
      scale: focused ? 1.12 : 1,
      duration: gameState.settings.reduceMotion ? 0 : 150,
      ease: "Back.easeOut"
    });
  }
}
