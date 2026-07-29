import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

const baseUrl = (process.argv[2] ?? "http://127.0.0.1:3000").replace(
  /\/$/u,
  "",
);
const root = process.cwd();
const sourceCoursePath = resolve(
  root,
  "private_content/import/shadowing-book.json",
);
const sourceManifestPath = resolve(
  root,
  "private_content/audio/tracks/manifest.json",
);
const outputCoursePath = resolve(root, "lib/bundled-course.json");
const outputManifestPath = resolve(
  root,
  "lib/bundled-audio-manifest.json",
);

const unitResponse = await fetch(`${baseUrl}/api/units`);
const unitPayload = await unitResponse.json();
if (!unitResponse.ok || !unitPayload.ok || !Array.isArray(unitPayload.data)) {
  throw new Error(
    unitPayload.error?.message ?? "Unable to list units from the running app.",
  );
}

const sourceCourse = JSON.parse(await readFile(sourceCoursePath, "utf8"));
const sourceLessons = new Map(
  sourceCourse
    .flatMap((unit) => unit.lessons)
    .map((lesson) => [lesson.trackNumber, lesson]),
);

const exportedUnits = [];
for (const unit of unitPayload.data) {
  const response = await fetch(
    `${baseUrl}/api/content/export?unit=${encodeURIComponent(unit.number)}`,
  );
  if (!response.ok) {
    throw new Error(`Unable to export Unit ${unit.number}: ${response.status}`);
  }
  const exportedUnit = await response.json();
  for (const lesson of exportedUnit.lessons) {
    lesson.expressions = sourceLessons.get(lesson.trackNumber)?.expressions ?? [];
  }
  exportedUnits.push(exportedUnit);
}

const sourceManifest = JSON.parse(
  await readFile(sourceManifestPath, "utf8"),
);
const audioDirectory = dirname(sourceManifestPath);
const bundledTracks = [];
for (const track of sourceManifest.tracks) {
  const bytes = await readFile(resolve(audioDirectory, track.filename));
  bundledTracks.push({
    trackNumber: track.trackNumber,
    filename: basename(track.filename),
    durationMs: Math.round(track.durationSeconds * 1_000),
    sizeBytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}

const lessonTracks = new Set(
  exportedUnits.flatMap((unit) =>
    unit.lessons.map((lesson) => lesson.trackNumber),
  ),
);
const audioTracks = new Set(bundledTracks.map((track) => track.trackNumber));
const missingAudio = [...lessonTracks].filter((track) => !audioTracks.has(track));
const orphanedAudio = [...audioTracks].filter((track) => !lessonTracks.has(track));
if (missingAudio.length > 0 || orphanedAudio.length > 0) {
  throw new Error(
    `Course/audio mismatch. Missing: ${missingAudio.join(", ") || "none"}; orphaned: ${
      orphanedAudio.join(", ") || "none"
    }.`,
  );
}

const lineCount = exportedUnits
  .flatMap((unit) => unit.lessons)
  .flatMap((lesson) => lesson.dialogues)
  .flatMap((dialogue) => dialogue.lines).length;
const timedLineCount = exportedUnits
  .flatMap((unit) => unit.lessons)
  .flatMap((lesson) => lesson.dialogues)
  .flatMap((dialogue) => dialogue.lines)
  .filter(
    (line) =>
      Number.isInteger(line.startMs) &&
      Number.isInteger(line.endMs) &&
      line.startMs < line.endMs,
  ).length;

await mkdir(dirname(outputCoursePath), { recursive: true });
await writeFile(
  outputCoursePath,
  `${JSON.stringify(exportedUnits, null, 2)}\n`,
  "utf8",
);
await writeFile(
  outputManifestPath,
  `${JSON.stringify(
    {
      version: new Date().toISOString(),
      tracks: bundledTracks,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(
  JSON.stringify(
    {
      units: exportedUnits.length,
      lessons: lessonTracks.size,
      lines: lineCount,
      timedLines: timedLineCount,
      audioTracks: bundledTracks.length,
      audioBytes: bundledTracks.reduce(
        (total, track) => total + track.sizeBytes,
        0,
      ),
      course: outputCoursePath,
      manifest: outputManifestPath,
    },
    null,
    2,
  ),
);
