import { describe, expect, it } from "vitest";
import {
  diffCharacters,
  evaluateDictation,
  normalizeJapaneseText,
} from "@/lib/text";

describe("Japanese text normalization", () => {
  it("normalizes full-width and half-width forms and removes whitespace", () => {
    expect(normalizeJapaneseText("  ＡＢＣ　１２３  ")).toBe("ABC123");
  });

  it("optionally ignores punctuation without folding kana scripts", () => {
    expect(
      normalizeJapaneseText("こんにちは、世界！", {
        ignorePunctuation: true,
      }),
    ).toBe("こんにちは世界");
    expect(normalizeJapaneseText("カタカナ")).not.toBe(
      normalizeJapaneseText("かたかな"),
    );
  });
});

describe("character diff", () => {
  it("classifies equal, replaced, missing and extra characters", () => {
    const replacement = diffCharacters("猫です", "犬です");
    expect(replacement[0]).toEqual({
      kind: "replace",
      expected: "猫",
      actual: "犬",
    });

    expect(diffCharacters("です", "で")).toContainEqual({
      kind: "missing",
      expected: "す",
    });
    expect(diffCharacters("です", "ですよ")).toContainEqual({
      kind: "extra",
      actual: "よ",
    });
  });
});

describe("dictation accuracy", () => {
  it("returns 100 percent for normalized exact matches", () => {
    const result = evaluateDictation("はい、そうです。", "はいそうです", {
      ignorePunctuation: true,
    });
    expect(result.correct).toBe(true);
    expect(result.accuracy).toBe(100);
  });

  it("uses the longer character count as the denominator", () => {
    const result = evaluateDictation("ありがとう", "ありがと");
    expect(result.correctCharacters).toBe(4);
    expect(result.missingCharacters).toBe(1);
    expect(result.accuracy).toBe(80);
  });
});
