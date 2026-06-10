import Phaser from "phaser";
import { ArtifactId, emitGameState, gameState, isUiLocked } from "../state";
import { playMiss, playSnap, playSuccess, playUiClick } from "../audio";
import { artifactColors, burst, drawArtifactIcon } from "../visuals";
import { formatCopy, localizedArtifact, puzzleCopy } from "@/data/i18n";

type CaseSlot = {
  index: number;
  x: number;
  y: number;
};

export class MuseumScene extends Phaser.Scene {
  private slots: CaseSlot[] = [
    { index: 0, x: 334, y: 446 },
    { index: 1, x: 545, y: 446 },
    { index: 2, x: 758, y: 446 },
    { index: 3, x: 968, y: 446 }
  ];
  private status!: Phaser.GameObjects.Text;
  private visitorFeedback!: Phaser.GameObjects.Text;
  private tokens = new Map<ArtifactId, Phaser.GameObjects.Container>();
  private slotFrames = new Map<number, Phaser.GameObjects.Rectangle>();
  private selectedArtifactId?: ArtifactId;
  private completionBanner?: Phaser.GameObjects.Container;
  private keyHandler?: (event: KeyboardEvent) => void;

  constructor() {
    super("MuseumScene");
  }

  create() {
    const copy = puzzleCopy[gameState.settings.locale];
    this.tokens.clear();
    this.slotFrames.clear();
    this.selectedArtifactId = undefined;
    this.completionBanner = undefined;
    this.drawGallery(copy);
    this.drawSlots();
    this.drawInventory();
    this.createBackButton();
    this.bindKeyboard();
    this.updateStatus();
  }

  private drawGallery(copy: (typeof puzzleCopy)[keyof typeof puzzleCopy]) {
    this.add.rectangle(640, 360, 1280, 720, 0x101817);
    const bg = this.add.image(640, 360, "museum-gallery");
    const scale = Math.max(1280 / bg.width, 720 / bg.height);
    bg.setScale(scale);
    this.add.rectangle(640, 360, 1280, 720, 0x050909, 0.08);
    const lights = this.add.graphics();
    lights.fillStyle(0xfff4d6, 0.08);
    for (const slot of this.slots) {
      lights.fillTriangle(slot.x - 48, 106, slot.x + 48, 106, slot.x + 104, 508);
      lights.fillTriangle(slot.x - 48, 106, slot.x + 48, 106, slot.x - 104, 508);
    }
    lights.lineStyle(1, 0xfff4d6, 0.08);
    for (let index = 0; index < 7; index += 1) {
      lights.lineBetween(210 + index * 126, 536, 260 + index * 116, 654);
    }
    this.add.rectangle(640, 68, 1280, 136, 0x090f0f, 0.38);
    this.add.rectangle(640, 665, 1280, 110, 0x090f0f, 0.4);
    this.add.rectangle(640, 520, 980, 2, 0xfff4d6, 0.12);
    this.add.rectangle(640, 548, 980, 1, 0xd1a95d, 0.14);
    this.add.text(78, 198, copy.museumTitle, {
      fontFamily: "Microsoft YaHei, sans-serif",
      fontSize: "34px",
      color: "#fff4d6"
    });
    this.add.text(80, 282, copy.museumSubtitle, {
      fontFamily: "Microsoft YaHei, sans-serif",
      fontSize: "18px",
      color: "#d8c8a3"
    });
    this.add.rectangle(640, 516, 560, 52, 0x090f0f, 0.36).setStrokeStyle(1, 0xd1a95d, 0.18);
    this.status = this.add.text(640, 528, "", {
      fontFamily: "Microsoft YaHei, sans-serif",
      fontSize: "20px",
      color: "#fff4d6"
    }).setOrigin(0.5);
    this.visitorFeedback = this.add.text(640, 502, "", {
      fontFamily: "Microsoft YaHei, sans-serif",
      fontSize: "16px",
      color: "#d8c8a3"
    }).setOrigin(0.5);
  }

