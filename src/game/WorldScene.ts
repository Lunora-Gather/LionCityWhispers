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
  private onboardingContainer?: Phaser.GameObjects.Container;
  private hasMoved = false;
  private interactables: NPC[] = [];
  private prompt!: Phaser.GameObjects.Container;
  private promptText!: Phaser.GameObjects.Text;
  private activeDialogue: {
    lines: string[];
    index: number;
  } | null = null;
  private nearestId = "";
  private virtualMove = { x: 0, y: 0 };
  private virtualMoveHandler?: (event: Event) => void;
  private virtualActionHandler?: () => void;
  private pressedCodes = new Set<string>();
  private keyDownHandler?: (event: KeyboardEvent) => void;
  private keyUpHandler?: (event: KeyboardEvent) => void;
  private dialogueHandler?: () => void;
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

    if (!this.hasMoved) {
      this.createOnboardingGuide();
    }

    emitGameState("world");
  }

  update(_time: number, delta: number) {
    if (this.onboardingContainer && !this.hasMoved) {
      const moving =
        this.cursors.left.isDown ||
        this.cursors.right.isDown ||
        this.cursors.up.isDown ||
        this.cursors.down.isDown ||
        this.pressedCodes.has(gameState.settings.bindings.moveLeft) ||
        this.pressedCodes.has(gameState.settings.bindings.moveRight) ||
        this.pressedCodes.has(gameState.settings.bindings.moveUp) ||
        this.pressedCodes.has(gameState.settings.bindings.moveDown) ||
        this.virtualMove.x !== 0 ||
        this.virtualMove.y !== 0;

      if (moving) {
        this.hasMoved = true;
        const target = this.onboardingContainer;
        this.onboardingContainer = undefined;
        this.tweens.add({
          targets: target,
          alpha: 0,
          y: target.y - 15,
          duration: 350,
          ease: "Sine.easeIn",
          onComplete: () => target.destroy()
        });
      }
    }

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
    this.dialogueHandler = () => {
      if (this.activeDialogue) {
        this.advanceDialogue();
      }
    };
    window.addEventListener("keydown", this.keyDownHandler);
    window.addEventListener("keyup", this.keyUpHandler);
    window.addEventListener("lcw:advance-dialogue", this.dialogueHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.pressedCodes.clear();
      if (this.keyDownHandler) {
        window.removeEventListener("keydown", this.keyDownHandler);
      }
      if (this.keyUpHandler) {
        window.removeEventListener("keyup", this.keyUpHandler);
      }
      if (this.dialogueHandler) {
        window.removeEventListener("lcw:advance-dialogue", this.dialogueHandler);
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

    // River paper lanterns
    const lanterns = [
      { x: 420, y: 310, scale: 0.8, delay: 0 },
      { x: 580, y: 320, scale: 0.6, delay: 500 },
      { x: 740, y: 305, scale: 0.7, delay: 1000 },
      { x: 890, y: 315, scale: 0.5, delay: 1500 }
    ];
    for (const lat of lanterns) {
      const lanternGlow = this.add.circle(lat.x, lat.y, 10, 0xffad33, 0.42).setDepth(4);
      const lanternBody = this.add.rectangle(lat.x, lat.y, 12, 12, 0xd1a95d, 0.8).setDepth(4);
      lanternBody.setStrokeStyle(1.5, 0xb9402f, 0.7);
      
      if (!gameState.settings.reduceMotion) {
        this.tweens.add({
          targets: [lanternGlow, lanternBody],
          x: lat.x - 30,
          y: lat.y + Math.random() * 4 - 2,
          duration: 3500 + Math.random() * 1500,
          delay: lat.delay,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut"
        });
        this.tweens.add({
          targets: lanternGlow,
          alpha: { from: 0.2, to: 0.6 },
          scale: { from: 0.8, to: 1.25 },
          duration: 1000 + Math.random() * 800,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut"
        });
      }
    }

    // Ink-fog particles (only if ritual is not complete)
    if (!gameState.flags.rhythm) {
      const fogColors = [0x050f0d, 0x081512];
      for (let i = 0; i < 6; i++) {
        const x = 120 + i * 200 + Math.random() * 60;
        const y = 200 + Math.random() * 320;
        const width = 160 + Math.random() * 100;
        const height = 80 + Math.random() * 60;
        const fog = this.add.ellipse(x, y, width, height, fogColors[i % 2], 0.08).setDepth(15);
        if (!gameState.settings.reduceMotion) {
          this.tweens.add({
            targets: fog,
            x: x + Math.random() * 40 - 20,
            y: y + Math.random() * 30 - 15,
            alpha: { from: 0.04, to: 0.12 },
            duration: 4000 + Math.random() * 2000,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut"
          });
        }
      }
    }

    const gateAura = this.add.circle(1085, 269, 128, 0x2bc7ab, 0.05).setDepth(4);
    const gateRing = this.add.circle(1085, 269, 116, 0x2bc7ab, 0).setDepth(6);
    gateRing.setStrokeStyle(1.5, 0x5ed6c0, 0.45);
    const innerRing = this.add.circle(1085, 269, 82, 0x2bc7ab, 0).setDepth(6);
    innerRing.setStrokeStyle(1, 0xf8edd2, 0.28);
    if (!gameState.settings.reduceMotion) {
      this.tweens.add({
        targets: [gateAura, gateRing, innerRing],
        alpha: { from: 0.6, to: 1 },
        scale: { from: 0.99, to: 1.01 },
        duration: 2500,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      });
    }

    // Dynamic rotating ritual magic circle
    const portalDecors = this.add.graphics().setDepth(5);
    portalDecors.setPosition(1085, 269);
    portalDecors.lineStyle(1, 0x5ed6c0, 0.28);
    portalDecors.strokeCircle(0, 0, 118);
    portalDecors.strokeCircle(0, 0, 82);
    portalDecors.lineStyle(1, 0xd1a95d, 0.25);
    for (let index = 0; index < 18; index += 1) {
      const angle = (Math.PI * 2 * index) / 18;
      portalDecors.lineBetween(
        Math.cos(angle) * 91,
        Math.sin(angle) * 91,
        Math.cos(angle) * 120,
        Math.sin(angle) * 120
      );
    }
    if (!gameState.settings.reduceMotion) {
      this.tweens.add({
        targets: portalDecors,
        angle: 360,
        duration: 40000,
        repeat: -1,
        ease: "Linear"
      });
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
        id: "boatman",
        kind: "npc",
        x: 720,
        y: 480,
        radius: 96,
        label: copy.boatman,
        color: 0xd1a95d,
        onInteract: () => this.showDialogue(this.getBoatmanLines())
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

  private getBoatmanLines() {
    const copy = worldCopy[gameState.settings.locale];
    if (gameState.museum.complete) {
      return copy.boatmanMuseumDone;
    }
    if (gameState.flags.rhythm) {
      return copy.boatmanRitualDone;
    }
    if (completedPuzzleCount() >= 2) {
      return copy.boatmanReadyRitual;
    }
    if (completedPuzzleCount() === 1) {
      return copy.boatmanOnePuzzle;
    }
    return copy.boatmanStart;
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
    this.activeDialogue = {
      lines,
      index: 0
    };
    if (this.onboardingContainer) {
      this.onboardingContainer.setVisible(false);
    }
    // Set first dialogue line
    gameState.dialogue = lines[0];
    emitGameState("dialogue");
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
    gameState.dialogue = text;
    emitGameState("dialogue");
  }

  private closeDialogue() {
    this.activeDialogue = null;
    if (this.onboardingContainer) {
      this.onboardingContainer.setVisible(true);
    }
    // Clear dialogue so React dialogue box fades out cleanly
    gameState.dialogue = "";
    emitGameState("world");
  }

  private createOnboardingGuide() {
    const isTouch = this.sys.game.device.os.android || this.sys.game.device.os.iOS || ('ontouchstart' in window);
    const locale = gameState.settings.locale;
    const textStr = isTouch
      ? (locale === "en" ? "Drag Joystick to Move • Tap to Interact" : "滑动摇杆移动 • 点击角色/物品交互")
      : (locale === "en" ? "WASD / ➔ to Move • Space / Click to Interact" : "WASD / 方向键 移动 • 空格 / 点击 交互");

    const container = this.add.container(230, 485).setDepth(35);
    
    const bg = this.add.rectangle(0, 0, locale === "en" ? 340 : 290, 36, 0x0c1b18, 0.92)
      .setStrokeStyle(1.5, 0xd1a95d, 0.72);
    
    const arrow = this.add.triangle(0, 23, -6, -6, 6, -6, 0, 0, 0x0c1b18, 0.92)
      .setStrokeStyle(1.5, 0xd1a95d, 0.72);
    const cover = this.add.rectangle(0, 17, 10, 2, 0x0c1b18, 1);

    const text = this.add.text(0, 0, textStr, {
      fontFamily: "Microsoft YaHei, Noto Sans SC, sans-serif",
      fontSize: "12px",
      fontStyle: "bold",
      color: "#fff4d6"
    }).setOrigin(0.5);

    container.add([bg, arrow, cover, text]);
    this.onboardingContainer = container;

    if (!gameState.settings.reduceMotion) {
      this.tweens.add({
        targets: container,
        y: 477,
        duration: 1000,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      });
    }
  }
}
