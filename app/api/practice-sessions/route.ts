import { failure, success } from "@/lib/api-response";
import { practiceRecordSchema } from "@/lib/content-schema";
import { ensureDatabase, logServerError } from "@/lib/server/database";
import { getDatabase } from "@/lib/server/runtime";
import { studyDateKey } from "@/lib/study-date";

export async function POST(request: Request) {
  try {
    const payload: unknown = await request.json();
    const parsed = practiceRecordSchema.safeParse(payload);
    if (!parsed.success) {
      return failure(
        "VALIDATION_ERROR",
        "练习记录不完整，请检查自评分与时长。",
        422,
        parsed.error.flatten(),
      );
    }
    await ensureDatabase();
    const database = getDatabase();
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const studyDate = studyDateKey(new Date(parsed.data.startedAt));
    await database.batch([
      database
        .prepare(
          `INSERT INTO practice_sessions
          (id, lesson_id, dialogue_id, line_id, mode, started_at, duration_ms, recording_path, self_pronunciation_score, self_rhythm_score, self_fluency_score, started_within_target, completed, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          id,
          parsed.data.lessonId,
          parsed.data.dialogueId ?? null,
          parsed.data.lineId ?? null,
          parsed.data.mode,
          parsed.data.startedAt,
          parsed.data.durationMs,
          parsed.data.recordingPath ?? null,
          parsed.data.selfPronunciationScore ?? null,
          parsed.data.selfRhythmScore ?? null,
          parsed.data.selfFluencyScore ?? null,
          parsed.data.startedWithinTarget === undefined
            ? null
            : Number(parsed.data.startedWithinTarget),
          Number(parsed.data.completed),
          parsed.data.note ?? null,
          createdAt,
        ),
      database
        .prepare(
          `INSERT INTO daily_study_logs
          (id, study_date, duration_ms, lesson_count, created_at, updated_at)
         VALUES (?, ?, ?, 1, ?, ?)
         ON CONFLICT(study_date) DO UPDATE SET
          duration_ms = duration_ms + excluded.duration_ms,
          lesson_count = lesson_count + 1,
          updated_at = excluded.updated_at`,
        )
        .bind(
          crypto.randomUUID(),
          studyDate,
          parsed.data.durationMs,
          createdAt,
          createdAt,
        ),
      database
        .prepare(
          `UPDATE lessons
           SET status = CASE
             WHEN ? = 1 THEN 'COMPLETED'
             WHEN status = 'NOT_STARTED' THEN 'IN_PROGRESS'
             ELSE status
           END,
           updated_at = ?
           WHERE id = ?`,
        )
        .bind(Number(parsed.data.completed), createdAt, parsed.data.lessonId),
    ]);
    return success({ id }, "练习记录已保存", { status: 201 });
  } catch (error) {
    logServerError("practice.save.failed", error);
    return failure(
      "PRACTICE_SAVE_FAILED",
      "练习记录保存失败，请稍后重试。",
      500,
    );
  }
}
