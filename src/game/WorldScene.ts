import Phaser from "phaser";
import { NPC, type InteractableConfig } from "./NPC";
import { Player } from "./Player";
import { startPuzzle, transitionTo } from "./PuzzleManager";
import { playUiClick } from "./audio";
import { completedPuzzleCount, emitGameState, gameState, isUiLocked } from "./state";
import { worldCopy } from "@/data/i18n";

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

export class WorldScene extends Phaser.Scene {
  private player!: Player;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private interactables: NPC[] = [];
  private prompt!: Phaser.GameObjects.Container;
  private promptText!: Phaser.GameObjects.Text;
  private activeDialogue: {
    lines: string[];
    index: number;
    box: Phaser.GameObjects.Container;
  } | null = null;
  private nearestId = "";
  private virtualMove = { x: 0, y: 0 };
  private virtualMoveHandler?: (event: Event) => void;
  private virtualActionHandler?: () => void;
  private pressedCodes = new Set<string>();
  private keyDownHandler?: (event: KeyboardEvent) => void;
  private keyUpHandler?: (event: KeyboardEvent) => void;
  private guideTargetId = "__unset";

  constructor() {
    super("WorldScene");
  }

  create() {
    this.drawWorld();
    this.player = new Player(this, 230, 555);
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.createInteractables();
    this.createPrompt();
    this.bindKeyboard();
    this.bindVirtualControls();
    this.bindPointerInteractions();

    emitGameState("world");
  }

  update(_time: number, delta: number) {
    if (isUiLocked()) {
      this.pressedCodes.clear();
      this.virtualMove = { x: 0, y: 0 };
      this.player.update({ left: false, right: false, up: false, down: false }, delta);
      return;
    }

    if (gameState.paused || this.activeDialogue) {
      return;
    }

    this.player.update(
      {
        left:
          this.cursors.left.isDown ||
          this.pressedCodes.has(gameState.settings.bindings.moveLeft) ||
          this.virtualMove.x < 0,
        right:
          this.cursors.right.isDown ||
          this.pressedCodes.has(gameState.settings.bindings.moveRight) ||
          this.virtualMove.x > 0,
        up:
          this.cursors.up.isDown ||
          this.pressedCodes.has(gameState.settings.bindings.moveUp) ||
          this.virtualMove.y < 0,
        down:
          this.cursors.down.isDown ||
          this.pressedCodes.has(gameState.settings.bindings.moveDown) ||
          this.virtualMove.y > 0
      },
      delta
    );

    const nearest = this.getNearest();
    this.updateGuidedInteractable();
    for (const item of this.interactables) {
      item.setFocus(item === nearest);
    }

    if (nearest) {
      this.nearestId = nearest.config.id;
      this.promptText.setText(
        `${nearest.config.label}  /  ${formatBinding(gameState.settings.bindings.action)}`
      );
      this.prompt.setAlpha(1);
    } else {
      this.nearestId = "";
      this.prompt.setAlpha(0);
    }
  }

