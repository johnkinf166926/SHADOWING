import type { DialogueLine, PracticeMode } from "./types";

export const shadowingModes: Array<{
  value: PracticeMode;
  label: string;
  description: string;
}> = [
  {
    value: "SINGLE_LINE",
    label: "逐句跟读",
    description: "全部台词，逐句听录",
  },
  {
    value: "SPEAKER_A",
    label: "只练 A",
    description: "仅显示 A 的台词",
  },
  {
    value: "SPEAKER_B",
    label: "只练 B",
    description: "仅显示 B 的台词",
  },
];

export function shadowingLinesForMode(
  lines: DialogueLine[],
  mode: PracticeMode,
) {
  if (mode === "SPEAKER_A") {
    return lines.filter((line) => line.speaker === "A");
  }
  if (mode === "SPEAKER_B") {
    return lines.filter((line) => line.speaker === "B");
  }
  return lines;
}
