import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const manifestPath = resolve(
  process.cwd(),
  process.argv[2] ?? "private_content/audio/tracks/manifest.json",
);
const baseUrl = (process.argv[3] ?? "http://localhost:3000").replace(
  /\/$/u,
  "",
);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const lessonsResponse = await fetch(`${baseUrl}/api/lessons`);
const lessonsPayload = await lessonsResponse.json();
if (!lessonsResponse.ok || !lessonsPayload.ok) {
  throw new Error(lessonsPayload.error?.message ?? "无法读取本地课程列表。");
}
const lessonByTrack = new Map(
  lessonsPayload.data.map((lesson) => [lesson.trackNumber, lesson]),
);

for (const [index, track] of manifest.tracks.entries()) {
  const lesson = lessonByTrack.get(track.trackNumber);
  if (!lesson) {
    throw new Error(`找不到音轨 ${track.trackNumber} 对应的课程。`);
  }
  const filePath = resolve(dirname(manifestPath), track.filename);
  const bytes = await readFile(filePath);
  const formData = new FormData();
  formData.append(
    "file",
    new File([bytes], track.filename, { type: "audio/mp4" }),
  );
  formData.append("lessonId", lesson.id);
  formData.append(
    "durationMs",
    String(Math.round(track.durationSeconds * 1_000)),
  );
  const response = await fetch(`${baseUrl}/api/audio`, {
    method: "POST",
    body: formData,
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(
      `${track.trackNumber}: ${payload.error?.message ?? response.status}`,
    );
  }
  console.log(
    `[${String(index + 1).padStart(2, "0")}/62] ${track.trackNumber} -> ${lesson.id}`,
  );
}

console.log(
  JSON.stringify(
    { success: true, attachedTracks: manifest.tracks.length },
    null,
    2,
  ),
);
