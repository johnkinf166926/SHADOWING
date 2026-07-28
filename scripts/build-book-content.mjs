import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const japaneseDirectory = resolve(
  process.cwd(),
  process.argv[2] ?? "private_content/ocr/windows-japanese-all",
);
const chineseDirectory = resolve(
  process.cwd(),
  process.argv[3] ?? "private_content/ocr/windows-chinese-all",
);
const imageDirectory = resolve(
  process.cwd(),
  process.argv[4] ?? "private_content/ocr/crops-japanese-all",
);
const outputPath = resolve(
  process.cwd(),
  process.argv[5] ?? "private_content/import/shadowing-book.json",
);
const reportPath = outputPath.replace(/\.json$/u, "-report.json");

const unitDefinitions = [
  {
    number: 1,
    title: "家族・夫婦・恋人との会話",
    subtitle: "家人、夫妻与恋人之间的会话",
    sections: [
      { number: 1, level: "INTERMEDIATE", pages: range(2, 4) },
      { number: 2, level: "ADVANCED", pages: range(5, 9) },
    ],
  },
  {
    number: 2,
    title: "親しい友人との会話",
    subtitle: "与好友的对话",
    sections: [
      { number: 1, level: "INTERMEDIATE", pages: range(12, 15) },
      { number: 2, level: "ADVANCED", pages: range(16, 20) },
    ],
  },
  {
    number: 3,
    title: "知人や近所の人などとの会話",
    subtitle: "与熟人、邻居的对话",
    sections: [
      { number: 1, level: "INTERMEDIATE", pages: range(23, 25) },
      { number: 2, level: "ADVANCED", pages: range(26, 31) },
    ],
  },
  {
    number: 4,
    title: "医者や店員などとの会話",
    subtitle: "与医生、店员等的对话",
    sections: [
      { number: 1, level: "INTERMEDIATE", pages: range(33, 34) },
      { number: 2, level: "ADVANCED", pages: range(35, 38) },
    ],
  },
  {
    number: 5,
    title: "同僚との会話",
    subtitle: "与同事的对话",
    sections: [
      { number: 1, level: "INTERMEDIATE", pages: range(40, 44) },
      { number: 2, level: "ADVANCED", pages: range(45, 49) },
    ],
  },
  {
    number: 6,
    title: "上司や部下との会話",
    subtitle: "与上司或部下的对话",
    sections: [
      { number: 1, level: "INTERMEDIATE", pages: range(52, 54) },
      { number: 2, level: "ADVANCED", pages: range(55, 58) },
    ],
  },
  {
    number: 7,
    title: "社外の人や面接官などとの会話",
    subtitle: "与公司外人士、面试官等的对话",
    sections: [
      { number: 1, level: "INTERMEDIATE", pages: range(60, 61) },
      { number: 2, level: "ADVANCED", pages: range(62, 64) },
    ],
  },
  {
    number: 8,
    title: "長い会話・スピーチなど",
    subtitle: "较长的会话与演讲等",
    sections: range(66, 73).map((page, index) => ({
      number: index + 1,
      level: "ADVANCED",
      pages: [page],
    })),
  },
];

const diskOnePages = unitDefinitions
  .slice(0, 4)
  .flatMap((unit) => unit.sections.flatMap((section) => section.pages));
const diskTwoPages = unitDefinitions
  .slice(4)
  .flatMap((unit) => unit.sections.flatMap((section) => section.pages));
const trackByPage = new Map([
  ...diskOnePages.map((page, index) => [page, `1-${pad(index + 2)}`]),
  ...diskTwoPages.map((page, index) => [page, `2-${pad(index + 2)}`]),
]);

const imports = [];
const report = {
  generatedAt: new Date().toISOString(),
  source: "private_content/book.pdf",
  units: 0,
  lessons: 0,
  dialogues: 0,
  lines: 0,
  translatedLines: 0,
  pages: [],
  warnings: [],
};

