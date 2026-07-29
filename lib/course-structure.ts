import type { Dialogue, Lesson, LessonLevel } from "./types";

export interface CourseTrack {
  id: string;
  number: number;
  lessonId: string;
  sectionNumber: number;
  level: LessonLevel;
  sourceTrackNumber: string;
  pdfPage?: number;
  favorite: boolean;
  progress: number;
  dialogue: Dialogue;
}

export interface CourseTrackReference {
  id: string;
  number: number;
  lessonId: string;
}

export type PracticeSurface =
  "practice" | "shadowing" | "dictation" | "roleplay";

export interface CourseSection {
  number: number;
  level: LessonLevel;
  tracks: CourseTrack[];
}

export function buildCourseSections(lessons: Lesson[]): CourseSection[] {
  const sections = new Map<number, CourseSection>();
  const orderedLessons = [...lessons].sort((left, right) => {
    if (left.sectionNumber !== right.sectionNumber) {
      return left.sectionNumber - right.sectionNumber;
    }
    if (
      left.pdfPage !== undefined &&
      right.pdfPage !== undefined &&
      left.pdfPage !== right.pdfPage
    ) {
      return left.pdfPage - right.pdfPage;
    }
    return left.trackNumber.localeCompare(right.trackNumber, undefined, {
      numeric: true,
    });
  });

  for (const lesson of orderedLessons) {
    const section = sections.get(lesson.sectionNumber) ?? {
      number: lesson.sectionNumber,
      level: lesson.level,
      tracks: [],
    };
    for (const dialogue of [...lesson.dialogues].sort(
      (left, right) => left.number - right.number,
    )) {
      section.tracks.push({
        id: dialogue.id,
        number: section.tracks.length + 1,
        lessonId: lesson.id,
        sectionNumber: lesson.sectionNumber,
        level: lesson.level,
        sourceTrackNumber: lesson.trackNumber,
        pdfPage: lesson.pdfPage,
        favorite: lesson.favorite,
        progress: lesson.progress,
        dialogue,
      });
    }
    sections.set(lesson.sectionNumber, section);
  }

  return [...sections.values()].sort(
    (left, right) => left.number - right.number,
  );
}

export function courseTrackHref(
  track: CourseTrackReference,
  practiceSurface?: PracticeSurface,
) {
  return practiceSurface
    ? `/${practiceSurface}/${track.lessonId}?dialogue=${track.id}`
    : `/tracks/${track.id}`;
}
