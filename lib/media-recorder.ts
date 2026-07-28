export const recordingMimeCandidates = [
  "audio/webm;codecs=opus",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/webm",
] as const;

export function selectRecordingMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") {
    return undefined;
  }
  return recordingMimeCandidates.find((type) =>
    MediaRecorder.isTypeSupported(type),
  );
}

export function supportsRecording(): boolean {
  return (
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== "undefined"
  );
}

export async function readWaveform(
  blob: Blob,
  barCount = 72,
): Promise<number[]> {
  const AudioContextClass =
    window.AudioContext ??
    (
      window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }
    ).webkitAudioContext;
  if (!AudioContextClass) {
    return fallbackWaveform(barCount);
  }

  const context = new AudioContextClass();
  try {
    const buffer = await context.decodeAudioData(await blob.arrayBuffer());
    const channel = buffer.getChannelData(0);
    const blockSize = Math.max(1, Math.floor(channel.length / barCount));
    return Array.from({ length: barCount }, (_, barIndex) => {
      let sum = 0;
      const start = barIndex * blockSize;
      const end = Math.min(channel.length, start + blockSize);
      for (let index = start; index < end; index += 1) {
        sum += Math.abs(channel[index]);
      }
      const average = end > start ? sum / (end - start) : 0;
      return Math.max(0.08, Math.min(1, average * 5));
    });
  } catch {
    return fallbackWaveform(barCount);
  } finally {
    await context.close();
  }
}

export function fallbackWaveform(barCount = 72): number[] {
  return Array.from({ length: barCount }, (_, index) => {
    const phrase = 0.36 + Math.sin(index * 0.44) * 0.18;
    const syllable = Math.abs(Math.sin(index * 1.31)) * 0.45;
    return Math.max(0.09, Math.min(0.95, phrase + syllable));
  });
}
