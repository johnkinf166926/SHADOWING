import { describe, expect, it } from "vitest";
import { validateContent } from "@/lib/content-validation";

function contentWithTimes(firstEnd = 2_500, secondStart = 2_700) {
  return {
    unit: { number: 3, title: "例" },
    lessons: [
      {
        sectionNumber: 1,
        level: "INTERMEDIATE",
        trackNumber: "3-01",
        dialogues: [
          {
            number: 1,
            lines: [
              {
                order: 1,
                speaker: "A",
                text: "こんにちは。",
                startMs: 0,
                endMs: firstEnd,
              },
              {
                order: 2,
                speaker: "B",
                text: "こんにちは。",
                startMs: secondStart,
                endMs: 4_000,
              },
            ],
          },
        ],
      },
    ],
  };
}

describe("content import validation", () => {
  it("accepts a valid structured import", () => {
    const result = validateContent(contentWithTimes());
    expect(result.success).toBe(true);
    expect(result.summary).toEqual({
      lessons: 1,
      dialogues: 1,
      lines: 2,
      expressions: 0,
    });
  });

  it("rejects an inverted time range", () => {
    const content = contentWithTimes();
    content.lessons[0].dialogues[0].lines[0].startMs = 3_000;
    const result = validateContent(content);
    expect(result.success).toBe(false);
    expect(result.issues.some((issue) => issue.message.includes("endMs"))).toBe(
      true,
    );
  });

  it("warns about adjacent line overlap without rejecting the import", () => {
    const result = validateContent(contentWithTimes(3_000, 2_700));
    expect(result.success).toBe(true);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        severity: "warning",
        message: expect.stringContaining("重叠"),
      }),
    );
  });

  it("rejects duplicate track numbers in one file", () => {
    const content = contentWithTimes();
    content.lessons.push({
      ...content.lessons[0],
      sectionNumber: 2,
    });
    const result = validateContent(content);
    expect(result.success).toBe(false);
    expect(
      result.issues.some((issue) => issue.message.includes("音轨编号")),
    ).toBe(true);
  });
});
