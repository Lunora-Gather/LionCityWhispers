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
    this.add.rectangle(640, 360, 1280, 720, 0x101817);
    const bg = this.add.image(640, 360, "world-cinematic");
    const scale = Math.max(1280 / bg.width, 720 / bg.height);
    bg.setScale(scale).setAlpha(0.55);
    this.add.rectangle(640, 360, 1280, 720, 0x101817, 0.34);
    const copy = shellCopy[gameState.settings.locale];
    this.add.text(640, 318, copy.brand, {
      fontFamily: "Microsoft YaHei, sans-serif",
      fontSize: "44px",
      color: "#fff6dc"
    }).setOrigin(0.5);
    this.add.text(640, 372, copy.subtitle, {
      fontFamily: "Georgia, serif",
      fontSize: "19px",
      color: "#d7b46a"
    }).setOrigin(0.5);
    emitGameState("boot");
    window.dispatchEvent(new CustomEvent("lcw:loading", { detail: { ready: true, progress: 1 } }));

    this.startTimer = this.time.delayedCall(350, () => {
      if (!this.hasGameplaySceneActive()) {
        this.scene.start("WorldScene");
      }
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.startTimer?.remove(false);
      this.startTimer = undefined;
    });
  }

  private hasGameplaySceneActive() {
    return this.gameplayScenes.some((key) => this.scene.manager.getScene(key)?.sys.isActive());
  }
}
