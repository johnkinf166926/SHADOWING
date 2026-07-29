import { describe, expect, it } from "vitest";
import { calculateStudyStreak, studyDateKey } from "@/lib/study-date";

describe("study date", () => {
  it("uses the Tokyo calendar date around UTC midnight", () => {
    expect(studyDateKey(new Date("2026-07-29T14:59:59.000Z"))).toBe(
      "2026-07-29",
    );
    expect(studyDateKey(new Date("2026-07-29T15:00:00.000Z"))).toBe(
      "2026-07-30",
    );
  });

  it("counts a streak ending today", () => {
    expect(
      calculateStudyStreak(
        ["2026-07-29", "2026-07-28", "2026-07-27", "2026-07-25"],
        "2026-07-29",
      ),
    ).toBe(3);
  });

  it("keeps yesterday's streak before today's first practice", () => {
    expect(
      calculateStudyStreak(
        ["2026-07-28", "2026-07-27", "2026-07-26"],
        "2026-07-29",
      ),
    ).toBe(3);
  });
});
