import { mkdir, readdir, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { loadImage } from "@napi-rs/canvas";
import { createWorker, OEM, PSM } from "tesseract.js";

const pageDirectory = resolve(
  process.cwd(),
  process.argv[2] ?? "private_content/ocr/pages",
);
const outputDirectory = resolve(
  process.cwd(),
  process.argv[3] ?? "private_content/ocr/text",
);
const pageSelection = process.argv[4] ?? "all";
const languages = (process.argv[5] ?? "jpn+chi_sim+eng").split("+");
const pageSegmentationMode = process.argv[6] ?? PSM.AUTO;
const region = process.argv[7] ?? "full";
const cachePath = resolve(process.cwd(), "private_content/ocr/tessdata");

await mkdir(outputDirectory, { recursive: true });
await mkdir(cachePath, { recursive: true });

const availableFiles = (await readdir(pageDirectory))
  .filter((file) => /^page-\d{3}\.jpg$/u.test(file))
  .sort();
const selectedFiles = selectPages(availableFiles, pageSelection);
if (selectedFiles.length === 0) {
  throw new Error("没有找到待识别的页面图片。请先运行 npm run book:render。");
}

const worker = await createWorker(languages, OEM.LSTM_ONLY, {
  cachePath,
  logger(message) {
    if (message.status === "recognizing text") {
      process.stderr.write(
        `\r${message.status}: ${Math.round((message.progress ?? 0) * 100)}%`,
      );
    }
  },
});
await worker.setParameters({
  tessedit_pageseg_mode: pageSegmentationMode,
  preserve_interword_spaces: "1",
  user_defined_dpi: "300",
});

try {
  for (const file of selectedFiles) {
    const pagePath = resolve(pageDirectory, file);
    const rectangle = await getRegionRectangle(pagePath, region);
    const result = await worker.recognize(
      pagePath,
      {
        rotateAuto: false,
        ...(rectangle ? { rectangle } : {}),
      },
      { text: true, tsv: true },
    );
    const stem = basename(file, ".jpg");
    await Promise.all([
      writeFile(
        resolve(outputDirectory, `${stem}.txt`),
        result.data.text,
        "utf8",
      ),
      writeFile(
        resolve(outputDirectory, `${stem}.tsv`),
        result.data.tsv ?? "",
        "utf8",
      ),
    ]);
    process.stderr.write("\n");
    console.log(
      JSON.stringify({
        page: Number(stem.slice(-3)),
        confidence: result.data.confidence,
        characters: result.data.text.length,
      }),
    );
  }
} finally {
  await worker.terminate();
}

async function getRegionRectangle(imagePath, selectedRegion) {
  if (selectedRegion === "full") {
    return undefined;
  }
  const image = await loadImage(imagePath);
  const halfWidth = Math.floor(image.width / 2);
  if (selectedRegion === "left") {
    return { left: 0, top: 0, width: halfWidth, height: image.height };
  }
  if (selectedRegion === "right") {
    return {
      left: halfWidth,
      top: 0,
      width: image.width - halfWidth,
      height: image.height,
    };
  }
  throw new Error(`无法识别 OCR 区域：${selectedRegion}`);
}

function selectPages(files, selection) {
  if (selection === "all") {
    return files;
  }
  const requested = new Set();
  for (const token of selection.split(",")) {
    const value = token.trim();
    const range = /^(\d+)-(\d+)$/u.exec(value);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      for (
        let page = Math.min(start, end);
        page <= Math.max(start, end);
        page += 1
      ) {
        requested.add(page);
      }
    } else if (/^\d+$/u.test(value)) {
      requested.add(Number(value));
    } else {
      throw new Error(`无法识别页码范围：${value}`);
    }
  }
  return files.filter((file) => requested.has(Number(file.slice(5, 8))));
}
