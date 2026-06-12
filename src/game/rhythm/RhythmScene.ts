import Phaser from "phaser";
import chart from "@/data/rhythm.json";
import { addArtifact, emitGameState, gameState, isUiLocked } from "../state";
import { Note } from "./Note";
import { playMiss, playRitualHit, playSuccess } from "../audio";
import { burst, drawPuzzleBackdrop, showRewardBanner } from "../visuals";
import { formatCopy, puzzleCopy } from "@/data/i18n";

function formatBinding(code: string) {
  const namedKeys: Record<string, string> = {
    Semicolon: ";",
    Quote: "'",
    Comma: ",",
    Period: ".",
    Slash: "/",
    Backslash: "\\",
    Minus: "-",
    Equal: "=",
    BracketLeft: "[",
    BracketRight: "]"
  };
  if (namedKeys[code]) {
    return namedKeys[code];
  }
  if (code === "Space") {
    return "Space";
  }
  if (code.startsWith("Key")) {
    return code.slice(3);
  }
  if (code.startsWith("Digit")) {
    return code.slice(5);
  }
  if (code.startsWith("Arrow")) {
    return code.replace("Arrow", "");
  }
  if (code.startsWith("Numpad")) {
    return `Num ${code.slice(6)}`;
  }
  return code;
}

const laneColors = [0xd1a95d, 0xc6523d, 0x2bc7ab, 0x6f7772];

