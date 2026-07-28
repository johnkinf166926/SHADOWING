import { failure, success } from "@/lib/api-response";
import { unitFormSchema } from "@/lib/content-schema";
import { ensureDatabase, logServerError } from "@/lib/server/database";
import { getDatabase } from "@/lib/server/runtime";

interface UnitRow {
  id: string;
  number: number;
  title: string;
  subtitle: string | null;
  description: string | null;
  lessonCount: number;
}

export async function GET() {
  try {
    await ensureDatabase();
    const database = getDatabase();
    const result = await database
      .prepare(
        `SELECT
          u.id,
          u.number,
          u.title,
          u.subtitle,
          u.description,
          COUNT(l.id) AS lessonCount
         FROM units u
         LEFT JOIN lessons l ON l.unit_id = u.id
         GROUP BY u.id
         ORDER BY u.number`,
      )
      .all<UnitRow>();

    return success(result.results);
  } catch (error) {
    logServerError("units.list.failed", error);
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
    const duplicate = await database
      .prepare("SELECT id FROM units WHERE number = ?")
      .bind(parsed.data.number)
      .first<{ id: string }>();
    if (duplicate) {
      return failure(
        "DUPLICATE_UNIT",
        `Unit ${parsed.data.number} 已存在，请使用其他编号。`,
        409,
      );
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await database
      .prepare(
        `INSERT INTO units
          (id, number, title, subtitle, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        parsed.data.number,
        parsed.data.title,
        parsed.data.subtitle ?? null,
        parsed.data.description ?? null,
        now,
        now,
      )
      .run();

    return success({ id, ...parsed.data }, "Unit 已创建", { status: 201 });
  } catch (error) {
    logServerError("units.create.failed", error);
    return failure("SAVE_FAILED", "Unit 保存失败，请稍后重试。", 500);
  }
}
