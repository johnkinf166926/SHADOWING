import type { ExpressionCard, Unit } from "./types";

export const sampleUnits: Unit[] = [
  {
    id: "unit-1",
    number: 1,
    title: "人に頼む",
    subtitle: "请求与回应",
    description: "在日常场景中自然地提出请求、确认细节并礼貌回应。",
    progress: 68,
    lessons: [
      {
        id: "lesson-1",
        unitId: "unit-1",
        sectionNumber: 1,
        level: "INTERMEDIATE",
        title: "お願いの仕方",
        subtitle: "在咖啡店提出请求",
        trackNumber: "1-02",
        pdfPage: 8,
        status: "IN_PROGRESS",
        favorite: true,
        progress: 68,
        lastPracticedAt: "2026-07-23T19:40:00+09:00",
        audioUrl: "/audio/sample-dialogue.wav",
        durationMs: 16_000,
        dialogues: [
          {
            id: "dialogue-1",
            number: 1,
            lines: [
              {
                id: "line-1",
                order: 1,
                speaker: "A",
                text: "すみません、ちょっとお願いがあるんですが。",
                reading: "すみません、ちょっと おねがいが あるんですが。",
                translationZh: "不好意思，我有件事想拜托您。",
                startMs: 0,
                endMs: 3_800,
              },
              {
                id: "line-2",
                order: 2,
                speaker: "B",
                text: "はい、何でしょうか。",
                reading: "はい、なんでしょうか。",
                translationZh: "好的，请问是什么事？",
                startMs: 4_000,
                endMs: 6_600,
              },
              {
                id: "line-3",
                order: 3,
                speaker: "A",
                text: "この席を使わせていただけませんか。",
                reading: "この せきを つかわせて いただけませんか。",
                translationZh: "可以让我使用这个座位吗？",
                startMs: 7_000,
                endMs: 11_200,
              },
              {
                id: "line-4",
                order: 4,
                speaker: "B",
                text: "もちろんです。どうぞ。",
                reading: "もちろんです。どうぞ。",
                translationZh: "当然可以，请用。",
                startMs: 11_600,
                endMs: 14_800,
              },
            ],
          },
        ],
      },
      {
        id: "lesson-2",
        unitId: "unit-1",
        sectionNumber: 2,
        level: "ADVANCED",
        title: "丁寧に断る",
        subtitle: "婉转地拒绝请求",
        trackNumber: "1-03",
        pdfPage: 10,
        status: "NOT_STARTED",
        favorite: false,
        progress: 0,
        audioUrl: "/audio/sample-dialogue.wav",
        durationMs: 16_000,
        dialogues: [
          {
            id: "dialogue-2",
            number: 1,
            lines: [
              {
                id: "line-5",
                order: 1,
                speaker: "A",
                text: "来週、少しお時間をいただけないでしょうか。",
                reading:
                  "らいしゅう、すこし おじかんを いただけないでしょうか。",
                translationZh: "下周可以占用您一点时间吗？",
                startMs: 0,
                endMs: 4_300,
              },
              {
                id: "line-6",
                order: 2,
                speaker: "B",
                text: "申し訳ありませんが、来週は予定が詰まっております。",
                reading:
                  "もうしわけ ありませんが、らいしゅうは よていが つまっております。",
                translationZh: "非常抱歉，我下周的安排已经满了。",
                startMs: 4_600,
                endMs: 10_500,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "unit-2",
    number: 2,
    title: "意見を伝える",
    subtitle: "表达观点",
    description: "说明立场、补充理由并确认对方的理解。",
    progress: 34,
    lessons: [],
  },
  {
    id: "unit-3",
    number: 3,
    title: "話をまとめる",
    subtitle: "归纳与总结",
    description: "组织信息，让较长的说明清晰而自然。",
    progress: 0,
    lessons: [],
  },
];

export const sampleLesson = sampleUnits[0].lessons[0];

export const sampleExpressions: ExpressionCard[] = [
  {
    id: "expression-1",
    expression: "〜ていただけませんか",
    reading: "〜て いただけませんか",
    explanationZh: "礼貌地请求对方为自己做某事，比「〜てください」更委婉。",
    explanationJa: "相手に丁寧に依頼するときに使う表現。",
    example: "もう一度説明していただけませんか。",
    sourceLesson: "お願いの仕方",
    unitNumber: 1,
    tags: ["依頼", "丁寧語"],
    masteryLevel: 2,
    nextReviewAt: "2026-07-24T20:00:00+09:00",
    favorite: true,
  },
  {
    id: "expression-2",
    expression: "申し訳ありませんが",
    reading: "もうしわけ ありませんが",
    explanationZh: "在拒绝、说明不便或提出负面信息前使用的正式缓冲表达。",
    explanationJa: "断りや都合の悪い内容を伝える前の前置き。",
    example: "申し訳ありませんが、本日は満席です。",
    sourceLesson: "丁寧に断る",
    unitNumber: 1,
    tags: ["断り", "フォーマル"],
    masteryLevel: 1,
    nextReviewAt: "2026-07-24T20:00:00+09:00",
    favorite: false,
  },
  {
    id: "expression-3",
    expression: "〜ということですね",
    reading: "〜という ことですね",
    explanationZh: "复述并确认自己对对方内容的理解。",
    explanationJa: "相手の話を要約して確認するときの表現。",
    example: "締め切りは金曜日ということですね。",
    sourceLesson: "内容を確認する",
    unitNumber: 2,
    tags: ["確認", "会話"],
    masteryLevel: 3,
    nextReviewAt: "2026-07-28T20:00:00+09:00",
    favorite: false,
  },
];

export const sampleDashboard = {
  minutesToday: 12,
  streakDays: 7,
  reviewCount: 6,
  dictationAccuracy: 86,
  averageScore: 4.2,
};

export function findUnit(unitId: string) {
  return sampleUnits.find((unit) => unit.id === unitId);
}

export function findLesson(lessonId: string) {
  return sampleUnits
    .flatMap((unit) => unit.lessons)
    .find((lesson) => lesson.id === lessonId);
}
