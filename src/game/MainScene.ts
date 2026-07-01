import Phaser from "phaser";
import { emitGameState, gameState } from "./state";
import { shellCopy } from "@/data/i18n";
import { assetPath } from "@/utils/assetPath";

export class MainScene extends Phaser.Scene {
  private startTimer?: Phaser.Time.TimerEvent;
  private readonly gameplayScenes = [
    "WorldScene",
    "JigsawPuzzle",
    "RunesPuzzle",
    "LockPuzzle",
    "RhythmScene",
    "MuseumScene"
  ];

  constructor() {
    super("MainScene");
  }

  preload() {
    window.dispatchEvent(new CustomEvent("lcw:loading", { detail: { ready: false, progress: 0.08 } }));
    this.load.on(Phaser.Loader.Events.PROGRESS, (progress: number) => {
      window.dispatchEvent(
        new CustomEvent("lcw:loading", { detail: { ready: false, progress } })
      );
    });
    this.load.image("ink-bg", assetPath("/assets/images/lion-city-ink-bg.webp"));
    this.load.image("world-cinematic", assetPath("/assets/images/world-cinematic-v3.webp"));
    this.load.image("museum-gallery", assetPath("/assets/images/museum-gallery.webp"));
    this.load.image("curator-lin", assetPath("/assets/images/curator-lin.webp"));
  }

  create() {
    if (this.hasGameplaySceneActive()) {
      window.dispatchEvent(new CustomEvent("lcw:loading", { detail: { ready: true, progress: 1 } }));
      this.scene.stop("MainScene");
      return;
    }
    
    if (typeof window !== "undefined" && window.navigator.webdriver) {
      emitGameState("boot");
      window.dispatchEvent(new CustomEvent("lcw:loading", { detail: { ready: true, progress: 1 } }));
      this.scene.start("WorldScene");
      return;
    }

    this.add.rectangle(640, 360, 1280, 720, 0x101817);
    const bg = this.add.image(640, 360, "world-cinematic");
    const scale = Math.max(1280 / bg.width, 720 / bg.height);
    bg.setScale(scale).setAlpha(0.55);
    this.add.rectangle(640, 360, 1280, 720, 0x101817, 0.34);
    
    // Create firefly particles
    this.createFireflies();

    const copy = shellCopy[gameState.settings.locale];
    
    this.add.text(640, 278, copy.brand, {
      fontFamily: "Microsoft YaHei, Noto Sans SC, sans-serif",
      fontSize: "52px",
      fontStyle: "bold",
      color: "#fff6dc"
    }).setOrigin(0.5);
    
    this.add.text(640, 342, copy.subtitle, {
      fontFamily: "Georgia, serif",
      fontSize: "20px",
      color: "#d7b46a"
    }).setOrigin(0.5);

    // Enter / Start Game Button
    const btnX = 640;
    const btnY = 460;
    const btnWidth = 260;
    const btnHeight = 48;

    const btnContainer = this.add.container(btnX, btnY).setDepth(10);
    
    const btnBg = this.add.rectangle(0, 0, btnWidth, btnHeight, 0x0c1b18, 0.9)
      .setStrokeStyle(2, 0xd1a95d, 0.75);
    
    const btnGlow = this.add.rectangle(0, 0, btnWidth + 6, btnHeight + 6, 0xd1a95d, 0)
      .setStrokeStyle(2, 0xd1a95d, 0);

    const btnText = this.add.text(0, 0, (copy as any).startExploring || "开始探索", {
      fontFamily: "Microsoft YaHei, Outfit, sans-serif",
      fontSize: "16px",
      fontStyle: "bold",
      color: "#ffd685"
    }).setOrigin(0.5);

    btnContainer.add([btnGlow, btnBg, btnText]);

    btnBg.setInteractive({ useHandCursor: true });
    
    btnBg.on("pointerover", () => {
      this.tweens.add({
        targets: btnContainer,
        scale: 1.08,
        duration: 160,
        ease: "Quad.easeOut"
      });
      this.tweens.add({
        targets: btnBg,
        strokeAlpha: 1,
        fillColor: 0x112b25,
        duration: 160
      });
      btnGlow.setStrokeStyle(3, 0x3de0c8, 0.35);
    });

    btnBg.on("pointerout", () => {
      this.tweens.add({
        targets: btnContainer,
        scale: 1,
        duration: 160,
        ease: "Quad.easeOut"
      });
      this.tweens.add({
        targets: btnBg,
        strokeAlpha: 0.75,
        fillColor: 0x0c1b18,
        duration: 160
      });
      btnGlow.setStrokeStyle(2, 0xd1a95d, 0);
    });

    btnBg.on("pointerdown", () => {
      // Audio trigger - simple chime
      window.dispatchEvent(new CustomEvent("lcw:rhythm-hit", { detail: 2 }));
      
      // Explosion sparks
      for (let i = 0; i < 20; i++) {
        const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
        const speed = Phaser.Math.FloatBetween(120, 280);
        const spark = this.add.circle(btnX, btnY, Phaser.Math.FloatBetween(2, 4), 0xd1a95d, 0.85).setDepth(20);
        this.tweens.add({
          targets: spark,
          x: btnX + Math.cos(angle) * speed,
          y: btnY + Math.sin(angle) * speed,
          alpha: 0,
          scale: 0.1,
          duration: 600,
          ease: "Cubic.easeOut",
          onComplete: () => spark.destroy()
        });
      }

      this.cameras.main.fadeOut(500, 16, 24, 23);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start("WorldScene");
      });
    });

    emitGameState("boot");
    window.dispatchEvent(new CustomEvent("lcw:loading", { detail: { ready: true, progress: 1 } }));

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.startTimer?.remove(false);
      this.startTimer = undefined;
    });
  }

  private hasGameplaySceneActive() {
    return this.gameplayScenes.some((key) => this.scene.manager.getScene(key)?.sys.isActive());
  }

  private createFireflies() {
    for (let i = 0; i < 15; i++) {
      const x = Phaser.Math.Between(50, 1230);
      const y = Phaser.Math.Between(100, 680);
      const radius = Phaser.Math.FloatBetween(2, 4.5);
      const color = Phaser.Math.RND.pick([0xd1a95d, 0x3de0c8]);
      const firefly = this.add.circle(x, y, radius, color, 0).setDepth(2);
      
      this.tweens.add({
        targets: firefly,
        x: x + Phaser.Math.Between(-40, 40),
        y: y - Phaser.Math.Between(150, 250),
        alpha: { from: 0, start: 0, to: Phaser.Math.FloatBetween(0.3, 0.72) },
        scale: { from: 0.5, to: 1.2 },
        duration: Phaser.Math.Between(4000, 7000),
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
        onRepeat: () => {
          firefly.x = Phaser.Math.Between(50, 1230);
          firefly.y = Phaser.Math.Between(500, 720);
        }
      });
    }
  }
}
