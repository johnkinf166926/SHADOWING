import type {
  Dialogue,
  DialogueLine,
  Lesson,
  LessonLevel,
  LessonStatus,
  Speaker,
  Unit,
} from "../types";
import type { CourseTrack, CourseTrackReference } from "../course-structure";
import { ensureDatabase } from "./database";
import { getDatabase } from "./runtime";

interface UnitRow {
  id: string;
  number: number;
  title: string;
  subtitle: string | null;
  description: string | null;
}

interface LessonRow {
  id: string;
  unitId: string;
  unitNumber?: number;
  sectionNumber: number;
  level: LessonLevel;
  title: string;
  subtitle: string | null;
  trackNumber: string;
  pdfPage: number | null;
  status: LessonStatus;
  favorite: number;
  storagePath: string | null;
  durationMs: number | null;
  dialogueCount?: number;
  lastPracticedAt: string | null;
}

interface DialogueRow {
  id: string;
  number: number;
}

interface OrderedDialogueRow {
  id: string;
  lessonId: string;
  unitNumber: number;
  sectionNumber: number;
}

interface LineRow {
  id: string;
  dialogueId: string;
  order: number;
  speaker: Speaker;
  text: string;
  reading: string | null;
  translationZh: string | null;
  translationEn: string | null;
  startMs: number | null;
  endMs: number | null;
  note: string | null;
}

export interface LessonWithUnit extends Lesson {
  unitNumber: number;
}

export interface CourseTrackWithLesson {
  track: CourseTrack;
  lesson: LessonWithUnit;
  previousTrack?: CourseTrackReference;
  nextTrack?: CourseTrackReference;
}

