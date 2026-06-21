import Phaser from "phaser";
import puzzles from "@/data/puzzles.json";
import { addArtifact, emitGameState, gameState, isUiLocked } from "../state";
import { playMiss, playSuccess, playUiClick } from "../audio";
import { burst, drawPuzzleBackdrop, showRewardBanner } from "../visuals";
import { puzzleCopy } from "@/data/i18n";

type RuneConfig = {
  order: string[];
  choices: string[];
};

export class RunesPuzzle extends Phaser.Scene {
  private selected: string[] = [];
  private readout!: Phaser.GameObjects.Text;
  private progressSlots: Phaser.GameObjects.Rectangle[] = [];
  private timers: Phaser.Time.TimerEvent[] = [];
  private keyHandler?: (event: KeyboardEvent) => void;

  constructor() {
    super("RunesPuzzle");
  }

  create() {
    const copy = puzzleCopy[gameState.settings.locale];
    this.selected = [];
    this.timers.forEach((timer) => timer.remove(false));
    this.timers = [];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.timers.forEach((timer) => timer.remove(false));
      this.timers = [];
    });
    const config = puzzles.runes as RuneConfig;
    this.progressSlots = [];
    drawPuzzleBackdrop(this, {
      title: copy.runesTitle,
      subtitle: copy.runesSubtitle,
      clue: copy.runesHint,
      accent: 0xc6523d,
      backgroundAlpha: 0.3,
      overlayAlpha: 0.5
    });

    this.add.rectangle(640, 318, 560, 128, 0x050c0a, 0.4).setStrokeStyle(2, 0x1f8f82, 0.28);
    this.add.rectangle(640, 310, 488, 78, 0x0c1b18, 0.82).setStrokeStyle(1.5, 0xd1a95d, 0.44);
    for (let index = 0; index < 9; index += 1) {
      this.add.line(424 + index * 54, 318, 0, -36, 0, 36, 0xd1a95d, 0.16);
    }
    this.readout = this.add.text(640, 310, copy.runesEmpty, {
      fontFamily: "Microsoft YaHei, Noto Sans SC, sans-serif",
      fontSize: "34px",
      fontStyle: "700",
      color: "#3de0c8",
      shadow: { offsetX: 0, offsetY: 0, color: "#3de0c8", blur: 8, stroke: true, fill: true }
    }).setOrigin(0.5);
    config.order.forEach((_rune, index) => {
      const slot = this.add.rectangle(550 + index * 60, 372, 40, 10, 0x091412, 0.8).setStrokeStyle(1, 0xd1a95d, 0.36);
      this.progressSlots.push(slot);
    });
    this.refreshProgress();

    config.choices.forEach((rune, index) => {
      const x = 370 + index * 180;
      const button = this.add.container(x, 430);
      const aura = this.add.circle(0, 0, 70, 0x3de0c8, 0.14);
      const seal = this.add.circle(0, 0, 58, 0x0c1b18, 0.9).setStrokeStyle(2.5, 0xd1a95d, 0.76);
      const inner = this.add.circle(0, 0, 42, 0x1f8f82, 0.22).setStrokeStyle(1, 0x3de0c8, 0.24);
      const scratchA = this.add.line(0, 0, -34, -22, 28, -32, 0xfff4d6, 0.18);
      const scratchB = this.add.line(0, 0, -28, 32, 32, 22, 0xfff4d6, 0.12);
      const text = this.add.text(0, 0, rune, {
        fontFamily: "Microsoft YaHei, Noto Sans SC, sans-serif",
        fontSize: "38px",
        fontStyle: "700",
        color: "#fffcf2"
      }).setOrigin(0.5);
      button.add([aura, seal, inner, scratchA, scratchB, text]);
      button.setInteractive(new Phaser.Geom.Circle(0, 0, 62), Phaser.Geom.Circle.Contains);
      button.on("pointerdown", () => this.choose(rune, config));
      button.on("pointerover", () => {
        aura.setAlpha(0.38);
        seal.setStrokeStyle(3, 0x3de0c8, 0.95);
        this.tweens.add({
          targets: button,
          scale: 1.1,
          duration: gameState.settings.reduceMotion ? 0 : 120
        });
      });
      button.on("pointerout", () => {
        aura.setAlpha(0.14);
        seal.setStrokeStyle(2.5, 0xd1a95d, 0.76);
        this.tweens.add({
          targets: button,
          scale: 1,
          duration: gameState.settings.reduceMotion ? 0 : 120
        });
      });
    });
    this.bindKeyboard(config);

    this.createFooter();
    emitGameState("runes");
  }

  private bindKeyboard(config: RuneConfig) {
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
      const rune = config.choices[index];
      if (rune) {
        this.choose(rune, config);
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

  private choose(rune: string, config: RuneConfig) {
    if (isUiLocked()) {
      return;
    }
    playUiClick();
    if (this.selected.length >= config.order.length) {
      this.selected = [];
    }
    this.selected.push(rune);
    this.readout.setText(this.selected.join("  "));
    this.refreshProgress();

    const expected = config.order.slice(0, this.selected.length).join("");
    if (this.selected.join("") !== expected) {
      const copy = puzzleCopy[gameState.settings.locale];
      gameState.dialogue = copy.runesWrong;
      playMiss();
      emitGameState("runes");
      this.selected = [];
      this.refreshProgress();
      this.tweens.add({
        targets: this.readout,
        scale: 1.08,
        duration: gameState.settings.reduceMotion ? 0 : 90,
        yoyo: !gameState.settings.reduceMotion
      });
      this.timers.push(this.time.delayedCall(260, () => this.readout.setText(copy.runesEmpty)));
      return;
    }

    if (this.selected.length === config.order.length) {
      burst(this, 640, 310, 0xc6523d);
      this.complete();
    }
  }

  private createFooter() {
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

  private refreshProgress() {
    this.progressSlots.forEach((slot, index) => {
      const filled = index < this.selected.length;
      slot.setFillStyle(filled ? 0xc6523d : 0x111817, filled ? 0.72 : 0.08);
      slot.setStrokeStyle(1, filled ? 0xfff4d6 : 0xb88735, filled ? 0.42 : 0.18);
    });
  }

  private complete() {
    gameState.flags.runes = true;
    addArtifact("rune-plaque");
    const copy = puzzleCopy[gameState.settings.locale];
    gameState.dialogue = copy.runesComplete;
    emitGameState("runes");
    playSuccess();
    showRewardBanner(this, copy.runesReward, 0xb9402f);
    this.timers.push(this.time.delayedCall(1100, () => this.scene.start("WorldScene")));
  }
}
