import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
};

export const units = sqliteTable(
  "units",
  {
    id: text("id").primaryKey(),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    description: text("description"),
    ...timestamps,
  },
  (table) => [uniqueIndex("units_number_idx").on(table.number)],
);

export const audioAssets = sqliteTable(
  "audio_assets",
  {
    id: text("id").primaryKey(),
    filename: text("filename").notNull(),
    storagePath: text("storage_path").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    durationMs: integer("duration_ms"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("audio_assets_storage_path_idx").on(table.storagePath),
    index("audio_assets_filename_idx").on(table.filename),
  ],
);

export const lessons = sqliteTable(
  "lessons",
  {
    id: text("id").primaryKey(),
    unitId: text("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "restrict" }),
    sectionNumber: integer("section_number").notNull(),
    level: text("level", { enum: ["INTERMEDIATE", "ADVANCED"] }).notNull(),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    trackNumber: text("track_number").notNull(),
    pdfPage: integer("pdf_page"),
    status: text("status", {
      enum: ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"],
    })
      .notNull()
      .default("NOT_STARTED"),
    favorite: integer("favorite", { mode: "boolean" }).notNull().default(false),
    audioAssetId: text("audio_asset_id").references(() => audioAssets.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("lessons_track_number_idx").on(table.trackNumber),
    index("lessons_unit_section_lookup_idx").on(
      table.unitId,
      table.sectionNumber,
    ),
    index("lessons_unit_status_idx").on(table.unitId, table.status),
  ],
);

export const dialogues = sqliteTable(
  "dialogues",
  {
    id: text("id").primaryKey(),
    lessonId: text("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
  },
  (table) => [
    uniqueIndex("dialogues_lesson_number_idx").on(table.lessonId, table.number),
  ],
);

export const dialogueLines = sqliteTable(
  "dialogue_lines",
  {
    id: text("id").primaryKey(),
    dialogueId: text("dialogue_id")
      .notNull()
      .references(() => dialogues.id, { onDelete: "cascade" }),
    order: integer("line_order").notNull(),
    speaker: text("speaker", { enum: ["A", "B", "NARRATOR"] }).notNull(),
    text: text("text").notNull(),
    reading: text("reading"),
    translationZh: text("translation_zh"),
    translationEn: text("translation_en"),
    startMs: integer("start_ms"),
    endMs: integer("end_ms"),
    note: text("note"),
  },
  (table) => [
    uniqueIndex("dialogue_lines_dialogue_order_idx").on(
      table.dialogueId,
      table.order,
    ),
    index("dialogue_lines_time_idx").on(table.startMs, table.endMs),
  ],
);

export const expressions = sqliteTable(
  "expressions",
  {
    id: text("id").primaryKey(),
    expression: text("expression").notNull(),
    reading: text("reading"),
    explanationZh: text("explanation_zh"),
    explanationJa: text("explanation_ja"),
    example: text("example"),
    tags: text("tags").notNull().default("[]"),
    masteryLevel: integer("mastery_level").notNull().default(0),
    nextReviewAt: text("next_review_at"),
    favorite: integer("favorite", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (table) => [
    index("expressions_next_review_idx").on(table.nextReviewAt),
    index("expressions_favorite_idx").on(table.favorite),
  ],
);

export const lessonExpressions = sqliteTable(
  "lesson_expressions",
  {
    lessonId: text("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    expressionId: text("expression_id")
      .notNull()
      .references(() => expressions.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.lessonId, table.expressionId] })],
);

export const practiceSessions = sqliteTable(
  "practice_sessions",
  {
    id: text("id").primaryKey(),
    lessonId: text("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "restrict" }),
    dialogueId: text("dialogue_id").references(() => dialogues.id, {
      onDelete: "set null",
    }),
    lineId: text("line_id").references(() => dialogueLines.id, {
      onDelete: "set null",
    }),
    mode: text("mode").notNull(),
    startedAt: text("started_at").notNull(),
    durationMs: integer("duration_ms").notNull(),
    recordingPath: text("recording_path"),
    selfPronunciationScore: integer("self_pronunciation_score"),
    selfRhythmScore: integer("self_rhythm_score"),
    selfFluencyScore: integer("self_fluency_score"),
    startedWithinTarget: integer("started_within_target", { mode: "boolean" }),
    completed: integer("completed", { mode: "boolean" })
      .notNull()
      .default(false),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("practice_sessions_lesson_started_idx").on(
      table.lessonId,
      table.startedAt,
    ),
    index("practice_sessions_mode_started_idx").on(table.mode, table.startedAt),
  ],
);

export const recordings = sqliteTable(
  "recordings",
  {
    id: text("id").primaryKey(),
    practiceSessionId: text("practice_session_id").references(
      () => practiceSessions.id,
      { onDelete: "cascade" },
    ),
    storagePath: text("storage_path").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    durationMs: integer("duration_ms"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("recordings_storage_path_idx").on(table.storagePath),
    index("recordings_session_idx").on(table.practiceSessionId),
  ],
);

export const dictationAttempts = sqliteTable(
  "dictation_attempts",
  {
    id: text("id").primaryKey(),
    lessonId: text("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "restrict" }),
    lineId: text("line_id")
      .notNull()
      .references(() => dialogueLines.id, { onDelete: "restrict" }),
    answer: text("answer").notNull(),
    normalized: text("normalized").notNull(),
    accuracy: real("accuracy").notNull(),
    correct: integer("correct", { mode: "boolean" }).notNull(),
    diffJson: text("diff_json").notNull(),
    addedToReview: integer("added_to_review", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("dictation_lesson_created_idx").on(table.lessonId, table.createdAt),
    index("dictation_line_correct_idx").on(table.lineId, table.correct),
  ],
);

export const reviewItems = sqliteTable(
  "review_items",
  {
    id: text("id").primaryKey(),
    lessonId: text("lesson_id").references(() => lessons.id, {
      onDelete: "set null",
    }),
    lineId: text("line_id").references(() => dialogueLines.id, {
      onDelete: "set null",
    }),
    expressionId: text("expression_id").references(() => expressions.id, {
      onDelete: "set null",
    }),
    easeFactor: real("ease_factor").notNull().default(2.5),
    intervalDays: integer("interval_days").notNull().default(0),
    repetitions: integer("repetitions").notNull().default(0),
    nextReviewAt: text("next_review_at").notNull(),
    lastRating: text("last_rating", {
      enum: ["KNOW", "UNCERTAIN", "AGAIN"],
    }),
    ...timestamps,
  },
  (table) => [
    index("review_items_next_review_idx").on(table.nextReviewAt),
    index("review_items_expression_idx").on(table.expressionId),
  ],
);

export const dailyStudyLogs = sqliteTable(
  "daily_study_logs",
  {
    id: text("id").primaryKey(),
    studyDate: text("study_date").notNull(),
    durationMs: integer("duration_ms").notNull().default(0),
    lessonCount: integer("lesson_count").notNull().default(0),
    ...timestamps,
  },
  (table) => [uniqueIndex("daily_study_logs_date_idx").on(table.studyDate)],
);

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  valueJson: text("value_json").notNull(),
  updatedAt: text("updated_at").notNull(),
});
