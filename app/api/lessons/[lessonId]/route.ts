import { failure, success } from "@/lib/api-response";
import { lessonFormSchema } from "@/lib/content-schema";
import { ensureDatabase, logServerError } from "@/lib/server/database";
import { getDatabase } from "@/lib/server/runtime";
import { getCourseLesson } from "@/lib/server/course-content";

interface RouteContext {
  params: Promise<{ lessonId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { lessonId } = await context.params;
    const lesson = await getCourseLesson(lessonId);
    if (!lesson) {
      return failure("LESSON_NOT_FOUND", "找不到这节课程。", 404);
    }
    return success(lesson);
  } catch (error) {
    logServerError("lessons.read.failed", error);
    return failure("DATABASE_UNAVAILABLE", "课程数据暂时无法读取。", 500);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { lessonId } = await context.params;
    const payload: unknown = await request.json();
    const parsed = lessonFormSchema.safeParse(payload);
    if (!parsed.success) {
      return failure(
        "VALIDATION_ERROR",
        "课程信息不完整，请检查输入内容。",
        422,
        parsed.error.flatten(),
      );
    }

    await ensureDatabase();
    const database = getDatabase();
    const current = await database
      .prepare("SELECT id FROM lessons WHERE id = ?")
      .bind(lessonId)
      .first<{ id: string }>();
    if (!current) {
      return failure("LESSON_NOT_FOUND", "找不到要编辑的 Section。", 404);
    }
    const duplicate = await database
      .prepare(
        `SELECT id FROM lessons
         WHERE id <> ? AND track_number = ?`,
      )
      .bind(lessonId, parsed.data.trackNumber)
      .first<{ id: string }>();
    if (duplicate) {
      return failure("DUPLICATE_LESSON", "相同音轨编号已存在。", 409);
    }

    await database
      .prepare(
        `UPDATE lessons
         SET unit_id = ?, section_number = ?, level = ?, title = ?,
             subtitle = ?, track_number = ?, pdf_page = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(
        parsed.data.unitId,
        parsed.data.sectionNumber,
        parsed.data.level,
        parsed.data.title,
        parsed.data.subtitle ?? null,
        parsed.data.trackNumber,
        parsed.data.pdfPage ?? null,
        new Date().toISOString(),
        lessonId,
      )
      .run();

    return success({ id: lessonId, ...parsed.data }, "Section 已更新");
  } catch (error) {
    logServerError("lessons.update.failed", error);
    return failure("SAVE_FAILED", "Section 更新失败，请稍后重试。", 500);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { lessonId } = await context.params;
    await ensureDatabase();
    const database = getDatabase();
    const current = await database
      .prepare("SELECT id FROM lessons WHERE id = ?")
      .bind(lessonId)
      .first<{ id: string }>();
    if (!current) {
      return failure("LESSON_NOT_FOUND", "找不到要删除的 Section。", 404);
    }

    const references = await database
      .prepare(
        `SELECT
          (SELECT COUNT(*) FROM practice_sessions WHERE lesson_id = ?) +
          (SELECT COUNT(*) FROM dictation_attempts WHERE lesson_id = ?) AS historyCount`,
      )
      .bind(lessonId, lessonId)
      .first<{ historyCount: number }>();
    if (Number(references?.historyCount ?? 0) > 0) {
      return failure(
        "LESSON_HAS_HISTORY",
        "此 Section 已有练习或听写记录。请保留课程，避免学习历史失去来源。",
        409,
      );
    }

    await database
      .prepare("DELETE FROM lessons WHERE id = ?")
      .bind(lessonId)
      .run();
    return success({ id: lessonId }, "Section 已删除");
  } catch (error) {
    logServerError("lessons.delete.failed", error);
    return failure("DELETE_FAILED", "Section 删除失败，请稍后重试。", 500);
  }
}
