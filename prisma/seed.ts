import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const unit = await prisma.unit.upsert({
    where: { number: 1 },
    update: {},
    create: {
      number: 1,
      title: "人に頼む",
      subtitle: "请求与回应",
      description: "虚构示例：练习礼貌提出请求与自然回应。",
    },
  });

  const lesson = await prisma.lesson.upsert({
    where: { trackNumber: "1-02" },
    update: {},
    create: {
      unitId: unit.id,
      sectionNumber: 1,
      level: "INTERMEDIATE",
      title: "お願いの仕方",
      subtitle: "在咖啡店提出请求",
      trackNumber: "1-02",
      pdfPage: 8,
      status: "IN_PROGRESS",
      dialogues: {
        create: {
          number: 1,
          lines: {
            create: [
              {
                order: 1,
                speaker: "A",
                text: "すみません、ちょっとお願いがあるんですが。",
                reading: "すみません、ちょっと おねがいが あるんですが。",
                translationZh: "不好意思，我有件事想拜托您。",
                startMs: 0,
                endMs: 3800,
              },
              {
                order: 2,
                speaker: "B",
                text: "はい、何でしょうか。",
                reading: "はい、なんでしょうか。",
                translationZh: "好的，请问是什么事？",
                startMs: 4000,
                endMs: 6600,
              },
            ],
          },
        },
      },
    },
  });

  const expression = await prisma.expression.upsert({
    where: { id: "seed-expression-1" },
    update: {},
    create: {
      id: "seed-expression-1",
      expression: "〜ていただけませんか",
      reading: "〜て いただけませんか",
      explanationZh: "礼貌地请求对方做某事。",
      explanationJa: "相手に丁寧に依頼するときに使う表現。",
      example: "もう一度説明していただけませんか。",
      tags: JSON.stringify(["依頼", "丁寧語"]),
      masteryLevel: 2,
      nextReviewAt: new Date(),
    },
  });

  await prisma.lessonExpression.upsert({
    where: {
      lessonId_expressionId: {
        lessonId: lesson.id,
        expressionId: expression.id,
      },
    },
    update: {},
    create: { lessonId: lesson.id, expressionId: expression.id },
  });
}

main()
  .catch((error: unknown) => {
    console.error("数据库初始化失败", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
