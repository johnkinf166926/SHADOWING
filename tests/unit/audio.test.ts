import { describe, expect, it } from "vitest";
import {
  clampSeekTime,
  formatAudioTime,
  getActiveLine,
  getPlayableRange,
} from "@/lib/audio";
import type { DialogueLine } from "@/lib/types";

const lines: DialogueLine[] = [
  {
    id: "one",
    order: 1,
    speaker: "A",
    text: "一",
    startMs: 0,
    endMs: 1000,
  },
  {
    id: "two",
    order: 2,
    speaker: "B",
    text: "二",
    startMs: 1200,
    endMs: 2500,
  },
  { id: "three", order: 3, speaker: "A", text: "三" },
];

describe("audio line calculation", () => {
  it("finds a line inside its half-open time range", () => {
    expect(getActiveLine(lines, 0.5)?.id).toBe("one");
    expect(getActiveLine(lines, 1)).toBeUndefined();
    expect(getActiveLine(lines, 1.2)?.id).toBe("two");
  });

  it("returns no playable range for missing or invalid timing", () => {
    expect(getPlayableRange(lines[2])).toBeUndefined();
    expect(
      getPlayableRange({ ...lines[0], startMs: 1000, endMs: 1000 }),
    ).toBeUndefined();
  });

  it("clamps seeking and formats duration", () => {
    expect(clampSeekTime(20, 12)).toBe(12);
    expect(clampSeekTime(-1, 12)).toBe(0);
    expect(formatAudioTime(65.8)).toBe("1:05");
  });
});
