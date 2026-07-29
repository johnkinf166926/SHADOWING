import bundledAudioManifestJson from "@/lib/bundled-audio-manifest.json";
import bundledCourseJson from "@/lib/bundled-course.json";
import type { ContentImport } from "@/lib/content-schema";

interface BundledAudioTrack {
  trackNumber: string;
  filename: string;
  durationMs: number;
  sizeBytes: number;
  sha256: string;
}

interface BundledAudioManifest {
  version: string;
  tracks: BundledAudioTrack[];
}

interface SeedStateRow {
  valueJson: string;
}

interface CountRow {
  count: number;
}

const bundledCourse = bundledCourseJson as ContentImport[];
const bundledAudioManifest =
  bundledAudioManifestJson as BundledAudioManifest;
const seedStateKey = "bundled_course_seed";
const statementBatchSize = 75;

export async function seedBundledCourse(
  database: D1Database,
): Promise<boolean> {
  const seedStateRow = await database
    .prepare(
      "SELECT value_json AS valueJson FROM app_settings WHERE key = ?",
    )
    .bind(seedStateKey)
    .first<SeedStateRow>();
  const seedState = parseSeedState(seedStateRow?.valueJson);

  if (
    seedState?.status === "complete" &&
    seedState.version === bundledAudioManifest.version
  ) {
    return false;
  }

  const unitCount = await database
    .prepare("SELECT COUNT(*) AS count FROM units")
    .first<CountRow>();
  if (!seedState && Number(unitCount?.count ?? 0) > 0) {
    return false;
  }

  await database
    .prepare(
      `INSERT INTO app_settings (key, value_json, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         value_json = excluded.value_json,
         updated_at = excluded.updated_at`,
    )
    .bind(
      seedStateKey,
      JSON.stringify({
        status: "in_progress",
        version: bundledAudioManifest.version,
      }),
      bundledAudioManifest.version,
    )
    .run();

  const audioByTrack = new Map(
    bundledAudioManifest.tracks.map((track) => [track.trackNumber, track]),
  );

  for (const unit of bundledCourse) {
    const statements: D1PreparedStatement[] = [];
    const unitId = bundledUnitId(unit.unit.number);

    for (const lesson of unit.lessons) {
      const audio = audioByTrack.get(lesson.trackNumber);
      if (!audio) {
        throw new Error(
          `Bundled audio is missing for track ${lesson.trackNumber}.`,
        );
      }
      statements.push(
        database
          .prepare(
            `INSERT OR IGNORE INTO audio_assets
              (id, filename, storage_path, mime_type, size_bytes, duration_ms, created_at)
             VALUES (?, ?, ?, 'audio/mp4', ?, ?, ?)`,
          )
          .bind(
            bundledAudioId(lesson.trackNumber),
            audio.filename,
            `/audio/${audio.filename}`,
            audio.sizeBytes,
            audio.durationMs,
            bundledAudioManifest.version,
          ),
      );
    }

    statements.push(
      database
        .prepare(
          `INSERT OR IGNORE INTO units
            (id, number, title, subtitle, description, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          unitId,
          unit.unit.number,
          unit.unit.title,
          unit.unit.subtitle ?? null,
          unit.unit.description ?? null,
          bundledAudioManifest.version,
          bundledAudioManifest.version,
        ),
    );

    for (const lesson of unit.lessons) {
      const lessonId = bundledLessonId(lesson.trackNumber);
      statements.push(
        database
          .prepare(
            `INSERT OR IGNORE INTO lessons
              (id, unit_id, section_number, level, title, subtitle, track_number, pdf_page, status, favorite, audio_asset_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'NOT_STARTED', 0, ?, ?, ?)`,
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
            bundledAudioId(lesson.trackNumber),
            bundledAudioManifest.version,
            bundledAudioManifest.version,
          ),
      );

      for (const dialogue of lesson.dialogues) {
        const dialogueId = bundledDialogueId(
          lesson.trackNumber,
          dialogue.number,
        );
        statements.push(
          database
            .prepare(
              `INSERT OR IGNORE INTO dialogues (id, lesson_id, number)
               VALUES (?, ?, ?)`,
            )
            .bind(dialogueId, lessonId, dialogue.number),
        );

        for (const line of dialogue.lines) {
          statements.push(
            database
              .prepare(
                `INSERT OR IGNORE INTO dialogue_lines
                  (id, dialogue_id, line_order, speaker, text, reading, translation_zh, translation_en, start_ms, end_ms, note)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              )
              .bind(
                bundledLineId(
                  lesson.trackNumber,
                  dialogue.number,
                  line.order,
                ),
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

      for (const [index, expression] of lesson.expressions.entries()) {
        const expressionId = bundledExpressionId(
          lesson.trackNumber,
          index + 1,
        );
        statements.push(
          database
            .prepare(
              `INSERT OR IGNORE INTO expressions
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
              bundledAudioManifest.version,
              bundledAudioManifest.version,
              bundledAudioManifest.version,
            ),
        );
        statements.push(
          database
            .prepare(
              `INSERT OR IGNORE INTO lesson_expressions
                (lesson_id, expression_id)
               VALUES (?, ?)`,
            )
            .bind(lessonId, expressionId),
        );
      }
    }

    await runStatementBatches(database, statements);
  }

  await database
    .prepare(
      `UPDATE app_settings
       SET value_json = ?, updated_at = ?
       WHERE key = ?`,
    )
    .bind(
      JSON.stringify({
        status: "complete",
        version: bundledAudioManifest.version,
      }),
      bundledAudioManifest.version,
      seedStateKey,
    )
    .run();

  return true;
}

async function runStatementBatches(
  database: D1Database,
  statements: D1PreparedStatement[],
) {
  for (let index = 0; index < statements.length; index += statementBatchSize) {
    await database.batch(statements.slice(index, index + statementBatchSize));
  }
}

function parseSeedState(value: string | undefined) {
  if (!value) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(value) as {
      status?: string;
      version?: string;
    };
    return parsed.status && parsed.version ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function bundledUnitId(unitNumber: number) {
  return `bundled-unit-${unitNumber}`;
}

function bundledAudioId(trackNumber: string) {
  return `bundled-audio-${safeIdPart(trackNumber)}`;
}

function bundledLessonId(trackNumber: string) {
  return `bundled-lesson-${safeIdPart(trackNumber)}`;
}

function bundledDialogueId(trackNumber: string, dialogueNumber: number) {
  return `bundled-dialogue-${safeIdPart(trackNumber)}-${dialogueNumber}`;
}

function bundledLineId(
  trackNumber: string,
  dialogueNumber: number,
  lineOrder: number,
) {
  return `bundled-line-${safeIdPart(trackNumber)}-${dialogueNumber}-${lineOrder}`;
}

function bundledExpressionId(trackNumber: string, expressionNumber: number) {
  return `bundled-expression-${safeIdPart(trackNumber)}-${expressionNumber}`;
}

function safeIdPart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/gu, "-");
}
