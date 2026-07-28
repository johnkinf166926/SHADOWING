import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const unitNumber = Number(process.argv[2] ?? 1);
  if (!Number.isInteger(unitNumber) || unitNumber < 1) {
    throw new Error("Unit 编号必须是大于 0 的整数。");
  }

  const unit = await prisma.unit.findUnique({
    where: { number: unitNumber },
    include: {
      lessons: {
        orderBy: { sectionNumber: "asc" },
        include: {
          dialogues: {
            orderBy: { number: "asc" },
            include: { lines: { orderBy: { order: "asc" } } },
          },
          expressions: {
            include: { expression: true },
          },
        },
      },
    },
  });
  if (!unit) {
    throw new Error(`找不到 Unit ${unitNumber}。`);
  }

  const payload = {
    unit: {
      number: unit.number,
      title: unit.title,
      ...(unit.subtitle ? { subtitle: unit.subtitle } : {}),
      ...(unit.description ? { description: unit.description } : {}),
    },
    lessons: unit.lessons.map((lesson) => ({
      sectionNumber: lesson.sectionNumber,
      level: lesson.level,
      title: lesson.title,
      ...(lesson.subtitle ? { subtitle: lesson.subtitle } : {}),
      trackNumber: lesson.trackNumber,
      ...(lesson.pdfPage ? { pdfPage: lesson.pdfPage } : {}),
      dialogues: lesson.dialogues.map((dialogue) => ({
        number: dialogue.number,
        lines: dialogue.lines.map((line) => ({
          order: line.order,
          speaker: line.speaker,
          text: line.text,
          ...(line.reading ? { reading: line.reading } : {}),
          ...(line.translationZh ? { translationZh: line.translationZh } : {}),
          ...(line.translationEn ? { translationEn: line.translationEn } : {}),
          ...(line.startMs === null ? {} : { startMs: line.startMs }),
          ...(line.endMs === null ? {} : { endMs: line.endMs }),
          ...(line.note ? { note: line.note } : {}),
        })),
      })),
      expressions: lesson.expressions.map(({ expression }) => ({
        expression: expression.expression,
        ...(expression.reading ? { reading: expression.reading } : {}),
        ...(expression.explanationZh
          ? { explanationZh: expression.explanationZh }
          : {}),
        ...(expression.explanationJa
          ? { explanationJa: expression.explanationJa }
          : {}),
        ...(expression.example ? { example: expression.example } : {}),
        tags: parseTags(expression.tags),
      })),
    })),
  };

  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

function parseTags(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === "string")
      : [];
  } catch {
    return [];
  }
}

main()
  .catch((error: unknown) => {
    console.error(
      JSON.stringify({
        level: "error",
        event: "content.export.failed",
        message: error instanceof Error ? error.message : "未知错误",
      }),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
