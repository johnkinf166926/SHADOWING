import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const sourcePath = resolve(
  process.cwd(),
  process.argv[2] ?? "private_content/book.pdf",
);
const outputDirectory = resolve(
  process.cwd(),
  process.argv[3] ?? "private_content/ocr/pages",
);
const pageSelection = process.argv[4] ?? "all";
const scale = Number(process.argv[5] ?? 2);

if (!Number.isFinite(scale) || scale < 0.5 || scale > 4) {
  throw new Error("渲染倍率必须在 0.5 到 4 之间。");
}

await mkdir(outputDirectory, { recursive: true });
const loadingTask = getDocument({
  url: sourcePath,
  disableWorker: true,
  wasmUrl: directoryUrl("node_modules/pdfjs-dist/wasm"),
  standardFontDataUrl: directoryUrl("node_modules/pdfjs-dist/standard_fonts"),
});
const document = await loadingTask.promise;
const pageNumbers = parsePageSelection(pageSelection, document.numPages);

for (const pageNumber of pageNumbers) {
  const page = await document.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(
    Math.ceil(viewport.width),
    Math.ceil(viewport.height),
  );
  const context = canvas.getContext("2d");
  await page.render({
    canvasContext: context,
    viewport,
  }).promise;
  const outputPath = resolve(
    outputDirectory,
    `page-${String(pageNumber).padStart(3, "0")}.jpg`,
  );
  await writeFile(outputPath, canvas.toBuffer("image/jpeg", 88));
  console.log(
    JSON.stringify({
      page: pageNumber,
      width: canvas.width,
      height: canvas.height,
      outputPath,
    }),
  );
  page.cleanup();
}

await loadingTask.destroy();

function parsePageSelection(selection, pageCount) {
  if (selection === "all") {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }
  const pages = new Set();
  for (const token of selection.split(",")) {
    const value = token.trim();
    const range = /^(\d+)-(\d+)$/.exec(value);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      for (
        let page = Math.min(start, end);
        page <= Math.max(start, end);
        page += 1
      ) {
        pages.add(page);
      }
      continue;
    }
    if (/^\d+$/.test(value)) {
      pages.add(Number(value));
      continue;
    }
    throw new Error(`无法识别页码范围：${value}`);
  }
  const invalid = [...pages].find((page) => page < 1 || page > pageCount);
  if (invalid) {
    throw new Error(`页码 ${invalid} 超出 1-${pageCount}。`);
  }
  return [...pages].sort((left, right) => left - right);
}

function directoryUrl(relativePath) {
  return `${resolve(process.cwd(), relativePath).replaceAll("\\", "/")}/`;
}
