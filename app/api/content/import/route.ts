import { failure, success } from "@/lib/api-response";
import { validateContent } from "@/lib/content-validation";
import { ensureDatabase, logServerError } from "@/lib/server/database";
import { getDatabase } from "@/lib/server/runtime";

export async function POST(request: Request) {
  try {
    const payload: unknown = await request.json();
    const validation = validateContent(payload);
    if (!validation.success || !validation.data) {
      return failure(
        "CONTENT_INVALID",
        "导入内容未通过校验，请修正错误后重试。",
        422,
        validation,
      );
    }

    await ensureDatabase();
    const database = getDatabase();
    const duplicateUnit = await database
      .prepare("SELECT id FROM units WHERE number = ?")
      .bind(validation.data.unit.number)
      .first<{ id: string }>();
    if (duplicateUnit) {
      return failure(
        "DUPLICATE_UNIT",
        `Unit ${validation.data.unit.number} 已存在，未写入任何数据。`,
        409,
      );
    }

    const trackNumbers = validation.data.lessons.map(
      (lesson) => lesson.trackNumber,
    );
    for (const trackNumber of trackNumbers) {
      const duplicateTrack = await database
        .prepare("SELECT id FROM lessons WHERE track_number = ?")
        .bind(trackNumber)
        .first<{ id: string }>();
      if (duplicateTrack) {
        return failure(
          "DUPLICATE_TRACK",
          `音轨编号 ${trackNumber} 已存在，未写入任何数据。`,
          409,
        );
      }
    }

    if (new URL(request.url).searchParams.get("dryRun") === "true") {
      return success(
        { validation, duplicateUnit: false, duplicateTracks: [] },
        "内容校验通过，可安全导入",
      );
    }

    const now = new Date().toISOString();
    const unitId = crypto.randomUUID();
    const statements: D1PreparedStatement[] = [
      database
        .prepare(
          `INSERT INTO units
            (id, number, title, subtitle, description, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          unitId,
          validation.data.unit.number,
          validation.data.unit.title,
          validation.data.unit.subtitle ?? null,
          validation.data.unit.description ?? null,
          now,
          now,
        ),
    ];

    for (const lesson of validation.data.lessons) {
      const lessonId = crypto.randomUUID();
      statements.push(
        database
          .prepare(
            `INSERT INTO lessons
              (id, unit_id, section_number, level, title, subtitle, track_number, pdf_page, status, favorite, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'NOT_STARTED', 0, ?, ?)`,
          )
          .bind(
            lessonId,
            unitId,
            lesson.sectionNumber,
            lesson.level,
            lesson.title ?? `Section ${lesson.sectionNumber}`,
            lesson.subtitle ?? null,
            lesson.trackNumber,
            lesson.pdfPage ?? null,
            now,
            now,
          ),
      );

      for (const dialogue of lesson.dialogues) {
        const dialogueId = crypto.randomUUID();
        statements.push(
          database
            .prepare(
              "INSERT INTO dialogues (id, lesson_id, number) VALUES (?, ?, ?)",
            )
            .bind(dialogueId, lessonId, dialogue.number),
        );

        for (const line of dialogue.lines) {
          statements.push(
            database
              .prepare(
                `INSERT INTO dialogue_lines
                  (id, dialogue_id, line_order, speaker, text, reading, translation_zh, translation_en, start_ms, end_ms, note)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              )
              .bind(
                crypto.randomUUID(),
                dialogueId,
                line.order,
                line.speaker,
                line.text,
                line.reading ?? null,
                line.translationZh ?? null,
                line.translationEn ?? null,
                line.startMs ?? null,
                line.endMs ?? null,
                line.note ?? null,
              ),
          );
        }
      }

      for (const expression of lesson.expressions) {
        const expressionId = crypto.randomUUID();
        statements.push(
          database
            .prepare(
              `INSERT INTO expressions
                (id, expression, reading, explanation_zh, explanation_ja, example, tags, mastery_level, next_review_at, favorite, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?, ?)`,
            )
            .bind(
              expressionId,
              expression.expression,
              expression.reading ?? null,
              expression.explanationZh ?? null,
              expression.explanationJa ?? null,
              expression.example ?? null,
              JSON.stringify(expression.tags),
              now,
              now,
              now,
            ),
        );
        statements.push(
          database
            .prepare(
              "INSERT INTO lesson_expressions (lesson_id, expression_id) VALUES (?, ?)",
            )
            .bind(lessonId, expressionId),
        );
      }
    }

    await database.batch(statements);
    return success(
      { unitId, ...validation.summary, warnings: validation.issues },
      "教材内容已完整导入",
      { status: 201 },
    );
  } catch (error) {
    logServerError("content.import.failed", error);
    return failure("IMPORT_FAILED", "导入失败，数据库未保留不完整内容。", 500);
  }
}
