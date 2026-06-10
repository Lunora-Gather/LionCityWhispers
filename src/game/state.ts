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

function createDefaultSettings(): GameSettings {
  return {
    muted: false,
    volume: 0.78,
    effectsVolume: 0.78,
    ambientVolume: 0.62,
    reduceMotion: false,
    locale: "zh",
    bindings: { ...defaultBindings, rhythm: [...defaultBindings.rhythm] }
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

function sanitizeVolume(value: unknown, fallback = 0.78) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback;
}

function sanitizeBinding(value: unknown, fallback: string) {
  return typeof value === "string" && value.length > 0 && value.length < 32 ? value : fallback;
}

function sanitizeBindings(value: unknown): ControlBindings {
  const source =
    value && typeof value === "object" ? (value as Partial<ControlBindings>) : {};
  const rhythmSource = Array.isArray(source.rhythm) ? source.rhythm : defaultBindings.rhythm;
  return {
    moveUp: sanitizeBinding(source.moveUp, defaultBindings.moveUp),
    moveDown: sanitizeBinding(source.moveDown, defaultBindings.moveDown),
    moveLeft: sanitizeBinding(source.moveLeft, defaultBindings.moveLeft),
    moveRight: sanitizeBinding(source.moveRight, defaultBindings.moveRight),
    action: sanitizeBinding(source.action, defaultBindings.action),
    rhythm: [
      sanitizeBinding(rhythmSource[0], defaultBindings.rhythm[0]),
      sanitizeBinding(rhythmSource[1], defaultBindings.rhythm[1]),
      sanitizeBinding(rhythmSource[2], defaultBindings.rhythm[2]),
      sanitizeBinding(rhythmSource[3], defaultBindings.rhythm[3])
    ]
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

function saveGameState() {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(serializeGameState()));
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
      flags?: Partial<Flags>;
      museum?: Partial<MuseumState>;
      dialogue?: unknown;
      easyMode?: unknown;
      settings?: Partial<GameSettings>;
    };
    if (parsed.version !== SAVE_VERSION) {
      return null;
    }
    const defaults = createDefaultState();
    const placements: Partial<Record<ArtifactId, number>> = {};
    if (parsed.museum?.placements && typeof parsed.museum.placements === "object") {
      for (const [artifactId, slot] of Object.entries(parsed.museum.placements)) {
        if (isArtifactId(artifactId) && typeof slot === "number" && slot >= 0 && slot <= 3) {
          placements[artifactId] = slot;
        }
      }
    }
    return {
      ...defaults,
      inventory: (parsed.inventoryIds ?? [])
        .filter(isArtifactId)
        .map((id) => artifacts[id]),
      flags: {
        jigsaw: Boolean(parsed.flags?.jigsaw),
        runes: Boolean(parsed.flags?.runes),
        lock: Boolean(parsed.flags?.lock),
        rhythm: Boolean(parsed.flags?.rhythm)
      },
      museum: {
        placements,
        visitors:
          typeof parsed.museum?.visitors === "number" && Number.isFinite(parsed.museum.visitors)
            ? parsed.museum.visitors
            : 0,
        complete: Boolean(parsed.museum?.complete)
      },
      dialogue:
        typeof parsed.dialogue === "string" && parsed.dialogue.length > 0
          ? parsed.dialogue
          : defaults.dialogue,
      easyMode: typeof parsed.easyMode === "boolean" ? parsed.easyMode : defaults.easyMode,
      settings: {
        muted: Boolean(parsed.settings?.muted),
        volume: sanitizeVolume(parsed.settings?.volume),
        effectsVolume: sanitizeVolume(parsed.settings?.effectsVolume),
        ambientVolume: sanitizeVolume(parsed.settings?.ambientVolume, 0.62),
        reduceMotion: Boolean(parsed.settings?.reduceMotion),
        locale: isLocale(parsed.settings?.locale) ? parsed.settings.locale : "zh",
        bindings: sanitizeBindings(parsed.settings?.bindings)
      }
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
  gameState.settings = {
    ...gameState.settings,
    ...settings,
    volume: settings.volume === undefined ? gameState.settings.volume : sanitizeVolume(settings.volume),
    effectsVolume:
      settings.effectsVolume === undefined
        ? gameState.settings.effectsVolume
        : sanitizeVolume(settings.effectsVolume),
    ambientVolume:
      settings.ambientVolume === undefined
        ? gameState.settings.ambientVolume
        : sanitizeVolume(settings.ambientVolume, 0.62),
    bindings:
      settings.bindings === undefined
        ? gameState.settings.bindings
        : sanitizeBindings(settings.bindings),
    locale:
      settings.locale === undefined
        ? gameState.settings.locale
        : isLocale(settings.locale)
          ? settings.locale
          : gameState.settings.locale
  };
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
  gameState.performance = stats;
}
