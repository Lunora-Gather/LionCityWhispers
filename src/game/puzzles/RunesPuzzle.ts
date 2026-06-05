import Phaser from "phaser";
import puzzles from "@/data/puzzles.json";
import { addArtifact, emitGameState, gameState, isUiLocked } from "../state";
import { playMiss, playSuccess, playUiClick } from "../audio";
import { burst, showRewardBanner } from "../visuals";
import { puzzleCopy } from "@/data/i18n";

type RuneConfig = {
  order: string[];
  choices: string[];
};

export class RunesPuzzle extends Phaser.Scene {
  private selected: string[] = [];
  private readout!: Phaser.GameObjects.Text;
  private timers: Phaser.Time.TimerEvent[] = [];
  private keyHandler?: (event: KeyboardEvent) => void;

  constructor() {
    super("RunesPuzzle");
  }

  create() {
    const copy = puzzleCopy[gameState.settings.locale];
    this.timers.forEach((timer) => timer.remove(false));
    this.timers = [];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.timers.forEach((timer) => timer.remove(false));
      this.timers = [];
    });
    const config = puzzles.runes as RuneConfig;
    this.add.rectangle(640, 360, 1280, 720, 0x111817);
    const bg = this.add.image(640, 360, "world-cinematic");
    const scale = Math.max(1280 / bg.width, 720 / bg.height);
    bg.setScale(scale).setAlpha(0.28);
    this.add.rectangle(640, 360, 1280, 720, 0x07100f, 0.52);
    this.add.rectangle(640, 360, 960, 540, 0xf8edd2, 0.91).setStrokeStyle(2, 0xd1a95d, 0.32);
    this.add.text(170, 188, copy.runesTitle, {
      fontFamily: "Microsoft YaHei, sans-serif",
      fontSize: "34px",
      color: "#121817"
    });
    this.add.text(170, 232, copy.runesSubtitle, {
      fontFamily: "Microsoft YaHei, sans-serif",
      fontSize: "18px",
      color: "#394440"
    });
    this.add.text(170, 266, copy.runesHint, {
      fontFamily: "Microsoft YaHei, sans-serif",
      fontSize: "15px",
      color: "#6b5a3d"
    });

    this.readout = this.add.text(640, 310, copy.runesEmpty, {
      fontFamily: "Microsoft YaHei, sans-serif",
      fontSize: "34px",
      color: "#b9402f"
    }).setOrigin(0.5);
    this.add.rectangle(640, 310, 460, 72, 0x111817, 0.07).setStrokeStyle(1, 0xb88735, 0.22).setDepth(-1);

    config.choices.forEach((rune, index) => {
      const x = 370 + index * 180;
      const button = this.add.container(x, 430);
      const seal = this.add.circle(0, 0, 58, 0x1c211f, 0.88).setStrokeStyle(3, 0xb88735, 0.78);
      const text = this.add.text(0, 0, rune, {
        fontFamily: "Microsoft YaHei, sans-serif",
        fontSize: "38px",
        color: "#fffcf2"
      }).setOrigin(0.5);
      button.add([seal, text]);
      button.setInteractive(new Phaser.Geom.Circle(0, 0, 62), Phaser.Geom.Circle.Contains);
      button.on("pointerdown", () => this.choose(rune, config));
      button.on("pointerover", () =>
        this.tweens.add({
          targets: button,
          scale: 1.08,
          duration: gameState.settings.reduceMotion ? 0 : 120
        })
      );
      button.on("pointerout", () =>
        this.tweens.add({
          targets: button,
          scale: 1,
          duration: gameState.settings.reduceMotion ? 0 : 120
        })
      );
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

    const expected = config.order.slice(0, this.selected.length).join("");
    if (this.selected.join("") !== expected) {
      const copy = puzzleCopy[gameState.settings.locale];
      gameState.dialogue = copy.runesWrong;
      playMiss();
      emitGameState("runes");
      this.selected = [];
      this.timers.push(this.time.delayedCall(260, () => this.readout.setText(copy.runesEmpty)));
      return;
    }

    if (this.selected.length === config.order.length) {
      burst(this, 640, 310, 0xc6523d);
      this.complete();
    }
  }

  private createFooter() {
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
      this.scene.start("WorldScene");
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
