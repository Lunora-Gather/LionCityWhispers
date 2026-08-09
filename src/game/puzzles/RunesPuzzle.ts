import Phaser from "phaser";
import puzzles from "@/data/puzzles.json";
import { addArtifact, emitGameState, gameState, isUiLocked } from "../state";
import { playMiss, playSuccess, playUiClick } from "../audio";
import { burst, drawPuzzleBackdrop, showRewardBanner } from "../visuals";
import { puzzleCopy } from "@/data/i18n";
import { bindSceneHint, pulseSceneHint } from "../hints";

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
  private done = false;

  constructor() {
    super("RunesPuzzle");
  }

  create() {
    const copy = puzzleCopy[gameState.settings.locale];
    this.selected = [];
    this.done = false;
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

    this.add.rectangle(640, 316, 520, 112, 0x050c0a, 0.32).setStrokeStyle(1, 0x1f8f82, 0.2);
    this.add.rectangle(640, 308, 468, 70, 0x0c1b18, 0.74).setStrokeStyle(1, 0xd1a95d, 0.36);
    for (let index = 0; index < 9; index += 1) {
      this.add.line(424 + index * 54, 318, 0, -36, 0, 36, 0xd1a95d, 0.16);
    }
    this.readout = this.add.text(640, 310, copy.runesEmpty, {
      fontFamily: "Microsoft YaHei, Noto Sans SC, sans-serif",
      fontSize: "30px",
      fontStyle: "700",
      color: "#d8eee8",
      shadow: { offsetX: 0, offsetY: 1, color: "#07110f", blur: 3, stroke: true, fill: true }
    }).setOrigin(0.5);
    config.order.forEach((_rune, index) => {
      const slot = this.add.rectangle(550 + index * 60, 372, 40, 10, 0x091412, 0.8).setStrokeStyle(1, 0xd1a95d, 0.36);
      this.progressSlots.push(slot);
    });
    this.refreshProgress();

    config.choices.forEach((rune, index) => {
      const x = 370 + index * 180;
      const button = this.add.container(x, 430);
      const aura = this.add.circle(0, 4, 58, 0x3de0c8, 0.06);
      const shadow = this.add.rectangle(5, 7, 104, 104, 0x020504, 0.3);
      const seal = this.add.rectangle(0, 0, 102, 102, 0x0c1b18, 0.92).setStrokeStyle(1.5, 0xd1a95d, 0.58);
      const inner = this.add.rectangle(0, 0, 82, 82, 0x1f8f82, 0.12).setStrokeStyle(1, 0x3de0c8, 0.18);
      const scratchA = this.add.line(0, 0, -34, -30, 28, -34, 0xfff4d6, 0.14);
      const scratchB = this.add.line(0, 0, -32, 34, 34, 28, 0xfff4d6, 0.1);
      const text = this.add.text(0, 0, rune, {
        fontFamily: "Microsoft YaHei, Noto Sans SC, sans-serif",
        fontSize: "34px",
        fontStyle: "700",
        color: "#fffcf2"
      }).setOrigin(0.5);
      const key = this.add.text(-42, -42, String(index + 1), {
        fontFamily: "Georgia, serif",
        fontSize: "12px",
        color: "#bda66d"
      }).setOrigin(0.5);
      button.add([aura, shadow, seal, inner, scratchA, scratchB, text, key]);
      button.setInteractive(new Phaser.Geom.Rectangle(-54, -54, 108, 108), Phaser.Geom.Rectangle.Contains);
      button.on("pointerdown", () => this.choose(rune, config, x, 430));
      button.on("pointerover", () => {
        aura.setAlpha(0.18);
        seal.setStrokeStyle(2, 0x3de0c8, 0.8);
        this.tweens.add({
          targets: button,
          scale: 1.1,
          duration: gameState.settings.reduceMotion ? 0 : 120
        });
      });
      button.on("pointerout", () => {
        aura.setAlpha(0.06);
        seal.setStrokeStyle(1.5, 0xd1a95d, 0.58);
        this.tweens.add({
          targets: button,
          scale: 1,
          duration: gameState.settings.reduceMotion ? 0 : 120
        });
      });
    });
    this.bindKeyboard(config);
    bindSceneHint(this, () => {
      const nextRune = config.order[this.selected.length] ?? config.order[0];
      const index = config.choices.indexOf(nextRune);
      if (index >= 0) {
        pulseSceneHint(this, 370 + index * 180, 430, 0xc6523d);
      }
    });

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
        const x = 370 + index * 180;
        this.choose(rune, config, x, 430);
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

  private choose(rune: string, config: RuneConfig, x?: number, y?: number) {
    if (this.done || isUiLocked()) {
      return;
    }
    playUiClick();
    if (x !== undefined && y !== undefined && !gameState.settings.reduceMotion) {
      burst(this, x, y, 0x1f8f82, 10, 3);
    }
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
    this.done = true;
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
