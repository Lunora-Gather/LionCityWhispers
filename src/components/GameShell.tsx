import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Check,
  Circle,
  Gauge,
  Pause,
  RotateCcw,
  Settings,
  Trash2,
  Volume2,
  VolumeX,
  X
} from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { getCodexEntries, getEndingCopy } from "@/data/codex";
import { formatCopy, objectiveCopy, sceneName, sceneCopy, shellCopy, stateCopy, text, type Locale } from "@/data/i18n";
import { assetPath } from "@/utils/assetPath";

type ControlBindingId =
  | "moveUp"
  | "moveDown"
  | "moveLeft"
  | "moveRight"
  | "action"
  | "rhythm0"
  | "rhythm1"
  | "rhythm2"
  | "rhythm3";
type MovementBindingId = Exclude<ControlBindingId, `rhythm${number}`>;
type ShellUi = (typeof shellCopy)[Locale];

export type HudArtifact = {
  id: string;
  name: string;
  detail: string;
};

export type HudState = {
  objective: string;
  inventory: HudArtifact[];
  visitors: number;
  scene: string;
  completedPuzzles: number;
  ritualComplete: boolean;
  museumComplete: boolean;
  easyMode: boolean;
  dialogue: string;
  settings: {
    muted: boolean;
    volume: number;
    effectsVolume: number;
    ambientVolume: number;
    reduceMotion: boolean;
    locale: Locale;
    bindings: {
      moveUp: string;
      moveDown: string;
      moveLeft: string;
      moveRight: string;
      action: string;
      rhythm: [string, string, string, string];
    };
  };
  performance: {
    fps: number;
    longFrames: number;
    inputLatency: number;
    worstInputLatency: number;
    interactionSamples: number;
  };
};

const initialHud: HudState = {
  objective: text(objectiveCopy.startJigsaw, "zh"),
  inventory: [],
  visitors: 0,
  scene: sceneName("boot", "zh"),
  completedPuzzles: 0,
  ritualComplete: false,
  museumComplete: false,
  easyMode: true,
  dialogue: text(stateCopy.opening, "zh"),
  settings: {
    muted: false,
    volume: 0.78,
    effectsVolume: 0.78,
    ambientVolume: 0.62,
    reduceMotion: false,
    locale: "zh",
    bindings: {
      moveUp: "KeyW",
      moveDown: "KeyS",
      moveLeft: "KeyA",
      moveRight: "KeyD",
      action: "Space",
      rhythm: ["KeyA", "KeyS", "KeyD", "KeyF"]
    }
  },
  performance: {
    fps: 60,
    longFrames: 0,
    inputLatency: 0,
    worstInputLatency: 0,
    interactionSamples: 0
  }
};

const minimumLoadingProgress = 0.08;

const defaultBindings: HudState["settings"]["bindings"] = {
  moveUp: "KeyW",
  moveDown: "KeyS",
  moveLeft: "KeyA",
  moveRight: "KeyD",
  action: "Space",
  rhythm: ["KeyA", "KeyS", "KeyD", "KeyF"]
};

const movementBindingOrder: MovementBindingId[] = [
  "moveUp",
  "moveDown",
  "moveLeft",
  "moveRight",
  "action"
];

const rhythmBindingOrder: ControlBindingId[] = [
  "rhythm0",
  "rhythm1",
  "rhythm2",
  "rhythm3"
];

function readBinding(
  bindings: HudState["settings"]["bindings"],
  id: ControlBindingId
) {
  if (id.startsWith("rhythm")) {
    const lane = Number(id.replace("rhythm", ""));
    return bindings.rhythm[lane] ?? "";
  }
  return bindings[id as MovementBindingId];
}

function writeBinding(
  bindings: HudState["settings"]["bindings"],
  id: ControlBindingId,
  code: string
) {
  if (id.startsWith("rhythm")) {
    const lane = Number(id.replace("rhythm", ""));
    if (lane >= 0 && lane < bindings.rhythm.length) {
      bindings.rhythm[lane] = code;
    }
    return;
  }
  bindings[id as MovementBindingId] = code;
}

