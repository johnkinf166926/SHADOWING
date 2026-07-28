export interface NormalizeOptions {
  ignorePunctuation?: boolean;
  removeWhitespace?: boolean;
}

export type DiffKind = "equal" | "replace" | "missing" | "extra";

export interface CharacterDiff {
  kind: DiffKind;
  expected?: string;
  actual?: string;
}

export interface DictationResult {
  expectedNormalized: string;
  actualNormalized: string;
  diff: CharacterDiff[];
  correctCharacters: number;
  wrongCharacters: number;
  missingCharacters: number;
  extraCharacters: number;
  accuracy: number;
  correct: boolean;
}

export function normalizeJapaneseText(
  value: string,
  options: NormalizeOptions = {},
): string {
  const { ignorePunctuation = false, removeWhitespace = true } = options;
  let normalized = value.normalize("NFKC");
  normalized = removeWhitespace
    ? normalized.replace(/\s+/gu, "")
    : normalized.trim().replace(/\s+/gu, " ");
  if (ignorePunctuation) {
    normalized = normalized.replace(/[\p{P}\p{S}]/gu, "");
  }
  return normalized;
}

export function diffCharacters(
  expected: string,
  actual: string,
): CharacterDiff[] {
  const expectedChars = Array.from(expected);
  const actualChars = Array.from(actual);
  const rows = expectedChars.length + 1;
  const columns = actualChars.length + 1;
  const matrix = Array.from({ length: rows }, () =>
    Array<number>(columns).fill(0),
  );

  for (let row = 0; row < rows; row += 1) {
    matrix[row][0] = row;
  }
  for (let column = 0; column < columns; column += 1) {
    matrix[0][column] = column;
  }

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const substitutionCost =
        expectedChars[row - 1] === actualChars[column - 1] ? 0 : 1;
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + substitutionCost,
      );
    }
  }

  const reversed: CharacterDiff[] = [];
  let row = expectedChars.length;
  let column = actualChars.length;

  while (row > 0 || column > 0) {
    if (
      row > 0 &&
      column > 0 &&
      expectedChars[row - 1] === actualChars[column - 1]
    ) {
      reversed.push({
        kind: "equal",
        expected: expectedChars[row - 1],
        actual: actualChars[column - 1],
      });
      row -= 1;
      column -= 1;
    } else if (
      row > 0 &&
      column > 0 &&
      matrix[row][column] === matrix[row - 1][column - 1] + 1
    ) {
      reversed.push({
        kind: "replace",
        expected: expectedChars[row - 1],
        actual: actualChars[column - 1],
      });
      row -= 1;
      column -= 1;
    } else if (row > 0 && matrix[row][column] === matrix[row - 1][column] + 1) {
      reversed.push({ kind: "missing", expected: expectedChars[row - 1] });
      row -= 1;
    } else {
      reversed.push({ kind: "extra", actual: actualChars[column - 1] });
      column -= 1;
    }
  }

  return reversed.reverse();
}

export function evaluateDictation(
  expected: string,
  actual: string,
  options: NormalizeOptions = {},
): DictationResult {
  const expectedNormalized = normalizeJapaneseText(expected, options);
  const actualNormalized = normalizeJapaneseText(actual, options);
  const diff = diffCharacters(expectedNormalized, actualNormalized);
  const correctCharacters = diff.filter((item) => item.kind === "equal").length;
  const wrongCharacters = diff.filter((item) => item.kind === "replace").length;
  const missingCharacters = diff.filter(
    (item) => item.kind === "missing",
  ).length;
  const extraCharacters = diff.filter((item) => item.kind === "extra").length;
  const denominator = Math.max(
    Array.from(expectedNormalized).length,
    Array.from(actualNormalized).length,
    1,
  );
  const accuracy = Math.round((correctCharacters / denominator) * 1_000) / 10;

  return {
    expectedNormalized,
    actualNormalized,
    diff,
    correctCharacters,
    wrongCharacters,
    missingCharacters,
    extraCharacters,
    accuracy,
    correct:
      expectedNormalized.length > 0 && expectedNormalized === actualNormalized,
  };
}
