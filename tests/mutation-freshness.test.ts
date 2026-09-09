import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const redirectActionFiles = [
  "../src/features/audits/actions.ts",
  "../src/features/inspections/actions.ts",
  "../src/features/inspections/inspection-capa.actions.ts",
  "../src/features/inspections/inspection-checklist.actions.ts",
  "../src/features/inspections/inspection-execution.actions.ts",
  "../src/features/moc/actions.ts",
  "../src/features/risks/actions.ts",
];

test("redirecting platform mutations invalidate visited route data before navigation", async () => {
  for (const relativePath of redirectActionFiles) {
    const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
    assert.match(source, /revalidatePath\("\/", "layout"\)/, relativePath);
    assert.match(source, /redirect as nextRedirect/, relativePath);
  }
});

test("module navigation avoids stale prefetched register payloads", async () => {
  const source = await readFile(new URL("../src/components/layout/active-navigation-link.tsx", import.meta.url), "utf8");
  assert.match(source, /prefetch=\{false\}/);
});
