import { failure } from "@/lib/api-response";
import { ensureDatabase, logServerError } from "@/lib/server/database";
import { getDatabase } from "@/lib/server/runtime";

interface ExportRow {
  unitNumber: number;
  unitTitle: string;
  unitSubtitle: string | null;
  unitDescription: string | null;
  lessonId: string;
  sectionNumber: number;
  level: "INTERMEDIATE" | "ADVANCED";
  lessonTitle: string;
  lessonSubtitle: string | null;
  trackNumber: string;
  pdfPage: number | null;
  dialogueNumber: number;
  lineOrder: number;
  speaker: "A" | "B" | "NARRATOR";
  text: string;
  reading: string | null;
  translationZh: string | null;
  translationEn: string | null;
  startMs: number | null;
  endMs: number | null;
  note: string | null;
}

export async function GET(request: Request) {
  try {
    const unitNumber = Number(
      new URL(request.url).searchParams.get("unit") ?? 1,
    );
    if (!Number.isInteger(unitNumber) || unitNumber < 1) {
      return failure("INVALID_UNIT", "Unit 编号无效。", 422);
    }

    await ensureDatabase();
    const database = getDatabase();
    const rows = await database
      .prepare(
        `SELECT
          u.number AS unitNumber,
          u.title AS unitTitle,
          u.subtitle AS unitSubtitle,
          u.description AS unitDescription,
          l.id AS lessonId,
          l.section_number AS sectionNumber,
          l.level,
          l.title AS lessonTitle,
          l.subtitle AS lessonSubtitle,
          l.track_number AS trackNumber,
          l.pdf_page AS pdfPage,
          d.number AS dialogueNumber,
          dl.line_order AS lineOrder,
          dl.speaker,
          dl.text,
          dl.reading,
          dl.translation_zh AS translationZh,
          dl.translation_en AS translationEn,
          dl.start_ms AS startMs,
          dl.end_ms AS endMs,
          dl.note
         FROM units u
         JOIN lessons l ON l.unit_id = u.id
         JOIN dialogues d ON d.lesson_id = l.id
         JOIN dialogue_lines dl ON dl.dialogue_id = d.id
         WHERE u.number = ?
         ORDER BY l.section_number, d.number, dl.line_order`,
      )
      .bind(unitNumber)
      .all<ExportRow>();

    if (rows.results.length === 0) {
      return failure("UNIT_NOT_FOUND", "没有找到可导出的 Unit 内容。", 404);
    }

    const first = rows.results[0];
    const lessonMap = new Map<
      string,
      {
        sectionNumber: number;
        level: "INTERMEDIATE" | "ADVANCED";
        title: string;
        subtitle?: string;
        trackNumber: string;
        pdfPage?: number;
        dialogues: Map<
          number,
          {
            number: number;
            lines: Array<Record<string, unknown>>;
          }
        >;
        expressions: [];
      }
    >();

    for (const row of rows.results) {
      const lesson = lessonMap.get(row.lessonId) ?? {
        sectionNumber: row.sectionNumber,
        level: row.level,
        title: row.lessonTitle,
        subtitle: row.lessonSubtitle ?? undefined,
        trackNumber: row.trackNumber,
        pdfPage: row.pdfPage ?? undefined,
        dialogues: new Map(),
        expressions: [],
      };
      const dialogue = lesson.dialogues.get(row.dialogueNumber) ?? {
        number: row.dialogueNumber,
        lines: [],
      };
      dialogue.lines.push({
        order: row.lineOrder,
        speaker: row.speaker,
        text: row.text,
        ...(row.reading ? { reading: row.reading } : {}),
        ...(row.translationZh ? { translationZh: row.translationZh } : {}),
        ...(row.translationEn ? { translationEn: row.translationEn } : {}),
        ...(row.startMs === null ? {} : { startMs: row.startMs }),
        ...(row.endMs === null ? {} : { endMs: row.endMs }),
        ...(row.note ? { note: row.note } : {}),
      });
      lesson.dialogues.set(row.dialogueNumber, dialogue);
      lessonMap.set(row.lessonId, lesson);
    }

    const payload = {
      unit: {
        number: first.unitNumber,
        title: first.unitTitle,
        ...(first.unitSubtitle ? { subtitle: first.unitSubtitle } : {}),
        ...(first.unitDescription
          ? { description: first.unitDescription }
          : {}),
      },
      lessons: Array.from(lessonMap.values()).map((lesson) => ({
        ...lesson,
        dialogues: Array.from(lesson.dialogues.values()),
      })),
    };

    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="shadowing-unit-${unitNumber}.json"`,
      },
    });
  } catch (error) {
    logServerError("content.export.failed", error);
    return failure("EXPORT_FAILED", "导出失败，请稍后重试。", 500);
  }
}
