import { z } from "zod";
import { failure, success } from "@/lib/api-response";
import { ensureDatabase, logServerError } from "@/lib/server/database";
import { getDatabase } from "@/lib/server/runtime";

const contentUpdateSchema = z
  .object({
    speaker: z.enum(["A", "B", "NARRATOR"]).optional(),
    text: z.string().trim().min(1).max(2_000).optional(),
    translationZh: z.string().trim().max(4_000).optional(),
  })
  .refine(
    (value) =>
      value.speaker !== undefined ||
      value.text !== undefined ||
      value.translationZh !== undefined,
    {
      message: "至少需要提供一项文本内容。",
    },
  );
const timingUpdateSchema = z
  .object({
    startMs: z.number().int().nonnegative(),
    endMs: z.number().int().positive(),
  })
  .refine((value) => value.endMs - value.startMs >= 100, {
    message: "单句时间至少需要 0.1 秒。",
    path: ["endMs"],
  });
const lineUpdateSchema = z.union([contentUpdateSchema, timingUpdateSchema]);

interface TimingRow {
  id: string;
  startMs: number | null;
  endMs: number | null;
}

interface RouteContext {
  params: Promise<{ lineId: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { lineId } = await context.params;
    const payload: unknown = await request.json();
    const parsed = lineUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      return failure(
        "VALIDATION_ERROR",
        "原文、中文翻译或逐句时间格式不正确。",
        422,
      );
    }

    await ensureDatabase();
    const database = getDatabase();
    if (!("startMs" in parsed.data)) {
      const current = await database
        .prepare(
          `SELECT speaker, text, translation_zh AS translationZh
           FROM dialogue_lines
           WHERE id = ?`,
        )
        .bind(lineId)
        .first<{
          speaker: "A" | "B" | "NARRATOR";
          text: string;
          translationZh: string | null;
        }>();
      if (!current) {
        return failure("LINE_NOT_FOUND", "找不到要修改的台词。", 404);
      }
      const speaker = parsed.data.speaker ?? current.speaker;
      const text = parsed.data.text ?? current.text;
      const translationZh =
        parsed.data.translationZh ?? current.translationZh ?? "";
      await database
        .prepare(
          `UPDATE dialogue_lines
           SET speaker = ?, text = ?, translation_zh = ?
           WHERE id = ?`,
        )
        .bind(speaker, text, translationZh, lineId)
        .run();
      return success(
        { id: lineId, speaker, text, translationZh },
        "原文和中文翻译已保存",
      );
    }

    const owner = await database
      .prepare(
        `SELECT d.lesson_id AS lessonId, aa.duration_ms AS durationMs
         FROM dialogue_lines dl
         INNER JOIN dialogues d ON d.id = dl.dialogue_id
         INNER JOIN lessons l ON l.id = d.lesson_id
         LEFT JOIN audio_assets aa ON aa.id = l.audio_asset_id
         WHERE dl.id = ?`,
      )
      .bind(lineId)
      .first<{ lessonId: string; durationMs: number | null }>();
    if (!owner) {
      return failure("LINE_NOT_FOUND", "找不到要校准的台词。", 404);
    }
    if (owner.durationMs !== null && parsed.data.endMs > owner.durationMs) {
      return failure("TIMING_EXCEEDS_AUDIO", "结束时间不能超过音频长度。", 422);
    }

    const stored = await database
      .prepare(
        `SELECT
          dl.id,
          dl.start_ms AS startMs,
          dl.end_ms AS endMs
         FROM dialogue_lines dl
         INNER JOIN dialogues d ON d.id = dl.dialogue_id
         WHERE d.lesson_id = ?
         ORDER BY d.number ASC, dl.line_order ASC`,
      )
      .bind(owner.lessonId)
      .all<TimingRow>();
    const lineIndex = stored.results.findIndex((line) => line.id === lineId);
    if (lineIndex < 0) {
      return failure("LINE_NOT_FOUND", "找不到要校准的台词。", 404);
    }
    const current = stored.results[lineIndex];
    const previous = stored.results[lineIndex - 1];
    const next = stored.results[lineIndex + 1];
    if (
      current.startMs !== parsed.data.startMs &&
      previous?.startMs !== null &&
      previous?.startMs !== undefined &&
      parsed.data.startMs - previous.startMs < 100
    ) {
      return failure(
        "TIMING_TOO_SHORT",
        "开始时间不能让上一句短于 0.1 秒。",
        422,
      );
    }
    if (
      current.endMs !== parsed.data.endMs &&
      next?.endMs !== null &&
      next?.endMs !== undefined &&
      next.endMs - parsed.data.endMs < 100
    ) {
      return failure(
        "TIMING_TOO_SHORT",
        "结束时间不能让下一句短于 0.1 秒。",
        422,
      );
    }

    const statements = [
      database
        .prepare(
          "UPDATE dialogue_lines SET start_ms = ?, end_ms = ? WHERE id = ?",
        )
        .bind(parsed.data.startMs, parsed.data.endMs, lineId),
    ];
    const updatedLines = [
      {
        id: lineId,
        startMs: parsed.data.startMs,
        endMs: parsed.data.endMs,
      },
    ];
    if (
      current.startMs !== parsed.data.startMs &&
      previous?.startMs !== null &&
      previous?.startMs !== undefined
    ) {
      statements.push(
        database
          .prepare("UPDATE dialogue_lines SET end_ms = ? WHERE id = ?")
          .bind(parsed.data.startMs, previous.id),
      );
      updatedLines.push({
        id: previous.id,
        startMs: previous.startMs,
        endMs: parsed.data.startMs,
      });
    }
    if (
      current.endMs !== parsed.data.endMs &&
      next?.endMs !== null &&
      next?.endMs !== undefined
    ) {
      statements.push(
        database
          .prepare("UPDATE dialogue_lines SET start_ms = ? WHERE id = ?")
          .bind(parsed.data.endMs, next.id),
      );
      updatedLines.push({
        id: next.id,
        startMs: parsed.data.endMs,
        endMs: next.endMs,
      });
    }
    await database.batch(statements);

    return success(
      {
        id: lineId,
        startMs: parsed.data.startMs,
        endMs: parsed.data.endMs,
        updatedLines,
      },
      "逐句时间已保存",
    );
  } catch (error) {
    logServerError("dialogue-line.update.failed", error);
    return failure("SAVE_FAILED", "保存失败，请稍后重试。", 500);
  }
}