  private drawSlots() {
    for (const slot of this.slots) {
      const occupied = Object.values(gameState.museum.placements).includes(slot.index);
      this.add.rectangle(slot.x + 6, slot.y - 56, 180, 116, 0x050909, 0.28);
      this.add.rectangle(slot.x, slot.y - 64, 178, 112, 0x06100f, 0.34).setStrokeStyle(1, 0xfff4d6, 0.12);
      const glass = this.add.rectangle(slot.x, slot.y - 64, 164, 98, 0xd1a95d, occupied ? 0.08 : 0.16);
      glass.setStrokeStyle(2, occupied ? 0x1f8f82 : 0xd1a95d, occupied ? 0.34 : 0.48);
      this.add.rectangle(slot.x - 44, slot.y - 95, 52, 2, 0xfff4d6, 0.28);
      this.add.rectangle(slot.x + 44, slot.y - 35, 52, 2, 0xfff4d6, 0.16);
      this.add.rectangle(slot.x, slot.y + 2, 150, 18, 0x090f0f, 0.48).setStrokeStyle(1, 0xd1a95d, 0.18);
      this.add.rectangle(slot.x, slot.y + 18, 178, 26, 0x090f0f, 0.6).setStrokeStyle(1, 0xfff4d6, 0.12);
      this.slotFrames.set(slot.index, glass);
      glass.setInteractive();
      glass.on("pointerdown", () => this.placeSelectedArtifact(slot));
      this.add.circle(slot.x, slot.y - 64, 9, occupied ? 0x1f8f82 : 0xd1a95d, 0.9);
    }
  }

  private drawInventory() {
    if (gameState.inventory.length === 0) {
      this.add.text(640, 624, puzzleCopy[gameState.settings.locale].museumEmpty, {
        fontFamily: "Microsoft YaHei, sans-serif",
        fontSize: "20px",
        color: "#fff4d6"
      }).setOrigin(0.5);
      return;
    }

    gameState.inventory.forEach((artifact, index) => {
      const localized = localizedArtifact(artifact.id, gameState.settings.locale);
      const placedSlot = gameState.museum.placements[artifact.id];
      const startX = placedSlot === undefined ? 276 + index * 190 : this.slots[placedSlot].x;
      const startY = placedSlot === undefined ? 582 : this.slots[placedSlot].y - 64;
      this.createArtifactToken(artifact.id, localized.name, localized.detail, startX, startY);
    });
  }

  private createArtifactToken(id: ArtifactId, name: string, detail: string, x: number, y: number) {
    const token = this.add.container(x, y).setDepth(24);
    const color = artifactColors[id];
    const shadow = this.add.rectangle(6, 7, 174, 62, 0x050909, 0.28);
    const card = this.add.rectangle(0, 0, 172, 58, 0xfff4d6, 0.95).setStrokeStyle(2, 0xd1a95d, 0.45);
    const colorRail = this.add.rectangle(-78, 0, 8, 48, color, 0.78);
    const sheen = this.add.rectangle(22, -22, 110, 2, 0xffffff, 0.32);
    const icon = drawArtifactIcon(this, id, -54, 0, 42);
    const label = this.add.text(-24, -18, name, {
      fontFamily: "Microsoft YaHei, sans-serif",
      fontSize: "15px",
      color: "#161c1a",
      wordWrap: { width: 112 }
    });
    const detailLimit = gameState.settings.locale === "en" ? 42 : 18;
    const shortDetail = detail.length > detailLimit ? `${detail.slice(0, detailLimit - 3)}...` : detail;
    const detailText = this.add.text(-24, 6, shortDetail, {
      fontFamily: "Microsoft YaHei, sans-serif",
      fontSize: gameState.settings.locale === "en" ? "10px" : "11px",
      color: "#5f5749",
      wordWrap: { width: 114 }
    });
    token.add([shadow, card, colorRail, sheen, icon, label, detailText]);
    token.setData("home", { x, y });
    this.tokens.set(id, token);
    token.setInteractive(new Phaser.Geom.Rectangle(-86, -38, 172, 86), Phaser.Geom.Rectangle.Contains);
    this.input.setDraggable(token);

    token.on("pointerdown", () => {
      if (isUiLocked()) {
        return;
      }
      this.selectArtifact(id);
      playUiClick();
    });
    token.on("dragstart", () => {
      if (isUiLocked()) {
        return;
      }
      this.selectArtifact(id);
      playUiClick();
      this.tweens.add({ targets: token, scale: 1.08, duration: gameState.settings.reduceMotion ? 0 : 120 });
    });
    token.on("drag", (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      if (isUiLocked()) {
        return;
      }
      token.setPosition(dragX, dragY);
    });
    token.on("dragend", () => {
      if (isUiLocked()) {
        return;
      }
      this.tweens.add({ targets: token, scale: 1, duration: gameState.settings.reduceMotion ? 0 : 120 });
      const slot = this.nearestFreeSlot(token.x, token.y, id);
      if (slot) {
        this.placeArtifact(id, slot);
      } else {
        playMiss();
        const ownSlot = gameState.museum.placements[id];
        if (ownSlot !== undefined) {
          token.setPosition(this.slots[ownSlot].x, this.slots[ownSlot].y - 64);
        } else {
          token.setPosition(x, y);
        }
      }
    });
  }