function uniqueBindings(
  current: HudState["settings"]["bindings"],
  target: ControlBindingId,
  code: string
) {
  const next = {
    ...current,
    rhythm: [...current.rhythm] as [string, string, string, string]
  };
  const previousCode = readBinding(next, target);
  const group = target.startsWith("rhythm") ? rhythmBindingOrder : movementBindingOrder;
  const duplicate = group.find((id) => id !== target && readBinding(next, id) === code);

  if (duplicate && previousCode) {
    writeBinding(next, duplicate, previousCode);
  }
  writeBinding(next, target, code);

  return next;
}

function keyLabel(code: string) {
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

function guidanceFor(hud: HudState, ui: ShellUi) {
  if (hud.museumComplete) {
    return ui.guidance.complete;
  }
  if (hud.ritualComplete && hud.inventory.length >= 4) {
    return ui.guidance.museum;
  }
  if (hud.completedPuzzles >= 2 && !hud.ritualComplete) {
    return ui.guidance.ritual;
  }
  if (hud.completedPuzzles === 0) {
    return ui.guidance.start;
  }
  if (hud.completedPuzzles === 1) {
    return ui.guidance.runes;
  }
  return ui.guidance.lock;
}

function isLocalSecureOrigin() {
  return window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";
}

function isDevPwaOptIn() {
  try {
    return (
      new URLSearchParams(window.location.search).get("pwa") === "1" ||
      window.localStorage.getItem("lcw:pwa-dev") === "1"
    );
  } catch {
    return false;
  }
}

function shouldUseServiceWorker() {
  return process.env.NODE_ENV === "production" || isDevPwaOptIn();
}

async function loadGameBootstrap() {
  try {
    return await import("@/game/bootstrap");
  } catch (error) {
    const message = error instanceof Error ? `${error.name} ${error.message}` : String(error);
    const isChunkLoadError = /ChunkLoadError|Failed to load chunk|Loading chunk/.test(message);
    if (isChunkLoadError && window.sessionStorage.getItem("lcw:chunk-reload") !== "1") {
      window.sessionStorage.setItem("lcw:chunk-reload", "1");
      window.location.reload();
      return null;
    }
    throw error;
  }
}

async function clearDevServiceWorkers() {
  if (!("serviceWorker" in navigator)) {
    return false;
  }
  const hadController = Boolean(navigator.serviceWorker.controller);
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("lion-city-whispers"))
          .map((key) => caches.delete(key))
      );
    }
  } catch {
    // Development cleanup is best-effort; production registration is handled separately.
  }
  return hadController;
}

