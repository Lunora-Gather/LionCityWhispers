import Phaser from "phaser";
import { MainScene } from "./MainScene";
import { MuseumScene } from "./museum/MuseumScene";
import { JigsawPuzzle } from "./puzzles/JigsawPuzzle";
import { LockPuzzle } from "./puzzles/LockPuzzle";
import { RunesPuzzle } from "./puzzles/RunesPuzzle";
import { RhythmScene } from "./rhythm/RhythmScene";
import { WorldScene } from "./WorldScene";
import {
  applyAudioSettings,
  preloadAudioAssets,
  setAudioPageSuspended,
  setAudioPaused
} from "./audio";
import {
  clearSavedGame,
  emitGameState,
  gameState,
  initializeGameState,
  resetGameState,
  setPaused,
  setUiLocked,
  toggleEasyMode,
  toggleMuted,
  updatePerformanceStats,
  updateSettings,
  type GameSettings
} from "./state";
import type { SceneKey } from "@/data/i18n";

export function startGame(parent: string) {
  initializeGameState();
  applyAudioSettings(gameState.settings);
  preloadAudioAssets();
  const managedScenes = [
    "MainScene",
    "WorldScene",
    "JigsawPuzzle",
    "RunesPuzzle",
    "LockPuzzle",
    "RhythmScene",
    "MuseumScene"
  ];
  const sceneLabels: Record<string, SceneKey> = {
    MainScene: "boot",
    WorldScene: "world",
    JigsawPuzzle: "jigsaw",
    RunesPuzzle: "runes",
    LockPuzzle: "lock",
    RhythmScene: "rhythm",
    MuseumScene: "museum"
  };

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent,
    backgroundColor: "#f5f0e6",
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 1280,
      height: 720
    },
    scene: [
      MainScene,
      WorldScene,
      JigsawPuzzle,
      RunesPuzzle,
      LockPuzzle,
      RhythmScene,
      MuseumScene
    ],
    input: {
      activePointers: 3
    },
    render: {
      antialias: true,
      pixelArt: false
    }
  };

  const game = new Phaser.Game(config);
  let frameCount = 0;
  let longFrames = 0;
  let inputLatency = 0;
  let worstInputLatency = 0;
  let interactionSamples = 0;
  let lastFrame = performance.now();
  let windowStart = lastFrame;
  let rafId = 0;
  const tick = (time: number) => {
    const delta = time - lastFrame;
    lastFrame = time;
    frameCount += 1;
    if (delta > 80) {
      longFrames += 1;
    }
    rafId = window.requestAnimationFrame(tick);
  };
  rafId = window.requestAnimationFrame(tick);
  const performanceTimer = window.setInterval(() => {
    const now = performance.now();
    const elapsed = Math.max(1, now - windowStart);
    updatePerformanceStats({
      fps: Math.round((frameCount * 1000) / elapsed),
      longFrames,
      inputLatency: Math.round(inputLatency),
      worstInputLatency: Math.round(worstInputLatency),
      interactionSamples
    });
    emitGameState();
    frameCount = 0;
    longFrames = 0;
    inputLatency = 0;
    worstInputLatency = 0;
    interactionSamples = 0;
    windowStart = now;
  }, 2500);

  const trackInteraction = () => {
    const start = performance.now();
    window.requestAnimationFrame(() => {
      const delay = performance.now() - start;
      interactionSamples += 1;
      inputLatency += (delay - inputLatency) / interactionSamples;
      worstInputLatency = Math.max(worstInputLatency, delay);
    });
  };

  const currentSceneLabel = () => {
    const key = managedScenes.find(
      (sceneKey) => game.scene.isActive(sceneKey) || game.scene.isPaused(sceneKey)
    );
    return key ? sceneLabels[key] : "world";
  };

  const onPause = (event: Event) => {
    const paused = Boolean((event as CustomEvent<boolean>).detail);
    setPaused(paused);
    for (const key of managedScenes) {
      if (paused && game.scene.isActive(key)) {
        game.scene.pause(key);
      } else if (!paused && game.scene.isPaused(key)) {
        game.scene.resume(key);
      }
    }
    setAudioPaused(paused);
    emitGameState(paused ? "paused" : currentSceneLabel());
  };

  const onDifficulty = () => {
    toggleEasyMode();
    emitGameState(currentSceneLabel());
  };

  const onAudio = () => {
    toggleMuted();
    applyAudioSettings(gameState.settings);
    emitGameState(currentSceneLabel());
  };

  const onSettings = (event: Event) => {
    const previousLocale = gameState.settings.locale;
    updateSettings((event as CustomEvent<Partial<GameSettings>>).detail ?? {});
    applyAudioSettings(gameState.settings);
    if (gameState.settings.locale !== previousLocale) {
      const activeScene = managedScenes.find(
        (sceneKey) => game.scene.isActive(sceneKey) || game.scene.isPaused(sceneKey)
      );
      if (activeScene) {
        game.scene.stop(activeScene);
        game.scene.start(activeScene);
      }
    }
    emitGameState(currentSceneLabel());
  };

  const onReset = () => {
    clearSavedGame();
    resetGameState();
    applyAudioSettings(gameState.settings);
    for (const key of managedScenes) {
      if (game.scene.isActive(key) || game.scene.isPaused(key)) {
        game.scene.stop(key);
      }
    }
    game.scene.start("WorldScene");
    emitGameState("world");
  };

  const onChapter = (event: Event) => {
    const target = (event as CustomEvent<string>).detail;
    if (!managedScenes.includes(target)) {
      return;
    }
    setPaused(false);
    for (const key of managedScenes) {
      if (game.scene.isActive(key) || game.scene.isPaused(key)) {
        game.scene.stop(key);
      }
    }
    game.scene.start(target);
  };

  const onUiLock = (event: Event) => {
    setUiLocked(Boolean((event as CustomEvent<boolean>).detail));
  };

  const onVisibilityChange = () => {
    setAudioPageSuspended(document.hidden);
  };

  const onBlur = () => setAudioPageSuspended(true);
  const onFocus = () => setAudioPageSuspended(document.hidden);

  window.addEventListener("lcw:pause", onPause);
  window.addEventListener("lcw:difficulty", onDifficulty);
  window.addEventListener("lcw:reset", onReset);
  window.addEventListener("lcw:audio-toggle", onAudio);
  window.addEventListener("lcw:settings", onSettings);
  window.addEventListener("lcw:chapter", onChapter);
  window.addEventListener("lcw:ui-lock", onUiLock);
  window.addEventListener("pointerdown", trackInteraction, { passive: true });
  window.addEventListener("keydown", trackInteraction);
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("blur", onBlur);
  window.addEventListener("focus", onFocus);

  return {
    destroy() {
      window.removeEventListener("lcw:pause", onPause);
      window.removeEventListener("lcw:difficulty", onDifficulty);
      window.removeEventListener("lcw:reset", onReset);
      window.removeEventListener("lcw:audio-toggle", onAudio);
      window.removeEventListener("lcw:settings", onSettings);
      window.removeEventListener("lcw:chapter", onChapter);
      window.removeEventListener("lcw:ui-lock", onUiLock);
      window.removeEventListener("pointerdown", trackInteraction);
      window.removeEventListener("keydown", trackInteraction);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      window.cancelAnimationFrame(rafId);
      window.clearInterval(performanceTimer);
      game.destroy(true);
    }
  };
}
