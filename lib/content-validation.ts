import { contentImportSchema, type ContentImport } from "./content-schema";

export interface ContentValidationIssue {
  severity: "error" | "warning";
  path: string;
  message: string;
}

export interface ContentValidationResult {
  success: boolean;
  data?: ContentImport;
  issues: ContentValidationIssue[];
  summary: {
    lessons: number;
    dialogues: number;
    lines: number;
    expressions: number;
  };
}

export function validateContent(input: unknown): ContentValidationResult {
  const parsed = contentImportSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      issues: parsed.error.issues.map((issue) => ({
        severity: "error",
        path: issue.path.join("."),
        message: issue.message,
      })),
      summary: { lessons: 0, dialogues: 0, lines: 0, expressions: 0 },
    };
  }

  const issues: ContentValidationIssue[] = [];
  const trackNumbers = new Set<string>();

  for (const [lessonIndex, lesson] of parsed.data.lessons.entries()) {
    if (trackNumbers.has(lesson.trackNumber)) {
      issues.push({
        severity: "error",
        path: `lessons.${lessonIndex}.trackNumber`,
        message: `音轨编号 ${lesson.trackNumber} 在文件内重复`,
      });
    }
    trackNumbers.add(lesson.trackNumber);

    for (const [dialogueIndex, dialogue] of lesson.dialogues.entries()) {
      const orders = new Set<number>();
      const sortedLines = [...dialogue.lines].sort((a, b) => {
        return (
          (a.startMs ?? Number.MAX_SAFE_INTEGER) -
          (b.startMs ?? Number.MAX_SAFE_INTEGER)
        );
      });

      for (const [lineIndex, line] of dialogue.lines.entries()) {
        if (orders.has(line.order)) {
          issues.push({
            severity: "error",
            path: `lessons.${lessonIndex}.dialogues.${dialogueIndex}.lines.${lineIndex}.order`,
            message: `台词顺序 ${line.order} 重复`,
          });
        }
        orders.add(line.order);
      }

      for (let index = 1; index < sortedLines.length; index += 1) {
        const previous = sortedLines[index - 1];
        const current = sortedLines[index];
        if (
          previous.endMs !== undefined &&
          current.startMs !== undefined &&
          current.startMs < previous.endMs
        ) {
          issues.push({
            severity: "warning",
            path: `lessons.${lessonIndex}.dialogues.${dialogueIndex}`,
            message: `台词 ${previous.order} 与 ${current.order} 的时间范围重叠`,
          });
        }
      }
    }
  }

  const summary = {
    lessons: parsed.data.lessons.length,
    dialogues: parsed.data.lessons.reduce(
      (count, lesson) => count + lesson.dialogues.length,
      0,
    ),
    lines: parsed.data.lessons.reduce(
      (count, lesson) =>
        count +
        lesson.dialogues.reduce(
          (lineCount, dialogue) => lineCount + dialogue.lines.length,
          0,
        ),
      0,
    ),
    expressions: parsed.data.lessons.reduce(
      (count, lesson) => count + lesson.expressions.length,
      0,
    ),
  };

  return {
    success: !issues.some((issue) => issue.severity === "error"),
    data: parsed.data,
    issues,
    summary,
  };
}

export function parseCsvContent(csv: string): unknown {
  const rows = parseCsvRows(csv);
  if (rows.length < 2) {
    throw new Error("CSV 至少需要表头和一行数据");
  }

  const headers = rows[0].map((header) => header.trim());
  const required = [
    "unitNumber",
    "unitTitle",
    "sectionNumber",
    "level",
    "trackNumber",
    "dialogueNumber",
    "order",
    "speaker",
    "text",
  ];

  for (const key of required) {
    if (!headers.includes(key)) {
      throw new Error(`CSV 缺少必需列：${key}`);
    }
  }

  const records = rows
    .slice(1)
    .map((row) =>
      Object.fromEntries(
        headers.map((header, index) => [header, row[index] ?? ""]),
      ),
    );
  const first = records[0];
  const lessonMap = new Map<
    string,
    {
      sectionNumber: number;
      level: string;
      title?: string;
      trackNumber: string;
      pdfPage?: number;
      dialogues: Map<
        number,
        {
          number: number;
          lines: Array<Record<string, unknown>>;
        }
      >;
    }
  >();

  for (const record of records) {
    const trackNumber = record.trackNumber;
    const dialogueNumber = Number(record.dialogueNumber);
    const lesson = lessonMap.get(trackNumber) ?? {
      sectionNumber: Number(record.sectionNumber),
      level: record.level,
      title: record.lessonTitle || undefined,
      trackNumber,
      pdfPage: record.pdfPage ? Number(record.pdfPage) : undefined,
      dialogues: new Map(),
    };
    const dialogue = lesson.dialogues.get(dialogueNumber) ?? {
      number: dialogueNumber,
      lines: [],
    };

    dialogue.lines.push({
      order: Number(record.order),
      speaker: record.speaker,
      text: record.text,
      reading: record.reading || undefined,
      translationZh: record.translationZh || undefined,
      startMs: record.startMs ? Number(record.startMs) : undefined,
      endMs: record.endMs ? Number(record.endMs) : undefined,
    });
    lesson.dialogues.set(dialogueNumber, dialogue);
    lessonMap.set(trackNumber, lesson);
  }

  return {
    unit: {
      number: Number(first.unitNumber),
      title: first.unitTitle,
      subtitle: first.unitSubtitle || undefined,
    },
    lessons: Array.from(lessonMap.values()).map((lesson) => ({
      ...lesson,
      dialogues: Array.from(lesson.dialogues.values()),
      expressions: [],
    })),
  };
}

function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    const next = csv[index + 1];
    if (character === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") {
        index += 1;
      }
      row.push(value);
      if (row.some((cell) => cell.trim())) {
        rows.push(row);
      }
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  row.push(value);
  if (row.some((cell) => cell.trim())) {
    rows.push(row);
  }
  return rows;
}