export async function listCourseUnits(): Promise<Unit[]> {
  await ensureDatabase();
  const database = getDatabase();
  const [unitResult, lessonResult] = await Promise.all([
    database
      .prepare(
        `SELECT id, number, title, subtitle, description
         FROM units
         ORDER BY number`,
      )
      .all<UnitRow>(),
    database
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
          l.status,
          l.favorite,
          a.storage_path AS storagePath,
          a.duration_ms AS durationMs,
          COUNT(DISTINCT d.id) AS dialogueCount,
          MAX(p.started_at) AS lastPracticedAt
         FROM lessons l
         LEFT JOIN audio_assets a ON a.id = l.audio_asset_id
         LEFT JOIN dialogues d ON d.lesson_id = l.id
         LEFT JOIN practice_sessions p ON p.lesson_id = l.id
         GROUP BY l.id
         ORDER BY l.unit_id, l.section_number, l.track_number`,
      )
      .all<LessonRow>(),
  ]);

  const lessonsByUnit = new Map<string, Lesson[]>();
  for (const row of lessonResult.results) {
    const lessons = lessonsByUnit.get(row.unitId) ?? [];
    lessons.push(mapLesson(row, []));
    lessonsByUnit.set(row.unitId, lessons);
  }

  return unitResult.results.map((row) => {
    const lessons = lessonsByUnit.get(row.id) ?? [];
    const progress =
      lessons.length === 0
        ? 0
        : Math.round(
            lessons.reduce((total, lesson) => total + lesson.progress, 0) /
              lessons.length,
          );
    return {
      id: row.id,
      number: Number(row.number),
      title: row.title,
      subtitle: row.subtitle ?? "",
      description: row.description ?? "",
      progress,
      lessons,
    };
  });
}

export async function getCourseUnit(unitId: string): Promise<Unit | undefined> {
  const units = await listCourseUnits();
  const unit = units.find((candidate) => candidate.id === unitId);
  if (!unit) {
    return undefined;
  }
  const lessons = (
    await Promise.all(unit.lessons.map((lesson) => getCourseLesson(lesson.id)))
  ).filter((lesson): lesson is LessonWithUnit => lesson !== undefined);
  return { ...unit, lessons };
}

export async function getCourseTrack(
  trackId: string,
): Promise<CourseTrackWithLesson | undefined> {
  await ensureDatabase();
  const database = getDatabase();
  const dialogue = await database
    .prepare(
      `SELECT lesson_id AS lessonId
       FROM dialogues
       WHERE id = ?`,
    )
    .bind(trackId)
    .first<{ lessonId: string }>();
  if (!dialogue) {
    return undefined;
  }

  const lesson = await getCourseLesson(dialogue.lessonId);
  if (!lesson) {
    return undefined;
  }
  const selectedDialogue = lesson.dialogues.find(
    (candidate) => candidate.id === trackId,
  );
  const orderedDialogues = await database
    .prepare(
      `SELECT
        d.id,
        d.lesson_id AS lessonId,
        u.number AS unitNumber,
        l.section_number AS sectionNumber
       FROM dialogues d
       INNER JOIN lessons l ON l.id = d.lesson_id
       INNER JOIN units u ON u.id = l.unit_id
       ORDER BY
         u.number ASC,
         l.section_number ASC,
         l.pdf_page ASC,
         l.track_number ASC,
         d.number ASC`,
    )
    .all<OrderedDialogueRow>();
  const sectionTrackCounts = new Map<string, number>();
  const courseTracks = orderedDialogues.results.map((candidate) => {
    const sectionKey = `${candidate.unitNumber}:${candidate.sectionNumber}`;
    const number = (sectionTrackCounts.get(sectionKey) ?? 0) + 1;
    sectionTrackCounts.set(sectionKey, number);
    return { ...candidate, number };
  });
  const trackIndex = courseTracks.findIndex(
    (candidate) => candidate.id === trackId,
  );
  if (!selectedDialogue || trackIndex < 0) {
    return undefined;
  }
  const track: CourseTrack = {
    id: selectedDialogue.id,
    number: courseTracks[trackIndex].number,
    lessonId: lesson.id,
    sectionNumber: lesson.sectionNumber,
    level: lesson.level,
    sourceTrackNumber: lesson.trackNumber,
    pdfPage: lesson.pdfPage,
    favorite: lesson.favorite,
    progress: lesson.progress,
    dialogue: selectedDialogue,
  };
  const previousDialogue = courseTracks[trackIndex - 1];
  const nextDialogue = courseTracks[trackIndex + 1];

  return {
    track,
    previousTrack: previousDialogue
      ? {
          id: previousDialogue.id,
          number: previousDialogue.number,
          lessonId: previousDialogue.lessonId,
        }
      : undefined,
    nextTrack: nextDialogue
      ? {
          id: nextDialogue.id,
          number: nextDialogue.number,
          lessonId: nextDialogue.lessonId,
        }
      : undefined,
    lesson: {
      ...lesson,
      title: `Track ${track.number}`,
      subtitle: `Unit ${lesson.unitNumber} · Section ${lesson.sectionNumber} · Disk ${lesson.trackNumber}`,
      dialogues: [track.dialogue],
    },
  };
}

export async function getPracticeCourse(
  lessonId: string,
  trackId?: string,
): Promise<CourseTrackWithLesson | { lesson: LessonWithUnit } | undefined> {
  if (!trackId) {
    const lesson = await getCourseLesson(lessonId);
    return lesson ? { lesson } : undefined;
  }
  const courseTrack = await getCourseTrack(trackId);
  return courseTrack?.lesson.id === lessonId ? courseTrack : undefined;
}

export async function getCourseLesson(
  lessonId: string,
): Promise<LessonWithUnit | undefined> {
  await ensureDatabase();
  const database = getDatabase();
  const lessonRow = await database
    .prepare(
      `SELECT
        l.id,
        l.unit_id AS unitId,
        u.number AS unitNumber,
        l.section_number AS sectionNumber,
        l.level,
        l.title,
        l.subtitle,
        l.track_number AS trackNumber,
        l.pdf_page AS pdfPage,
        l.status,
        l.favorite,
        a.storage_path AS storagePath,
        a.duration_ms AS durationMs,
        MAX(p.started_at) AS lastPracticedAt
       FROM lessons l
       JOIN units u ON u.id = l.unit_id
       LEFT JOIN audio_assets a ON a.id = l.audio_asset_id
       LEFT JOIN practice_sessions p ON p.lesson_id = l.id
       WHERE l.id = ?
       GROUP BY l.id`,
    )
    .bind(lessonId)
    .first<LessonRow>();
  if (!lessonRow) {
    return undefined;
  }

  const [dialogueResult, lineResult] = await Promise.all([
    database
      .prepare(
        `SELECT id, number
         FROM dialogues
         WHERE lesson_id = ?
         ORDER BY number`,
      )
      .bind(lessonId)
      .all<DialogueRow>(),
    database
      .prepare(
        `SELECT
          dl.id,
          dl.dialogue_id AS dialogueId,
          dl.line_order AS "order",
          dl.speaker,
          dl.text,
          dl.reading,
          dl.translation_zh AS translationZh,
          dl.translation_en AS translationEn,
          dl.start_ms AS startMs,
          dl.end_ms AS endMs,
          dl.note
         FROM dialogue_lines dl
         JOIN dialogues d ON d.id = dl.dialogue_id
         WHERE d.lesson_id = ?
         ORDER BY d.number, dl.line_order`,
      )
      .bind(lessonId)
      .all<LineRow>(),
  ]);

  const linesByDialogue = new Map<string, DialogueLine[]>();
  for (const row of lineResult.results) {
    const lines = linesByDialogue.get(row.dialogueId) ?? [];
    lines.push({
      id: row.id,
      order: Number(row.order),
      speaker: row.speaker,
      text: row.text,
      reading: row.reading ?? undefined,
      translationZh: row.translationZh ?? undefined,
      translationEn: row.translationEn ?? undefined,
      startMs: row.startMs ?? undefined,
      endMs: row.endMs ?? undefined,
      note: row.note ?? undefined,
    });
    linesByDialogue.set(row.dialogueId, lines);
  }
  const dialogues = dialogueResult.results.map((row) => ({
    id: row.id,
    number: Number(row.number),
    lines: linesByDialogue.get(row.id) ?? [],
  }));

  return {
    ...mapLesson(lessonRow, dialogues),
    unitNumber: Number(lessonRow.unitNumber),
  };
}

function mapLesson(row: LessonRow, dialogues: Dialogue[]): Lesson {
  return {
    id: row.id,
    unitId: row.unitId,
    sectionNumber: Number(row.sectionNumber),
    level: row.level,
    title: row.title,
    subtitle: row.subtitle ?? "",
    trackNumber: row.trackNumber,
    pdfPage: row.pdfPage ?? undefined,
    status: row.status,
    favorite: Boolean(row.favorite),
    progress: lessonProgress(row.status),
    lastPracticedAt: row.lastPracticedAt ?? undefined,
    audioUrl: row.storagePath ? fileUrl(row.storagePath) : undefined,
    durationMs: row.durationMs ?? undefined,
    dialogueCount: Number(row.dialogueCount ?? dialogues.length),
    dialogues,
  };
}

function lessonProgress(status: LessonStatus) {
  if (status === "COMPLETED") {
    return 100;
  }
  if (status === "IN_PROGRESS") {
    return 50;
  }
  return 0;
}

function fileUrl(storagePath: string) {
  const key = storagePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `/api/files/${key}`;
}