for (const unit of unitDefinitions) {
  const lessons = [];
  for (const section of unit.sections) {
    for (const page of section.pages) {
      const trackNumber = trackByPage.get(page);
      const japanese = await readOcr(japaneseDirectory, page);
      const chinese = await readOcr(chineseDirectory, page);
      const imagePath = pagePath(imageDirectory, page, "jpg");
      const boundaries = await findDialogueBoundaries(imagePath);
      const japaneseDialogues = parseJapaneseDialogues(japanese, boundaries);
      const chineseDialogues = parseChineseDialogues(chinese, boundaries);
      const dialogues = alignTranslations(japaneseDialogues, chineseDialogues);

      if (dialogues.length === 0) {
        report.warnings.push(`PDF ${page}: 没有识别到可导入的台词`);
        continue;
      }
      const lineCount = dialogues.reduce(
        (count, dialogue) => count + dialogue.lines.length,
        0,
      );
      const translatedLineCount = dialogues.reduce(
        (count, dialogue) =>
          count + dialogue.lines.filter((line) => line.translationZh).length,
        0,
      );
      const printedLeftPage = page * 2 + 14;
      lessons.push({
        sectionNumber: section.number,
        level: section.level,
        title: `Section ${section.number} · Track ${trackNumber}`,
        subtitle: `教材第 ${printedLeftPage}–${printedLeftPage + 1} 页 · OCR 待核对`,
        trackNumber,
        pdfPage: page,
        dialogues,
        expressions: [],
      });
      report.pages.push({
        page,
        unit: unit.number,
        section: section.number,
        trackNumber,
        dialogueCount: dialogues.length,
        lineCount,
        translatedLineCount,
      });
      report.lessons += 1;
      report.dialogues += dialogues.length;
      report.lines += lineCount;
      report.translatedLines += translatedLineCount;
    }
  }

  imports.push({
    unit: {
      number: unit.number,
      title: unit.title,
      subtitle: unit.subtitle,
      description:
        "由本机扫描版教材生成。日文与中文为 OCR 草稿，请结合原 PDF 核对；教材音频需另行关联。",
    },
    lessons,
  });
}

