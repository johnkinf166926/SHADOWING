import { failure, success } from "@/lib/api-response";
import { expressionFavoriteSchema } from "@/lib/content-schema";
import { ensureDatabase, logServerError } from "@/lib/server/database";
import { getDatabase } from "@/lib/server/runtime";

export async function GET() {
  try {
    await ensureDatabase();
    const rows = await getDatabase()
      .prepare(
        `SELECT
          e.id,
          e.expression,
          e.reading,
          e.explanation_zh AS explanationZh,
          e.explanation_ja AS explanationJa,
          e.example,
          e.tags,
          e.mastery_level AS masteryLevel,
          e.next_review_at AS nextReviewAt,
          e.favorite,
          l.title AS sourceLesson,
          u.number AS unitNumber
         FROM expressions e
         LEFT JOIN lesson_expressions le ON le.expression_id = e.id
         LEFT JOIN lessons l ON l.id = le.lesson_id
         LEFT JOIN units u ON u.id = l.unit_id
         ORDER BY e.next_review_at, e.expression`,
      )
      .all<Record<string, unknown>>();
    return success(rows.results);
  } catch (error) {
    logServerError("expressions.list.failed", error);
    return failure("DATABASE_UNAVAILABLE", "表达卡片暂时无法读取。", 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const payload: unknown = await request.json();
    const parsed = expressionFavoriteSchema.safeParse(payload);
    if (!parsed.success) {
      return failure("VALIDATION_ERROR", "收藏状态无效。", 422);
    }
    await ensureDatabase();
    const result = await getDatabase()
      .prepare(
        "UPDATE expressions SET favorite = ?, updated_at = ? WHERE id = ?",
      )
      .bind(
        Number(parsed.data.favorite),
        new Date().toISOString(),
        parsed.data.expressionId,
      )
      .run();
    if ((result.meta.changes ?? 0) === 0) {
      return failure("EXPRESSION_NOT_FOUND", "表达卡片不存在。", 404);
    }
    return success(
      { id: parsed.data.expressionId, favorite: parsed.data.favorite },
      "收藏状态已更新",
    );
  } catch (error) {
    logServerError("expressions.favorite.failed", error);
    return failure("SAVE_FAILED", "收藏状态保存失败。", 500);
  }
}
