import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { parseCsvContent, validateContent } from "../lib/content-validation";

async function main() {
  const fileArgument = process.argv[2];
  if (!fileArgument) {
    throw new Error(
      "用法：npm run content:validate -- examples/sample-content.json",
    );
  }
  const filePath = resolve(process.cwd(), fileArgument);
  const source = await readFile(filePath, "utf8");
  const input: unknown =
    extname(filePath).toLowerCase() === ".csv"
      ? parseCsvContent(source)
      : JSON.parse(source);
  const result = validateContent(input);

  console.log(
    JSON.stringify(
      {
        file: filePath,
        success: result.success,
        summary: result.summary,
        issues: result.issues,
      },
      null,
      2,
    ),
  );
  if (!result.success) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      level: "error",
      event: "content.validation.failed",
      message: error instanceof Error ? error.message : "未知错误",
    }),
  );
  process.exitCode = 1;
});
