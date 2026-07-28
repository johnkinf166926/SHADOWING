import { failure, success } from "@/lib/api-response";
import { lessonFormSchema } from "@/lib/content-schema";
import { ensureDatabase, logServerError } from "@/lib/server/database";
import { getDatabase } from "@/lib/server/runtime";

interface LessonRow {
  id: string;
  unitId: string;
  sectionNumber: number;
  level: "INTERMEDIATE" | "ADVANCED";
  title: string;
  subtitle: string | null;
  trackNumber: string;
  pdfPage: number | null;
  status: string;
}

export async function GET() {
  try {
    await ensureDatabase();
    const database = getDatabase();
    const result = await database
      .prepare(
        `SELECT
          l.id,
          l.unit_id AS unitId,
          l.section_number AS sectionNumber,
          l.level,
          l.title,
          l.subtitle,
          l.track_number AS trackNumber,
          l.pdf_page AS pdfPage,
          l.status
         FROM lessons l
         JOIN units u ON u.id = l.unit_id
         ORDER BY u.number, l.section_number, l.track_number`,
      )
      .all<LessonRow>();
    return success(result.results);
  } catch (error) {
    logServerError("lessons.list.failed", error);
    return failure(
      "DATABASE_UNAVAILABLE",
      "课程数据暂时无法读取，请检查本地数据库后重试。",
      500,
    );
  }
}

export async function POST(request: Request) {
  try {
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
    const duplicate = await database
      .prepare("SELECT id FROM lessons WHERE track_number = ?")
      .bind(parsed.data.trackNumber)
      .first<{ id: string }>();
    if (duplicate) {
      return failure("DUPLICATE_LESSON", "相同音轨编号已存在。", 409);
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await database
      .prepare(
        `INSERT INTO lessons
          (id, unit_id, section_number, level, title, subtitle, track_number, pdf_page, status, favorite, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'NOT_STARTED', 0, ?, ?)`,
      )
      .bind(
        id,
        parsed.data.unitId,
        parsed.data.sectionNumber,
        parsed.data.level,
        parsed.data.title,
        parsed.data.subtitle ?? null,
        parsed.data.trackNumber,
        parsed.data.pdfPage ?? null,
        now,
        now,
      )
      .run();

    return success({ id, ...parsed.data }, "课程已创建", { status: 201 });
  } catch (error) {
    logServerError("lessons.create.failed", error);
    return failure("SAVE_FAILED", "课程保存失败，请稍后重试。", 500);
  }
}