  private bindKeyboard() {
    this.keyDownHandler = (event: KeyboardEvent) => {
      if (isUiLocked()) {
        this.pressedCodes.clear();
        return;
      }
      this.pressedCodes.add(event.code);
      if (event.key === "Escape" && this.activeDialogue) {
        this.closeDialogue();
        return;
      }
      if (event.code === gameState.settings.bindings.action) {
        event.preventDefault();
        if (this.activeDialogue) {
          this.advanceDialogue();
          return;
        }
        this.interactWithNearest();
      }
    };
    this.keyUpHandler = (event: KeyboardEvent) => {
      this.pressedCodes.delete(event.code);
    };
    window.addEventListener("keydown", this.keyDownHandler);
    window.addEventListener("keyup", this.keyUpHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.pressedCodes.clear();
      if (this.keyDownHandler) {
        window.removeEventListener("keydown", this.keyDownHandler);
      }
      if (this.keyUpHandler) {
        window.removeEventListener("keyup", this.keyUpHandler);
      }
    });
  }

  private drawWorld() {
    this.add.rectangle(640, 360, 1280, 720, 0x101817);
    const bg = this.add.image(640, 360, "world-cinematic");
    const scale = Math.max(1280 / bg.width, 720 / bg.height);
    bg.setScale(scale);

    this.add.rectangle(640, 360, 1280, 720, 0x050909, 0.03);
    this.add.rectangle(640, 683, 1280, 96, 0x08100f, 0.18);
    this.add.rectangle(640, 76, 1280, 152, 0x08100f, 0.08);
    this.drawSceneAtmosphere();
  }

  private drawSceneAtmosphere() {
    const fx = this.add.graphics().setDepth(5);
    fx.lineStyle(2, 0xcfe6df, 0.14);
    for (let row = 0; row < 4; row += 1) {
      const y = 334 + row * 26;
      fx.beginPath();
      fx.moveTo(490, y);
      for (let x = 550; x <= 875; x += 62) {
        fx.lineTo(x, y + Math.sin((x + row * 31) / 38) * 7);
      }
      fx.strokePath();
    }

    const glints = [
      { x: 556, y: 367, w: 42, delay: 0 },
      { x: 644, y: 390, w: 56, delay: 240 },
      { x: 736, y: 361, w: 48, delay: 480 },
      { x: 836, y: 384, w: 52, delay: 720 }
    ];
    for (const glint of glints) {
      const shine = this.add.ellipse(glint.x, glint.y, glint.w, 4, 0xf8edd2, 0.16).setDepth(6);
      if (!gameState.settings.reduceMotion) {
        this.tweens.add({
          targets: shine,
          alpha: { from: 0.07, to: 0.34 },
          scaleX: { from: 0.68, to: 1.18 },
          duration: 1500,
          delay: glint.delay,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut"
        });
      }
    }

    const gateAura = this.add.circle(1085, 269, 128, 0x2bc7ab, 0.07).setDepth(4);
    const gateRing = this.add.circle(1085, 269, 116, 0x2bc7ab, 0).setDepth(6);
    gateRing.setStrokeStyle(2, 0x5ed6c0, 0.36);
    const innerRing = this.add.circle(1085, 269, 82, 0x2bc7ab, 0).setDepth(6);
    innerRing.setStrokeStyle(1, 0xf8edd2, 0.22);
    if (!gameState.settings.reduceMotion) {
      this.tweens.add({
        targets: [gateAura, gateRing, innerRing],
        alpha: { from: 0.55, to: 1 },
        scale: { from: 0.985, to: 1.02 },
        duration: 2100,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      });
    }

    fx.lineStyle(1, 0x5ed6c0, 0.22);
    fx.strokeCircle(1085, 269, 118);
    fx.strokeCircle(1085, 269, 82);
    fx.lineStyle(1, 0xd1a95d, 0.2);
    for (let index = 0; index < 18; index += 1) {
      const angle = (Math.PI * 2 * index) / 18;
      fx.lineBetween(
        1085 + Math.cos(angle) * 91,
        269 + Math.sin(angle) * 91,
        1085 + Math.cos(angle) * 120,
        269 + Math.sin(angle) * 120
      );
    }

    const lamps = [
      { x: 173, y: 466, r: 18, alpha: 0.22 },
      { x: 418, y: 507, r: 14, alpha: 0.17 },
      { x: 982, y: 548, r: 16, alpha: 0.18 }
    ];
    for (const lamp of lamps) {
      const glow = this.add.circle(lamp.x, lamp.y, lamp.r, 0xd1a95d, lamp.alpha).setDepth(6);
      if (!gameState.settings.reduceMotion) {
        this.tweens.add({
          targets: glow,
          alpha: { from: lamp.alpha * 0.55, to: lamp.alpha },
          scale: { from: 0.92, to: 1.14 },
          duration: 1200 + lamp.r * 14,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut"
        });
      }
    }
  }

  private createInteractables() {
    const copy = worldCopy[gameState.settings.locale];
    const configs: InteractableConfig[] = [
      {
        id: "curator",
        kind: "npc",
        x: 258,
        y: 584,
        radius: 96,
        label: copy.curator,
        color: 0x1f8f82,
        onInteract: () => this.showDialogue(this.getCuratorLines())
      },
      {
        id: "jigsaw",
        kind: "puzzle",
        x: 588,
        y: 548,
        radius: 92,
        label: gameState.flags.jigsaw ? copy.jigsawDone : copy.jigsawPending,
        color: 0xd1a95d,
        onInteract: () => {
          if (gameState.flags.jigsaw) {
            this.showDialogue([copy.jigsawDoneLine]);
          } else {
            startPuzzle(this, "jigsaw");
          }
        }
      },
      {
        id: "runes",
        kind: "puzzle",
        x: 840,
        y: 448,
        radius: 92,
        label: gameState.flags.runes ? copy.runesDone : copy.runesPending,
        color: 0xc6523d,
        onInteract: () => {
          if (gameState.flags.runes) {
            this.showDialogue([copy.runesDoneLine]);
          } else {
            startPuzzle(this, "runes");
          }
        }
      },
      {
        id: "lock",
        kind: "puzzle",
        x: 1010,
        y: 570,
        radius: 90,
        label: gameState.flags.lock ? copy.lockDone : copy.lockPending,
        color: 0x252b28,
        onInteract: () => {
          if (gameState.flags.lock) {
            this.showDialogue([copy.lockDoneLine]);
          } else {
            startPuzzle(this, "lock");
          }
        }
      },
      {
        id: "ritual",
        kind: "ritual",
        x: 1092,
        y: 282,
        radius: 122,
        label: gameState.flags.rhythm ? copy.ritualDone : copy.ritualPending,
        color: 0x2bc7ab,
        onInteract: () => {
          if (completedPuzzleCount() < 2) {
            this.showDialogue([copy.ritualLockedLine]);
            return;
          }
          if (gameState.flags.rhythm) {
            this.showDialogue([copy.ritualDoneLine]);
            return;
          }
          transitionTo(this, "RhythmScene");
        }
      },
      {
        id: "museum",
        kind: "museum",
        x: 185,
        y: 330,
        radius: 118,
        label: copy.museum,
        color: 0xd1a95d,
        onInteract: () => transitionTo(this, "MuseumScene")
      }
    ];

    this.interactables = configs.map((config) => new NPC(this, config));
    this.updateGuidedInteractable();
  }

  private createPrompt() {
    const panel = this.add.rectangle(0, 0, 330, 42, 0x101817, 0.68);
    panel.setStrokeStyle(1, 0xd1a95d, 0.38);
    this.promptText = this.add.text(0, 0, "", {
      fontFamily: "Microsoft YaHei, sans-serif",
      fontSize: "16px",
      color: "#fff4d6"
    }).setOrigin(0.5);
    this.prompt = this.add.container(640, 548, [panel, this.promptText]).setDepth(40).setAlpha(0);
  }

  private getCuratorLines() {
    const copy = worldCopy[gameState.settings.locale];
    if (gameState.museum.complete) {
      return copy.curatorMuseumDone;
    }
    if (gameState.flags.rhythm) {
      return copy.curatorRitualDone;
    }
    if (completedPuzzleCount() >= 2) {
      return copy.curatorReadyRitual;
    }
    if (completedPuzzleCount() === 1) {
      return copy.curatorOnePuzzle;
    }
    return copy.curatorStart;
  }

  private bindVirtualControls() {
    this.virtualMoveHandler = (event: Event) => {
      if (isUiLocked()) {
        this.virtualMove = { x: 0, y: 0 };
        return;
      }
      const detail = (event as CustomEvent<{ x: number; y: number }>).detail;
      this.virtualMove = detail ?? { x: 0, y: 0 };
    };
    this.virtualActionHandler = () => {
      if (isUiLocked()) {
        return;
      }
      if (this.activeDialogue) {
        this.advanceDialogue();
        return;
      }
      this.interactWithNearest();
    };
    window.addEventListener("lcw:virtual-move", this.virtualMoveHandler);
    window.addEventListener("lcw:virtual-action", this.virtualActionHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.virtualMoveHandler) {
        window.removeEventListener("lcw:virtual-move", this.virtualMoveHandler);
      }
      if (this.virtualActionHandler) {
        window.removeEventListener("lcw:virtual-action", this.virtualActionHandler);
      }
    });
  }

  private bindPointerInteractions() {
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.activeDialogue || isUiLocked()) {
        return;
      }
      const target =
        this.getInteractableAt(pointer.x, pointer.y) ??
        this.getInteractableAt(pointer.worldX, pointer.worldY);
      if (target) {
        playUiClick();
        target.config.onInteract();
      }
    });
  }

  private getInteractableAt(x: number, y: number) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return undefined;
    }
    let best: NPC | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const item of this.interactables) {
      const distance = Phaser.Math.Distance.Between(x, y, item.config.x, item.config.y);
      if (distance <= item.config.radius + 28 && distance < bestDistance) {
        best = item;
        bestDistance = distance;
      }
    }
    return best;
  }

  private getNearest() {
    return this.interactables.find((item) => item.isNear(this.player.x, this.player.y));
  }

  private getGuidedInteractableId() {
    if (gameState.museum.complete) {
      return "";
    }
    if (gameState.flags.rhythm && gameState.inventory.length >= 4) {
      return "museum";
    }
    if (completedPuzzleCount() >= 2 && !gameState.flags.rhythm) {
      return "ritual";
    }
    if (!gameState.flags.jigsaw) {
      return "jigsaw";
    }
    if (!gameState.flags.runes) {
      return "runes";
    }
    if (!gameState.flags.lock) {
      return "lock";
    }
    if (!gameState.flags.rhythm) {
      return "ritual";
    }
    return "museum";
  }

  private updateGuidedInteractable() {
    const targetId = this.getGuidedInteractableId();
    if (targetId === this.guideTargetId) {
      return;
    }
    this.guideTargetId = targetId;
    for (const item of this.interactables) {
      item.setGuided(item.config.id === targetId);
    }
  }

  private interactWithNearest() {
    const nearest = this.getNearest();
    if (nearest) {
      this.nearestId = nearest.config.id;
      playUiClick();
      nearest.config.onInteract();
    }
  }

  private showDialogue(lines: string[]) {
    const copy = worldCopy[gameState.settings.locale];
    const hasPortrait = lines[0]?.startsWith(`${copy.curator}:`);
    this.activeDialogue = {
      lines,
      index: 0,
      box: this.createDialogueBox(lines[0], hasPortrait)
    };
    gameState.dialogue = lines[0];
    emitGameState("dialogue");
  }

  private createDialogueBox(text: string, hasPortrait: boolean) {
    const box = this.add.container(640, 578).setDepth(50);
    const panel = this.add.rectangle(0, 0, 900, 118, 0x0c1212, 0.8);
    panel.setStrokeStyle(1, 0xd1a95d, 0.46);
    const lineX = hasPortrait ? -310 : -410;
    const wrapWidth = hasPortrait ? 690 : 820;
    const line = this.add.text(lineX, -28, text, {
      fontFamily: "Microsoft YaHei, sans-serif",
      fontSize: "21px",
      color: "#fff4d6",
      wordWrap: { width: wrapWidth }
    });
    const hint = this.add.text(410, 34, formatBinding(gameState.settings.bindings.action), {
      fontFamily: "Georgia, serif",
      fontSize: "15px",
      color: "#d1a95d"
    }).setOrigin(1, 0.5);
    if (hasPortrait) {
      const portraitFrame = this.add.rectangle(-390, 0, 86, 86, 0x111817, 0.86);
      portraitFrame.setStrokeStyle(1, 0xd1a95d, 0.48);
      const portrait = this.add.image(-390, 0, "curator-lin").setDisplaySize(78, 78);
      box.add([panel, portraitFrame, portrait, line, hint]);
    } else {
      box.add([panel, line, hint]);
    }
    box.setData("line", line);
    box.setInteractive(
      new Phaser.Geom.Rectangle(-450, -59, 900, 118),
      Phaser.Geom.Rectangle.Contains
    );
    box.on("pointerdown", () => this.advanceDialogue());
    return box;
  }

  private advanceDialogue() {
    if (!this.activeDialogue) {
      return;
    }
    this.activeDialogue.index += 1;
    playUiClick();
    if (this.activeDialogue.index >= this.activeDialogue.lines.length) {
      this.closeDialogue();
      return;
    }
    const text = this.activeDialogue.lines[this.activeDialogue.index];
    const line = this.activeDialogue.box.getData("line") as Phaser.GameObjects.Text;
    line.setText(text);
    gameState.dialogue = text;
    emitGameState("dialogue");
  }

  private closeDialogue() {
    this.activeDialogue?.box.destroy();
    this.activeDialogue = null;
    emitGameState("world");
  }
}