export function GameShell() {
  const hostId = useMemo(() => "lion-city-game-host", []);
  const gameRef = useRef<{ destroy: () => void } | null>(null);
  const [hud, setHud] = useState<HudState>(initialHud);
  const [paused, setPaused] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [codexOpen, setCodexOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [loading, setLoading] = useState({ ready: false, progress: minimumLoadingProgress });
  const [listeningBinding, setListeningBinding] = useState<ControlBindingId | null>(null);
  const [bindingNotice, setBindingNotice] = useState("");
  const [updateReady, setUpdateReady] = useState(false);
  const ui = shellCopy[hud.settings.locale];
  const uiLocked = settingsOpen || codexOpen || resetConfirm || listeningBinding !== null;
  const stageStyle = {
    "--lcw-loading-bg": `url("${assetPath("/assets/images/lion-city-ink-bg.webp")}")`,
    "--lcw-artifact-sheet": `url("${assetPath("/assets/images/artifact-sheet.webp")}")`
  } as CSSProperties;

  useEffect(() => {
    let active = true;

    const onState = (event: Event) => {
      const custom = event as CustomEvent<HudState>;
      setHud((current) => ({ ...current, ...custom.detail }));
    };
    const onLoading = (event: Event) => {
      const detail = (event as CustomEvent<{ ready?: boolean; progress?: number }>).detail ?? {};
      setLoading((current) => ({
        ready: Boolean(detail.ready ?? current.ready),
        progress:
          typeof detail.progress === "number"
            ? detail.ready
              ? 1
              : Math.min(1, Math.max(minimumLoadingProgress, detail.progress))
            : current.progress
      }));
    };

    window.addEventListener("lcw:state", onState);
    window.addEventListener("lcw:loading", onLoading);

    const boot = async () => {
      if (!shouldUseServiceWorker()) {
        const hadController = await clearDevServiceWorkers();
        if (!active) {
          return;
        }
        if (hadController && window.sessionStorage.getItem("lcw:sw-dev-cleared") !== "1") {
          window.sessionStorage.setItem("lcw:sw-dev-cleared", "1");
          window.location.reload();
          return;
        }
      } else {
        window.sessionStorage.removeItem("lcw:sw-dev-cleared");
      }
      const bootstrap = await loadGameBootstrap();
      if (active && bootstrap) {
        window.sessionStorage.removeItem("lcw:chunk-reload");
        gameRef.current = bootstrap.startGame(hostId);
      }
    };
    boot();

    return () => {
      active = false;
      window.removeEventListener("lcw:state", onState);
      window.removeEventListener("lcw:loading", onLoading);
      gameRef.current?.destroy();
      gameRef.current = null;
    };
  }, [hostId]);

  useEffect(() => {
    const closePanels = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setListeningBinding(null);
        setSettingsOpen(false);
        setCodexOpen(false);
        setResetConfirm(false);
      }
    };
    window.addEventListener("keydown", closePanels);
    return () => window.removeEventListener("keydown", closePanels);
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("lcw:ui-lock", { detail: uiLocked }));
    return () => {
      window.dispatchEvent(new CustomEvent("lcw:ui-lock", { detail: false }));
    };
  }, [uiLocked]);

  useEffect(() => {
    if (!listeningBinding) {
      return;
    }
    const captureBinding = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const code = event.code || event.key;
      if (!code || code === "Escape") {
        setListeningBinding(null);
        return;
      }
      const group = listeningBinding.startsWith("rhythm") ? rhythmBindingOrder : movementBindingOrder;
      const duplicate = group.find(
        (id) => id !== listeningBinding && readBinding(hud.settings.bindings, id) === code
      );
      updateSettings({
        bindings: uniqueBindings(hud.settings.bindings, listeningBinding, code)
      });
      setBindingNotice(
        duplicate
          ? formatCopy(ui.keySwapNotice, {
              action: bindingLabel(listeningBinding),
              key: keyLabel(code),
              other: bindingLabel(duplicate)
            })
          : formatCopy(ui.keySetNotice, {
              action: bindingLabel(listeningBinding),
              key: keyLabel(code)
            })
      );
      setListeningBinding(null);
    };
    window.addEventListener("keydown", captureBinding, true);
    return () => window.removeEventListener("keydown", captureBinding, true);
  }, [hud.settings.bindings, listeningBinding, ui]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }
    if (!shouldUseServiceWorker()) {
      return;
    }
    if (window.location.protocol !== "https:" && !isLocalSecureOrigin()) {
      return;
    }
    const warmRuntimeCache = () => {
      const controller = navigator.serviceWorker.controller;
      if (!controller) {
        return;
      }
      const urls = performance
        .getEntriesByType("resource")
        .map((entry) => entry.name)
        .filter((url) => {
          try {
            const parsed = new URL(url);
            return parsed.origin === window.location.origin;
          } catch {
            return false;
          }
        });
      controller.postMessage({
        type: "CACHE_URLS",
        urls: [window.location.href, ...urls]
      });
    };
    let hadController = Boolean(navigator.serviceWorker.controller);
    const onControllerChange = () => {
      if (hadController) {
        setUpdateReady(true);
      }
      hadController = true;
      window.setTimeout(warmRuntimeCache, 800);
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    navigator.serviceWorker.register(assetPath("/sw.js")).then((registration) => {
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            setUpdateReady(true);
          }
        });
      });
      navigator.serviceWorker.ready.then(() => window.setTimeout(warmRuntimeCache, 800));
    }).catch(() => {
      // Offline caching is optional; the game remains playable when registration is blocked.
    });
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  useEffect(() => {
    const nextTitle =
      hud.settings.locale === "zh" ? `${ui.brand} | ${ui.subtitle}` : ui.brand;
    document.title = nextTitle;
    const titleTimer = window.setTimeout(() => {
      document.title = nextTitle;
    }, 0);
    return () => window.clearTimeout(titleTimer);
  }, [hud.settings.locale, ui.brand, ui.subtitle]);

  const togglePause = () => {
    const next = !paused;
    setPaused(next);
    window.dispatchEvent(new CustomEvent("lcw:pause", { detail: next }));
  };

  const sendMove = (x: number, y: number) => {
    window.dispatchEvent(new CustomEvent("lcw:virtual-move", { detail: { x, y } }));
  };

  const sendAction = () => {
    window.dispatchEvent(new CustomEvent("lcw:virtual-action"));
  };

  const sendRhythmLane = (lane: number) => {
    window.dispatchEvent(new CustomEvent("lcw:rhythm-hit", { detail: lane }));
  };

  const clearMove = () => sendMove(0, 0);
  const toggleAudio = () => {
    window.dispatchEvent(new CustomEvent("lcw:audio-toggle"));
  };

  const updateSettings = (detail: Partial<HudState["settings"]>) => {
    window.dispatchEvent(new CustomEvent("lcw:settings", { detail }));
  };

  const resetBindings = () => updateSettings({ bindings: defaultBindings });
  const applyUpdate = () => window.location.reload();

  const resetGame = () => {
    setPaused(false);
    setResetConfirm(false);
    window.dispatchEvent(new CustomEvent("lcw:reset"));
  };

  const codexEntries = useMemo(
    () => getCodexEntries(hud.settings.locale),
    [hud.settings.locale]
  );
  const endingCopy = useMemo(() => getEndingCopy(hud.settings.locale), [hud.settings.locale]);
  const unlockedIds = useMemo(() => new Set(hud.inventory.map((item) => item.id)), [hud.inventory]);
  const routeNodes = useMemo(() => {
    const hasBadangStone = unlockedIds.has("badang-stone");
    const hasRunePlaque = unlockedIds.has("rune-plaque");
    const hasHarborSeal = unlockedIds.has("harbor-seal");
    const hasSpiritChime = unlockedIds.has("spirit-chime") || hud.ritualComplete;
    const currentRouteKey = hud.museumComplete
      ? ""
      : !hasBadangStone
        ? "jigsaw"
        : hud.completedPuzzles >= 2 && !hasSpiritChime
          ? "ritual"
          : !hasRunePlaque
            ? "runes"
            : !hasHarborSeal
              ? "lock"
              : !hasSpiritChime
                ? "ritual"
                : "museum";
    const marks =
      hud.settings.locale === "zh"
        ? ["石", "文", "钥", "铃", "馆"]
        : ["ST", "RN", "GT", "CH", "MU"];
    const nodes = [
      { key: "jigsaw", label: ui.route.jigsaw, done: hasBadangStone, mark: marks[0] },
      { key: "runes", label: ui.route.runes, done: hasRunePlaque, mark: marks[1] },
      { key: "lock", label: ui.route.lock, done: hasHarborSeal, mark: marks[2] },
      { key: "ritual", label: ui.route.ritual, done: hasSpiritChime, mark: marks[3] },
      { key: "museum", label: ui.route.museum, done: hud.museumComplete, mark: marks[4] }
    ];

    return nodes.map((node) => {
      const state = node.done ? "done" : node.key === currentRouteKey ? "current" : "waiting";
      const status =
        state === "done" ? ui.route.done : state === "current" ? ui.route.current : ui.route.waiting;
      return { ...node, state, status };
    });
  }, [
    hud.completedPuzzles,
    hud.museumComplete,
    hud.ritualComplete,
    hud.settings.locale,
    ui.route,
    unlockedIds
  ]);
  const achievements = [
    { label: ui.achievementLabels.repaired, active: hud.museumComplete },
    { label: ui.achievementLabels.perfect, active: hud.visitors >= 200 },
    { label: ui.achievementLabels.ritual, active: hud.ritualComplete },
    { label: ui.achievementLabels.fullSet, active: hud.inventory.length >= 4 }
  ];
  const movementBindings: Array<{ id: MovementBindingId; label: string }> = [
    { id: "moveUp", label: ui.moveUpBinding },
    { id: "moveDown", label: ui.moveDownBinding },
    { id: "moveLeft", label: ui.moveLeftBinding },
    { id: "moveRight", label: ui.moveRightBinding },
    { id: "action", label: ui.actionBinding }
  ];
  const isRitualScene =
    hud.scene === shellCopy.zh.ritual || hud.scene === shellCopy.en.ritual;

  const isDialogueActive = useMemo(() => {
    return hud.scene === sceneCopy.zh.dialogue || hud.scene === sceneCopy.en.dialogue;
  }, [hud.scene]);

  const isPuzzleOrRitualActive = useMemo(() => {
    const s = hud.scene;
    return (
      s === sceneCopy.zh.jigsaw ||
      s === sceneCopy.en.jigsaw ||
      s === sceneCopy.zh.runes ||
      s === sceneCopy.en.runes ||
      s === sceneCopy.zh.lock ||
      s === sceneCopy.en.lock ||
      s === sceneCopy.zh.rhythm ||
      s === sceneCopy.en.rhythm
    );
  }, [hud.scene]);

  const currentGuidance = guidanceFor(hud, ui);
  const parsedDialogue = useMemo(() => {
    if (!hud.dialogue) return { speaker: "", message: "" };
    const match = hud.dialogue.match(/^([^：:]+)[：:]([\s\S]+)$/);
    if (match) {
      return { speaker: match[1].trim(), message: match[2].trim() };
    }
    return { speaker: "", message: hud.dialogue };
  }, [hud.dialogue]);

  const bindingLabel = (id: ControlBindingId) => {
    const movement = movementBindings.find((binding) => binding.id === id);
    if (movement) {
      return movement.label;
    }
    const lane = Number(id.replace("rhythm", ""));
    return `${ui.rhythmBinding} ${lane + 1}`;
  };
  const openChapter = (target: string) => {
    setSettingsOpen(false);
    setCodexOpen(false);
    window.dispatchEvent(new CustomEvent("lcw:chapter", { detail: target }));
  };

  return (
    <div className={`shell ${hud.settings.reduceMotion ? "reduced-motion" : ""}`}>
      <main className="stage" aria-label={ui.gameAria} style={stageStyle}>
        <div id={hostId} className="game-host" />
        {!loading.ready ? (
          <div className="loading-layer" role="status" aria-live="polite">
            <strong>{ui.loading}</strong>
            <span>{Math.round(loading.progress * 100)}%</span>
            <i style={{ transform: `scaleX(${Math.max(0.06, loading.progress)})` }} />
          </div>
        ) : null}

        <header className="hud hud-top">
          <section className="brand" aria-label={ui.gameTitleAria}>
            <span className="brand-mark" style={{ overflow: "hidden", padding: 0 }}>
              <img
                src={assetPath("/icon.svg")}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </span>
            <div>
              <h1>{ui.brand}</h1>
              <small>{ui.subtitle}</small>
            </div>
          </section>

          <section className="objective" aria-live="polite">
            <span>{ui.currentObjective}</span>
            <p>{hud.objective}</p>
            <small>
              <b>{ui.nextStep}</b>
              {currentGuidance}
            </small>
          </section>

          <nav className="toolbar" aria-label={ui.controls}>
            <button
              className="icon-button"
              type="button"
              aria-label={ui.codex}
              title={ui.codex}
              onClick={() => {
                setCodexOpen(true);
                setSettingsOpen(false);
              }}
            >
              <BookOpen size={18} />
            </button>
            <button
              className="icon-button"
              type="button"
              aria-label={hud.easyMode ? ui.difficultyEasy : ui.difficultyStandard}
              title={hud.easyMode ? ui.difficultyEasy : ui.difficultyStandard}
              onClick={() => window.dispatchEvent(new CustomEvent("lcw:difficulty"))}
            >
              <Gauge size={18} />
            </button>
            <button
              className="icon-button"
              type="button"
              aria-label={hud.settings.muted ? ui.audioOn : ui.audioOff}
              title={hud.settings.muted ? ui.audioOn : ui.audioOff}
              onClick={toggleAudio}
            >
              {hud.settings.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <button
              className="icon-button"
              type="button"
              aria-label={paused ? ui.resume : ui.pause}
              title={paused ? ui.resume : ui.pause}
              onClick={togglePause}
            >
              <Pause size={18} />
            </button>
            <button
              className="icon-button"
              type="button"
              aria-label={ui.restart}
              title={ui.restart}
              onClick={() => setResetConfirm(true)}
            >
              <RotateCcw size={18} />
            </button>
            <button
              className="icon-button"
              type="button"
              aria-label={ui.settings}
              title={ui.settings}
              onClick={() => {
                setSettingsOpen((current) => !current);
                setCodexOpen(false);
              }}
            >
              <Settings size={18} />
            </button>
          </nav>
        </header>

        <aside
          className={`hud progress-strip ${isPuzzleOrRitualActive ? "hud-hidden-in-puzzle" : ""}`}
          aria-label={ui.progress}
        >
          <span>
            {hud.completedPuzzles}/3 {ui.puzzles}
          </span>
          <span>{hud.ritualComplete ? ui.spiritClean : ui.spiritBlocked}</span>
          <span>
            {hud.visitors} {ui.visitors}
          </span>
          <span>{hud.museumComplete ? ui.exhibitionComplete : hud.scene}</span>
        </aside>

        <aside
          className={`hud route-rail ${isPuzzleOrRitualActive ? "hud-hidden-in-puzzle" : ""}`}
          aria-label={ui.route.aria}
        >
          {routeNodes.map((node, index) => (
            <Fragment key={node.key}>
              {index > 0 ? (
                <span
                  className={`route-connector ${
                    routeNodes[index - 1].state === "done" && node.state !== "waiting"
                      ? "active"
                      : ""
                  }`}
                  aria-hidden="true"
                />
              ) : null}
              <span
                className="route-step"
                data-state={node.state}
                aria-current={node.state === "current" ? "step" : undefined}
                aria-label={`${node.label} ${node.status}`}
              >
                <i aria-hidden="true">{node.mark}</i>
                <b>{node.label}</b>
                <small>{node.status}</small>
              </span>
            </Fragment>
          ))}
        </aside>

        <aside
          className={`hud inventory-dock ${isPuzzleOrRitualActive ? "hud-hidden-in-puzzle" : ""}`}
          aria-label={ui.inventory}
        >
          {hud.inventory.length === 0 ? (
            <span className="inventory-empty">{ui.inventoryEmpty}</span>
          ) : (
            hud.inventory.map((item) => (
              <button
                className={`artifact-pill artifact-${item.id}`}
                key={item.id}
                title={item.detail}
                type="button"
                onClick={() => setCodexOpen(true)}
              >
                <i />
                {item.name}
              </button>
            ))
          )}
        </aside>

        <section
          className={`hud dialogue-bar ${
            isPuzzleOrRitualActive || isDialogueActive || !hud.dialogue
              ? "hud-hidden-in-puzzle"
              : ""
          }`}
          aria-live="polite"
        >
          {parsedDialogue.speaker ? (
            <span className="dialogue-speaker">{parsedDialogue.speaker}</span>
          ) : null}
          <p>{parsedDialogue.message}</p>
        </section>

        {updateReady ? (
          <aside className="update-banner" role="status">
            <span>{ui.updateReady}</span>
            <button type="button" onClick={applyUpdate}>
              {ui.updateNow}
            </button>
          </aside>
        ) : null}

        {isRitualScene && uiLocked ? (
          <aside className="ritual-pause-banner" role="status">
            {ui.ritualPaused}
          </aside>
        ) : null}

        {hud.museumComplete ? (
          <aside className="completion-card" aria-label={ui.endingTitle}>
            <strong>{ui.endingTitle}</strong>
            <span>{ui.endingSummary}</span>
          </aside>
        ) : null}

        <p className="sr-only" aria-live="polite">
          {hud.objective} {currentGuidance} {hud.completedPuzzles}/3 {ui.puzzles}. {hud.visitors}{" "}
          {ui.visitors}.
        </p>

        {resetConfirm ? (
          <section className="modal-backdrop" role="dialog" aria-label={ui.resetAria}>
            <div className="confirm-panel">
              <p>{ui.resetWarning}</p>
              <div className="panel-actions">
                <button type="button" onClick={() => setResetConfirm(false)}>
                  <X size={16} />
                  {ui.cancel}
                </button>
                <button type="button" className="danger-action" onClick={resetGame}>
                  <Trash2 size={16} />
                  {ui.confirmReset}
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {settingsOpen ? (
          <section className="settings-panel" role="dialog" aria-label={ui.settings}>
            <header>
              <h2>{ui.settings}</h2>
              <button type="button" aria-label={ui.closeSettings} onClick={() => setSettingsOpen(false)}>
                <X size={16} />
              </button>
            </header>
            <div className="settings-section">
              <h3>{ui.settingsSections.experience}</h3>
              <div className="setting-row">
                <span>{ui.difficulty}</span>
                <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("lcw:difficulty"))}>
                  {hud.easyMode ? ui.easy : ui.standard}
                </button>
              </div>
              <div className="setting-row language-row">
                <span>{ui.language}</span>
                <div role="group" aria-label={ui.language}>
                  <button
                    type="button"
                    className={hud.settings.locale === "zh" ? "active-choice" : ""}
                    aria-pressed={hud.settings.locale === "zh"}
                    onClick={() => updateSettings({ locale: "zh" })}
                  >
                    {ui.zh}
                  </button>
                  <button
                    type="button"
                    className={hud.settings.locale === "en" ? "active-choice" : ""}
                    aria-pressed={hud.settings.locale === "en"}
                    onClick={() => updateSettings({ locale: "en" })}
                  >
                    {ui.en}
                  </button>
                </div>
              </div>
            </div>
            <div className="settings-section">
              <h3>{ui.settingsSections.audio}</h3>
              <label className="setting-row">
                <span>{ui.masterVolume}</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(hud.settings.volume * 100)}
                  onChange={(event) => updateSettings({ volume: Number(event.currentTarget.value) / 100 })}
                />
              </label>
              <label className="setting-row">
                <span>{ui.effectsVolume}</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(hud.settings.effectsVolume * 100)}
                  onChange={(event) =>
                    updateSettings({ effectsVolume: Number(event.currentTarget.value) / 100 })
                  }
                />
              </label>
              <label className="setting-row">
                <span>{ui.ambientVolume}</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(hud.settings.ambientVolume * 100)}
                  onChange={(event) =>
                    updateSettings({ ambientVolume: Number(event.currentTarget.value) / 100 })
                  }
                />
              </label>
              <label className="setting-row">
                <span>{ui.mute}</span>
                <input
                  type="checkbox"
                  checked={hud.settings.muted}
                  onChange={(event) => updateSettings({ muted: event.currentTarget.checked })}
                />
              </label>
            </div>
            <div className="settings-section">
              <h3>{ui.settingsSections.accessibility}</h3>
              <label className="setting-row">
                <span>{ui.reduceMotion}</span>
                <input
                  type="checkbox"
                  checked={hud.settings.reduceMotion}
                  onChange={(event) => updateSettings({ reduceMotion: event.currentTarget.checked })}
                />
              </label>
            </div>
            <div className="settings-section">
              <h3>{ui.settingsSections.performance}</h3>
              <div className="setting-row">
                <span>{ui.performance}</span>
                <strong>{hud.performance.fps} FPS</strong>
              </div>
              <div className="setting-row">
                <span>{ui.inputLatency}</span>
                <strong>{hud.performance.inputLatency} ms</strong>
              </div>
              <div className="setting-row">
                <span>{ui.worstInputLatency}</span>
                <strong>{hud.performance.worstInputLatency} ms</strong>
              </div>
              <div className="setting-row">
                <span>{ui.longFrames}</span>
                <strong>{hud.performance.longFrames}</strong>
              </div>
            </div>
            <div className="settings-group">
              <div className="settings-group-title">
                <span>{ui.settingsSections.controls}</span>
                <button type="button" onClick={resetBindings}>
                  {ui.resetKeys}
                </button>
              </div>
              <div className="binding-grid">
                {movementBindings.map((binding) => (
                  <button
                    type="button"
                    key={binding.id}
                    className={listeningBinding === binding.id ? "listening" : ""}
                    onClick={() => setListeningBinding(binding.id)}
                  >
                    <span>{binding.label}</span>
                    <strong>
                      {listeningBinding === binding.id
                        ? ui.waitingKey
                        : keyLabel(hud.settings.bindings[binding.id])}
                    </strong>
                  </button>
                ))}
              </div>
              <div className="binding-grid rhythm-binding-grid">
                {hud.settings.bindings.rhythm.map((code, index) => {
                  const id = `rhythm${index}` as ControlBindingId;
                  return (
                    <button
                      type="button"
                      key={id}
                      className={listeningBinding === id ? "listening" : ""}
                      onClick={() => setListeningBinding(id)}
                    >
                      <span>
                        {ui.rhythmBinding} {index + 1}
                      </span>
                      <strong>{listeningBinding === id ? ui.waitingKey : keyLabel(code)}</strong>
                    </button>
                  );
                })}
              </div>
              {bindingNotice ? <p className="binding-notice">{bindingNotice}</p> : null}
            </div>
            <div className="setting-row chapter-row">
              <span>{ui.settingsSections.revisit}</span>
              <div>
                <button type="button" onClick={() => openChapter("WorldScene")}>
                  {ui.river}
                </button>
                <button type="button" onClick={() => openChapter("MuseumScene")}>
                  {ui.gallery}
                </button>
                <button
                  type="button"
                  disabled={hud.completedPuzzles < 2}
                  onClick={() => openChapter("RhythmScene")}
                >
                  {ui.ritual}
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {codexOpen ? (
          <section className="codex-panel" role="dialog" aria-label={ui.codex}>
            <header>
              <h2>{ui.codex}</h2>
              <button type="button" aria-label={ui.closeCodex} onClick={() => setCodexOpen(false)}>
                <X size={16} />
              </button>
            </header>
            <div className="codex-list">
              {codexEntries.map((entry) => {
                const unlocked = unlockedIds.has(entry.id);
                return (
                  <article className={unlocked ? "codex-entry" : "codex-entry locked"} key={entry.id}>
                    {unlocked ? <span className={`codex-art codex-art-${entry.id}`} /> : null}
                    <div>
                      <h3>{unlocked ? entry.name : ui.lockedArtifact}</h3>
                      <small>{unlocked ? entry.era : ui.lockedEra}</small>
                      <p>{unlocked ? entry.clue : ui.lockedClue}</p>
                      {unlocked ? <p>{entry.exhibit}</p> : null}
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="achievement-list" aria-label={ui.achievements}>
              {achievements.map((achievement) => (
                <span className={achievement.active ? "earned" : ""} key={achievement.label}>
                  {achievement.label}
                </span>
              ))}
            </div>
            {hud.museumComplete ? (
              <footer className="ending-note">
                <Check size={16} />
                <p>{hud.visitors >= 200 ? endingCopy.perfect : endingCopy.repaired}</p>
              </footer>
            ) : null}
          </section>
        ) : null}

        {isRitualScene ? (
          <nav className="touch-controls rhythm-controls" aria-label={ui.rhythmControls}>
            {hud.settings.bindings.rhythm.map((code, lane) => (
              <button
                key={`${code}-${lane}`}
                type="button"
                aria-label={`${keyLabel(code)} ${ui.lane}`}
                onPointerDown={() => sendRhythmLane(lane)}
              >
                {keyLabel(code)}
              </button>
            ))}
          </nav>
        ) : (
          <nav className="touch-controls" aria-label={ui.touchControls}>
            <div className="touch-pad">
              <button
                type="button"
                aria-label={ui.moveUp}
                onPointerDown={() => sendMove(0, -1)}
                onPointerUp={clearMove}
                onPointerCancel={clearMove}
                onPointerLeave={clearMove}
              >
                <ArrowUp size={17} />
              </button>
              <button
                type="button"
                aria-label={ui.moveLeft}
                onPointerDown={() => sendMove(-1, 0)}
                onPointerUp={clearMove}
                onPointerCancel={clearMove}
                onPointerLeave={clearMove}
              >
                <ArrowLeft size={17} />
              </button>
              <button
                type="button"
                aria-label={ui.moveDown}
                onPointerDown={() => sendMove(0, 1)}
                onPointerUp={clearMove}
                onPointerCancel={clearMove}
                onPointerLeave={clearMove}
              >
                <ArrowDown size={17} />
              </button>
              <button
                type="button"
                aria-label={ui.moveRight}
                onPointerDown={() => sendMove(1, 0)}
                onPointerUp={clearMove}
                onPointerCancel={clearMove}
                onPointerLeave={clearMove}
              >
                <ArrowRight size={17} />
              </button>
            </div>
            <button className="touch-action" type="button" aria-label={ui.interact} onClick={sendAction}>
              <Circle size={18} />
            </button>
          </nav>
        )}
      </main>
    </div>
  );
}
