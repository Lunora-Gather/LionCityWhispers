import Phaser from "phaser";
import chart from "@/data/rhythm.json";
import { addArtifact, emitGameState, gameState, isUiLocked } from "../state";
import { Note } from "./Note";
import { playMiss, playRitualHit, playSuccess } from "../audio";
import { burst, showRewardBanner } from "../visuals";
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

export class RhythmScene extends Phaser.Scene {
  private notes: Note[] = [];
  private startTime = -1;
  private currentTime = 0;
  private score = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private feedback!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
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
    this.add.rectangle(640, 360, 1280, 720, 0x07100f);
    const bg = this.add.image(640, 360, "world-cinematic");
    const scale = Math.max(1280 / bg.width, 720 / bg.height);
    bg.setScale(scale).setAlpha(0.24);
    this.add.rectangle(640, 360, 1280, 720, 0x030908, 0.58);
    this.add.rectangle(640, 368, 900, 548, 0xf8edd2, 0.9).setStrokeStyle(2, 0xd1a95d, 0.34);
    this.add.text(205, 188, copy.rhythmTitle, {
      fontFamily: "Microsoft YaHei, sans-serif",
      fontSize: "34px",
      color: "#111817"
    });
    this.add.text(205, 232, copy.rhythmSubtitle, {
      fontFamily: "Microsoft YaHei, sans-serif",
      fontSize: "18px",
      color: "#394440"
    });

    const laneXs = [435, 570, 705, 840];
    laneXs.forEach((x, lane) => {
      this.add.rectangle(x, 360, 92, 410, 0x0b1514, 0.08).setStrokeStyle(1, 0x1c211f, 0.12);
      this.add.line(x, 360, 0, -184, 0, 184, 0xd1a95d, 0.16);
      this.add.text(x, 586, formatBinding(gameState.settings.bindings.rhythm[lane]), {
        fontFamily: "Georgia, serif",
        fontSize: "30px",
        color: "#b9402f"
      }).setOrigin(0.5);
    });
    this.add.rectangle(640, 535, 620, 5, 0xb9402f, 0.92);

    this.scoreText = this.add.text(1010, 188, "0", {
      fontFamily: "Georgia, serif",
      fontSize: "38px",
      color: "#1d7f73"
    }).setOrigin(0.5);
    this.feedback = this.add.text(640, 280, "", {
      fontFamily: "Microsoft YaHei, sans-serif",
      fontSize: "20px",
      color: "#1c211f"
    }).setOrigin(0.5);
    this.comboText = this.add.text(1010, 228, "COMBO 0", {
      fontFamily: "Georgia, serif",
      fontSize: "16px",
      color: "#6b5a3d"
    }).setOrigin(0.5);

    const travel = gameState.easyMode ? 3300 : 2500;
    this.notes = chart.notes.map(
      (note) => new Note(this, note.lane, note.time, laneXs[note.lane], 535, travel)
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
    for (const note of this.notes) {
      note.update(elapsed);
    }

    const missed = this.notes.filter((note) => note.missed).length;
    if (missed > this.previousMissed) {
      this.misses += missed - this.previousMissed;
      this.combo = 0;
      this.comboText.setText("COMBO 0");
      this.feedback.setText("MISS");
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
      burst(this, candidate.marker.x, candidate.marker.y, 0x2bc7ab);
    } else if (diff <= 340) {
      this.score += 70;
      candidate.markHit();
      this.feedback.setText("GOOD");
      this.combo += 1;
      this.goodHits += 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      playRitualHit(false);
      burst(this, candidate.marker.x, candidate.marker.y, 0xd1a95d);
    } else if (gameState.easyMode && diff <= 480) {
      this.score += 25;
      candidate.markHit();
      this.feedback.setText("ASSIST");
      this.assistHits += 1;
      this.combo = 0;
      playRitualHit(false);
    } else {
      this.feedback.setText("MISS");
      this.combo = 0;
      this.misses += 1;
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
      burst(this, 640, 320, 0x2bc7ab);
      showRewardBanner(this, formatCopy(copy.rhythmReward, { grade }), 0x1f8f82);
      this.returnTimer = this.time.delayedCall(1400, () => this.scene.start("WorldScene"));
    } else {
      gameState.dialogue = copy.rhythmFail;
      emitGameState("rhythm");
      this.add.rectangle(640, 320, 560, 92, 0xb9402f, 0.92);
      this.add.text(640, 306, copy.rhythmUnstable, {
        fontFamily: "Microsoft YaHei, sans-serif",
        fontSize: "24px",
        color: "#fffcf2"
      }).setOrigin(0.5);
      const retry = this.add.text(640, 350, copy.rhythmRetry, {
        fontFamily: "Microsoft YaHei, sans-serif",
        fontSize: "18px",
        color: "#fffcf2"
      }).setOrigin(0.5);
      retry.setInteractive();
      retry.on("pointerdown", () => this.scene.restart());
    }
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
