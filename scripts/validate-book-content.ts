import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateContent } from "../lib/content-validation";

const inputPath = resolve(
  process.cwd(),
  process.argv[2] ?? "private_content/import/shadowing-book.json",
);
const input: unknown = JSON.parse(await readFile(inputPath, "utf8"));
if (!Array.isArray(input)) {
  throw new Error("教材文件必须是 Unit 导入对象数组。");
}

const results = input.map((unit, index) => ({
  index,
  result: validateContent(unit),
}));
const failed = results.filter(({ result }) => !result.success);
const summary = results.reduce(
  (total, { result }) => ({
    units: total.units + 1,
    lessons: total.lessons + result.summary.lessons,
    dialogues: total.dialogues + result.summary.dialogues,
    lines: total.lines + result.summary.lines,
    expressions: total.expressions + result.summary.expressions,
    warnings:
      total.warnings +
      result.issues.filter((issue) => issue.severity === "warning").length,
  }),
  {
    units: 0,
    lessons: 0,
    dialogues: 0,
    lines: 0,
    expressions: 0,
    warnings: 0,
  },
);

console.log(JSON.stringify({ success: failed.length === 0, summary }, null, 2));
if (failed.length > 0) {
  console.error(
    JSON.stringify(
      failed.map(({ index, result }) => ({ index, issues: result.issues })),
      null,
      2,
    ),
  );
  process.exitCode = 1;
}
