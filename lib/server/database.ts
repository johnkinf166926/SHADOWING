import { getDatabase } from "./runtime";
import { seedBundledCourse } from "./bundled-course";

let initialization: Promise<void> | undefined;

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS units (
    id TEXT PRIMARY KEY,
    number INTEGER NOT NULL UNIQUE,
    title TEXT NOT NULL,
    subtitle TEXT,
    description TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS audio_assets (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    storage_path TEXT NOT NULL UNIQUE,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    duration_ms INTEGER,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS lessons (
    id TEXT PRIMARY KEY,
    unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
    section_number INTEGER NOT NULL,
    level TEXT NOT NULL CHECK(level IN ('INTERMEDIATE','ADVANCED')),
    title TEXT NOT NULL,
    subtitle TEXT,
    track_number TEXT NOT NULL UNIQUE,
    pdf_page INTEGER,
    status TEXT NOT NULL DEFAULT 'NOT_STARTED' CHECK(status IN ('NOT_STARTED','IN_PROGRESS','COMPLETED')),
    favorite INTEGER NOT NULL DEFAULT 0,
    audio_asset_id TEXT REFERENCES audio_assets(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS dialogues (
    id TEXT PRIMARY KEY,
    lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    number INTEGER NOT NULL,
    UNIQUE(lesson_id, number)
  )`,
  `CREATE TABLE IF NOT EXISTS dialogue_lines (
    id TEXT PRIMARY KEY,
    dialogue_id TEXT NOT NULL REFERENCES dialogues(id) ON DELETE CASCADE,
    line_order INTEGER NOT NULL,
    speaker TEXT NOT NULL CHECK(speaker IN ('A','B','NARRATOR')),
    text TEXT NOT NULL,
    reading TEXT,
    translation_zh TEXT,
    translation_en TEXT,
    start_ms INTEGER,
    end_ms INTEGER,
    note TEXT,
    UNIQUE(dialogue_id, line_order),
    CHECK(start_ms IS NULL OR end_ms IS NULL OR start_ms < end_ms)
  )`,
  `CREATE TABLE IF NOT EXISTS expressions (
    id TEXT PRIMARY KEY,
    expression TEXT NOT NULL,
    reading TEXT,
    explanation_zh TEXT,
    explanation_ja TEXT,
    example TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    mastery_level INTEGER NOT NULL DEFAULT 0,
    next_review_at TEXT,
    favorite INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS lesson_expressions (
    lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    expression_id TEXT NOT NULL REFERENCES expressions(id) ON DELETE CASCADE,
    PRIMARY KEY(lesson_id, expression_id)
  )`,
  `CREATE TABLE IF NOT EXISTS practice_sessions (
    id TEXT PRIMARY KEY,
    lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,
    dialogue_id TEXT REFERENCES dialogues(id) ON DELETE SET NULL,
    line_id TEXT REFERENCES dialogue_lines(id) ON DELETE SET NULL,
    mode TEXT NOT NULL,
    started_at TEXT NOT NULL,
    duration_ms INTEGER NOT NULL,
    recording_path TEXT,
    self_pronunciation_score INTEGER,
    self_rhythm_score INTEGER,
    self_fluency_score INTEGER,
    started_within_target INTEGER,
    completed INTEGER NOT NULL DEFAULT 0,
    note TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS recordings (
    id TEXT PRIMARY KEY,
    practice_session_id TEXT REFERENCES practice_sessions(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL UNIQUE,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    duration_ms INTEGER,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS dictation_attempts (
    id TEXT PRIMARY KEY,
    lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,
    line_id TEXT NOT NULL REFERENCES dialogue_lines(id) ON DELETE RESTRICT,
    answer TEXT NOT NULL,
    normalized TEXT NOT NULL,
    accuracy REAL NOT NULL,
    correct INTEGER NOT NULL,
    diff_json TEXT NOT NULL,
    added_to_review INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS review_items (
    id TEXT PRIMARY KEY,
    lesson_id TEXT REFERENCES lessons(id) ON DELETE SET NULL,
    line_id TEXT REFERENCES dialogue_lines(id) ON DELETE SET NULL,
    expression_id TEXT REFERENCES expressions(id) ON DELETE SET NULL,
    ease_factor REAL NOT NULL DEFAULT 2.5,
    interval_days INTEGER NOT NULL DEFAULT 0,
    repetitions INTEGER NOT NULL DEFAULT 0,
    next_review_at TEXT NOT NULL,
    last_rating TEXT CHECK(last_rating IS NULL OR last_rating IN ('KNOW','UNCERTAIN','AGAIN')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS daily_study_logs (
    id TEXT PRIMARY KEY,
    study_date TEXT NOT NULL UNIQUE,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    lesson_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS lessons_unit_section_lookup_idx ON lessons(unit_id, section_number)",
  "CREATE INDEX IF NOT EXISTS lessons_unit_status_idx ON lessons(unit_id, status)",
  "CREATE INDEX IF NOT EXISTS dialogue_lines_time_idx ON dialogue_lines(start_ms, end_ms)",
  "CREATE INDEX IF NOT EXISTS practice_sessions_lesson_started_idx ON practice_sessions(lesson_id, started_at)",
  "CREATE INDEX IF NOT EXISTS dictation_lesson_created_idx ON dictation_attempts(lesson_id, created_at)",
  "CREATE INDEX IF NOT EXISTS review_items_next_review_idx ON review_items(next_review_at)",
  "CREATE INDEX IF NOT EXISTS expressions_next_review_idx ON expressions(next_review_at)",
] as const;

export async function ensureDatabase(): Promise<void> {
  initialization ??= initialize();
  try {
    await initialization;
  } catch (error) {
    initialization = undefined;
    throw error;
  }
}

async function initialize(): Promise<void> {
  const database = getDatabase();
  await database.batch(
    schemaStatements.map((statement) => database.prepare(statement)),
  );
  await seedBundledCourse(database);
  const synchronizedAt = new Date().toISOString();
  await database.batch([
    database
      .prepare(
        `UPDATE lessons
         SET status = 'COMPLETED', updated_at = ?
         WHERE status <> 'COMPLETED'
           AND EXISTS (
             SELECT 1
             FROM practice_sessions
             WHERE practice_sessions.lesson_id = lessons.id
               AND practice_sessions.completed = 1
           )`,
      )
      .bind(synchronizedAt),
    database
      .prepare(
        `UPDATE lessons
         SET status = 'IN_PROGRESS', updated_at = ?
         WHERE status = 'NOT_STARTED'
           AND EXISTS (
             SELECT 1
             FROM practice_sessions
             WHERE practice_sessions.lesson_id = lessons.id
           )`,
      )
      .bind(synchronizedAt),
  ]);
}

export function logServerError(
  event: string,
  error: unknown,
  context: Record<string, string | number | boolean | undefined> = {},
) {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(
    JSON.stringify({
      level: "error",
      event,
      message,
      context,
      timestamp: new Date().toISOString(),
    }),
  );
}
