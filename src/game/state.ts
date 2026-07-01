import {
  isLocale,
  localizedArtifact,
  objectiveCopy,
  sceneName,
  stateCopy,
  text,
  type ArtifactId,
  type Locale
} from "@/data/i18n";

export type { ArtifactId } from "@/data/i18n";

export type Artifact = {
  id: ArtifactId;
  name: string;
  detail: string;
};

type Flags = {
  jigsaw: boolean;
  runes: boolean;
  lock: boolean;
  rhythm: boolean;
};

type MuseumState = {
  placements: Partial<Record<ArtifactId, number>>;
  visitors: number;
  complete: boolean;
};

export type GameSettings = {
  muted: boolean;
  volume: number;
  effectsVolume: number;
  ambientVolume: number;
  reduceMotion: boolean;
  locale: Locale;
  bindings: ControlBindings;
};

export type ControlBindings = {
  moveUp: string;
  moveDown: string;
  moveLeft: string;
  moveRight: string;
  action: string;
  rhythm: [string, string, string, string];
};

export type PerformanceStats = {
  fps: number;
  longFrames: number;
  inputLatency: number;
  worstInputLatency: number;
  interactionSamples: number;
};

export type GameState = {
  inventory: Artifact[];
  flags: Flags;
  museum: MuseumState;
  dialogue: string;
  paused: boolean;
  easyMode: boolean;
  settings: GameSettings;
  performance: PerformanceStats;
};

const SAVE_KEY = "lcw:save:v2";
const SAVE_VERSION = 2;
const MAX_VISITORS = 9999;
const artifactIds: ArtifactId[] = [
  "badang-stone",
  "rune-plaque",
  "harbor-seal",
  "spirit-chime"
];

const defaultBindings: ControlBindings = {
  moveUp: "KeyW",
  moveDown: "KeyS",
  moveLeft: "KeyA",
  moveRight: "KeyD",
  action: "Space",
  rhythm: ["KeyA", "KeyS", "KeyD", "KeyF"]
};

function cloneBindings(bindings: ControlBindings): ControlBindings {
  return { ...bindings, rhythm: [...bindings.rhythm] as [string, string, string, string] };
}

function createDefaultSettings(): GameSettings {
  return {
    muted: false,
    volume: 0.78,
    effectsVolume: 0.78,
    ambientVolume: 0.62,
    reduceMotion: false,
    locale: "zh",
    bindings: cloneBindings(defaultBindings)
  };
}

export const artifacts: Record<ArtifactId, Artifact> = {
  "badang-stone": localizedArtifact("badang-stone", "zh"),
  "rune-plaque": localizedArtifact("rune-plaque", "zh"),
  "harbor-seal": localizedArtifact("harbor-seal", "zh"),
  "spirit-chime": localizedArtifact("spirit-chime", "zh")
};

function createDefaultState(): GameState {
  return {
    inventory: [],
    flags: {
      jigsaw: false,
      runes: false,
      lock: false,
      rhythm: false
    },
    museum: {
      placements: {},
      visitors: 0,
      complete: false
    },
    dialogue: text(stateCopy.opening, "zh"),
    paused: false,
    easyMode: true,
    settings: createDefaultSettings(),
    performance: {
      fps: 60,
      longFrames: 0,
      inputLatency: 0,
      worstInputLatency: 0,
      interactionSamples: 0
    }
  };
}

export const gameState: GameState = createDefaultState();
let uiLocked = false;
let currentScene = "world";

function isArtifactId(value: unknown): value is ArtifactId {
  return typeof value === "string" && artifactIds.includes(value as ArtifactId);
}

function sanitizeBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function sanitizeVolume(value: unknown, fallback = 0.78) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback;
}

function sanitizeNonNegativeInteger(value: unknown, fallback = 0, max = Number.MAX_SAFE_INTEGER) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(0, Math.round(value)))
    : fallback;
}

function sanitizeBinding(value: unknown, fallback: string) {
  return typeof value === "string" && value.length > 0 && value.length < 32 ? value : fallback;
}

function sanitizeBindings(value: unknown, fallback: ControlBindings = defaultBindings): ControlBindings {
  const source =
    value && typeof value === "object" ? (value as Partial<ControlBindings>) : {};
  const rhythmSource = Array.isArray(source.rhythm) ? source.rhythm : fallback.rhythm;
  return {
    moveUp: sanitizeBinding(source.moveUp, fallback.moveUp),
    moveDown: sanitizeBinding(source.moveDown, fallback.moveDown),
    moveLeft: sanitizeBinding(source.moveLeft, fallback.moveLeft),
    moveRight: sanitizeBinding(source.moveRight, fallback.moveRight),
    action: sanitizeBinding(source.action, fallback.action),
    rhythm: [
      sanitizeBinding(rhythmSource[0], fallback.rhythm[0]),
      sanitizeBinding(rhythmSource[1], fallback.rhythm[1]),
      sanitizeBinding(rhythmSource[2], fallback.rhythm[2]),
      sanitizeBinding(rhythmSource[3], fallback.rhythm[3])
    ]
  };
}

