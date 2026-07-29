import { describe, expect, it } from "vitest";
import { shadowingLinesForMode, shadowingModes } from "@/lib/shadowing";
import type { DialogueLine } from "@/lib/types";

const lines: DialogueLine[] = [
  { id: "a-1", order: 1, speaker: "A", text: "A1" },
  { id: "b-1", order: 2, speaker: "B", text: "B1" },
  { id: "a-2", order: 3, speaker: "A", text: "A2" },
];

describe("shadowing modes", () => {
  it("exposes only the three modes backed by distinct behavior", () => {
    expect(shadowingModes.map((mode) => mode.value)).toEqual([
      "SINGLE_LINE",
      "SPEAKER_A",
      "SPEAKER_B",
    ]);
  });

  it("keeps every line in normal line-by-line practice", () => {
    expect(shadowingLinesForMode(lines, "SINGLE_LINE")).toEqual(lines);
  });

  it("filters the line list for A and B practice", () => {
    expect(
      shadowingLinesForMode(lines, "SPEAKER_A").map((line) => line.id),
    ).toEqual(["a-1", "a-2"]);
    expect(
      shadowingLinesForMode(lines, "SPEAKER_B").map((line) => line.id),
    ).toEqual(["b-1"]);
  });
});
