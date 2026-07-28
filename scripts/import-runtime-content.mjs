import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const inputPath = resolve(
  process.cwd(),
  process.argv[2] ?? "private_content/import/shadowing-book.json",
);
const baseUrl = (process.argv[3] ?? "http://127.0.0.1:3000").replace(
  /\/$/u,
  "",
);
const input = JSON.parse(await readFile(inputPath, "utf8"));
if (!Array.isArray(input)) {
  throw new Error("教材文件必须是 Unit 导入对象数组。");
}

const results = [];
for (const unit of input) {
  const response = await fetch(`${baseUrl}/api/content/import`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(unit),
  });
  const payload = await response.json();
  results.push({
    unit: unit.unit?.number,
    status: response.status,
    ok: response.ok,
    payload,
  });
  if (!response.ok) {
    console.error(JSON.stringify(results.at(-1), null, 2));
    process.exitCode = 1;
    break;
  }
  console.log(
    `Unit ${unit.unit.number}: ${payload.data?.lessons ?? 0} 条音轨已导入`,
  );
}

console.log(
  JSON.stringify(
    {
      success:
        results.length === input.length && results.every((item) => item.ok),
      importedUnits: results.filter((item) => item.ok).length,
    },
    null,
    2,
  ),
);