  private selectArtifact(id: ArtifactId) {
    this.selectedArtifactId = id;
    for (const [artifactId, token] of this.tokens.entries()) {
      this.tweens.add({
        targets: token,
        scale: artifactId === id ? 1.08 : 1,
        duration: gameState.settings.reduceMotion ? 0 : 110
      });
    }
  }

  private placeSelectedArtifact(slot: CaseSlot) {
    if (isUiLocked()) {
      return;
    }
    if (!this.selectedArtifactId) {
      return;
    }
    this.placeArtifact(this.selectedArtifactId, slot);
  }

  private placeArtifact(id: ArtifactId, slot: CaseSlot) {
    if (isUiLocked()) {
      return;
    }
    const token = this.tokens.get(id);
    const occupiedByOther = Object.entries(gameState.museum.placements).some(
      ([artifactId, slotIndex]) => artifactId !== id && slotIndex === slot.index
    );
    if (!token || occupiedByOther) {
      playMiss();
      return;
    }
    token.setPosition(slot.x, slot.y - 64);
    token.setScale(1);
    gameState.museum.placements[id] = slot.index;
    this.selectedArtifactId = undefined;
    playSnap();
    burst(this, slot.x, slot.y - 64, 0xd1a95d);
    this.updateStatus();
  }

  private nearestFreeSlot(x: number, y: number, id: ArtifactId) {
    const occupied = new Set(
      Object.entries(gameState.museum.placements)
        .filter(([artifactId]) => artifactId !== id)
        .map(([, slot]) => slot)
    );
    return this.slots.find(
      (slot) =>
        !occupied.has(slot.index) &&
        Phaser.Math.Distance.Between(x, y, slot.x, slot.y - 64) < 96
    );
  }

  private updateStatus() {
    this.refreshSlotFrames();
    const placedCount = Object.keys(gameState.museum.placements).length;
    const copy = puzzleCopy[gameState.settings.locale];
    const wasComplete = gameState.museum.complete;
    const storyOrder: ArtifactId[] = ["badang-stone", "rune-plaque", "harbor-seal", "spirit-chime"];
    const orderMatches = storyOrder.filter(
      (artifactId, index) => gameState.museum.placements[artifactId] === index
    ).length;
    const layoutBonus = orderMatches * 7;
    gameState.museum.visitors = placedCount * 36 + (gameState.flags.rhythm ? 28 : 0) + layoutBonus;
    this.visitorFeedback.setText(
      placedCount === 0
        ? copy.museumNoStory
        : orderMatches >= placedCount
          ? copy.museumStoryClear
          : copy.museumStoryAdjust
    );
    if (placedCount >= 4 && gameState.inventory.length >= 4) {
      gameState.museum.complete = true;
      gameState.dialogue = copy.museumOpen;
      this.status.setText(formatCopy(copy.museumStatusOpen, { visitors: gameState.museum.visitors }));
      if (!wasComplete) {
        playSuccess();
        this.showCompletionMoment(copy, true);
      } else if (!this.completionBanner) {
        this.showCompletionMoment(copy, false);
      }
    } else {
      this.status.setText(
        formatCopy(copy.museumStatusCases, {
          placed: placedCount,
          visitors: gameState.museum.visitors
        })
      );
    }
    emitGameState("museum");
  }

