export type Speaker = "A" | "B" | "NARRATOR";
export type LessonLevel = "INTERMEDIATE" | "ADVANCED";
export type LessonStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
export type PracticeMode =
  | "FULL"
  | "SPEAKER_A"
  | "SPEAKER_B"
  | "DELAYED"
  | "SINGLE_LINE"
  | "FULL_DIALOGUE"
  | "ROLEPLAY_A"
  | "ROLEPLAY_B"
  | "ROLEPLAY_RANDOM";

export interface DialogueLine {
  id: string;
  order: number;
  speaker: Speaker;
  text: string;
  reading?: string;
  translationZh?: string;
  translationEn?: string;
  startMs?: number;
  endMs?: number;
  note?: string;
}

export interface Dialogue {
  id: string;
  number: number;
  lines: DialogueLine[];
}

export interface Lesson {
  id: string;
  unitId: string;
  sectionNumber: number;
  level: LessonLevel;
  title: string;
  subtitle: string;
  trackNumber: string;
  pdfPage?: number;
  status: LessonStatus;
  favorite: boolean;
  progress: number;
  lastPracticedAt?: string;
  audioUrl?: string;
  durationMs?: number;
  dialogueCount?: number;
  dialogues: Dialogue[];
}

export interface Unit {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  description: string;
  progress: number;
  lessons: Lesson[];
}

export interface ExpressionCard {
  id: string;
  expression: string;
  reading: string;
  explanationZh: string;
  explanationJa: string;
  example: string;
  sourceLesson: string;
  unitNumber: number;
  tags: string[];
  masteryLevel: number;
  nextReviewAt: string;
  favorite: boolean;
}

export interface PracticeRecordInput {
  lessonId: string;
  dialogueId?: string;
  lineId?: string;
  mode: PracticeMode;
  startedAt: string;
  durationMs: number;
  recordingPath?: string;
  selfPronunciationScore?: number;
  selfRhythmScore?: number;
  selfFluencyScore?: number;
  note?: string;
}
