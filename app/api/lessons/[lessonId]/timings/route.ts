import { z } from "zod";
import { failure, success } from "@/lib/api-response";
import { ensureDatabase, logServerError } from "@/lib/server/database";
import { getDatabase } from "@/lib/server/runtime";

const timingsSchema = z
  .object({
    lines: z
      .array(
        z.object({
          id: z.string().trim().min(1),
          startMs: z.number().int().nonnegative(),
          endMs: z.number().int().positive(),
        }),
      )
      .min(1)
      .max(500),
  })
  .superRefine(({ lines }, context) => {
    for (const [index, line] of lines.entries()) {
      if (line.endMs <= line.startMs) {
        context.addIssue({
          code: "custom",
          message: "每句结束时间必须晚于开始时间。",
          path: ["lines", index, "endMs"],
        });
      }
      const previous = lines[index - 1];
      if (previous && line.startMs < previous.endMs) {
        context.addIssue({
          code: "custom",
          message: "相邻句子的时间范围不能重叠。",
          path: ["lines", index, "startMs"],
        });
      }
    }
  });

interface RouteContext {
  params: Promise<{ lessonId: string }>;
}

interface StoredLine {
  id: string;
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { lessonId } = await context.params;
    const payload: unknown = await request.json();
    const parsed = timingsSchema.safeParse(payload);
    if (!parsed.success) {
      return failure(
        "VALIDATION_ERROR",
        "逐句时间轴格式不正确。",
        422,
        parsed.error.flatten(),
      );
    }

    await ensureDatabase();
    const database = getDatabase();
    const stored = await database
      .prepare(
        `SELECT dl.id
         FROM dialogue_lines dl
         INNER JOIN dialogues d ON d.id = dl.dialogue_id
         WHERE d.lesson_id = ?
         ORDER BY d.number ASC, dl.line_order ASC`,
      )
      .bind(lessonId)
      .all<StoredLine>();
    const storedLines = stored.results ?? [];
    if (!storedLines.length) {
      return failure("LESSON_NOT_FOUND", "找不到要写入时间轴的课程。", 404);
    }
    if (
      storedLines.length !== parsed.data.lines.length ||
      storedLines.some(
        (line, index) => line.id !== parsed.data.lines[index]?.id,
      )
    ) {
      return failure(
        "LINE_SET_MISMATCH",
        "时间轴中的句子与当前课程内容不一致，请重新生成。",
        409,
      );
    }

    const lastEndMs = parsed.data.lines.at(-1)?.endMs ?? 0;
    const audio = await database
      .prepare(
        `SELECT aa.duration_ms AS durationMs
         FROM lessons l
         LEFT JOIN audio_assets aa ON aa.id = l.audio_asset_id
         WHERE l.id = ?`,
      )
      .bind(lessonId)
      .first<{ durationMs: number | null }>();
    if (audio?.durationMs && lastEndMs > audio.durationMs + 1_000) {
      return failure(
        "TIMING_EXCEEDS_AUDIO",
        "时间轴超过了课程音频长度，请先重新关联正确音轨。",
        409,
      );
    }

    await database.batch(
      parsed.data.lines.map((line) =>
        database
          .prepare(
            `UPDATE dialogue_lines
             SET start_ms = ?, end_ms = ?
             WHERE id = ?`,
          )
          .bind(line.startMs, line.endMs, line.id),
      ),
    );

    return success(
      { lessonId, updatedLines: parsed.data.lines.length },
      "逐句时间轴已保存",
    );
  } catch (error) {
    logServerError("lesson-timings.update.failed", error);
    return failure("SAVE_FAILED", "逐句时间轴保存失败，请稍后重试。", 500);
  }
}
