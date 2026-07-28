import type { DialogueLine } from "./types";

export function getActiveLine(
  lines: DialogueLine[],
  currentTimeSeconds: number,
): DialogueLine | undefined {
  const currentMs = currentTimeSeconds * 1_000;
  return lines.find((line) => {
    if (line.startMs === undefined || line.endMs === undefined) {
      return false;
    }
    return currentMs >= line.startMs && currentMs < line.endMs;
  });
}

export function getPlayableRange(
  line: DialogueLine | undefined,
): { start: number; end: number } | undefined {
  if (
    !line ||
    line.startMs === undefined ||
    line.endMs === undefined ||
    line.startMs >= line.endMs
  ) {
    return undefined;
  }
  return { start: line.startMs / 1_000, end: line.endMs / 1_000 };
}

export function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

export function clampSeekTime(value: number, duration: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(duration) || duration <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(value, duration));
}
