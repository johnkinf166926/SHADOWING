import { failure, success } from "@/lib/api-response";
import { expressionReviewSchema } from "@/lib/content-schema";
import { masteryFromSchedule, scheduleReview } from "@/lib/review";
import { ensureDatabase, logServerError } from "@/lib/server/database";
import { getDatabase } from "@/lib/server/runtime";

interface ReviewRow {
  id: string;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  nextReviewAt: string;
}

export async function POST(request: Request) {
  try {
    const payload: unknown = await request.json();
    const parsed = expressionReviewSchema.safeParse(payload);
    if (!parsed.success) {
      return failure("VALIDATION_ERROR", "复习评分无效。", 422);
    }
    await ensureDatabase();
    const database = getDatabase();
    const existing = await database
      .prepare(
        `SELECT
          id,
          ease_factor AS easeFactor,
          interval_days AS intervalDays,
          repetitions,
          next_review_at AS nextReviewAt
         FROM review_items
         WHERE expression_id = ?
         ORDER BY updated_at DESC
         LIMIT 1`,
      )
      .bind(parsed.data.expressionId)
      .first<ReviewRow>();
    const now = new Date();
    const next = scheduleReview(
      existing
        ? {
            easeFactor: existing.easeFactor,
            intervalDays: existing.intervalDays,
            repetitions: existing.repetitions,
            nextReviewAt: new Date(existing.nextReviewAt),
          }
        : {
            easeFactor: 2.5,
            intervalDays: 0,
            repetitions: 0,
            nextReviewAt: now,
          },
      parsed.data.rating,
      now,
    );
    const masteryLevel = masteryFromSchedule(next);
    const nowIso = now.toISOString();
    const nextIso = next.nextReviewAt.toISOString();
    const statements: D1PreparedStatement[] = [];

    if (existing) {
      statements.push(
        database
          .prepare(
            `UPDATE review_items SET
              ease_factor = ?,
              interval_days = ?,
              repetitions = ?,
              next_review_at = ?,
              last_rating = ?,
              updated_at = ?
             WHERE id = ?`,
          )
          .bind(
            next.easeFactor,
            next.intervalDays,
            next.repetitions,
            nextIso,
            parsed.data.rating,
            nowIso,
            existing.id,
          ),
      );
    } else {
      statements.push(
        database
          .prepare(
            `INSERT INTO review_items
              (id, lesson_id, line_id, expression_id, ease_factor, interval_days, repetitions, next_review_at, last_rating, created_at, updated_at)
             VALUES (?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            crypto.randomUUID(),
            parsed.data.expressionId,
            next.easeFactor,
            next.intervalDays,
            next.repetitions,
            nextIso,
            parsed.data.rating,
            nowIso,
            nowIso,
          ),
      );
    }
    statements.push(
      database
        .prepare(
          "UPDATE expressions SET mastery_level = ?, next_review_at = ?, updated_at = ? WHERE id = ?",
        )
        .bind(masteryLevel, nextIso, nowIso, parsed.data.expressionId),
    );
    await database.batch(statements);

    return success(
      {
        nextReviewAt: nextIso,
        masteryLevel,
        intervalDays: next.intervalDays,
      },
      "复习计划已更新",
    );
  } catch (error) {
    logServerError("expressions.review.failed", error);
    return failure("REVIEW_SAVE_FAILED", "复习结果保存失败。", 500);
  }
}