  private refreshSlotFrames() {
    const occupied = new Set(Object.values(gameState.museum.placements));
    for (const [index, frame] of this.slotFrames.entries()) {
      frame.setAlpha(1);
      frame.setFillStyle(occupied.has(index) ? 0x1f8f82 : 0xd1a95d, occupied.has(index) ? 0.08 : 0.16);
      frame.setStrokeStyle(2, occupied.has(index) ? 0x1f8f82 : 0xd1a95d, occupied.has(index) ? 0.44 : 0.48);
    }
  }

  private showCompletionMoment(copy: (typeof puzzleCopy)[keyof typeof puzzleCopy], animated: boolean) {
    this.completionBanner?.destroy();
    const banner = this.add.container(640, 208).setDepth(92);
    const rayLeft = this.add.triangle(-260, 18, -46, -74, 20, -74, 96, 92, 0xfff4d6, 0.12);
    const rayRight = this.add.triangle(260, 18, -20, -74, 46, -74, -96, 92, 0xfff4d6, 0.1);
    const shadow = this.add.rectangle(8, 10, 704, 126, 0x020504, 0.32);
    const panel = this.add.rectangle(0, 0, 686, 116, 0x11392f, 0.95).setStrokeStyle(2, 0xfff4d6, 0.38);
    const topLine = this.add.rectangle(0, -46, 580, 2, 0xd1a95d, 0.72);
    const title = this.add.text(0, -16, copy.museumVictory, {
      fontFamily: "Microsoft YaHei, sans-serif",
      fontSize: "26px",
      color: "#fff4d6"
    }).setOrigin(0.5);
    const subtitle = this.add.text(0, 28, copy.museumOpen, {
      fontFamily: "Microsoft YaHei, sans-serif",
      fontSize: "15px",
      color: "#d8c8a3",
      align: "center",
      wordWrap: { width: 590 }
    }).setOrigin(0.5);
    banner.add([rayLeft, rayRight, shadow, panel, topLine, title, subtitle]);
    for (let index = 0; index < 6; index += 1) {
      const visitor = this.add.container(-230 + index * 92, 74);
      visitor.add([
        this.add.circle(0, -12, 7, 0x050909, 0.42),
        this.add.rectangle(0, 6, 14, 26, 0x050909, 0.36)
      ]);
      banner.add(visitor);
    }
    this.completionBanner = banner;
    if (animated && !gameState.settings.reduceMotion) {
      banner.setAlpha(0).setScale(0.96);
      this.tweens.add({
        targets: banner,
        alpha: 1,
        scale: 1,
        duration: 260,
        ease: "Sine.easeOut"
      });
    }
  }

  private createBackButton() {
    const back = this.add.text(1080, 188, puzzleCopy[gameState.settings.locale].backRiver, {
      fontFamily: "Microsoft YaHei, sans-serif",
      fontSize: "17px",
      color: "#fff4d6",
      backgroundColor: "rgba(10,17,17,0.62)",
      padding: { x: 14, y: 8 }
    }).setOrigin(0.5);
    back.setInteractive();
    back.on("pointerdown", () => {
      playUiClick();
      this.scene.start("WorldScene");
    });
  }

  private bindKeyboard() {
    if (!this.input.keyboard) {
      return;
    }
    if (this.keyHandler) {
      this.input.keyboard.off("keydown", this.keyHandler);
    }
    this.keyHandler = (event: KeyboardEvent) => {
      if (isUiLocked()) {
        return;
      }
      const index = Number(event.key) - 1;
      const artifact = gameState.inventory[index];
      const slot = this.slots[index];
      if (!artifact || !slot) {
        return;
      }
      this.placeArtifact(artifact.id, slot);
    };
    this.input.keyboard.on("keydown", this.keyHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.keyHandler) {
        this.input.keyboard?.off("keydown", this.keyHandler);
        this.keyHandler = undefined;
      }
    });
  }
}