function sanitizeSettings(value: unknown, fallback: GameSettings = createDefaultSettings()): GameSettings {
  const source = value && typeof value === "object" ? (value as Partial<GameSettings>) : {};
  return {
    muted: sanitizeBoolean(source.muted, fallback.muted),
    volume: sanitizeVolume(source.volume, fallback.volume),
    effectsVolume: sanitizeVolume(source.effectsVolume, fallback.effectsVolume),
    ambientVolume: sanitizeVolume(source.ambientVolume, fallback.ambientVolume),
    reduceMotion: sanitizeBoolean(source.reduceMotion, fallback.reduceMotion),
    locale: isLocale(source.locale) ? source.locale : fallback.locale,
    bindings: sanitizeBindings(source.bindings, fallback.bindings)
  };
}

function sanitizeFlags(value: unknown): Flags {
  const source = value && typeof value === "object" ? (value as Partial<Flags>) : {};
  return {
    jigsaw: source.jigsaw === true,
    runes: source.runes === true,
    lock: source.lock === true,
    rhythm: source.rhythm === true
  };
}

function sanitizeMuseum(value: unknown): MuseumState {
  const source = value && typeof value === "object" ? (value as Partial<MuseumState>) : {};
  const placements: Partial<Record<ArtifactId, number>> = {};
  if (source.placements && typeof source.placements === "object") {
    for (const [artifactId, slot] of Object.entries(source.placements)) {
      if (
        isArtifactId(artifactId) &&
        typeof slot === "number" &&
        Number.isInteger(slot) &&
        slot >= 0 &&
        slot <= 3
      ) {
        placements[artifactId] = slot;
      }
    }
  }
  return {
    placements,
    visitors: sanitizeNonNegativeInteger(source.visitors, 0, MAX_VISITORS),
    complete: sanitizeBoolean(source.complete)
  };
}

function sanitizePerformanceStats(stats: Partial<PerformanceStats>): PerformanceStats {
  return {
    fps: sanitizeNonNegativeInteger(stats.fps, gameState.performance.fps, 240),
    longFrames: sanitizeNonNegativeInteger(stats.longFrames, gameState.performance.longFrames),
    inputLatency: sanitizeNonNegativeInteger(stats.inputLatency, gameState.performance.inputLatency),
    worstInputLatency: sanitizeNonNegativeInteger(
      stats.worstInputLatency,
      gameState.performance.worstInputLatency
    ),
    interactionSamples: sanitizeNonNegativeInteger(
      stats.interactionSamples,
      gameState.performance.interactionSamples
    )
  };
}

function applyState(next: GameState) {
  gameState.inventory = next.inventory;
  gameState.flags = next.flags;
  gameState.museum = next.museum;
  gameState.dialogue = next.dialogue;
  gameState.paused = next.paused;
  gameState.easyMode = next.easyMode;
  gameState.settings = next.settings;
  gameState.performance = next.performance;
}

function serializeGameState() {
  return {
    version: SAVE_VERSION,
    inventoryIds: gameState.inventory.map((item) => item.id),
    flags: gameState.flags,
    museum: gameState.museum,
    dialogue: gameState.dialogue,
    easyMode: gameState.easyMode,
    settings: gameState.settings
  };
}

let lastSavedSerializedState = "";

function saveGameState() {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const serialized = JSON.stringify(serializeGameState());
    if (serialized === lastSavedSerializedState) {
      return;
    }
    window.localStorage.setItem(SAVE_KEY, serialized);
    lastSavedSerializedState = serialized;
  } catch {
    // Saving is best-effort; gameplay should continue if storage is unavailable.
  }
}

function loadPersistedState() {
  if (typeof window === "undefined") {
    return null;
  }
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(SAVE_KEY);
  } catch {
    return null;
  }
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as {
      version?: number;
      inventoryIds?: unknown[];
      flags?: unknown;
      museum?: unknown;
      dialogue?: unknown;
      easyMode?: unknown;
      settings?: unknown;
    };
    if (parsed.version !== SAVE_VERSION) {
      return null;
    }
    const defaults = createDefaultState();
    return {
      ...defaults,
      inventory: (parsed.inventoryIds ?? [])
        .filter(isArtifactId)
        .map((id) => artifacts[id]),
      flags: sanitizeFlags(parsed.flags),
      museum: sanitizeMuseum(parsed.museum),
      dialogue:
        typeof parsed.dialogue === "string" && parsed.dialogue.length > 0
          ? parsed.dialogue
          : defaults.dialogue,
      easyMode: typeof parsed.easyMode === "boolean" ? parsed.easyMode : defaults.easyMode,
      settings: sanitizeSettings(parsed.settings, defaults.settings)
    } satisfies GameState;
  } catch {
    return null;
  }
}

export function initializeGameState() {
  applyState(loadPersistedState() ?? createDefaultState());
  gameState.paused = false;
  uiLocked = false;
  emitGameState("world");
}

export function resetGameState() {
  const currentSettings = gameState.settings;
  applyState({ ...createDefaultState(), settings: currentSettings });
  uiLocked = false;
  emitGameState("world");
}

