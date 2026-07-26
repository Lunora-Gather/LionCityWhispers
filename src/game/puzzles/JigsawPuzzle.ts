import Phaser from "phaser";
import puzzles from "@/data/puzzles.json";
import { addArtifact, emitGameState, gameState, isUiLocked } from "../state";
import { playMiss, playSnap, playSuccess, playUiClick } from "../audio";
import { burst, drawPuzzleBackdrop, showRewardBanner } from "../visuals";
import { puzzleCopy } from "@/data/i18n";
import { bindSceneHint, pulseSceneHint } from "../hints";

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
    bindSceneHint(this, () => {
      const hinted =
        config.find((piece) => piece.id === this.selectedPieceId && !this.locked.has(piece.id)) ??
        config.find((piece) => !this.locked.has(piece.id));
      if (!hinted) {
        return;
      }
      this.selectPiece(hinted.id);
      const [targetX, targetY] = hinted.target;
      const [pieceX, pieceY] = [this.pieces.get(hinted.id)?.x, this.pieces.get(hinted.id)?.y];
      pulseSceneHint(this, targetX, targetY);
      if (pieceX !== undefined && pieceY !== undefined) {
        pulseSceneHint(this, pieceX, pieceY, 0xd1a95d);
      }
    });
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
    this.add.ellipse(640, 392, 560, 226, 0x06100f, 0.42)
      .setStrokeStyle(1, 0xd1a95d, 0.18);
    this.add.ellipse(640, 411, 510, 164, 0xd1a95d, 0.025);
    this.add.line(640, 426, -230, 0, 230, 0, 0xd1a95d, 0.15);
    this.createBackButton();
  }

  private drawTarget(piece: PieceConfig) {
    const [x, y] = piece.target;
    this.add.rectangle(x + 3, y + 6, 108, 82, 0x020504, 0.42);
    const target = this.add.rectangle(x, y, 102, 76, 0x07110f, 0.72)
      .setStrokeStyle(1.5, 0xd1a95d, 0.42);
    this.targetFrames.set(piece.id, target);
    this.add.text(x, y, piece.label, {
      fontFamily: "Microsoft YaHei, Noto Sans SC, sans-serif",
      fontSize: "34px",
      color: "#ffd685"
    }).setOrigin(0.5).setAlpha(0.28);
    this.add.rectangle(x, y - 45, 76, 1, 0xd1a95d, 0.24);
    this.add.rectangle(x, y + 45, 76, 1, 0xd1a95d, 0.14);
    this.add.circle(x - 44, y - 31, 2.5, 0xd1a95d, 0.28);
    this.add.circle(x + 44, y + 31, 2.5, 0xd1a95d, 0.2);
    target.setInteractive();
    target.on("pointerdown", () => {
      if (isUiLocked() || !this.selectedPieceId) {
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
        if (!gameState.settings.reduceMotion) {
          this.cameras.main.shake(80, 0.002);
        }
        return;
      }
      this.placePiece(selected, container);
    });
  }

  private createPiece(piece: PieceConfig) {
    const [x, y] = piece.start;
    const container = this.add.container(x, y).setDepth(12);
    const points = [-62, -38, 44, -42, 64, 23, -42, 40];
    const color = Phaser.Display.Color.HexStringToColor(piece.color).color;
    const glow = this.add.polygon(0, 3, points, color, 0.14).setScale(1.08);
    const shadow = this.add.polygon(5, 7, points, 0x020504, 0.48);
    const body = this.add.polygon(0, 0, points, color, 0.7);
    body.setStrokeStyle(1.5, 0xffe8b5, 0.52);
    const wash = this.add.polygon(0, -2, points, 0xf8edd2, 0.045).setScale(0.94);
    const topBevel = this.add.line(0, 0, -48, -24, 30, -29, 0xfff4d6, 0.24);
    const bottomBevel = this.add.line(0, 0, -38, 28, 42, 13, 0x111817, 0.28);
    const text = this.add.text(0, 0, piece.label, {
      fontFamily: "Microsoft YaHei, sans-serif",
      fontSize: "25px",
      fontStyle: "bold",
      color: "#fff2cf"
    }).setOrigin(0.5);
    const grain = this.add.line(0, 0, -43, 19, 39, -17, 0xfffcf2, 0.24);
    const crackA = this.add.line(0, 0, -15, -29, -6, -9, 0x06100f, 0.32);
    const crackB = this.add.line(0, 0, 28, 8, 45, 21, 0x06100f, 0.28);
    const chipA = this.add.circle(-38, -18, 2.5, 0xfffcf2, 0.22);
    const chipB = this.add.circle(43, 18, 2, 0x111817, 0.24);
    container.add([glow, shadow, body, wash, topBevel, bottomBevel, grain, crackA, crackB, chipA, chipB, text]);
    container.setData("piece", piece);
    this.pieces.set(piece.id, container);
    container.setInteractive(
      new Phaser.Geom.Rectangle(-68, -46, 136, 92),
      Phaser.Geom.Rectangle.Contains
    );
    this.input.setDraggable(container);

    container.on("pointerdown", () => {
      if (isUiLocked() || this.locked.has(piece.id)) {
        return;
      }
      this.selectPiece(piece.id);
      playUiClick();
    });

    container.on("drag", (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      if (isUiLocked() || this.locked.has(piece.id)) {
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
      if (!isUiLocked() && Phaser.Math.Distance.Between(container.x, container.y, targetX, targetY) < 62) {
        this.placePiece(piece, container);
      } else {
        if (!isUiLocked()) {
          playMiss();
        }
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
