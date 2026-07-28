import { z } from "zod";
import { failure, success } from "@/lib/api-response";
import { ensureDatabase, logServerError } from "@/lib/server/database";
import { getDatabase } from "@/lib/server/runtime";

const splitDialogueSchema = z.object({
  lineId: z.string().trim().min(1),
});

interface StoredDialogue {
  lessonId: string;
  number: number;
}

interface StoredLine {
  id: string;
  order: number;
}

interface FollowingDialogue {
  id: string;
  number: number;
}

interface RouteContext {
  params: Promise<{ dialogueId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { dialogueId } = await context.params;
    const payload: unknown = await request.json();
    const parsed = splitDialogueSchema.safeParse(payload);
    if (!parsed.success) {
      return failure("VALIDATION_ERROR", "请选择新 Track 的第一句。", 422);
    }

    await ensureDatabase();
    const database = getDatabase();
    const dialogue = await database
      .prepare(
        `SELECT lesson_id AS lessonId, number
         FROM dialogues
         WHERE id = ?`,
      )
      .bind(dialogueId)
      .first<StoredDialogue>();
    if (!dialogue) {
      return failure("DIALOGUE_NOT_FOUND", "找不到要拆分的 Track。", 404);
    }

    const splitLine = await database
      .prepare(
        `SELECT id, line_order AS "order"
         FROM dialogue_lines
         WHERE id = ? AND dialogue_id = ?`,
      )
      .bind(parsed.data.lineId, dialogueId)
      .first<StoredLine>();
    if (!splitLine) {
      return failure("LINE_NOT_FOUND", "选择的台词不属于当前 Track。", 404);
    }
    if (splitLine.order <= 1) {
      return failure(
        "EMPTY_TRACK",
        "第一句已经是当前 Track 的开头，不能在这里拆分。",
        422,
      );
    }

    const [movedLines, followingDialogues] = await Promise.all([
      database
        .prepare(
          `SELECT id, line_order AS "order"
           FROM dialogue_lines
           WHERE dialogue_id = ? AND line_order >= ?
           ORDER BY line_order ASC`,
        )
        .bind(dialogueId, splitLine.order)
        .all<StoredLine>(),
      database
        .prepare(
          `SELECT id, number
           FROM dialogues
           WHERE lesson_id = ? AND number > ?
           ORDER BY number DESC`,
        )
        .bind(dialogue.lessonId, dialogue.number)
        .all<FollowingDialogue>(),
    ]);
    if (!movedLines.results.length) {
      return failure("LINE_NOT_FOUND", "找不到要移动的台词。", 404);
    }

    const newDialogueId = crypto.randomUUID();
    const newDialogueNumber = dialogue.number + 1;
    const statements: D1PreparedStatement[] = followingDialogues.results.map(
      (following) =>
        database
          .prepare("UPDATE dialogues SET number = ? WHERE id = ?")
          .bind(following.number + 1, following.id),
    );
    statements.push(
      database
        .prepare(
          "INSERT INTO dialogues (id, lesson_id, number) VALUES (?, ?, ?)",
        )
        .bind(newDialogueId, dialogue.lessonId, newDialogueNumber),
    );
    for (const [index, line] of movedLines.results.entries()) {
      statements.push(
        database
          .prepare(
            `UPDATE dialogue_lines
             SET dialogue_id = ?, line_order = ?
             WHERE id = ?`,
          )
          .bind(newDialogueId, index + 1, line.id),
        database
          .prepare(
            `UPDATE practice_sessions
             SET dialogue_id = ?
             WHERE dialogue_id = ? AND line_id = ?`,
          )
          .bind(newDialogueId, dialogueId, line.id),
      );
    }
    await database.batch(statements);

    return success(
      {
        dialogueId,
        newDialogue: {
          id: newDialogueId,
          lessonId: dialogue.lessonId,
          number: newDialogueNumber,
          lineCount: movedLines.results.length,
        },
      },
      "已从所选台词开始建立新的 Track",
    );
  } catch (error) {
    logServerError("dialogue.split.failed", error);
    return failure("SPLIT_FAILED", "Track 拆分失败，请稍后重试。", 500);
  }
}
