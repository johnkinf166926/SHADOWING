import { readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const sourceDirectory = resolve(
  process.cwd(),
  process.argv[2] ?? "private_content/ocr/thumbnails",
);
const outputDirectory = resolve(
  process.cwd(),
  process.argv[3] ?? "private_content/ocr",
);
const files = (await readdir(sourceDirectory))
  .filter((file) => /^page-\d{3}\.jpg$/u.test(file))
  .sort();

const columns = 5;
const rows = 4;
const cellWidth = 300;
const imageHeight = 212;
const labelHeight = 28;
const pagesPerSheet = columns * rows;

for (let offset = 0; offset < files.length; offset += pagesPerSheet) {
  const batch = files.slice(offset, offset + pagesPerSheet);
  const canvas = createCanvas(
    columns * cellWidth,
    rows * (imageHeight + labelHeight),
  );
  const context = canvas.getContext("2d");
  context.fillStyle = "#f5f1e7";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.font = "700 15px sans-serif";
  context.textAlign = "center";

  for (const [index, file] of batch.entries()) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = column * cellWidth;
    const y = row * (imageHeight + labelHeight);
    const image = await loadImage(resolve(sourceDirectory, file));
    context.drawImage(image, x, y, cellWidth, imageHeight);
    context.fillStyle = "#26342f";
    context.fillText(
      `PDF ${Number(file.slice(5, 8))}`,
      x + cellWidth / 2,
      y + imageHeight + 19,
    );
  }

  const firstPage = offset + 1;
  const lastPage = offset + batch.length;
  const outputPath = resolve(
    outputDirectory,
    `contact-${String(firstPage).padStart(3, "0")}-${String(lastPage).padStart(3, "0")}.jpg`,
  );
  await writeFile(outputPath, canvas.toBuffer("image/jpeg", 88));
  console.log(outputPath);
}
