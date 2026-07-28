import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import ffmpegPath from "ffmpeg-static";

if (!ffmpegPath) {
  throw new Error("找不到项目内 FFmpeg 可执行文件。");
}

const inputPath = resolve(
  process.cwd(),
  process.argv[2] ?? "private_content/audio/book-full.mp4",
);
const outputPath = resolve(
  process.cwd(),
  process.argv[3] ?? "private_content/audio/book-full-analysis.json",
);
const analyzeSilence = process.argv.includes("--silence");
const metadataOutput = await runFfmpeg([
  "-hide_banner",
  "-i",
  inputPath,
  "-t",
  "0",
  "-f",
  "null",
  "NUL",
]);
const duration = parseDuration(metadataOutput);
const streams = metadataOutput
  .split(/\r?\n/u)
  .filter((line) => /Stream #/u.test(line))
  .map((line) => line.trim());
const chapters = parseChapters(metadataOutput);
let silences = [];

if (analyzeSilence) {
  const silenceOutput = await runFfmpeg([
    "-hide_banner",
    "-i",
    inputPath,
    "-map",
    "0:a:0",
    "-af",
    "silencedetect=noise=-38dB:d=0.8",
    "-f",
    "null",
    "NUL",
  ]);
  silences = parseSilences(silenceOutput);
}

const report = {
  inputPath,
  analyzedAt: new Date().toISOString(),
  durationSeconds: duration,
  durationText: formatDuration(duration),
  streams,
  chapters,
  silenceThreshold: analyzeSilence ? "-38 dB / 0.8 s" : undefined,
  silences,
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(
  JSON.stringify(
    {
      outputPath,
      durationSeconds: duration,
      durationText: report.durationText,
      streams,
      chapters: chapters.length,
      silences: silences.length,
    },
    null,
    2,
  ),
);

function runFfmpeg(arguments_) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(ffmpegPath, arguments_, {
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (
        code === 0 ||
        /At least one output file must be specified/u.test(stderr)
      ) {
        resolvePromise(stderr);
      } else {
        rejectPromise(
          new Error(
            `FFmpeg 分析失败（退出码 ${code}）：\n${stderr.slice(-4_000)}`,
          ),
        );
      }
    });
  });
}

function parseDuration(output) {
  const match = /Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/u.exec(output);
  if (!match) {
    throw new Error("无法从媒体中读取时长。");
  }
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

function parseChapters(output) {
  const chapters = [];
  const expression =
    /Chapter #\d+:(\d+): start ([\d.]+), end ([\d.]+)[\s\S]*?title\s*:\s*([^\r\n]+)/gu;
  for (const match of output.matchAll(expression)) {
    chapters.push({
      index: Number(match[1]),
      startSeconds: Number(match[2]),
      endSeconds: Number(match[3]),
      title: match[4].trim(),
    });
  }
  return chapters;
}

function parseSilences(output) {
  const starts = [...output.matchAll(/silence_start:\s*([\d.]+)/gu)].map(
    (match) => Number(match[1]),
  );
  const ends = [
    ...output.matchAll(
      /silence_end:\s*([\d.]+)\s*\|\s*silence_duration:\s*([\d.]+)/gu,
    ),
  ].map((match) => ({
    endSeconds: Number(match[1]),
    durationSeconds: Number(match[2]),
  }));
  return ends.map((end, index) => ({
    startSeconds: starts[index] ?? end.endSeconds - end.durationSeconds,
    ...end,
  }));
}

function formatDuration(seconds) {
  const wholeSeconds = Math.round(seconds);
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const remaining = wholeSeconds % 60;
  return [hours, minutes, remaining]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}
