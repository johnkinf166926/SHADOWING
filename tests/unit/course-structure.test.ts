import { describe, expect, it } from "vitest";
import { buildCourseSections, courseTrackHref } from "@/lib/course-structure";
import type { Dialogue, Lesson } from "@/lib/types";

function dialogue(id: string, number: number): Dialogue {
  return { id, number, lines: [] };
}

function lesson(
  id: string,
  sectionNumber: number,
  pdfPage: number,
  dialogues: Dialogue[],
): Lesson {
  return {
    id,
    unitId: "unit-1",
    sectionNumber,
    level: sectionNumber === 1 ? "INTERMEDIATE" : "ADVANCED",
    title: id,
    subtitle: "",
    trackNumber: `1-${String(pdfPage).padStart(2, "0")}`,
    pdfPage,
    status: "NOT_STARTED",
    favorite: false,
    progress: 0,
    dialogues,
  };
}

describe("course hierarchy", () => {
  it("numbers dialogues continuously inside a section and resets at the next section", () => {
    const sections = buildCourseSections([
      lesson("page-3", 1, 3, [dialogue("track-3", 1)]),
      lesson("page-2", 1, 2, [dialogue("track-1", 1), dialogue("track-2", 2)]),
      lesson("page-5", 2, 5, [dialogue("section-2-track-1", 1)]),
    ]);

    expect(sections).toHaveLength(2);
    expect(
      sections[0]?.tracks.map((track) => [track.id, track.number]),
    ).toEqual([
      ["track-1", 1],
      ["track-2", 2],
      ["track-3", 3],
    ]);
    expect(sections[1]?.tracks[0]?.number).toBe(1);
  });

  it("builds Track links for detail and practice surfaces", () => {
    const track = { id: "dialogue-2", number: 2, lessonId: "lesson-1" };

    expect(courseTrackHref(track)).toBe("/tracks/dialogue-2");
    expect(courseTrackHref(track, "shadowing")).toBe(
      "/shadowing/lesson-1?dialogue=dialogue-2",
    );
    expect(courseTrackHref(track, "practice")).toBe(
      "/practice/lesson-1?dialogue=dialogue-2",
    );
  });
});