export function setUiLocked(locked: boolean) {
  uiLocked = locked;
}

export function isUiLocked() {
  return uiLocked;
}

export function clearSavedGame() {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(SAVE_KEY);
      lastSavedSerializedState = "";
    } catch {
      // Storage can be blocked; resetting in memory is still valid.
    }
  }
}

export function setPaused(paused: boolean) {
  gameState.paused = paused;
}

export function toggleEasyMode() {
  gameState.easyMode = !gameState.easyMode;
  gameState.dialogue = gameState.easyMode
    ? text(stateCopy.easyOn, gameState.settings.locale)
    : text(stateCopy.easyOff, gameState.settings.locale);
}

export function updateSettings(settings: Partial<GameSettings>) {
  const previousLocale = gameState.settings.locale;
  gameState.settings = sanitizeSettings({ ...gameState.settings, ...settings }, gameState.settings);
  if (gameState.settings.locale !== previousLocale) {
    gameState.dialogue = text(
      gameState.settings.locale === "en" ? stateCopy.languageEn : stateCopy.languageZh,
      gameState.settings.locale
    );
  }
}

export function toggleMuted() {
  gameState.settings.muted = !gameState.settings.muted;
  return gameState.settings.muted;
}

export function addArtifact(id: ArtifactId) {
  if (!gameState.inventory.some((item) => item.id === id)) {
    gameState.inventory.push(artifacts[id]);
  }
}

export function completedPuzzleCount() {
  return [gameState.flags.jigsaw, gameState.flags.runes, gameState.flags.lock].filter(Boolean)
    .length;
}

export function getObjective() {
  if (gameState.museum.complete) {
    return text(objectiveCopy.museumComplete, gameState.settings.locale);
  }

  if (gameState.flags.rhythm && gameState.inventory.length >= 4) {
    return text(objectiveCopy.returnToMuseum, gameState.settings.locale);
  }

  if (completedPuzzleCount() >= 2 && !gameState.flags.rhythm) {
    return text(objectiveCopy.goRitual, gameState.settings.locale);
  }

  if (!gameState.flags.jigsaw) {
    return text(objectiveCopy.startJigsaw, gameState.settings.locale);
  }

  if (!gameState.flags.runes) {
    return text(objectiveCopy.startRunes, gameState.settings.locale);
  }

  if (!gameState.flags.lock) {
    return text(objectiveCopy.startLock, gameState.settings.locale);
  }

  return text(objectiveCopy.continueRiver, gameState.settings.locale);
}

export function emitGameState(scene?: string) {
  if (typeof window === "undefined") {
    return;
  }
  if (scene !== undefined) {
    currentScene = scene;
  }

  window.dispatchEvent(
    new CustomEvent("lcw:state", {
      detail: {
        objective: getObjective(),
        inventory: gameState.inventory.map((item) =>
          localizedArtifact(item.id, gameState.settings.locale)
        ),
        visitors: gameState.museum.visitors,
        scene: sceneName(currentScene, gameState.settings.locale),
        completedPuzzles: completedPuzzleCount(),
        ritualComplete: gameState.flags.rhythm,
        museumComplete: gameState.museum.complete,
        easyMode: gameState.easyMode,
        dialogue: gameState.dialogue,
        settings: gameState.settings,
        performance: gameState.performance
      }
    })
  );
  saveGameState();
}

export function updatePerformanceStats(stats: PerformanceStats) {
  gameState.performance = sanitizePerformanceStats(stats);
}

export function serializeSaveString(): string {
  if (typeof window === "undefined") {
    return "";
  }
  const saveState = serializeGameState();
  return window.btoa(encodeURIComponent(JSON.stringify(saveState)));
}

export function importSaveString(saveStr: string): boolean {
  if (typeof window === "undefined" || !saveStr) {
    return false;
  }
  try {
    const raw = decodeURIComponent(window.atob(saveStr.trim()));
    const parsed = JSON.parse(raw) as {
      version?: number;
      inventoryIds?: unknown[];
      flags?: unknown;
      museum?: unknown;
      dialogue?: unknown;
      easyMode?: unknown;
      settings?: unknown;
    };
    if (parsed.version !== SAVE_VERSION) {
      return false;
    }
    const defaults = createDefaultState();
    const imported = {
      ...defaults,
      inventory: (parsed.inventoryIds ?? [])
        .filter(isArtifactId)
        .map((id) => artifacts[id]),
      flags: sanitizeFlags(parsed.flags),
      museum: sanitizeMuseum(parsed.museum),
      dialogue:
        typeof parsed.dialogue === "string" && parsed.dialogue.length > 0
          ? parsed.dialogue
          : defaults.dialogue,
      easyMode: typeof parsed.easyMode === "boolean" ? parsed.easyMode : defaults.easyMode,
      settings: sanitizeSettings(parsed.settings, defaults.settings)
    } satisfies GameState;
    applyState(imported);
    emitGameState("world");
    return true;
  } catch {
    return false;
  }
}
