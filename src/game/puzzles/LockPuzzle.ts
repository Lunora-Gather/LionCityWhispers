import Phaser from "phaser";
import puzzles from "@/data/puzzles.json";
import { addArtifact, emitGameState, gameState, isUiLocked } from "../state";
import { playMiss, playSuccess, playUiClick } from "../audio";
import { burst, drawPuzzleBackdrop, showRewardBanner } from "../visuals";
import { puzzleCopy } from "@/data/i18n";

type LockConfig = {
  order: string[];
  seals: Array<{ label: string; color: string }>;
  seconds: number;
};

export class LockPuzzle extends Phaser.Scene {
  private selected: string[] = [];
  private timerText!: Phaser.GameObjects.Text;
  private sequenceSlots: Phaser.GameObjects.Rectangle[] = [];
  private secondsLeft = 0;
  private timer?: Phaser.Time.TimerEvent;
  private returnTimer?: Phaser.Time.TimerEvent;
  private keyHandler?: (event: KeyboardEvent) => void;

  constructor() {
    super("LockPuzzle");
  }

  create() {
    const copy = puzzleCopy[gameState.settings.locale];
    const config = puzzles.lock as LockConfig;
    this.selected = [];
    this.sequenceSlots = [];
    this.returnTimer?.remove(false);
    this.returnTimer = undefined;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.timer?.remove(false);
      this.returnTimer?.remove(false);
      this.returnTimer = undefined;
    });
    this.secondsLeft = config.seconds;
    drawPuzzleBackdrop(this, {
      title: copy.lockTitle,
      subtitle: copy.lockSubtitle,
      clue: copy.lockHint,
      accent: 0x8b6f37,
      backgroundAlpha: 0.3,
      overlayAlpha: 0.5
    });
    this.createBackButton();

    this.add.rectangle(640, 356, 340, 230, 0x111817, 0.08).setStrokeStyle(2, 0x8b6f37, 0.22);
    this.add.circle(640, 346, 132, 0x111817, 0.08).setStrokeStyle(3, 0x8b6f37, 0.38);
    this.add.circle(640, 346, 96, 0xd1a95d, 0.08).setStrokeStyle(2, 0xd1a95d, 0.28);
    this.add.circle(640, 346, 58, 0x111817, 0.08).setStrokeStyle(1, 0xfff4d6, 0.2);
    this.add.circle(640, 332, 20, 0x1c211f, 0.14).setStrokeStyle(1, 0x8b6f37, 0.28);
    this.add.rectangle(640, 370, 30, 70, 0x1c211f, 0.12).setStrokeStyle(1, 0x8b6f37, 0.24);
    this.add.rectangle(640, 346, 244, 2, 0x8b6f37, 0.2);
    this.add.rectangle(640, 346, 2, 196, 0x8b6f37, 0.16);
    config.order.forEach((_seal, index) => {
      const slot = this.add.rectangle(547 + index * 62, 392, 42, 10, 0x111817, 0.08).setStrokeStyle(1, 0x8b6f37, 0.18);
      this.sequenceSlots.push(slot);
    });
    this.refreshSequenceSlots();
    this.add.rectangle(1015, 228, 92, 46, 0xfffcf2, 0.28).setStrokeStyle(1, 0xb9402f, 0.24);
    this.timerText = this.add.text(1015, 228, `${this.secondsLeft}s`, {
      fontFamily: "Georgia, serif",
      fontSize: "28px",
      color: "#b9402f"
    }).setOrigin(0.5);

    config.seals.forEach((seal, index) => {
      const x = 355 + index * 190;
      const node = this.add.container(x, 472);
      const color = Phaser.Display.Color.HexStringToColor(seal.color).color;
      const shadow = this.add.circle(6, 9, 64, 0x111817, 0.2);
      const aura = this.add.circle(0, 0, 72, color, 0.12);
      const disc = this.add.circle(0, 0, 64, color, 0.92).setStrokeStyle(3, 0xfff4d6, 0.35);
      const ring = this.add.circle(0, 0, 43, 0x111817, 0.08).setStrokeStyle(1, 0xfff4d6, 0.22);
      const shine = this.add.line(0, 0, -28, -32, 24, -38, 0xfff4d6, 0.26);
      const label = this.add.text(0, 0, seal.label, {
        fontFamily: "Microsoft YaHei, sans-serif",
        fontSize: "34px",
        color: "#fffcf2"
      }).setOrigin(0.5);
      node.add([shadow, aura, disc, ring, shine, label]);
      node.setInteractive(new Phaser.Geom.Circle(0, 0, 66), Phaser.Geom.Circle.Contains);
      node.on("pointerdown", () => this.choose(seal.label, config));
      node.on("pointerover", () =>
        this.tweens.add({
          targets: node,
          scale: 1.07,
          duration: gameState.settings.reduceMotion ? 0 : 110
        })
      );
      node.on("pointerout", () =>
        this.tweens.add({
          targets: node,
          scale: 1,
          duration: gameState.settings.reduceMotion ? 0 : 110
        })
      );
    });
    this.bindKeyboard(config);

    this.timer = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (isUiLocked()) {
          return;
        }
        this.secondsLeft -= 1;
        this.timerText.setText(`${this.secondsLeft}s`);
        if (this.secondsLeft <= 0) {
          this.resetAttempt(puzzleCopy[gameState.settings.locale].lockTimeout);
        }
      }
    });
    emitGameState("lock");
  }

  private bindKeyboard(config: LockConfig) {
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
      const seal = config.seals[index];
      if (seal) {
        this.choose(seal.label, config);
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

  private choose(label: string, config: LockConfig) {
    if (isUiLocked()) {
      return;
    }
    playUiClick();
    this.selected.push(label);
    this.refreshSequenceSlots();
    const expected = config.order.slice(0, this.selected.length).join("");
    if (this.selected.join("") !== expected) {
      playMiss();
      this.resetAttempt(puzzleCopy[gameState.settings.locale].lockWrong);
      return;
    }

    if (this.selected.length === config.order.length) {
      burst(this, 640, 346, 0xd1a95d);
      this.complete();
    }
  }

  private resetAttempt(message: string) {
    const config = puzzles.lock as LockConfig;
    this.selected = [];
    this.refreshSequenceSlots();
    this.secondsLeft = config.seconds;
    this.timerText.setText(`${this.secondsLeft}s`);
    gameState.dialogue = message;
    emitGameState("lock");
    this.cameras.main.shake(120, 0.003);
  }

  private complete() {
    this.timer?.remove();
    gameState.flags.lock = true;
    addArtifact("harbor-seal");
    const copy = puzzleCopy[gameState.settings.locale];
    gameState.dialogue = copy.lockComplete;
    emitGameState("lock");
    playSuccess();
    showRewardBanner(this, copy.lockReward, 0x1c211f);
    this.returnTimer = this.time.delayedCall(1100, () => this.scene.start("WorldScene"));
  }

  private refreshSequenceSlots() {
    this.sequenceSlots.forEach((slot, index) => {
      const filled = index < this.selected.length;
      slot.setFillStyle(filled ? 0xd1a95d : 0x111817, filled ? 0.76 : 0.08);
      slot.setStrokeStyle(1, filled ? 0xfff4d6 : 0x8b6f37, filled ? 0.42 : 0.18);
    });
  }

  private createBackButton() {
    const back = this.add.text(1080, 188, puzzleCopy[gameState.settings.locale].backRiver, {
      fontFamily: "Microsoft YaHei, sans-serif",
      fontSize: "17px",
      color: "#1d7f73",
      backgroundColor: "rgba(255,252,242,0.8)",
      padding: { x: 12, y: 7 }
    }).setOrigin(0.5);
    back.setInteractive();
    back.on("pointerdown", () => {
      playUiClick();
      this.timer?.remove();
      this.scene.start("WorldScene");
    });
  }
}
