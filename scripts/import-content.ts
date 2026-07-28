import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { parseCsvContent, validateContent } from "../lib/content-validation";

const prisma = new PrismaClient();

async function main() {
  const fileArgument = process.argv[2];
  if (!fileArgument) {
    throw new Error(
      "用法：npm run content:import -- examples/sample-content.json",
    );
  }
  const filePath = resolve(process.cwd(), fileArgument);
  const source = await readFile(filePath, "utf8");
  const input: unknown =
    extname(filePath).toLowerCase() === ".csv"
      ? parseCsvContent(source)
      : JSON.parse(source);
  const result = validateContent(input);
  if (!result.success || !result.data) {
    console.error(JSON.stringify(result, null, 2));
    throw new Error("内容未通过校验，未写入任何数据。");
  }

  const duplicateUnit = await prisma.unit.findUnique({
    where: { number: result.data.unit.number },
    select: { id: true },
  });
  if (duplicateUnit) {
    throw new Error(`Unit ${result.data.unit.number} 已存在。`);
  }
  const duplicateTrack = await prisma.lesson.findFirst({
    where: {
      trackNumber: {
        in: result.data.lessons.map((lesson) => lesson.trackNumber),
      },
    },
    select: { trackNumber: true },
  });
  if (duplicateTrack) {
    throw new Error(`音轨编号 ${duplicateTrack.trackNumber} 已存在。`);
  }

  const unit = await prisma.$transaction(async (transaction) => {
    const createdUnit = await transaction.unit.create({
      data: {
        number: result.data!.unit.number,
        title: result.data!.unit.title,
        subtitle: result.data!.unit.subtitle,
        description: result.data!.unit.description,
      },
    });

    for (const lesson of result.data!.lessons) {
      const createdLesson = await transaction.lesson.create({
        data: {
          unitId: createdUnit.id,
          sectionNumber: lesson.sectionNumber,
          level: lesson.level,
          title: lesson.title ?? `Section ${lesson.sectionNumber}`,
          subtitle: lesson.subtitle,
          trackNumber: lesson.trackNumber,
          pdfPage: lesson.pdfPage,
          dialogues: {
            create: lesson.dialogues.map((dialogue) => ({
              number: dialogue.number,
              lines: {
                create: dialogue.lines.map((line) => ({
                  order: line.order,
                  speaker: line.speaker,
                  text: line.text,
                  reading: line.reading,
                  translationZh: line.translationZh,
                  translationEn: line.translationEn,
                  startMs: line.startMs,
                  endMs: line.endMs,
                  note: line.note,
                })),
              },
            })),
          },
        },
      });

      for (const expression of lesson.expressions) {
        const createdExpression = await transaction.expression.create({
          data: {
            expression: expression.expression,
            reading: expression.reading,
            explanationZh: expression.explanationZh,
            explanationJa: expression.explanationJa,
            example: expression.example,
            tags: JSON.stringify(expression.tags),
            nextReviewAt: new Date(),
          },
        });
        await transaction.lessonExpression.create({
          data: {
            lessonId: createdLesson.id,
            expressionId: createdExpression.id,
          },
        });
      }
    }
    return createdUnit;
  });

  console.log(
    JSON.stringify(
      {
        success: true,
        unitId: unit.id,
        summary: result.summary,
        warnings: result.issues.filter((issue) => issue.severity === "warning"),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error: unknown) => {
    console.error(
      JSON.stringify({
        level: "error",
        event: "content.import.failed",
        message: error instanceof Error ? error.message : "未知错误",
      }),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
