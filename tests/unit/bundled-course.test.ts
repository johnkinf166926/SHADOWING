import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import bundledAudioManifest from "@/lib/bundled-audio-manifest.json";
import bundledCourse from "@/lib/bundled-course.json";
import { validateContent } from "@/lib/content-validation";

describe("bundled course", () => {
  it("contains the complete validated course with final line timings", () => {
    const lessons = bundledCourse.flatMap((unit) => unit.lessons);
    const dialogues = lessons.flatMap((lesson) => lesson.dialogues);
    const lines = dialogues.flatMap((dialogue) => dialogue.lines);

    expect(bundledCourse).toHaveLength(8);
    expect(lessons).toHaveLength(62);
    expect(dialogues).toHaveLength(234);
    expect(lines).toHaveLength(1_207);
    expect(
      lines.every(
        (line) =>
          Number.isInteger(line.startMs) &&
          Number.isInteger(line.endMs) &&
          line.startMs < line.endMs,
      ),
    ).toBe(true);

    for (const unit of bundledCourse) {
      const validation = validateContent(unit);
      expect(validation.success, JSON.stringify(validation.issues)).toBe(true);
    }
  });

  it("contains one verified audio file for every lesson track", async () => {
    const lessonTracks = new Set(
      bundledCourse.flatMap((unit) =>
        unit.lessons.map((lesson) => lesson.trackNumber),
      ),
    );
    const manifestTracks = new Set(
      bundledAudioManifest.tracks.map((track) => track.trackNumber),
    );

    expect(bundledAudioManifest.tracks).toHaveLength(62);
    expect(manifestTracks).toEqual(lessonTracks);

    for (const track of bundledAudioManifest.tracks) {
      const bytes = await readFile(
        new URL(`../../public/audio/${track.filename}`, import.meta.url),
      );
      expect(bytes.byteLength).toBe(track.sizeBytes);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(
        track.sha256,
      );
    }
  });
});
