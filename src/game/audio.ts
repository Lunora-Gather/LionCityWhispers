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

export function resumeAudioContext() {
  if (typeof window === "undefined") {
    return;
  }
  const ctx = getContext();
  if (ctx && ctx.state === "suspended") {
    void ctx.resume();
  }
  startAmbient();
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

let generativeTimer: number | null = null;
const pentatonicScale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25];
let noiseSource: AudioBufferSourceNode | null = null;
let waveLfo: OscillatorNode | null = null;

function createNoiseNode(ctx: AudioContext) {
  const bufferSize = 2 * ctx.sampleRate;
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
  }
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer;
  source.loop = true;
  return source;
}

function startGenerativeMusic() {
  if (generativeTimer || typeof window === "undefined") return;
  const ctx = getContext();
  if (!ctx) return;
  
  const scheduleNext = () => {
    const delay = 8000 + Math.random() * 8000;
    generativeTimer = window.setTimeout(() => {
      if (muted || pageSuspended || !ambientAllowed) {
        scheduleNext();
        return;
      }
      const noteCount = 2 + Math.floor(Math.random() * 2);
      let arpeggioDelay = 0;
      for (let i = 0; i < noteCount; i++) {
        const freqIndex = Math.floor(Math.random() * pentatonicScale.length);
        const freq = pentatonicScale[freqIndex];
        window.setTimeout(() => {
          playTone(freq, 1.2, "sine", 0.008);
        }, arpeggioDelay);
        arpeggioDelay += 280 + Math.random() * 180;
      }
      scheduleNext();
    }, delay);
  };
  scheduleNext();
}

function stopGenerativeMusic() {
  if (generativeTimer) {
    window.clearTimeout(generativeTimer);
    generativeTimer = null;
  }
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
  
  try {
    noiseSource = createNoiseNode(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 320;
    filter.Q.value = 0.8;

    const waveGain = ctx.createGain();
    waveGain.gain.value = 0.08;

    waveLfo = ctx.createOscillator();
    waveLfo.type = "sine";
    waveLfo.frequency.value = 0.18;

    const waveLfoGain = ctx.createGain();
    waveLfoGain.gain.value = 0.05;

    waveLfo.connect(waveLfoGain);
    waveLfoGain.connect(waveGain.gain);
    noiseSource.connect(filter);
    filter.connect(waveGain);
    waveGain.connect(gain);

    noiseSource.start();
    waveLfo.start();
  } catch (err) {}

  ambient = { oscillators: [low, high], gain };
  startGenerativeMusic();
}

export function stopAmbient() {
  stopGenerativeMusic();
  try {
    if (noiseSource) {
      noiseSource.stop();
      noiseSource.disconnect();
      noiseSource = null;
    }
    if (waveLfo) {
      waveLfo.stop();
      waveLfo.disconnect();
      waveLfo = null;
    }
  } catch (err) {}

  if (!ambient) {
    return;
  }
  for (const oscillator of ambient.oscillators) {
    try {
      oscillator.stop();
      oscillator.disconnect();
    } catch (e) {}
  }
  try {
    ambient.gain.disconnect();
  } catch (e) {}
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

export function playAchievementFanfare() {
  playSequence([
    [523.25, 0.08],
    [659.25, 0.08],
    [783.99, 0.08],
    [1046.50, 0.24]
  ], "sine");
}

export function playRitualHit(perfect: boolean, lane?: number) {
  playAudioAsset(perfect ? "ritualPerfect" : "ritualGood", () => {
    const vol = perfect ? 0.022 : 0.014;
    const dur = perfect ? 0.45 : 0.32;
    if (lane !== undefined && lane >= 0 && lane <= 3) {
      const freqs = [
        [261.63, 392.00, 523.25], // Lane 0: C4-G4-C5
        [293.66, 440.00, 587.33], // Lane 1: D4-A4-D5
        [329.63, 493.88, 659.25], // Lane 2: E4-B4-E5
        [392.00, 587.33, 783.99]  // Lane 3: G4-D5-G5
      ][lane];
      for (const freq of freqs) {
        playTone(freq, dur, "sine", vol);
      }
    } else {
      playTone(perfect ? 880 : 660, perfect ? 0.09 : 0.07, "sine", perfect ? 0.042 : 0.03);
    }
  });
}
