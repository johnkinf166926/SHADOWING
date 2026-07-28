export type ReviewRating = "KNOW" | "UNCERTAIN" | "AGAIN";

export interface ReviewState {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  nextReviewAt: Date;
}

export function scheduleReview(
  previous: ReviewState,
  rating: ReviewRating,
  now = new Date(),
): ReviewState {
  let easeFactor = previous.easeFactor;
  let repetitions = previous.repetitions;
  let intervalDays: number;

  if (rating === "AGAIN") {
    repetitions = 0;
    intervalDays = 1;
    easeFactor = Math.max(1.3, easeFactor - 0.2);
  } else if (rating === "UNCERTAIN") {
    repetitions += 1;
    intervalDays =
      repetitions <= 1
        ? 1
        : Math.max(2, Math.round(previous.intervalDays * 1.35));
    easeFactor = Math.max(1.3, easeFactor - 0.08);
  } else {
    repetitions += 1;
    if (repetitions === 1) {
      intervalDays = 1;
    } else if (repetitions === 2) {
      intervalDays = 6;
    } else {
      intervalDays = Math.max(
        7,
        Math.round(Math.max(1, previous.intervalDays) * easeFactor),
      );
    }
    easeFactor = Math.min(3, easeFactor + 0.06);
  }

  const nextReviewAt = new Date(now);
  nextReviewAt.setUTCDate(nextReviewAt.getUTCDate() + intervalDays);
  return { easeFactor, intervalDays, repetitions, nextReviewAt };
}

export function masteryFromSchedule(
  state: Pick<ReviewState, "intervalDays" | "repetitions">,
): number {
  if (state.repetitions === 0) {
    return 0;
  }
  if (state.intervalDays <= 2) {
    return 1;
  }
  if (state.intervalDays <= 10) {
    return 2;
  }
  return 3;
}
