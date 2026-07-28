import { deflateSync } from "node:zlib";
import { writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

for (const size of [192, 512]) {
  const pixels = Buffer.alloc(size * size * 4);
  const colors = {
    paper: [245, 243, 237, 255],
    accent: [219, 91, 61, 255],
    sage: [220, 236, 229, 255],
    ink: [32, 48, 44, 255],
  };

  fill(colors.paper);
  roundedRect(
    Math.round(size * 0.1),
    Math.round(size * 0.1),
    Math.round(size * 0.8),
    Math.round(size * 0.8),
    Math.round(size * 0.19),
    colors.accent,
  );
  circle(
    Math.round(size * 0.72),
    Math.round(size * 0.29),
    Math.round(size * 0.055),
    colors.sage,
  );

  const barHeights = [0.2, 0.39, 0.63, 0.82, 0.59, 0.39, 0.2];
  const barWidth = Math.max(5, Math.round(size * 0.055));
  const gap = Math.round(size * 0.025);
  const totalWidth =
    barHeights.length * barWidth + (barHeights.length - 1) * gap;
  const startX = Math.round((size - totalWidth) / 2);
  for (let index = 0; index < barHeights.length; index += 1) {
    const height = Math.round(size * 0.48 * barHeights[index]);
    roundedRect(
      startX + index * (barWidth + gap),
      Math.round((size - height) / 2),
      barWidth,
      height,
      Math.floor(barWidth / 2),
      colors.paper,
    );
  }

  await writeFile(
    resolve(root, `public/icon-${size}.png`),
    encodePng(size, size, pixels),
  );

  function fill(color) {
    for (let index = 0; index < size * size; index += 1) {
      pixels.set(color, index * 4);
    }
  }

  function setPixel(x, y, color) {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    pixels.set(color, (y * size + x) * 4);
  }

  function roundedRect(x, y, width, height, radius, color) {
    for (let py = y; py < y + height; py += 1) {
      for (let px = x; px < x + width; px += 1) {
        const nearestX = Math.max(
          x + radius,
          Math.min(px, x + width - radius - 1),
        );
        const nearestY = Math.max(
          y + radius,
          Math.min(py, y + height - radius - 1),
        );
        const dx = px - nearestX;
        const dy = py - nearestY;
        if (dx * dx + dy * dy <= radius * radius) {
          setPixel(px, py, color);
        }
      }
    }
  }

  function circle(centerX, centerY, radius, color) {
    for (let y = centerY - radius; y <= centerY + radius; y += 1) {
      for (let x = centerX - radius; x <= centerX + radius; x += 1) {
        const dx = x - centerX;
        const dy = y - centerY;
        if (dx * dx + dy * dy <= radius * radius) {
          setPixel(x, y, color);
        }
      }
    }
  }
}

function encodePng(width, height, rgba) {
  const scanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (1 + width * 4);
    scanlines[rowStart] = 0;
    rgba.copy(scanlines, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(scanlines, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const result = Buffer.alloc(12 + data.length);
  result.writeUInt32BE(data.length, 0);
  typeBuffer.copy(result, 4);
  data.copy(result, 8);
  result.writeUInt32BE(
    crc32(Buffer.concat([typeBuffer, data])),
    8 + data.length,
  );
  return result;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

console.log("Generated PWA icons.");
