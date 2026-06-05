import Phaser from "phaser";
import puzzles from "@/data/puzzles.json";
import { addArtifact, emitGameState, gameState, isUiLocked } from "../state";
import { playMiss, playSuccess, playUiClick } from "../audio";
import { burst, showRewardBanner } from "../visuals";
import { puzzleCopy } from "@/data/i18n";

type LockConfig = {
  order: string[];
  seals: Array<{ label: string; color: string }>;
  seconds: number;
};

export class LockPuzzle extends Phaser.Scene {
  private selected: string[] = [];
  private timerText!: Phaser.GameObjects.Text;
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
    this.returnTimer?.remove(false);
    this.returnTimer = undefined;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.timer?.remove(false);
      this.returnTimer?.remove(false);
      this.returnTimer = undefined;
    });
    this.secondsLeft = config.seconds;
    this.add.rectangle(640, 360, 1280, 720, 0x111817);
    const bg = this.add.image(640, 360, "world-cinematic");
    const scale = Math.max(1280 / bg.width, 720 / bg.height);
    bg.setScale(scale).setAlpha(0.28);
    this.add.rectangle(640, 360, 1280, 720, 0x07100f, 0.52);
    this.add.rectangle(640, 360, 960, 540, 0xf8edd2, 0.91).setStrokeStyle(2, 0xd1a95d, 0.32);
    this.add.text(170, 188, copy.lockTitle, {
      fontFamily: "Microsoft YaHei, sans-serif",
      fontSize: "34px",
      color: "#1c211f"
    });
    this.add.text(170, 232, copy.lockSubtitle, {
      fontFamily: "Microsoft YaHei, sans-serif",
      fontSize: "18px",
      color: "#394440"
    });
    this.add.text(170, 266, copy.lockHint, {
      fontFamily: "Microsoft YaHei, sans-serif",
      fontSize: "15px",
      color: "#6b5a3d"
    });
    this.createBackButton();

    this.add.circle(640, 346, 122, 0x111817, 0.06).setStrokeStyle(3, 0xd1a95d, 0.34);
    this.add.circle(640, 346, 74, 0xd1a95d, 0.08);
    this.timerText = this.add.text(1015, 228, `${this.secondsLeft}s`, {
      fontFamily: "Georgia, serif",
      fontSize: "28px",
      color: "#b9402f"
    }).setOrigin(0.5);

    config.seals.forEach((seal, index) => {
      const x = 355 + index * 190;
      const node = this.add.container(x, 472);
      const color = Phaser.Display.Color.HexStringToColor(seal.color).color;
      const disc = this.add.circle(0, 0, 64, color, 0.92).setStrokeStyle(3, 0xfff4d6, 0.35);
      const label = this.add.text(0, 0, seal.label, {
        fontFamily: "Microsoft YaHei, sans-serif",
        fontSize: "34px",
        color: "#fffcf2"
      }).setOrigin(0.5);
      node.add([disc, label]);
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
