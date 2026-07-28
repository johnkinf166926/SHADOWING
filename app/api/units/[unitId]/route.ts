import { failure, success } from "@/lib/api-response";
import { unitFormSchema } from "@/lib/content-schema";
import { ensureDatabase, logServerError } from "@/lib/server/database";
import { getDatabase } from "@/lib/server/runtime";
import { getCourseUnit } from "@/lib/server/course-content";

interface RouteContext {
  params: Promise<{ unitId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { unitId } = await context.params;
    const unit = await getCourseUnit(unitId);
    if (!unit) {
      return failure("UNIT_NOT_FOUND", "找不到这个 Unit。", 404);
    }
    return success(unit);
  } catch (error) {
    logServerError("units.read.failed", error);
    return failure("DATABASE_UNAVAILABLE", "课程数据暂时无法读取。", 500);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { unitId } = await context.params;
    const payload: unknown = await request.json();
    const parsed = unitFormSchema.safeParse(payload);
    if (!parsed.success) {
      return failure(
        "VALIDATION_ERROR",
        "Unit 信息不完整，请检查标记的字段。",
        422,
        parsed.error.flatten(),
      );
    }

    await ensureDatabase();
    const database = getDatabase();
    const current = await database
      .prepare("SELECT id FROM units WHERE id = ?")
      .bind(unitId)
      .first<{ id: string }>();
    if (!current) {
      return failure("UNIT_NOT_FOUND", "找不到要编辑的 Unit。", 404);
    }
    const duplicate = await database
      .prepare("SELECT id FROM units WHERE number = ? AND id <> ?")
      .bind(parsed.data.number, unitId)
      .first<{ id: string }>();
    if (duplicate) {
      return failure(
        "DUPLICATE_UNIT",
        `Unit ${parsed.data.number} 已存在，请使用其他编号。`,
        409,
      );
    }

    await database
      .prepare(
        `UPDATE units
         SET number = ?, title = ?, subtitle = ?, description = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(
        parsed.data.number,
        parsed.data.title,
        parsed.data.subtitle ?? null,
        parsed.data.description ?? null,
        new Date().toISOString(),
        unitId,
      )
      .run();

    return success({ id: unitId, ...parsed.data }, "Unit 已更新");
  } catch (error) {
    logServerError("units.update.failed", error);
    return failure("SAVE_FAILED", "Unit 更新失败，请稍后重试。", 500);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { unitId } = await context.params;
    await ensureDatabase();
    const database = getDatabase();
    const unit = await database
      .prepare(
        `SELECT u.id, COUNT(l.id) AS lessonCount
         FROM units u
         LEFT JOIN lessons l ON l.unit_id = u.id
         WHERE u.id = ?
         GROUP BY u.id`,
      )
      .bind(unitId)
      .first<{ id: string; lessonCount: number }>();
    if (!unit) {
      return failure("UNIT_NOT_FOUND", "找不到要删除的 Unit。", 404);
    }
    if (Number(unit.lessonCount) > 0) {
      return failure(
        "UNIT_NOT_EMPTY",
        "请先删除此 Unit 下的 Section；为保护学习记录，系统不会级联删除整个 Unit。",
        409,
      );
    }

    await database.prepare("DELETE FROM units WHERE id = ?").bind(unitId).run();
    return success({ id: unitId }, "Unit 已删除");
  } catch (error) {
    logServerError("units.delete.failed", error);
    return failure("DELETE_FAILED", "Unit 删除失败，请稍后重试。", 500);
  }
}
