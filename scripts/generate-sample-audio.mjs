import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(root, "public/audio/sample-dialogue.wav");
const sampleRate = 44_100;
const durationSeconds = 16;
const sampleCount = sampleRate * durationSeconds;
const pcm = new Int16Array(sampleCount);

const phrases = [
  { start: 0, end: 3.8, base: 196 },
  { start: 4.0, end: 6.6, base: 247 },
  { start: 7.0, end: 11.2, base: 220 },
  { start: 11.6, end: 14.8, base: 277 },
];

for (const phrase of phrases) {
  const startSample = Math.floor(phrase.start * sampleRate);
  const endSample = Math.floor(phrase.end * sampleRate);
  for (let index = startSample; index < endSample; index += 1) {
    const localTime = (index - startSample) / sampleRate;
    const phraseDuration = phrase.end - phrase.start;
    const attack = Math.min(1, localTime / 0.08);
    const release = Math.min(1, (phraseDuration - localTime) / 0.18);
    const envelope = Math.max(0, Math.min(attack, release)) * 0.16;
    const syllablePulse = 0.62 + 0.38 * Math.sin(2 * Math.PI * 3.4 * localTime);
    const signal =
      Math.sin(2 * Math.PI * phrase.base * localTime) * 0.58 +
      Math.sin(2 * Math.PI * phrase.base * 1.5 * localTime) * 0.24 +
      Math.sin(2 * Math.PI * phrase.base * 2 * localTime) * 0.12;
    pcm[index] = Math.round(signal * envelope * syllablePulse * 32_767);
  }
}

const dataBytes = pcm.length * 2;
const wave = Buffer.alloc(44 + dataBytes);
wave.write("RIFF", 0);
wave.writeUInt32LE(36 + dataBytes, 4);
wave.write("WAVE", 8);
wave.write("fmt ", 12);
wave.writeUInt32LE(16, 16);
wave.writeUInt16LE(1, 20);
wave.writeUInt16LE(1, 22);
wave.writeUInt32LE(sampleRate, 24);
wave.writeUInt32LE(sampleRate * 2, 28);
wave.writeUInt16LE(2, 32);
wave.writeUInt16LE(16, 34);
wave.write("data", 36);
wave.writeUInt32LE(dataBytes, 40);
for (let index = 0; index < pcm.length; index += 1) {
  wave.writeInt16LE(pcm[index], 44 + index * 2);
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, wave);
console.log(`Generated ${outputPath}`);
