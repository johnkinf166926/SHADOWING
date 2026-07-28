import { randomUUID } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databasePath = join(
  tmpdir(),
  `shadowing-coach-test-${process.pid}-${randomUUID()}.db`,
);
const databaseUrl = `file:${databasePath.replaceAll("\\", "/")}`;
const prisma = new PrismaClient({
  datasources: { db: { url: databaseUrl } },
});
const ids = {
  unit: "integration-unit",
  lesson: "integration-lesson",
  dialogue: "integration-dialogue",
  line: "integration-line",
  audio: "integration-audio",
  practice: "integration-practice",
  dictation: "integration-dictation",
};

beforeAll(async () => {
  const migration = await readFile(
    new URL(
      "../../prisma/migrations/20260724040000_init/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const statements = migration
    .split(";")
    .map((statement) => statement.trim())
    .filter(
      (statement) =>
        statement && !/^--\s*Create(Index|Table)\s*$/u.test(statement),
    );
  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }
});

afterAll(async () => {
  await prisma.$disconnect();
  await unlink(databasePath).catch(() => undefined);
  await unlink(`${databasePath}-journal`).catch(() => undefined);
});

describe.sequential("SQLite integration workflows", () => {
  it("creates a Unit", async () => {
    const unit = await prisma.unit.create({
      data: {
        id: ids.unit,
        number: 999,
        title: "統合テスト",
        subtitle: "集成测试",
      },
    });
    expect(unit.number).toBe(999);
  });

  it("imports a Lesson with dialogue lines", async () => {
    const lesson = await prisma.lesson.create({
      data: {
        id: ids.lesson,
        unitId: ids.unit,
        sectionNumber: 1,
        level: "INTERMEDIATE",
        title: "予定を確認する",
        trackNumber: "TEST-999",
        dialogues: {
          create: {
            id: ids.dialogue,
            number: 1,
            lines: {
              create: {
                id: ids.line,
                order: 1,
                speaker: "A",
                text: "明日の予定を確認します。",
                startMs: 0,
                endMs: 2_800,
              },
            },
          },
        },
      },
      include: { dialogues: { include: { lines: true } } },
    });
    expect(lesson.dialogues[0].lines).toHaveLength(1);
  });

  it("stores uploaded audio metadata and links it to a Lesson", async () => {
    const audio = await prisma.audioAsset.create({
      data: {
        id: ids.audio,
        filename: "sample.wav",
        storagePath: "audio/integration.wav",
        mimeType: "audio/wav",
        sizeBytes: 2_048,
        durationMs: 2_800,
      },
    });
    const lesson = await prisma.lesson.update({
      where: { id: ids.lesson },
      data: { audioAssetId: audio.id },
    });
    expect(lesson.audioAssetId).toBe(ids.audio);
  });

  it("saves a practice session", async () => {
    const practice = await prisma.practiceSession.create({
      data: {
        id: ids.practice,
        lessonId: ids.lesson,
        dialogueId: ids.dialogue,
        lineId: ids.line,
        mode: "SINGLE_LINE",
        startedAt: new Date("2026-07-24T10:00:00.000Z"),
        durationMs: 3_100,
        completed: true,
        selfPronunciationScore: 4,
        selfRhythmScore: 4,
        selfFluencyScore: 3,
      },
    });
    expect(practice.completed).toBe(true);
  });

  it("saves a dictation result", async () => {
    const attempt = await prisma.dictationAttempt.create({
      data: {
        id: ids.dictation,
        lessonId: ids.lesson,
        lineId: ids.line,
        answer: "明日の予定を確認します。",
        normalized: "明日の予定を確認します。",
        accuracy: 100,
        correct: true,
        diffJson: "[]",
      },
    });
    expect(attempt.accuracy).toBe(100);
  });
});
