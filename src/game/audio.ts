import { assetPath } from "@/utils/assetPath";

let context: AudioContext | null = null;
let muted = false;
let masterVolume = 0.78;
let effectsVolume = 0.78;
let ambientVolume = 0.62;
let pageSuspended = false;
let ambientAllowed = true;
let ambient:
  | {
      oscillators: OscillatorNode[];
      gain: GainNode;
    }
  | null = null;

const audioAssetSources = {
  uiClick: assetPath("/assets/audio/ui-click.wav"),
  snap: assetPath("/assets/audio/snap.wav"),
  success: assetPath("/assets/audio/success.wav"),
  miss: assetPath("/assets/audio/miss.wav"),
  ritualPerfect: assetPath("/assets/audio/ritual-perfect.wav"),
  ritualGood: assetPath("/assets/audio/ritual-good.wav")
} as const;

type AudioAssetKey = keyof typeof audioAssetSources;

const audioPools = new Map<AudioAssetKey, HTMLAudioElement[]>();

function getContext() {
  if (typeof window === "undefined") {
    return null;
  }
  if (!context) {
    context = new AudioContext();
  }
  return context;
}

export function setAudioMuted(next: boolean) {
  muted = next;
  if (muted || pageSuspended || !ambientAllowed) {
    stopAmbient();
  } else if (context) {
    startAmbient();
  }
}

export function toggleAudioMuted() {
  setAudioMuted(!muted);
  return muted;
}

export function setAudioVolume(next: number) {
  masterVolume = Math.min(1, Math.max(0, Number.isFinite(next) ? next : 0.78));
  if (ambient) {
    ambient.gain.gain.value = muted ? 0 : masterVolume * ambientVolume * 0.014;
  }
  for (const pool of audioPools.values()) {
    for (const item of pool) {
      item.volume = masterVolume * effectsVolume;
    }
  }
}

export function setEffectsVolume(next: number) {
  effectsVolume = Math.min(1, Math.max(0, Number.isFinite(next) ? next : 0.78));
  for (const pool of audioPools.values()) {
    for (const item of pool) {
      item.volume = masterVolume * effectsVolume;
    }
  }
}

export function setAmbientVolume(next: number) {
  ambientVolume = Math.min(1, Math.max(0, Number.isFinite(next) ? next : 0.62));
  if (ambient) {
    ambient.gain.gain.value = muted ? 0 : masterVolume * ambientVolume * 0.014;
  }
}

export function setAudioPageSuspended(next: boolean) {
  pageSuspended = next;
  if (pageSuspended) {
    stopAmbient();
  } else if (!muted && ambientAllowed && context) {
    startAmbient();
  }
}

export function setAudioPaused(paused: boolean) {
  ambientAllowed = !paused;
  if (!ambientAllowed) {
    stopAmbient();
  } else if (!muted && !pageSuspended && context) {
    startAmbient();
  }
}

export function applyAudioSettings(settings: {
  muted: boolean;
  volume: number;
  effectsVolume?: number;
  ambientVolume?: number;
}) {
  setAudioVolume(settings.volume);
  setEffectsVolume(settings.effectsVolume ?? 0.78);
  setAmbientVolume(settings.ambientVolume ?? 0.62);
  setAudioMuted(settings.muted);
}

export function preloadAudioAssets() {
  if (typeof window === "undefined" || audioPools.size > 0) {
    return;
  }
  for (const [key, source] of Object.entries(audioAssetSources) as Array<
    [AudioAssetKey, string]
  >) {
    const pool = Array.from({ length: 3 }, () => {
      const audio = new Audio(source);
      audio.preload = "auto";
      audio.volume = masterVolume * effectsVolume;
      audio.load();
      return audio;
    });
    audioPools.set(key, pool);
  }
}

function playAudioAsset(key: AudioAssetKey, fallback: () => void) {
  if (muted || pageSuspended) {
    return;
  }
  const pool = audioPools.get(key);
  const audio = pool?.find((item) => item.paused) ?? pool?.[0];
  if (!audio) {
    fallback();
    return;
  }
  audio.pause();
  audio.currentTime = 0;
  audio.volume = masterVolume * effectsVolume;
  void audio.play().catch(fallback);
}

export function startAmbient() {
  if (muted || pageSuspended || !ambientAllowed || ambient || typeof window === "undefined") {
    return;
  }
  const ctx = getContext();
  if (!ctx) {
    return;
  }
  if (ctx.state === "suspended") {
    void ctx.resume();
  }
  const gain = ctx.createGain();
  gain.gain.value = masterVolume * ambientVolume * 0.014;
  gain.connect(ctx.destination);
  const low = ctx.createOscillator();
  const high = ctx.createOscillator();
  low.type = "sine";
  high.type = "triangle";
  low.frequency.value = 92;
  high.frequency.value = 184;
  low.connect(gain);
  high.connect(gain);
  low.start();
  high.start();
  ambient = { oscillators: [low, high], gain };
}

export function stopAmbient() {
  if (!ambient) {
    return;
  }
  for (const oscillator of ambient.oscillators) {
    oscillator.stop();
    oscillator.disconnect();
  }
  ambient.gain.disconnect();
  ambient = null;
}

export function playTone(
  frequency: number,
  duration = 0.12,
  type: OscillatorType = "sine",
  volume = 0.045
) {
  if (muted || pageSuspended) {
    return;
  }
  const ctx = getContext();
  if (!ctx) {
    return;
  }
  if (ctx.state === "suspended") {
    void ctx.resume();
  }
  startAmbient();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(
    volume * masterVolume * effectsVolume,
    ctx.currentTime + 0.012
  );
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + duration + 0.02);
}

export function playSequence(notes: Array<[number, number]>, type: OscillatorType = "sine") {
  let delay = 0;
  for (const [frequency, duration] of notes) {
    window.setTimeout(() => playTone(frequency, duration, type), delay);
    delay += duration * 1000 * 0.72;
  }
}

export function playUiClick() {
  playAudioAsset("uiClick", () => playTone(520, 0.06, "triangle", 0.025));
}

export function playSnap() {
  playAudioAsset("snap", () =>
    playSequence(
      [
        [460, 0.08],
        [690, 0.08]
      ],
      "triangle"
    )
  );
}

export function playSuccess() {
  playAudioAsset("success", () =>
    playSequence(
      [
        [523, 0.12],
        [659, 0.12],
        [880, 0.18]
      ],
      "sine"
    )
  );
}

export function playMiss() {
  playAudioAsset("miss", () => playTone(150, 0.18, "sawtooth", 0.025));
}

export function playRitualHit(perfect: boolean) {
  playAudioAsset(perfect ? "ritualPerfect" : "ritualGood", () =>
    playTone(perfect ? 880 : 660, perfect ? 0.09 : 0.07, "sine", perfect ? 0.042 : 0.03)
  );
}
