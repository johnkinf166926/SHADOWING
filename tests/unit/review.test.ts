import { describe, expect, it } from "vitest";
import { masteryFromSchedule, scheduleReview } from "@/lib/review";

const now = new Date("2026-07-24T00:00:00.000Z");
const initial = {
  easeFactor: 2.5,
  intervalDays: 0,
  repetitions: 0,
  nextReviewAt: now,
};

describe("spaced repetition", () => {
  it("resets progress when the expression is not known", () => {
    const next = scheduleReview(
      { ...initial, repetitions: 4, intervalDays: 16 },
      "AGAIN",
      now,
    );
    expect(next.repetitions).toBe(0);
    expect(next.intervalDays).toBe(1);
    expect(next.nextReviewAt.toISOString()).toBe("2026-07-25T00:00:00.000Z");
  });

  it("grows the interval for known cards", () => {
    const first = scheduleReview(initial, "KNOW", now);
    const second = scheduleReview(first, "KNOW", now);
    const third = scheduleReview(second, "KNOW", now);
    expect(first.intervalDays).toBe(1);
    expect(second.intervalDays).toBe(6);
    expect(third.intervalDays).toBeGreaterThan(6);
    expect(masteryFromSchedule(third)).toBe(3);
  });

  it("uses a shorter interval for uncertain cards", () => {
    const next = scheduleReview(
      { ...initial, repetitions: 2, intervalDays: 6 },
      "UNCERTAIN",
      now,
    );
    expect(next.intervalDays).toBe(8);
    expect(next.easeFactor).toBeLessThan(2.5);
  });
});