report.units = imports.length;
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(imports, null, 2)}\n`, "utf8");
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(
  JSON.stringify(
    {
      outputPath,
      reportPath,
      units: report.units,
      lessons: report.lessons,
      dialogues: report.dialogues,
      lines: report.lines,
      translatedLines: report.translatedLines,
      warnings: report.warnings.length,
    },
    null,
    2,
  ),
);

async function readOcr(directory, page) {
  return JSON.parse(await readFile(pagePath(directory, page, "json"), "utf8"));
}

function parseJapaneseDialogues(ocr, boundaries) {
  const rows = ocr.lines.map(toRow);
  const speakers = rows
    .filter(
      (row) =>
        (row.text === "A" || row.text === "B") &&
        row.x >= 210 &&
        row.x <= 360 &&
        row.y > 170 &&
        row.y < 1700,
    )
    .sort(byY);
  const mainRows = rows
    .filter(
      (row) =>
        row.y > 170 &&
        row.y < 1700 &&
        row.x >= 275 &&
        row.height >= 16 &&
        row.text !== "A" &&
        row.text !== "B",
    )
    .sort(byYThenX);
  const narrativeRows = rows
    .filter(
      (row) =>
        row.y > 170 &&
        row.y < 1700 &&
        row.x >= 190 &&
        row.height >= 16 &&
        row.text !== "A" &&
        row.text !== "B",
    )
    .sort(byYThenX);
  const ranges = makeRanges(boundaries);
  const dialogues = [];

  for (const [rangeIndex, rangeBounds] of ranges.entries()) {
    const rangeSpeakers = speakers.filter(
      (speaker) =>
        speaker.y >= rangeBounds.start - 12 && speaker.y < rangeBounds.end,
    );
    const lines = [];
    if (rangeSpeakers.length > 0) {
      for (const [speakerIndex, speaker] of rangeSpeakers.entries()) {
        const nextSpeaker = rangeSpeakers[speakerIndex + 1];
        const fragments = mainRows.filter(
          (row) =>
            row.y >= speaker.y - 10 &&
            row.y <
              Math.min(
                nextSpeaker ? nextSpeaker.y - 10 : rangeBounds.end,
                rangeBounds.end,
              ),
        );
        const text = normalizeJapanese(
          fragments.map((fragment) => fragment.text).join(""),
        );
        if (text) {
          lines.push({
            order: lines.length + 1,
            speaker: speaker.text,
            text,
            note: `OCR 草稿；请对照 PDF 第 ${ocr.page} 页核对`,
            sourceY: speaker.y,
          });
        }
      }
    } else {
      const dialogueNarrativeRows = narrativeRows.filter(
        (row) => row.y >= rangeBounds.start && row.y < rangeBounds.end,
      );
      for (const row of dialogueNarrativeRows) {
        const text = normalizeJapanese(row.text);
        if (text) {
          lines.push({
            order: lines.length + 1,
            speaker: "NARRATOR",
            text,
            note: `OCR 草稿；请对照 PDF 第 ${ocr.page} 页核对`,
            sourceY: row.y,
          });
        }
      }
    }
    if (lines.length > 0) {
      dialogues.push({ number: rangeIndex + 1, lines });
    }
  }
  return dialogues;
}

function parseChineseDialogues(ocr, boundaries) {
  const rows = ocr.lines
    .map(toRow)
    .filter(
      (row) => row.y > 170 && row.y < 1700 && row.x >= 120 && hasCjk(row.text),
    )
    .sort(byYThenX);
  const ranges = makeRanges(boundaries);
  return ranges.map((rangeBounds) => {
    const rangeRows = rows.filter(
      (row) => row.y >= rangeBounds.start - 12 && row.y < rangeBounds.end,
    );
    const speakerStarts = rangeRows
      .map((row, index) => {
        const match = /^([AB])\s*[：:]/u.exec(row.text.trim());
        return match ? { index, speaker: match[1], y: row.y } : undefined;
      })
      .filter(Boolean);
    if (speakerStarts.length === 0) {
      return {
        lines: rangeRows.map((row) => ({
          speaker: "NARRATOR",
          text: normalizeChinese(row.text),
          sourceY: row.y,
        })),
      };
    }
    return {
      lines: speakerStarts.map((start, index) => {
        const end = speakerStarts[index + 1]?.index ?? rangeRows.length;
        const text = normalizeChinese(
          rangeRows
            .slice(start.index, end)
            .map((row) => row.text)
            .join(""),
        ).replace(/^[AB][：:]/u, "");
        return { speaker: start.speaker, text, sourceY: start.y };
      }),
    };
  });
}

function alignTranslations(japaneseDialogues, chineseDialogues) {
  return japaneseDialogues.map((dialogue, dialogueIndex) => {
    const chineseLines = chineseDialogues[dialogueIndex]?.lines ?? [];
    const unused = new Set(chineseLines.map((_, index) => index));
    const lines = dialogue.lines.map((line) => {
      let bestIndex;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const index of unused) {
        const candidate = chineseLines[index];
        if (candidate.speaker !== line.speaker) {
          continue;
        }
        const distance = Math.abs(candidate.sourceY - line.sourceY);
        if (distance < bestDistance) {
          bestIndex = index;
          bestDistance = distance;
        }
      }
      if (bestIndex !== undefined) {
        unused.delete(bestIndex);
      }
      const translation = chineseLines[bestIndex]?.text;
      return {
        order: line.order,
        speaker: line.speaker,
        text: line.text,
        note: line.note,
        translationZh: translation || undefined,
      };
    });
    return { number: dialogue.number, lines };
  });
}

async function findDialogueBoundaries(imagePath) {
  const image = await loadImage(imagePath);
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  const left = 100;
  const width = 300;
  const pixels = context.getImageData(left, 0, width, image.height).data;
  const candidateRows = [];
  for (let y = 0; y < image.height; y += 1) {
    let bluePixels = 0;
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      if (
        blue > 100 &&
        blue > red * 1.35 &&
        blue > green * 1.08 &&
        green > 55
      ) {
        bluePixels += 1;
      }
    }
    if (bluePixels > 12) {
      candidateRows.push(y);
    }
  }
  const groups = [];
  for (const y of candidateRows) {
    const group = groups.at(-1);
    if (!group || y > group.at(-1) + 1) {
      groups.push([y]);
    } else {
      group.push(y);
    }
  }
  const markers = groups
    .filter(
      (group) =>
        group.length >= 18 &&
        group.length <= 30 &&
        group[0] > 180 &&
        group.at(-1) < image.height - 100,
    )
    .map((group) => group[0]);
  const deduplicatedMarkers = markers.filter((marker, index) => {
    const next = markers[index + 1];
    return next === undefined || next - marker >= 70;
  });
  return deduplicatedMarkers.length > 0 ? deduplicatedMarkers : [190];
}

function makeRanges(boundaries) {
  return boundaries.map((start, index) => ({
    start,
    end: boundaries[index + 1] ?? 1700,
  }));
}

function toRow(line) {
  const words = line.words ?? [];
  return {
    text: line.text.trim(),
    x: Math.min(...words.map((word) => Number(word.x))),
    y: Math.min(...words.map((word) => Number(word.y))),
    height: Math.max(...words.map((word) => Number(word.height))),
  };
}

function normalizeJapanese(text) {
  return text
    .replace(/\s+/gu, "")
    .replace(/^[：:・.，,]+/u, "")
    .replaceAll(",", "、")
    .replaceAll("?", "？")
    .replaceAll("!", "！")
    .trim();
}

function normalizeChinese(text) {
  return text
    .replace(/\s+/gu, "")
    .replaceAll("．", "。")
    .replaceAll("·", "。")
    .replaceAll("，", "，")
    .trim();
}

function hasCjk(text) {
  return /[\u3400-\u9fff]/u.test(text);
}

function pagePath(directory, page, extension) {
  return resolve(
    directory,
    `page-${String(page).padStart(3, "0")}.${extension}`,
  );
}

function range(start, end) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function pad(number) {
  return String(number).padStart(2, "0");
}

function byY(left, right) {
  return left.y - right.y;
}

function byYThenX(left, right) {
  return left.y - right.y || left.x - right.x;
}
