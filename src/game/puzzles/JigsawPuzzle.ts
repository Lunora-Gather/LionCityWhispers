import Phaser from "phaser";
import puzzles from "@/data/puzzles.json";
import { addArtifact, emitGameState, gameState, isUiLocked } from "../state";
import { playMiss, playSnap, playSuccess, playUiClick } from "../audio";
import { burst, drawPuzzleBackdrop, showRewardBanner } from "../visuals";
import { puzzleCopy } from "@/data/i18n";

type PieceConfig = {
  id: string;
  label: string;
  start: [number, number];
  target: [number, number];
  color: string;
};

export class JigsawPuzzle extends Phaser.Scene {
  private locked = new Set<string>();
  private pieces = new Map<string, Phaser.GameObjects.Container>();
  private targetFrames = new Map<string, Phaser.GameObjects.Rectangle>();
  private selectedPieceId = "";
  private returnTimer?: Phaser.Time.TimerEvent;
  private keyHandler?: (event: KeyboardEvent) => void;

  constructor() {
    super("JigsawPuzzle");
  }

  create() {
    const copy = puzzleCopy[gameState.settings.locale];
    this.locked.clear();
    this.pieces.clear();
    this.targetFrames.clear();
    this.selectedPieceId = "";
    this.returnTimer?.remove(false);
    this.returnTimer = undefined;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.returnTimer?.remove(false);
      this.returnTimer = undefined;
    });
    this.drawShell(copy.jigsawTitle, copy.jigsawSubtitle, copy.jigsawClue);

    const config = puzzles.jigsaw.pieces as PieceConfig[];
    for (const piece of config) {
      this.drawTarget(piece);
      this.createPiece(piece);
    }
    this.bindKeyboard(config);
    emitGameState("jigsaw");
  }

  private drawShell(title: string, subtitle: string, clue: string) {
    drawPuzzleBackdrop(this, {
      title,
      subtitle,
      clue,
      backgroundAlpha: 0.36,
      overlayAlpha: 0.42
    });
    this.add.rectangle(640, 364, 506, 228, 0x050c0a, 0.36).setStrokeStyle(2, 0x1f8f82, 0.28);
    this.add.rectangle(640, 352, 448, 186, 0x091412, 0.78).setStrokeStyle(2, 0xd1a95d, 0.38);
    this.add.line(640, 430, -206, 0, 206, 0, 0xd1a95d, 0.22);
    this.add.circle(436, 264, 5, 0xd1a95d, 0.32);
    this.add.circle(844, 438, 5, 0xd1a95d, 0.32);
    this.createBackButton();
  }

  private drawTarget(piece: PieceConfig) {
    const [x, y] = piece.target;
    this.add.rectangle(x + 4, y + 8, 158, 104, 0x030605, 0.4);
    const target = this.add.rectangle(x, y, 150, 98, 0x07110f, 0.88).setStrokeStyle(2, 0xd1a95d, 0.46);
    this.targetFrames.set(piece.id, target);
    this.add.text(x, y, piece.label, {
      fontFamily: "Microsoft YaHei, Noto Sans SC, sans-serif",
      fontSize: "44px",
      color: "#ffd685"
    }).setOrigin(0.5).setAlpha(0.28);
    this.add.rectangle(x, y - 56, 110, 3, 0xd1a95d, 0.22);
    this.add.rectangle(x, y + 56, 110, 3, 0xd1a95d, 0.16);
    this.add.circle(x - 64, y - 40, 4, 0xd1a95d, 0.32);
    this.add.circle(x + 64, y + 40, 4, 0xd1a95d, 0.24);
    target.setInteractive();
    target.on("pointerdown", () => {
      if (!this.selectedPieceId) {
        return;
      }
      const selected = (puzzles.jigsaw.pieces as PieceConfig[]).find(
        (item) => item.id === this.selectedPieceId
      );
      const container = this.pieces.get(this.selectedPieceId);
      if (!selected || !container) {
        return;
      }
      if (selected.id !== piece.id) {
        playMiss();
        this.cameras.main.shake(80, 0.002);
        return;
      }
      this.placePiece(selected, container);
    });
  }

  private createPiece(piece: PieceConfig) {
    const [x, y] = piece.start;
    const container = this.add.container(x, y).setDepth(12);
    const points = [-72, -42, 50, -48, 76, 26, -48, 46];
    const shadow = this.add.polygon(6, 8, points, 0x111817, 0.2);
    const body = this.add.polygon(0, 0, points, Phaser.Display.Color.HexStringToColor(piece.color).color, 0.95);
    body.setStrokeStyle(2, 0xfff4d6, 0.38);
    const topBevel = this.add.line(0, 0, -52, -24, 34, -30, 0xfff4d6, 0.3);
    const bottomBevel = this.add.line(0, 0, -42, 30, 46, 14, 0x111817, 0.16);
    const text = this.add.text(0, 0, piece.label, {
      fontFamily: "Microsoft YaHei, sans-serif",
      fontSize: "28px",
      color: "#fffcf2"
    }).setOrigin(0.5);
    const grain = this.add.line(0, 0, -46, 22, 42, -18, 0xfffcf2, 0.42);
    const chipA = this.add.circle(-42, -20, 3, 0xfffcf2, 0.32);
    const chipB = this.add.circle(48, 20, 2, 0x111817, 0.18);
    container.add([shadow, body, topBevel, bottomBevel, grain, chipA, chipB, text]);
    container.setData("piece", piece);
    this.pieces.set(piece.id, container);
    container.setInteractive(
      new Phaser.Geom.Rectangle(-78, -50, 156, 100),
      Phaser.Geom.Rectangle.Contains
    );
    this.input.setDraggable(container);

    container.on("pointerdown", () => {
      if (this.locked.has(piece.id)) {
        return;
      }
      this.selectPiece(piece.id);
      playUiClick();
    });

    container.on("drag", (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      if (this.locked.has(piece.id)) {
        return;
      }
      container.setPosition(dragX, dragY);
      
      const [targetX, targetY] = piece.target;
      const targetFrame = this.targetFrames.get(piece.id);
      if (targetFrame) {
        const isNear = Phaser.Math.Distance.Between(dragX, dragY, targetX, targetY) < 62;
        if (isNear) {
          targetFrame.setStrokeStyle(3.5, 0x3de0c8, 0.95);
        } else {
          targetFrame.setStrokeStyle(2, 0xd1a95d, 0.46);
        }
      }
    });

    container.on("dragend", () => {
      const [targetX, targetY] = piece.target;
      const targetFrame = this.targetFrames.get(piece.id);
      if (targetFrame) {
        targetFrame.setStrokeStyle(2, 0xd1a95d, 0.46);
      }
      if (Phaser.Math.Distance.Between(container.x, container.y, targetX, targetY) < 62) {
        this.placePiece(piece, container);
      } else {
        playMiss();
        this.tweens.add({
          targets: container,
          x: x,
          y: y,
          duration: 260,
          ease: "Sine.easeOut"
        });
      }
    });
  }

  private selectPiece(pieceId: string) {
    this.selectedPieceId = pieceId;
    for (const [id, container] of this.pieces.entries()) {
      if (this.locked.has(id)) {
        continue;
      }
      this.tweens.add({
        targets: container,
        scale: id === pieceId ? 1.08 : 1,
        duration: gameState.settings.reduceMotion ? 0 : 120
      });
    }
  }

  private placePiece(piece: PieceConfig, container: Phaser.GameObjects.Container) {
    if (this.locked.has(piece.id)) {
      return;
    }
    const [targetX, targetY] = piece.target;
    container.setPosition(targetX, targetY);
    this.targetFrames.get(piece.id)?.setFillStyle(0x1f8f82, 0.12).setStrokeStyle(2, 0x1f8f82, 0.44);
    this.tweens.add({
      targets: container,
      scale: 1.04,
      duration: gameState.settings.reduceMotion ? 0 : 90,
      yoyo: !gameState.settings.reduceMotion
    });
    playSnap();
    burst(this, targetX, targetY, 0xd1a95d);
    container.disableInteractive();
    this.locked.add(piece.id);
    this.selectedPieceId = "";
    if (this.locked.size === (puzzles.jigsaw.pieces as PieceConfig[]).length) {
      this.complete();
    }
  }

  private bindKeyboard(config: PieceConfig[]) {
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
      const piece = config[index];
      if (!piece || this.locked.has(piece.id)) {
        return;
      }
      const container = this.pieces.get(piece.id);
      if (container) {
        this.placePiece(piece, container);
      }
    };
    this.input.keyboard.on("keydown", this.keyHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.keyHandler) {
        this.input.keyboard?.off("keydown", this.keyHandler);
        this.keyHandler = undefined;
      }
    });
  }

  private complete() {
    gameState.flags.jigsaw = true;
    addArtifact("badang-stone");
    const copy = puzzleCopy[gameState.settings.locale];
    gameState.dialogue = copy.jigsawComplete;
    emitGameState("jigsaw");
    playSuccess();
    showRewardBanner(this, copy.jigsawReward, 0x1f8f82);
    this.returnTimer = this.time.delayedCall(1200, () => this.scene.start("WorldScene"));
  }

  private createBackButton() {
    const copy = puzzleCopy[gameState.settings.locale];
    const container = this.add.container(1080, 188).setSize(140, 42);

    const bg = this.add.rectangle(0, 0, 140, 42, 0x091412, 0.88).setStrokeStyle(1.5, 0xd1a95d, 0.6);
    const label = this.add.text(0, 0, copy.backRiver, {
      fontFamily: "Microsoft YaHei, Noto Sans SC, sans-serif",
      fontSize: "15px",
      fontStyle: "600",
      color: "#fff4d6"
    }).setOrigin(0.5);

    container.add([bg, label]);
    container.setInteractive(new Phaser.Geom.Rectangle(-70, -21, 140, 42), Phaser.Geom.Rectangle.Contains);

    container.on("pointerdown", () => {
      playUiClick();
      this.scene.start("WorldScene");
    });

    container.on("pointerover", () => {
      bg.setStrokeStyle(2, 0x3de0c8, 0.9);
      label.setColor("#3de0c8");
      this.tweens.add({
        targets: container,
        scale: 1.05,
        duration: gameState.settings.reduceMotion ? 0 : 100
      });
    });

    container.on("pointerout", () => {
      bg.setStrokeStyle(1.5, 0xd1a95d, 0.6);
      label.setColor("#fff4d6");
      this.tweens.add({
        targets: container,
        scale: 1,
        duration: gameState.settings.reduceMotion ? 0 : 100
      });
    });
  }
}
