import { z } from "zod";

export const speakerSchema = z.enum(["A", "B", "NARRATOR"]);
export const lessonLevelSchema = z.enum(["INTERMEDIATE", "ADVANCED"]);

export const contentLineSchema = z
  .object({
    order: z.number().int().positive(),
    speaker: speakerSchema,
    text: z.string().trim().min(1, "日文原文不能为空").max(2_000),
    reading: z.string().trim().max(2_000).optional(),
    translationZh: z.string().trim().max(4_000).optional(),
    translationEn: z.string().trim().max(4_000).optional(),
    startMs: z.number().int().nonnegative().optional(),
    endMs: z.number().int().positive().optional(),
    note: z.string().trim().max(2_000).optional(),
  })
  .superRefine((line, context) => {
    if (
      line.startMs !== undefined &&
      line.endMs !== undefined &&
      line.startMs >= line.endMs
    ) {
      context.addIssue({
        code: "custom",
        path: ["endMs"],
        message: "endMs 必须大于 startMs",
      });
    }
    if (
      (line.startMs === undefined && line.endMs !== undefined) ||
      (line.startMs !== undefined && line.endMs === undefined)
    ) {
      context.addIssue({
        code: "custom",
        path: ["startMs"],
        message: "startMs 和 endMs 必须同时填写或同时留空",
      });
    }
  });

export const contentDialogueSchema = z.object({
  number: z.number().int().positive(),
  lines: z.array(contentLineSchema).min(1, "每组对话至少需要一行台词"),
});

export const contentLessonSchema = z.object({
  sectionNumber: z.number().int().positive(),
  level: lessonLevelSchema,
  title: z.string().trim().min(1).max(200).optional(),
  subtitle: z.string().trim().max(300).optional(),
  trackNumber: z.string().trim().min(1, "音轨编号不能为空").max(80),
  pdfPage: z.number().int().positive().optional(),
  dialogues: z.array(contentDialogueSchema).min(1, "课程至少需要一组对话"),
  expressions: z
    .array(
      z.object({
        expression: z.string().trim().min(1),
        reading: z.string().trim().optional(),
        explanationZh: z.string().trim().optional(),
        explanationJa: z.string().trim().optional(),
        example: z.string().trim().optional(),
        tags: z.array(z.string().trim().min(1)).default([]),
      }),
    )
    .default([]),
});

export const contentImportSchema = z.object({
  unit: z.object({
    number: z.number().int().positive(),
    title: z.string().trim().min(1, "Unit 标题不能为空").max(200),
    subtitle: z.string().trim().max(300).optional(),
    description: z.string().trim().max(2_000).optional(),
  }),
  lessons: z.array(contentLessonSchema).min(1, "至少需要一节课程"),
});

export type ContentImport = z.infer<typeof contentImportSchema>;
export type ContentLesson = z.infer<typeof contentLessonSchema>;

export const unitFormSchema = z.object({
  number: z.coerce.number().int().positive("Unit 编号必须大于 0"),
  title: z.string().trim().min(1, "请输入 Unit 标题").max(200),
  subtitle: z.string().trim().max(300).optional(),
  description: z.string().trim().max(2_000).optional(),
});

export const lessonFormSchema = z.object({
  unitId: z.string().min(1),
  sectionNumber: z.coerce.number().int().positive(),
  level: lessonLevelSchema,
  title: z.string().trim().min(1),
  subtitle: z.string().trim().max(300).optional(),
  trackNumber: z.string().trim().min(1),
  pdfPage: z.coerce.number().int().positive().optional(),
});

export const practiceRecordSchema = z.object({
  lessonId: z.string().min(1),
  dialogueId: z.string().optional(),
  lineId: z.string().optional(),
  mode: z.enum([
    "FULL",
    "SPEAKER_A",
    "SPEAKER_B",
    "DELAYED",
    "SINGLE_LINE",
    "FULL_DIALOGUE",
    "ROLEPLAY_A",
    "ROLEPLAY_B",
    "ROLEPLAY_RANDOM",
  ]),
  startedAt: z.iso.datetime({ offset: true }),
  durationMs: z.number().int().nonnegative(),
  recordingPath: z.string().max(500).optional(),
  selfPronunciationScore: z.number().int().min(1).max(5).optional(),
  selfRhythmScore: z.number().int().min(1).max(5).optional(),
  selfFluencyScore: z.number().int().min(1).max(5).optional(),
  note: z.string().trim().max(2_000).optional(),
  completed: z.boolean().default(true),
  startedWithinTarget: z.boolean().optional(),
});

export const dictationAttemptSchema = z.object({
  lessonId: z.string().min(1),
  lineId: z.string().min(1),
  answer: z.string().max(4_000),
  normalized: z.string().max(4_000),
  accuracy: z.number().min(0).max(100),
  correct: z.boolean(),
  diff: z.array(
    z.object({
      kind: z.enum(["equal", "replace", "missing", "extra"]),
      expected: z.string().optional(),
      actual: z.string().optional(),
    }),
  ),
  addedToReview: z.boolean().default(false),
});

export const expressionReviewSchema = z.object({
  expressionId: z.string().min(1),
  rating: z.enum(["KNOW", "UNCERTAIN", "AGAIN"]),
});

export const expressionFavoriteSchema = z.object({
  expressionId: z.string().min(1),
  favorite: z.boolean(),
});

export const jsonSchemaDocument = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "Shadowing Coach Content Import",
  type: "object",
  required: ["unit", "lessons"],
  properties: {
    unit: {
      type: "object",
      required: ["number", "title"],
      properties: {
        number: { type: "integer", minimum: 1 },
        title: { type: "string", minLength: 1 },
        subtitle: { type: "string" },
        description: { type: "string" },
      },
      additionalProperties: false,
    },
    lessons: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["sectionNumber", "level", "trackNumber", "dialogues"],
        properties: {
          sectionNumber: { type: "integer", minimum: 1 },
          level: { enum: ["INTERMEDIATE", "ADVANCED"] },
          title: { type: "string" },
          subtitle: { type: "string" },
          trackNumber: { type: "string", minLength: 1 },
          pdfPage: { type: "integer", minimum: 1 },
          dialogues: { type: "array", minItems: 1 },
          expressions: { type: "array" },
        },
      },
    },
  },
  additionalProperties: false,
} as const;
