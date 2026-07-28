import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const inputPath = resolve(
  process.cwd(),
  process.argv[2] ?? "private_content/import/shadowing-book.json",
);
const baseUrl = (process.argv[3] ?? "http://localhost:3000").replace(
  /\/$/u,
  "",
);
const imports = JSON.parse(await readFile(inputPath, "utf8"));
const response = await fetch(`${baseUrl}/api/units`);
const payload = await response.json();
if (!response.ok || !payload.ok) {
  throw new Error(payload.error?.message ?? "无法读取 Unit 列表。");
}

for (const content of imports) {
  const existing = payload.data.find(
    (unit) => unit.number === content.unit.number,
  );
  if (!existing) {
    throw new Error(`找不到 Unit ${content.unit.number}。`);
  }
  const update = await fetch(`${baseUrl}/api/units/${existing.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(content.unit),
  });
  const result = await update.json();
  if (!update.ok || !result.ok) {
    throw new Error(
      `Unit ${content.unit.number}: ${result.error?.message ?? update.status}`,
    );
  }
  console.log(`Unit ${content.unit.number}: ${content.unit.title}`);
}