export class RhythmScene extends Phaser.Scene {
  private notes: Note[] = [];
  private startTime = -1;
  private currentTime = 0;
  private score = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private feedback!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private progressFill?: Phaser.GameObjects.Rectangle;
  private laneFlashes: Phaser.GameObjects.Rectangle[] = [];
  private finished = false;
  private domKeyHandler?: (event: KeyboardEvent) => void;
  private virtualLaneHandler?: (event: Event) => void;
  private combo = 0;
  private previousMissed = 0;
  private perfectHits = 0;
  private goodHits = 0;
  private assistHits = 0;
  private misses = 0;
  private maxCombo = 0;
  private returnTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super("RhythmScene");
  }

  create() {
    const copy = puzzleCopy[gameState.settings.locale];
    emitGameState("rhythm");
    this.finished = false;
    this.score = 0;
    this.combo = 0;
    this.previousMissed = 0;
    this.perfectHits = 0;
    this.goodHits = 0;
    this.assistHits = 0;
    this.misses = 0;
    this.maxCombo = 0;
    this.returnTimer?.remove(false);
    this.returnTimer = undefined;
    this.startTime = -1;
    this.currentTime = 0;
    this.laneFlashes = [];
    this.progressFill = undefined;
    const laneXs = this.drawRitualStage(copy);

    this.scoreText = this.add.text(1010, 198, "0", {
      fontFamily: "Georgia, serif",
      fontSize: "38px",
      color: "#1d7f73"
    }).setOrigin(0.5).setDepth(25);
    this.feedback = this.add.text(640, 282, "", {
      fontFamily: "Microsoft YaHei, sans-serif",
      fontSize: "22px",
      color: "#1c211f"
    }).setOrigin(0.5).setDepth(45);
    this.comboText = this.add.text(1010, 240, "COMBO 0", {
      fontFamily: "Georgia, serif",
      fontSize: "16px",
      color: "#6b5a3d"
    }).setOrigin(0.5).setDepth(25);

    const travel = gameState.easyMode ? 3300 : 2500;
    this.notes = chart.notes.map(
      (note) =>
        new Note(
          this,
          note.lane,
          note.time,
          laneXs[note.lane],
          535,
          travel,
          formatBinding(gameState.settings.bindings.rhythm[note.lane]),
          laneColors[note.lane]
        )
    );

    this.domKeyHandler = (event: KeyboardEvent) => {
      if (isUiLocked()) {
        return;
      }
      const lane = gameState.settings.bindings.rhythm.findIndex((code) => code === event.code);
      if (lane >= 0) {
        this.hitLane(lane);
      }
    };
    this.virtualLaneHandler = (event: Event) => {
      if (isUiLocked()) {
        return;
      }
      const lane = Number((event as CustomEvent<number>).detail);
      if (Number.isInteger(lane) && lane >= 0 && lane <= 3) {
        this.hitLane(lane);
      }
    };
    window.addEventListener("keydown", this.domKeyHandler);
    window.addEventListener("lcw:rhythm-hit", this.virtualLaneHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.domKeyHandler) {
        window.removeEventListener("keydown", this.domKeyHandler);
        this.domKeyHandler = undefined;
      }
      if (this.virtualLaneHandler) {
        window.removeEventListener("lcw:rhythm-hit", this.virtualLaneHandler);
        this.virtualLaneHandler = undefined;
      }
      this.returnTimer?.remove(false);
      this.returnTimer = undefined;
    });
  }

  update(time: number) {
    if (this.finished || gameState.paused || isUiLocked()) {
      return;
    }

    this.currentTime = time;
    if (this.startTime < 0) {
      this.startTime = time + 600;
    }
    const elapsed = time - this.startTime;
    this.updateProgress(elapsed);
    for (const note of this.notes) {
      note.update(elapsed);
    }

    const missed = this.notes.filter((note) => note.missed).length;
    if (missed > this.previousMissed) {
      this.misses += missed - this.previousMissed;
      this.combo = 0;
      this.comboText.setText("COMBO 0");
      this.feedback.setText("MISS");
      this.feedback.setColor("#b9402f");
      playMiss();
    }
    this.previousMissed = missed;

    if (elapsed > chart.duration) {
      this.finish();
    }
  }

  private hitLane(lane: number) {
    if (this.finished || isUiLocked()) {
      return;
    }
    if (this.startTime < 0) {
      return;
    }
    const elapsed = this.currentTime - this.startTime;
    const candidate = this.notes
      .filter((note) => note.lane === lane && !note.hit && !note.missed)
      .sort((a, b) => a.diff(elapsed) - b.diff(elapsed))[0];

    if (!candidate) {
      this.combo = 0;
      this.comboText.setText("COMBO 0");
      this.feedback.setText(puzzleCopy[gameState.settings.locale].rhythmEmpty);
      this.feedback.setColor("#b9402f");
      this.flashLane(lane, 0xb9402f);
      playMiss();
      return;
    }

    const diff = candidate.diff(elapsed);
    if (diff <= 180) {
      this.score += 120;
      candidate.markHit();
      this.feedback.setText("PERFECT");
      this.combo += 1;
      this.perfectHits += 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      playRitualHit(true);
      this.feedback.setColor("#1d7f73");
      this.flashLane(lane, 0x2bc7ab);
      this.pulseFeedback(0x2bc7ab);
      burst(this, candidate.marker.x, candidate.marker.y, 0x2bc7ab);
    } else if (diff <= 340) {
      this.score += 70;
      candidate.markHit();
      this.feedback.setText("GOOD");
      this.combo += 1;
      this.goodHits += 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      playRitualHit(false);
      this.feedback.setColor("#8b6f37");
      this.flashLane(lane, 0xd1a95d);
      this.pulseFeedback(0xd1a95d);
      burst(this, candidate.marker.x, candidate.marker.y, 0xd1a95d);
    } else if (gameState.easyMode && diff <= 480) {
      this.score += 25;
      candidate.markHit();
      this.feedback.setText("ASSIST");
      this.assistHits += 1;
      this.combo = 0;
      playRitualHit(false);
      this.feedback.setColor("#6b5a3d");
      this.flashLane(lane, 0xd1a95d);
    } else {
      this.feedback.setText("MISS");
      this.feedback.setColor("#b9402f");
      this.combo = 0;
      this.misses += 1;
      this.flashLane(lane, 0xb9402f);
      playMiss();
    }
    this.scoreText.setText(String(this.score));
    this.comboText.setText(`COMBO ${this.combo}`);
  }

  private finish() {
    this.finished = true;
    const success = this.score >= chart.targetScore;
    const grade = this.gradeRun();
    const copy = puzzleCopy[gameState.settings.locale];
    if (success) {
      gameState.flags.rhythm = true;
      addArtifact("spirit-chime");
      gameState.dialogue = formatCopy(copy.rhythmComplete, { grade });
      emitGameState("rhythm");
      playSuccess();
      this.updateProgress(chart.duration);
      burst(this, 640, 320, 0x2bc7ab);
      showRewardBanner(this, formatCopy(copy.rhythmReward, { grade }), 0x1f8f82);
      this.returnTimer = this.time.delayedCall(1400, () => this.scene.start("WorldScene"));
    } else {
      gameState.dialogue = copy.rhythmFail;
      emitGameState("rhythm");
      this.add.rectangle(640, 320, 584, 106, 0xb9402f, 0.92).setDepth(80).setStrokeStyle(2, 0xfff4d6, 0.34);
      this.add.text(640, 306, copy.rhythmUnstable, {
        fontFamily: "Microsoft YaHei, sans-serif",
        fontSize: "24px",
        color: "#fffcf2"
      }).setOrigin(0.5).setDepth(81);
      const retry = this.add.text(640, 350, copy.rhythmRetry, {
        fontFamily: "Microsoft YaHei, sans-serif",
        fontSize: "18px",
        color: "#fffcf2"
      }).setOrigin(0.5).setDepth(81);
      retry.setInteractive();
      retry.on("pointerdown", () => this.scene.restart());
    }
  }

  private drawRitualStage(copy: (typeof puzzleCopy)[keyof typeof puzzleCopy]) {
    drawPuzzleBackdrop(this, {
      title: copy.rhythmTitle,
      subtitle: copy.rhythmSubtitle,
      clue: copy.rhythmHint,
      accent: 0x2bc7ab,
      backgroundAlpha: 0.28,
      overlayAlpha: 0.54
    });
    this.add.circle(640, 370, 246, 0x2bc7ab, 0.07).setStrokeStyle(2, 0x2bc7ab, 0.18);
    this.add.circle(640, 370, 184, 0x111817, 0.06).setStrokeStyle(1, 0xd1a95d, 0.16);
    this.add.rectangle(640, 380, 688, 438, 0x07100f, 0.08).setStrokeStyle(1, 0x2bc7ab, 0.14);
    this.add.rectangle(640, 282, 340, 54, 0xfffcf2, 0.26).setStrokeStyle(1, 0x2bc7ab, 0.18);
    this.add.rectangle(1010, 218, 150, 112, 0xfffcf2, 0.24).setStrokeStyle(1, 0xd1a95d, 0.24);

    const laneXs = [435, 570, 705, 840];
    laneXs.forEach((x, lane) => {
      const color = laneColors[lane];
      this.add.rectangle(x + 5, 366, 104, 424, 0x020504, 0.1);
      this.add.rectangle(x, 360, 98, 416, 0x0b1514, 0.1).setStrokeStyle(1, color, 0.22);
      this.add.rectangle(x, 535, 110, 72, 0x111817, 0.12).setStrokeStyle(1, color, 0.28);
      this.add.line(x, 360, 0, -184, 0, 184, color, 0.18);
      this.add.circle(x, 535, 33, color, 0.1).setStrokeStyle(2, color, 0.28);
      this.add.circle(x, 535, 18, 0xfff4d6, 0.16);
      const flash = this.add.rectangle(x, 360, 98, 416, color, 0).setDepth(15);
      this.laneFlashes.push(flash);
      this.add.text(x, 586, formatBinding(gameState.settings.bindings.rhythm[lane]), {
        fontFamily: "Georgia, serif",
        fontSize: "30px",
        color: "#b9402f"
      }).setOrigin(0.5).setDepth(20);
    });
    this.add.rectangle(640, 535, 642, 8, 0xb9402f, 0.92).setDepth(18);
    this.add.rectangle(640, 535, 642, 20, 0xb9402f, 0.08).setDepth(17);
    this.add.rectangle(640, 154, 620, 6, 0x111817, 0.1).setStrokeStyle(1, 0x2bc7ab, 0.16);
    this.progressFill = this.add.rectangle(330, 154, 1, 6, 0x2bc7ab, 0.78).setOrigin(0, 0.5);
    return laneXs;
  }

  private updateProgress(elapsed: number) {
    const progress = Phaser.Math.Clamp(elapsed / chart.duration, 0, 1);
    this.progressFill?.setDisplaySize(Math.max(1, 620 * progress), 6);
  }

  private flashLane(lane: number, color: number) {
    const flash = this.laneFlashes[lane];
    if (!flash) {
      return;
    }
    flash.setAlpha(1);
    flash.setFillStyle(color, gameState.settings.reduceMotion ? 0.16 : 0.24);
    if (gameState.settings.reduceMotion) {
      this.time.delayedCall(120, () => flash.setAlpha(0));
      return;
    }
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 180,
      ease: "Sine.easeOut"
    });
  }

  private pulseFeedback(color: number) {
    if (gameState.settings.reduceMotion) {
      return;
    }
    const pulse = this.add.circle(640, 282, 24, color, 0.18).setDepth(40);
    this.tweens.add({
      targets: pulse,
      alpha: 0,
      scale: 2.4,
      duration: 260,
      ease: "Sine.easeOut",
      onComplete: () => pulse.destroy()
    });
    this.tweens.add({
      targets: this.feedback,
      scale: 1.08,
      duration: 90,
      yoyo: true
    });
  }

  private gradeRun() {
    if (this.perfectHits >= 10 && this.misses === 0 && this.maxCombo >= 10) {
      return "S";
    }
    if (this.perfectHits + this.goodHits >= 11 && this.misses <= 2) {
      return "A";
    }
    if (this.score >= chart.targetScore) {
      return "B";
    }
    return "C";
  }
}
