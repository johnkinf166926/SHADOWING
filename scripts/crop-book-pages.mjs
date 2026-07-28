import { mkdir, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const sourceDirectory = resolve(
  process.cwd(),
  process.argv[2] ?? "private_content/ocr/high",
);
const outputDirectory = resolve(
  process.cwd(),
  process.argv[3] ?? "private_content/ocr/crops",
);
const region = process.argv[4] ?? "japanese";

await mkdir(outputDirectory, { recursive: true });
const files = (await readdir(sourceDirectory))
  .filter((file) => /^page-\d{3}\.jpg$/u.test(file))
  .sort();

for (const file of files) {
  const image = await loadImage(resolve(sourceDirectory, file));
  const rectangle = regionRectangle(region, image.width, image.height);
  const canvas = createCanvas(rectangle.width, rectangle.height);
  const context = canvas.getContext("2d");
  context.drawImage(
    image,
    rectangle.left,
    rectangle.top,
    rectangle.width,
    rectangle.height,
    0,
    0,
    rectangle.width,
    rectangle.height,
  );
  const outputPath = resolve(outputDirectory, file);
  await writeFile(outputPath, canvas.toBuffer("image/jpeg", 92));
  console.log(JSON.stringify({ file, region, ...rectangle }));
}

function regionRectangle(selectedRegion, width, height) {
  if (selectedRegion === "japanese") {
    return {
      left: 0,
      top: 0,
      width: Math.floor(width * 0.5),
      height,
    };
  }
  if (selectedRegion === "chinese") {
    const left = Math.floor(width * 0.645);
    return {
      left,
      top: 0,
      width: Math.floor(width * 0.18),
      height,
    };
  }
  if (selectedRegion === "right-page") {
    const left = Math.floor(width * 0.5);
    return {
      left,
      top: 0,
      width: width - left,
      height,
    };
  }
  throw new Error(`不支持的裁剪区域：${selectedRegion}`);
}
