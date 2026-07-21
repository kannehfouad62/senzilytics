import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

function findTestFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return findTestFiles(path);
    return entry.isFile() && entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

const testFiles = findTestFiles("tests").sort();

if (testFiles.length === 0) {
  console.error("No TypeScript test files were found in the tests directory.");
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ["--import", "tsx", "--test", ...testFiles],
  { stdio: "inherit" },
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
