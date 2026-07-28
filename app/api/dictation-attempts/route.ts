import { failure, success } from "@/lib/api-response";
import { dictationAttemptSchema } from "@/lib/content-schema";
import { ensureDatabase, logServerError } from "@/lib/server/database";
import { getDatabase } from "@/lib/server/runtime";

export async function POST(request: Request) {
  try {
    const payload: unknown = await request.json();
    const parsed = dictationAttemptSchema.safeParse(payload);
    if (!parsed.success) {
      return failure(
        "VALIDATION_ERROR",
        "听写结果格式不正确。",
        422,
        parsed.error.flatten(),
      );
    }
    await ensureDatabase();
    const database = getDatabase();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const statements: D1PreparedStatement[] = [
      database
        .prepare(
          `INSERT INTO dictation_attempts
            (id, lesson_id, line_id, answer, normalized, accuracy, correct, diff_json, added_to_review, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          id,
          parsed.data.lessonId,
          parsed.data.lineId,
          parsed.data.answer,
          parsed.data.normalized,
          parsed.data.accuracy,
          Number(parsed.data.correct),
          JSON.stringify(parsed.data.diff),
          Number(parsed.data.addedToReview),
          now,
        ),
    ];

    if (parsed.data.addedToReview) {
      statements.push(
        database
          .prepare(
            `INSERT INTO review_items
              (id, lesson_id, line_id, expression_id, ease_factor, interval_days, repetitions, next_review_at, last_rating, created_at, updated_at)
             VALUES (?, ?, ?, NULL, 2.5, 0, 0, ?, 'AGAIN', ?, ?)`,
          )
          .bind(
            crypto.randomUUID(),
            parsed.data.lessonId,
            parsed.data.lineId,
            now,
            now,
            now,
          ),
      );
    }

    await database.batch(statements);
    return success({ id }, "听写结果已保存", { status: 201 });
  } catch (error) {
    logServerError("dictation.save.failed", error);
    return failure(
      "DICTATION_SAVE_FAILED",
      "听写结果保存失败，请稍后重试。",
      500,
    );
  }
}
