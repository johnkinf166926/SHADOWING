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
import { calculateStudyStreak, studyDateKey } from "../study-date";
import { ensureDatabase } from "./database";
import { getDatabase } from "./runtime";

interface UnitRow {
  id: string;
  number: number;
  title: string;
  subtitle: string | null;
  description: string | null;
}

interface CourseOverviewRow extends UnitRow {
  lessonCount: number;
  trackCount: number;
  progress: number;
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

interface LessonDialogueRow extends LessonRow {
  dialogueId: string | null;
  dialogueNumber: number | null;
}

interface DialogueRow {
  id: string;
  number: number;
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

interface UnitSummaryRow extends UnitRow {
  progress: number;
}

interface UnitTrackSummaryRow {
  id: string;
  lessonId: string;
  sectionNumber: number;
  level: LessonLevel;
  sourceTrackNumber: string;
  pdfPage: number | null;
  dialogueNumber: number;
  lineCount: number;
  firstSpeaker: Speaker | null;
  firstText: string | null;
}

interface HomeCourseTargetRow {
  unitId: string;
  unitNumber: number;
  unitTitle: string;
  lessonId: string;
  lessonTitle: string;
  sectionNumber: number;
  level: LessonLevel;
  sourceTrackNumber: string;
  status: LessonStatus;
  lastPracticedAt: string | null;
  dialogueId: string | null;
  trackNumber: number | null;
}

interface HomeDashboardStatsRow {
  todayDurationMs: number;
  todaySessionCount: number;
  pendingReviewCount: number;
  dictationAccuracy: number | null;
  averageSelfRating: number | null;
}

interface StudyDayRow {
  studyDate: string;
}

interface TrackContextRow extends LessonRow {
  dialogueId: string;
  dialogueNumber: number;
  sectionTrackNumber: number;
  previousTrackId: string | null;
  previousTrackNumber: number | null;
  previousLessonId: string | null;
  nextTrackId: string | null;
  nextTrackNumber: number | null;
  nextLessonId: string | null;
}

export interface CourseOverview {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  description: string;
  progress: number;
  lessonCount: number;
  trackCount: number;
}

export interface UnitTrackSummary {
  id: string;
  number: number;
  lessonId: string;
  sectionNumber: number;
  level: LessonLevel;
  sourceTrackNumber: string;
  pdfPage?: number;
  lineCount: number;
  firstLine?: {
    speaker: Speaker;
    text: string;
  };
}

export interface UnitSectionSummary {
  number: number;
  level: LessonLevel;
  tracks: UnitTrackSummary[];
}

export interface CourseUnitSummary {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  description: string;
  progress: number;
  sections: UnitSectionSummary[];
}

export interface HomeCourseTarget {
  unit: {
    id: string;
    number: number;
    title: string;
  };
  lesson: {
    id: string;
    unitId: string;
    title: string;
    sectionNumber: number;
    level: LessonLevel;
    trackNumber: string;
    progress: number;
    lastPracticedAt?: string;
  };
  track?: {
    id: string;
    number: number;
  };
}

export interface HomeDashboardStats {
  todayDurationMs: number;
  todayMinutes: number;
  todaySessionCount: number;
  goalMinutes: number;
  goalProgress: number;
  streakDays: number;
  pendingReviewCount: number;
  dictationAccuracy?: number;
  averageSelfRating?: number;
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

const courseOverviewSql = `
  WITH lesson_summary AS (
    SELECT
      unit_id AS unitId,
      COUNT(*) AS lessonCount,
      ROUND(
        AVG(
          CASE status
            WHEN 'COMPLETED' THEN 100
            WHEN 'IN_PROGRESS' THEN 50
            ELSE 0
          END
        )
      ) AS progress
    FROM lessons
    GROUP BY unit_id
  ),
  track_summary AS (
    SELECT
      l.unit_id AS unitId,
      COUNT(d.id) AS trackCount
    FROM lessons l
    LEFT JOIN dialogues d ON d.lesson_id = l.id
    GROUP BY l.unit_id
  )
  SELECT
    u.id,
    u.number,
    u.title,
    u.subtitle,
    u.description,
    COALESCE(ls.lessonCount, 0) AS lessonCount,
    COALESCE(ts.trackCount, 0) AS trackCount,
    COALESCE(ls.progress, 0) AS progress
  FROM units u
  LEFT JOIN lesson_summary ls ON ls.unitId = u.id
  LEFT JOIN track_summary ts ON ts.unitId = u.id
  ORDER BY u.number`;

export async function listCourseOverviews(): Promise<CourseOverview[]> {
  await ensureDatabase();
  const result = await getDatabase()
    .prepare(courseOverviewSql)
    .all<CourseOverviewRow>();
  return result.results.map(mapCourseOverview);
}

/**
 * Compatibility read for API and non-list consumers that still expect Unit
 * objects. List pages use listCourseOverviews() and never receive Lesson
 * dialogue content.
 */
export async function listCourseUnits(): Promise<Unit[]> {
  await ensureDatabase();
  const database = getDatabase();
  const [unitResult, lessonResult] = await Promise.all([
    database.prepare(courseOverviewSql).all<CourseOverviewRow>(),
    database
      .prepare(
        `WITH dialogue_counts AS (
           SELECT lesson_id AS lessonId, COUNT(*) AS dialogueCount
           FROM dialogues
           GROUP BY lesson_id
         ),
         practice_summary AS (
           SELECT lesson_id AS lessonId, MAX(started_at) AS lastPracticedAt
           FROM practice_sessions
           GROUP BY lesson_id
         )
         SELECT
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
           COALESCE(dc.dialogueCount, 0) AS dialogueCount,
           ps.lastPracticedAt
         FROM lessons l
         LEFT JOIN audio_assets a ON a.id = l.audio_asset_id
         LEFT JOIN dialogue_counts dc ON dc.lessonId = l.id
         LEFT JOIN practice_summary ps ON ps.lessonId = l.id
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

  return unitResult.results.map((row) => ({
    ...mapUnitRow(row),
    progress: Number(row.progress),
    lessons: lessonsByUnit.get(row.id) ?? [],
  }));
}

/**
 * Full Unit detail retained for API compatibility. It is now one Unit lookup
 * followed by two current-Unit batch reads instead of per-Lesson reads.
 */
export async function getCourseUnit(unitId: string): Promise<Unit | undefined> {
  await ensureDatabase();
  const database = getDatabase();
  const unitRow = await database
    .prepare(
      `SELECT id, number, title, subtitle, description
       FROM units
       WHERE id = ?`,
    )
    .bind(unitId)
    .first<UnitRow>();
  if (!unitRow) {
    return undefined;
  }

  const [lessonResult, lineResult] = await Promise.all([
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
           (
             SELECT MAX(p.started_at)
             FROM practice_sessions p
             WHERE p.lesson_id = l.id
           ) AS lastPracticedAt,
           d.id AS dialogueId,
           d.number AS dialogueNumber
         FROM lessons l
         LEFT JOIN audio_assets a ON a.id = l.audio_asset_id
         LEFT JOIN dialogues d ON d.lesson_id = l.id
         WHERE l.unit_id = ?
         ORDER BY
           l.section_number,
           l.pdf_page,
           l.track_number,
           d.number`,
      )
      .bind(unitId)
      .all<LessonDialogueRow>(),
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
         JOIN lessons l ON l.id = d.lesson_id
         WHERE l.unit_id = ?
         ORDER BY
           l.section_number,
           l.pdf_page,
           l.track_number,
           d.number,
           dl.line_order`,
      )
      .bind(unitId)
      .all<LineRow>(),
  ]);

  const linesByDialogue = groupLinesByDialogue(lineResult.results);
  const lessonEntries = new Map<
    string,
    { row: LessonRow; dialogues: Dialogue[] }
  >();
  for (const row of lessonResult.results) {
    let entry = lessonEntries.get(row.id);
    if (!entry) {
      entry = { row, dialogues: [] };
      lessonEntries.set(row.id, entry);
    }
    if (row.dialogueId && row.dialogueNumber !== null) {
      entry.dialogues.push({
        id: row.dialogueId,
        number: Number(row.dialogueNumber),
        lines: linesByDialogue.get(row.dialogueId) ?? [],
      });
    }
  }
  const lessons = [...lessonEntries.values()].map(({ row, dialogues }) =>
    mapLesson(row, dialogues),
  );

  return {
    ...mapUnitRow(unitRow),
    progress: averageLessonProgress(lessons),
    lessons,
  };
}

/**
 * Unit page read model: Unit metadata plus one compact row per Track. The
 * query deliberately excludes translations, readings, notes, and timings.
 */
export async function getCourseUnitSummary(
  unitId: string,
): Promise<CourseUnitSummary | undefined> {
  await ensureDatabase();
  const database = getDatabase();
  const unitRow = await database
    .prepare(
      `SELECT
         u.id,
         u.number,
         u.title,
         u.subtitle,
         u.description,
         COALESCE(
           (
             SELECT ROUND(
               AVG(
                 CASE l.status
                   WHEN 'COMPLETED' THEN 100
                   WHEN 'IN_PROGRESS' THEN 50
                   ELSE 0
                 END
               )
             )
             FROM lessons l
             WHERE l.unit_id = u.id
           ),
           0
         ) AS progress
       FROM units u
       WHERE u.id = ?`,
    )
    .bind(unitId)
    .first<UnitSummaryRow>();
  if (!unitRow) {
    return undefined;
  }

  const trackResult = await database
    .prepare(
      `WITH unit_tracks AS (
         SELECT
           d.id,
           d.lesson_id AS lessonId,
           d.number AS dialogueNumber,
           l.section_number AS sectionNumber,
           l.level,
           l.track_number AS sourceTrackNumber,
           l.pdf_page AS pdfPage
         FROM dialogues d
         JOIN lessons l ON l.id = d.lesson_id
         WHERE l.unit_id = ?
       ),
       line_counts AS (
         SELECT dl.dialogue_id AS dialogueId, COUNT(*) AS lineCount
         FROM dialogue_lines dl
         JOIN unit_tracks t ON t.id = dl.dialogue_id
         GROUP BY dl.dialogue_id
       ),
       first_lines AS (
         SELECT dialogueId, speaker AS firstSpeaker, text AS firstText
         FROM (
           SELECT
             dl.dialogue_id AS dialogueId,
             dl.speaker,
             dl.text,
             ROW_NUMBER() OVER (
               PARTITION BY dl.dialogue_id
               ORDER BY dl.line_order
             ) AS linePosition
           FROM dialogue_lines dl
           JOIN unit_tracks t ON t.id = dl.dialogue_id
         )
         WHERE linePosition = 1
       )
       SELECT
         t.id,
         t.lessonId,
         t.sectionNumber,
         t.level,
         t.sourceTrackNumber,
         t.pdfPage,
         t.dialogueNumber,
         COALESCE(lc.lineCount, 0) AS lineCount,
         fl.firstSpeaker,
         fl.firstText
       FROM unit_tracks t
       LEFT JOIN line_counts lc ON lc.dialogueId = t.id
       LEFT JOIN first_lines fl ON fl.dialogueId = t.id`,
    )
    .bind(unitId)
    .all<UnitTrackSummaryRow>();

  const orderedTracks = [...trackResult.results].sort(compareUnitTracks);
  const sections = new Map<number, UnitSectionSummary>();
  for (const row of orderedTracks) {
    const section = sections.get(row.sectionNumber) ?? {
      number: Number(row.sectionNumber),
      level: row.level,
      tracks: [],
    };
    section.tracks.push({
      id: row.id,
      number: section.tracks.length + 1,
      lessonId: row.lessonId,
      sectionNumber: Number(row.sectionNumber),
      level: row.level,
      sourceTrackNumber: row.sourceTrackNumber,
      pdfPage: row.pdfPage ?? undefined,
      lineCount: Number(row.lineCount),
      firstLine:
        row.firstSpeaker && row.firstText
          ? { speaker: row.firstSpeaker, text: row.firstText }
          : undefined,
    });
    sections.set(row.sectionNumber, section);
  }

  return {
    ...mapUnitRow(unitRow),
    progress: Number(unitRow.progress),
    sections: [...sections.values()].sort(
      (left, right) => left.number - right.number,
    ),
  };
}

/**
 * Home page target in one query. It returns only the first Lesson and its
 * first Track, while keeping section-local Track numbering identical.
 */
export async function getHomeCourseTarget(): Promise<
  HomeCourseTarget | undefined
> {
  await ensureDatabase();
  const row = await getDatabase()
    .prepare(
      `WITH first_lesson AS (
         SELECT
           u.id AS unitId,
           u.number AS unitNumber,
           u.title AS unitTitle,
           l.id AS lessonId,
           l.title AS lessonTitle,
           l.section_number AS sectionNumber,
           l.level,
           l.track_number AS sourceTrackNumber,
           l.status,
           (
             SELECT MAX(p.started_at)
             FROM practice_sessions p
             WHERE p.lesson_id = l.id
           ) AS lastPracticedAt
         FROM lessons l
         JOIN units u ON u.id = l.unit_id
         ORDER BY
           CASE l.status
             WHEN 'IN_PROGRESS' THEN 0
             WHEN 'NOT_STARTED' THEN 1
             ELSE 2
           END,
           u.number,
           l.section_number,
           l.track_number
         LIMIT 1
       ),
       numbered_tracks AS (
         SELECT
           d.id AS dialogueId,
           d.lesson_id AS lessonId,
           d.number AS dialogueNumber,
           ROW_NUMBER() OVER (
             PARTITION BY u.number, l.section_number
             ORDER BY
               l.pdf_page ASC,
               l.track_number ASC,
               d.number ASC
           ) AS trackNumber
         FROM dialogues d
         JOIN lessons l ON l.id = d.lesson_id
         JOIN units u ON u.id = l.unit_id
       )
       SELECT
         fl.*,
         nt.dialogueId,
         nt.trackNumber
       FROM first_lesson fl
       LEFT JOIN numbered_tracks nt ON nt.lessonId = fl.lessonId
       ORDER BY nt.dialogueNumber
       LIMIT 1`,
    )
    .first<HomeCourseTargetRow>();
  if (!row) {
    return undefined;
  }

  return {
    unit: {
      id: row.unitId,
      number: Number(row.unitNumber),
      title: row.unitTitle,
    },
    lesson: {
      id: row.lessonId,
      unitId: row.unitId,
      title: row.lessonTitle,
      sectionNumber: Number(row.sectionNumber),
      level: row.level,
      trackNumber: row.sourceTrackNumber,
      progress: lessonProgress(row.status),
      lastPracticedAt: row.lastPracticedAt ?? undefined,
    },
    track:
      row.dialogueId && row.trackNumber !== null
        ? { id: row.dialogueId, number: Number(row.trackNumber) }
        : undefined,
  };
}

export async function getHomeDashboardStats(
  now = new Date(),
): Promise<HomeDashboardStats> {
  await ensureDatabase();
  const database = getDatabase();
  const today = studyDateKey(now);
  const nowIso = now.toISOString();
  const [stats, studyDays] = await Promise.all([
    database
      .prepare(
        `SELECT
          (
            SELECT COALESCE(SUM(duration_ms), 0)
            FROM practice_sessions
            WHERE completed = 1
              AND date(started_at, '+9 hours') = ?
          ) AS todayDurationMs,
          (
            SELECT COUNT(*)
            FROM practice_sessions
            WHERE completed = 1
              AND date(started_at, '+9 hours') = ?
          ) AS todaySessionCount,
          (
            SELECT COUNT(*)
            FROM review_items
            WHERE next_review_at <= ?
          ) + (
            SELECT COUNT(*)
            FROM expressions
            WHERE next_review_at IS NOT NULL
              AND next_review_at <= ?
          ) AS pendingReviewCount,
          (
            SELECT AVG(accuracy)
            FROM (
              SELECT accuracy
              FROM dictation_attempts
              ORDER BY created_at DESC
              LIMIT 12
            )
          ) AS dictationAccuracy,
          (
            SELECT AVG(sessionScore)
            FROM (
              SELECT
                (
                  COALESCE(self_pronunciation_score, 0) +
                  COALESCE(self_rhythm_score, 0) +
                  COALESCE(self_fluency_score, 0)
                ) * 1.0 / (
                  (self_pronunciation_score IS NOT NULL) +
                  (self_rhythm_score IS NOT NULL) +
                  (self_fluency_score IS NOT NULL)
                ) AS sessionScore
              FROM practice_sessions
              WHERE self_pronunciation_score IS NOT NULL
                 OR self_rhythm_score IS NOT NULL
                 OR self_fluency_score IS NOT NULL
              ORDER BY started_at DESC
              LIMIT 12
            )
          ) AS averageSelfRating`,
      )
      .bind(today, today, nowIso, nowIso)
      .first<HomeDashboardStatsRow>(),
    database
      .prepare(
        `SELECT DISTINCT date(started_at, '+9 hours') AS studyDate
         FROM practice_sessions
         WHERE completed = 1
         ORDER BY studyDate DESC
         LIMIT 400`,
      )
      .all<StudyDayRow>(),
  ]);

  const todayDurationMs = Number(stats?.todayDurationMs ?? 0);
  const todayMinutes =
    todayDurationMs > 0 ? Math.max(1, Math.round(todayDurationMs / 60_000)) : 0;
  const goalMinutes = 20;

  return {
    todayDurationMs,
    todayMinutes,
    todaySessionCount: Number(stats?.todaySessionCount ?? 0),
    goalMinutes,
    goalProgress: Math.min(
      100,
      Math.round((todayDurationMs / (goalMinutes * 60_000)) * 100),
    ),
    streakDays: calculateStudyStreak(
      studyDays.results.map((row) => row.studyDate),
      today,
    ),
    pendingReviewCount: Number(stats?.pendingReviewCount ?? 0),
    dictationAccuracy:
      stats?.dictationAccuracy === null ||
      stats?.dictationAccuracy === undefined
        ? undefined
        : Math.round(Number(stats.dictationAccuracy)),
    averageSelfRating:
      stats?.averageSelfRating === null ||
      stats?.averageSelfRating === undefined
        ? undefined
        : Math.round(Number(stats.averageSelfRating) * 10) / 10,
  };
}

/**
 * Track detail in two queries: one windowed metadata/navigation lookup and
 * one current-Track Line lookup. No other Track content is returned.
 */
export async function getCourseTrack(
  trackId: string,
): Promise<CourseTrackWithLesson | undefined> {
  await ensureDatabase();
  const database = getDatabase();
  const context = await database
    .prepare(
      `WITH numbered_tracks AS (
         SELECT
           d.id AS dialogueId,
           d.lesson_id AS lessonId,
           d.number AS dialogueNumber,
           u.number AS unitNumber,
           l.section_number AS sectionNumber,
           l.pdf_page AS pdfPage,
           l.track_number AS sourceTrackNumber,
           ROW_NUMBER() OVER (
             PARTITION BY u.number, l.section_number
             ORDER BY
               l.pdf_page ASC,
               l.track_number ASC,
               d.number ASC
           ) AS trackNumber,
           ROW_NUMBER() OVER (
             ORDER BY
               u.number ASC,
               l.section_number ASC,
               l.pdf_page ASC,
               l.track_number ASC,
               d.number ASC
           ) AS coursePosition
         FROM dialogues d
         JOIN lessons l ON l.id = d.lesson_id
         JOIN units u ON u.id = l.unit_id
       ),
       navigated_tracks AS (
         SELECT
           *,
           LAG(dialogueId) OVER (
             ORDER BY coursePosition
           ) AS previousTrackId,
           LAG(trackNumber) OVER (
             ORDER BY coursePosition
           ) AS previousTrackNumber,
           LAG(lessonId) OVER (
             ORDER BY coursePosition
           ) AS previousLessonId,
           LEAD(dialogueId) OVER (
             ORDER BY coursePosition
           ) AS nextTrackId,
           LEAD(trackNumber) OVER (
             ORDER BY coursePosition
           ) AS nextTrackNumber,
           LEAD(lessonId) OVER (
             ORDER BY coursePosition
           ) AS nextLessonId
         FROM numbered_tracks
       )
       SELECT
         l.id,
         l.unit_id AS unitId,
         nt.unitNumber,
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
         (
           SELECT MAX(p.started_at)
           FROM practice_sessions p
           WHERE p.lesson_id = l.id
         ) AS lastPracticedAt,
         nt.dialogueId,
         nt.dialogueNumber,
         nt.trackNumber AS sectionTrackNumber,
         nt.previousTrackId,
         nt.previousTrackNumber,
         nt.previousLessonId,
         nt.nextTrackId,
         nt.nextTrackNumber,
         nt.nextLessonId
       FROM navigated_tracks nt
       JOIN lessons l ON l.id = nt.lessonId
       LEFT JOIN audio_assets a ON a.id = l.audio_asset_id
       WHERE nt.dialogueId = ?`,
    )
    .bind(trackId)
    .first<TrackContextRow>();
  if (!context) {
    return undefined;
  }

  const lineResult = await database
    .prepare(
      `SELECT
         id,
         dialogue_id AS dialogueId,
         line_order AS "order",
         speaker,
         text,
         reading,
         translation_zh AS translationZh,
         translation_en AS translationEn,
         start_ms AS startMs,
         end_ms AS endMs,
         note
       FROM dialogue_lines
       WHERE dialogue_id = ?
       ORDER BY line_order`,
    )
    .bind(trackId)
    .all<LineRow>();
  const dialogue: Dialogue = {
    id: context.dialogueId,
    number: Number(context.dialogueNumber),
    lines: lineResult.results.map(mapLine),
  };
  const trackNumber = Number(context.sectionTrackNumber);
  const lesson: LessonWithUnit = {
    ...mapLesson(context, [dialogue]),
    unitNumber: Number(context.unitNumber),
    title: `Track ${trackNumber}`,
    subtitle: `Unit ${context.unitNumber} · Section ${context.sectionNumber} · Disk ${context.trackNumber}`,
    dialogues: [dialogue],
  };
  const track: CourseTrack = {
    id: dialogue.id,
    number: trackNumber,
    lessonId: lesson.id,
    sectionNumber: lesson.sectionNumber,
    level: lesson.level,
    sourceTrackNumber: lesson.trackNumber,
    pdfPage: lesson.pdfPage,
    favorite: lesson.favorite,
    progress: lesson.progress,
    dialogue,
  };

  return {
    track,
    lesson,
    previousTrack: mapTrackReference(
      context.previousTrackId,
      context.previousTrackNumber,
      context.previousLessonId,
    ),
    nextTrack: mapTrackReference(
      context.nextTrackId,
      context.nextTrackNumber,
      context.nextLessonId,
    ),
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

/**
 * Full Lesson detail is reserved for Lesson-level pages and practice modes
 * without a selected Track.
 */
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

  const linesByDialogue = groupLinesByDialogue(lineResult.results);
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

function mapCourseOverview(row: CourseOverviewRow): CourseOverview {
  return {
    ...mapUnitRow(row),
    progress: Number(row.progress),
    lessonCount: Number(row.lessonCount),
    trackCount: Number(row.trackCount),
  };
}

function mapUnitRow(row: UnitRow) {
  return {
    id: row.id,
    number: Number(row.number),
    title: row.title,
    subtitle: row.subtitle ?? "",
    description: row.description ?? "",
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

function mapLine(row: LineRow): DialogueLine {
  return {
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
  };
}

function groupLinesByDialogue(rows: LineRow[]) {
  const linesByDialogue = new Map<string, DialogueLine[]>();
  for (const row of rows) {
    const lines = linesByDialogue.get(row.dialogueId) ?? [];
    lines.push(mapLine(row));
    linesByDialogue.set(row.dialogueId, lines);
  }
  return linesByDialogue;
}

function mapTrackReference(
  id: string | null,
  number: number | null,
  lessonId: string | null,
): CourseTrackReference | undefined {
  return id && number !== null && lessonId
    ? { id, number: Number(number), lessonId }
    : undefined;
}

function compareUnitTracks(
  left: UnitTrackSummaryRow,
  right: UnitTrackSummaryRow,
) {
  if (left.sectionNumber !== right.sectionNumber) {
    return left.sectionNumber - right.sectionNumber;
  }
  if (
    left.pdfPage !== null &&
    right.pdfPage !== null &&
    left.pdfPage !== right.pdfPage
  ) {
    return left.pdfPage - right.pdfPage;
  }
  const sourceTrackDifference = left.sourceTrackNumber.localeCompare(
    right.sourceTrackNumber,
    undefined,
    { numeric: true },
  );
  return sourceTrackDifference !== 0
    ? sourceTrackDifference
    : left.dialogueNumber - right.dialogueNumber;
}

function averageLessonProgress(lessons: Lesson[]) {
  return lessons.length === 0
    ? 0
    : Math.round(
        lessons.reduce((total, lesson) => total + lesson.progress, 0) /
          lessons.length,
      );
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
  if (storagePath.startsWith("/")) {
    return storagePath;
  }
  const key = storagePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `/api/files/${key}`;
}
