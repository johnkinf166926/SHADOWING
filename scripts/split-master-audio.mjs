import { spawn } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import ffmpegPath from "ffmpeg-static";

if (!ffmpegPath) {
  throw new Error("找不到项目内 FFmpeg 可执行文件。");
}

const positionalArguments = process.argv
  .slice(2)
  .filter((argument) => !argument.startsWith("--"));
const shouldOverwrite = process.argv.includes("--force");
const inputPath = resolve(
  process.cwd(),
  positionalArguments[0] ?? "private_content/audio/book-full.mp4",
);
const analysisPath = resolve(
  process.cwd(),
  positionalArguments[1] ?? "private_content/audio/book-full-analysis.json",
);
const outputDirectory = resolve(
  process.cwd(),
  positionalArguments[2] ?? "private_content/audio/tracks",
);
const manifestPath = resolve(outputDirectory, "manifest.json");
const analysis = JSON.parse(await readFile(analysisPath, "utf8"));
const longSilences = analysis.silences
  .filter((silence) => silence.durationSeconds >= 2.5)
  .sort((left, right) => left.startSeconds - right.startSeconds);

if (longSilences.length !== 62) {
  throw new Error(
    `预期检测到 62 个长静音区间，实际为 ${longSilences.length}。`,
  );
}

// SRT 中 Unit 5 / Section 1 的报幕紧接上一课结尾，正确的换盘静音
// 只有约 0.94 秒，不能使用“全书最长的短静音”来猜测。
const expectedDiskBoundarySeconds = 49 * 60 + 3.8;
const recoveredDiskBoundary = analysis.silences
  .filter(
    (silence) =>
      silence.durationSeconds >= 0.8 && silence.durationSeconds < 2.5,
  )
  .sort(
    (left, right) =>
      Math.abs(left.startSeconds - expectedDiskBoundarySeconds) -
      Math.abs(right.startSeconds - expectedDiskBoundarySeconds),
  )[0];
if (
  !recoveredDiskBoundary ||
  Math.abs(recoveredDiskBoundary.startSeconds - expectedDiskBoundarySeconds) > 2
) {
  throw new Error("无法根据 SRT 校验结果定位 Disk 1 / Disk 2 的较短边界。");
}

const boundaries = [...longSilences, recoveredDiskBoundary].sort(
  (left, right) => left.startSeconds - right.startSeconds,
);
const tracks = [];
for (let index = 0; index < boundaries.length - 1; index += 1) {
  const previous = boundaries[index];
  const next = boundaries[index + 1];
  const trackNumber =
    index < 32
      ? `1-${String(index + 2).padStart(2, "0")}`
      : `2-${String(index - 30).padStart(2, "0")}`;
  const startSeconds = Math.max(0, previous.endSeconds - 0.12);
  const endSeconds = Math.min(
    analysis.durationSeconds,
    next.startSeconds + 0.12,
  );
  tracks.push({
    trackNumber,
    startSeconds,
    endSeconds,
    durationSeconds: endSeconds - startSeconds,
    filename: `track-${trackNumber}.m4a`,
  });
}
if (tracks.length !== 62 || tracks.at(-1)?.trackNumber !== "2-31") {
  throw new Error("生成的音轨编号不完整。");
}

await mkdir(outputDirectory, { recursive: true });
for (const [index, track] of tracks.entries()) {
  const outputPath = resolve(outputDirectory, track.filename);
  if (!shouldOverwrite && (await exists(outputPath))) {
    throw new Error(`输出文件已存在，未覆盖：${outputPath}`);
  }
  await runFfmpeg([
    "-hide_banner",
    "-loglevel",
    "error",
    shouldOverwrite ? "-y" : "-n",
    "-ss",
    track.startSeconds.toFixed(3),
    "-i",
    inputPath,
    "-t",
    track.durationSeconds.toFixed(3),
    "-map",
    "0:a:0",
    "-vn",
    "-c:a",
    "copy",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
  const file = await stat(outputPath);
  track.sizeBytes = file.size;
  console.log(
    `[${String(index + 1).padStart(2, "0")}/62] ${track.trackNumber} ${track.durationSeconds.toFixed(1)}s ${formatBytes(file.size)}`,
  );
}

const manifest = {
  source: inputPath,
  createdAt: new Date().toISOString(),
  strategy: {
    longSilence: "-38 dB / 0.8 s, boundary >= 2.5 s",
    recoveredBoundary: recoveredDiskBoundary,
    recoveredBoundarySource: "SRT Unit 5 / Section 1 marker",
    edgePaddingSeconds: 0.12,
    codec: "AAC stream copy",
  },
  tracks,
};
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(
  JSON.stringify(
    {
      manifestPath,
      tracks: tracks.length,
      totalBytes: tracks.reduce((total, track) => total + track.sizeBytes, 0),
      first: tracks[0],
      last: tracks.at(-1),
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
      if (code === 0) {
        resolvePromise();
      } else {
        rejectPromise(
          new Error(
            `FFmpeg 切分失败（退出码 ${code}）：${stderr.slice(-2_000)}`,
          ),
        );
      }
    });
  });
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}
