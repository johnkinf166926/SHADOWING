import { z } from "zod";
import { failure, success } from "@/lib/api-response";
import { ensureDatabase, logServerError } from "@/lib/server/database";
import { getDatabase } from "@/lib/server/runtime";

const speakerSchema = z.enum(["A", "B", "NARRATOR"]);
const splitLineSchema = z.object({
  speaker: speakerSchema,
  text: z.string().trim().min(1).max(2_000),
  translationZh: z.string().trim().max(4_000),
});
const splitSchema = z.object({
  current: splitLineSchema,
  next: splitLineSchema,
  splitAtMs: z.number().int().nonnegative().optional(),
});

interface StoredLine {
  dialogueId: string;
  order: number;
  startMs: number | null;
  endMs: number | null;
  note: string | null;
}

interface FollowingLine {
  id: string;
  order: number;
}

interface RouteContext {
  params: Promise<{ lineId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { lineId } = await context.params;
    const payload: unknown = await request.json();
    const parsed = splitSchema.safeParse(payload);
    if (!parsed.success) {
      return failure(
        "VALIDATION_ERROR",
        "拆分内容不完整，请检查说话人和台词。",
        422,
      );
    }

    await ensureDatabase();
    const database = getDatabase();
    const current = await database
      .prepare(
        `SELECT
          dialogue_id AS dialogueId,
          line_order AS "order",
          start_ms AS startMs,
          end_ms AS endMs,
          note
         FROM dialogue_lines
         WHERE id = ?`,
      )
      .bind(lineId)
      .first<StoredLine>();
    if (!current) {
      return failure("LINE_NOT_FOUND", "找不到要拆分的台词。", 404);
    }

    let splitAtMs: number | null = null;
    if (current.startMs !== null && current.endMs !== null) {
      if (current.endMs - current.startMs < 200) {
        return failure(
          "TIMING_TOO_SHORT",
          "这句音频不足 0.2 秒，不能安全拆分。",
          422,
        );
      }
      splitAtMs =
        parsed.data.splitAtMs ??
        Math.round((current.startMs + current.endMs) / 2);
      if (
        splitAtMs - current.startMs < 100 ||
        current.endMs - splitAtMs < 100
      ) {
        return failure(
          "INVALID_SPLIT_TIME",
          "拆分位置必须让前后两句都至少保留 0.1 秒。",
          422,
        );
      }
    } else if (parsed.data.splitAtMs !== undefined) {
      return failure(
        "TIMING_UNAVAILABLE",
        "当前句没有完整时间轴，不能指定拆分时间。",
        422,
      );
    }

    const following = await database
      .prepare(
        `SELECT id, line_order AS "order"
         FROM dialogue_lines
         WHERE dialogue_id = ? AND line_order > ?
         ORDER BY line_order DESC`,
      )
      .bind(current.dialogueId, current.order)
      .all<FollowingLine>();
    const nextId = crypto.randomUUID();
    const statements: D1PreparedStatement[] = following.results.map((line) =>
      database
        .prepare("UPDATE dialogue_lines SET line_order = ? WHERE id = ?")
        .bind(line.order + 1, line.id),
    );
    statements.push(
      database
        .prepare(
          `UPDATE dialogue_lines
           SET speaker = ?, text = ?, translation_zh = ?, end_ms = ?
           WHERE id = ?`,
        )
        .bind(
          parsed.data.current.speaker,
          parsed.data.current.text,
          parsed.data.current.translationZh,
          splitAtMs ?? current.endMs,
          lineId,
        ),
      database
        .prepare(
          `INSERT INTO dialogue_lines
            (id, dialogue_id, line_order, speaker, text, reading,
             translation_zh, translation_en, start_ms, end_ms, note)
           VALUES (?, ?, ?, ?, ?, NULL, ?, NULL, ?, ?, ?)`,
        )
        .bind(
          nextId,
          current.dialogueId,
          current.order + 1,
          parsed.data.next.speaker,
          parsed.data.next.text,
          parsed.data.next.translationZh,
          splitAtMs,
          splitAtMs === null ? null : current.endMs,
          current.note,
        ),
    );
    await database.batch(statements);

    return success(
      {
        current: {
          id: lineId,
          ...parsed.data.current,
          startMs: current.startMs,
          endMs: splitAtMs ?? current.endMs,
        },
        next: {
          id: nextId,
          order: current.order + 1,
          ...parsed.data.next,
          startMs: splitAtMs ?? undefined,
          endMs: splitAtMs === null ? undefined : current.endMs,
        },
      },
      "台词已拆分为两句",
    );
  } catch (error) {
    logServerError("dialogue-line.split.failed", error);
    return failure("SPLIT_FAILED", "台词拆分失败，请稍后重试。", 500);
  }
}
