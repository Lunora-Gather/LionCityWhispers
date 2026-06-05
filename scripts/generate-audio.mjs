import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const sampleRate = 44100;
const outputDir = join(process.cwd(), "public", "assets", "audio");

const clips = {
  "ui-click.wav": {
    duration: 0.085,
    notes: [{ start: 0, duration: 0.07, frequency: 520, type: "triangle", gain: 0.38 }]
  },
  "snap.wav": {
    duration: 0.18,
    notes: [
      { start: 0, duration: 0.08, frequency: 460, type: "triangle", gain: 0.35 },
      { start: 0.065, duration: 0.09, frequency: 690, type: "triangle", gain: 0.34 }
    ]
  },
  "success.wav": {
    duration: 0.42,
    notes: [
      { start: 0, duration: 0.13, frequency: 523, type: "sine", gain: 0.28 },
      { start: 0.105, duration: 0.13, frequency: 659, type: "sine", gain: 0.28 },
      { start: 0.215, duration: 0.18, frequency: 880, type: "sine", gain: 0.3 }
    ]
  },
  "miss.wav": {
    duration: 0.22,
    notes: [{ start: 0, duration: 0.18, frequency: 150, type: "saw", gain: 0.18 }]
  },
  "ritual-perfect.wav": {
    duration: 0.12,
    notes: [{ start: 0, duration: 0.1, frequency: 880, type: "sine", gain: 0.3 }]
  },
  "ritual-good.wav": {
    duration: 0.1,
    notes: [{ start: 0, duration: 0.08, frequency: 660, type: "sine", gain: 0.24 }]
  }
};

function oscillator(phase, type) {
  if (type === "triangle") {
    return (2 / Math.PI) * Math.asin(Math.sin(phase));
  }
  if (type === "saw") {
    return 2 * (phase / (2 * Math.PI) - Math.floor(0.5 + phase / (2 * Math.PI)));
  }
  return Math.sin(phase);
}

function envelope(index, total) {
  const attack = Math.max(1, Math.floor(total * 0.08));
  const release = Math.max(1, Math.floor(total * 0.48));
  if (index < attack) {
    return index / attack;
  }
  const releaseStart = total - release;
  if (index > releaseStart) {
    return Math.max(0, (total - index) / release);
  }
  return 1;
}

function renderClip({ duration, notes }) {
  const length = Math.ceil(duration * sampleRate);
  const samples = new Float32Array(length);
  for (const note of notes) {
    const start = Math.floor(note.start * sampleRate);
    const total = Math.ceil(note.duration * sampleRate);
    for (let index = 0; index < total && start + index < length; index += 1) {
      const time = index / sampleRate;
      const phase = 2 * Math.PI * note.frequency * time;
      samples[start + index] += oscillator(phase, note.type) * envelope(index, total) * note.gain;
    }
  }
  return samples;
}

function writeString(buffer, offset, value) {
  for (let index = 0; index < value.length; index += 1) {
    buffer.writeUInt8(value.charCodeAt(index), offset + index);
  }
}

function encodeWav(samples) {
  const bytesPerSample = 2;
  const dataLength = samples.length * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataLength);
  writeString(buffer, 0, "RIFF");
  buffer.writeUInt32LE(36 + dataLength, 4);
  writeString(buffer, 8, "WAVE");
  writeString(buffer, 12, "fmt ");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * bytesPerSample, 28);
  buffer.writeUInt16LE(bytesPerSample, 32);
  buffer.writeUInt16LE(8 * bytesPerSample, 34);
  writeString(buffer, 36, "data");
  buffer.writeUInt32LE(dataLength, 40);
  for (let index = 0; index < samples.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[index]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + index * bytesPerSample);
  }
  return buffer;
}

await mkdir(outputDir, { recursive: true });
await Promise.all(
  Object.entries(clips).map(([name, clip]) =>
    writeFile(join(outputDir, name), encodeWav(renderClip(clip)))
  )
);
