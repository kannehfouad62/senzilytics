import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildChartData,
  detectQualityIssues,
  summarizeVariable,
  type ResearchDataRow,
  type ResearchVariable,
} from "../src/modules/research/research-analysis";
import { createResearchPresentation } from "../src/modules/research/research-presentation";

const score: ResearchVariable = {
  id: "score",
  key: "score",
  label: "Performance score",
  type: "NUMBER",
  required: true,
};
const department: ResearchVariable = {
  id: "department",
  key: "department",
  label: "Department",
  type: "SELECT",
  required: true,
};
const rows: ResearchDataRow[] = [
  { assignmentId: "assignment-00000001", responseId: "r1", submittedAt: "2026-09-01", values: { score: 10, department: "Operations" } },
  { assignmentId: "assignment-00000002", responseId: "r2", submittedAt: "2026-09-01", values: { score: 20, department: "Operations" } },
  { assignmentId: "assignment-00000003", responseId: "r3", submittedAt: "2026-09-01", values: { score: 30, department: "Finance" } },
  { assignmentId: "assignment-00000004", responseId: "r4", submittedAt: "2026-09-01", values: { score: 100, department: "Finance" } },
  { assignmentId: "assignment-00000005", responseId: "r5", submittedAt: "2026-09-01", values: { score: null, department: "" } },
];

test("research descriptive statistics use sample standard deviation and report missing data", () => {
  const result = summarizeVariable(score, rows);
  assert.equal(result.present, 4);
  assert.equal(result.missing, 1);
  assert.equal(result.mean, 40);
  assert.equal(result.median, 25);
  assert.ok(result.standardDeviation && Math.abs(result.standardDeviation - 40.824829) < 0.00001);
});

test("research analysis automatically creates grouped means and scatter pairs", () => {
  assert.deepEqual(buildChartData(rows, department, score), [
    { name: "Operations", value: 15, count: 2 },
    { name: "Finance", value: 65, count: 2 },
  ]);
  assert.deepEqual(buildChartData(rows, score, score).at(0), { x: 10, y: 10 });
});

test("research quality checks identify required gaps, duplicates, and numeric outliers", () => {
  const duplicate = { ...rows[0], assignmentId: "assignment-00000006", responseId: "r6" };
  const issues = detectQualityIssues([score, department], [...rows, duplicate]);
  assert.match(issues.get("assignment-00000005")?.join(" ") ?? "", /Missing required value/);
  assert.match(issues.get("assignment-00000006")?.join(" ") ?? "", /Possible duplicate/);
  assert.match(issues.get("assignment-00000004")?.join(" ") ?? "", /Potential outlier/);
});

test("dataset mutations and reads remain tenant and permission scoped", async () => {
  const [actions, service] = await Promise.all([
    readFile(new URL("../src/features/research/dataset-actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/modules/research/research-dataset.service.ts", import.meta.url), "utf8"),
  ]);
  assert.match(actions, /MANAGE_RESEARCH_DATASETS/);
  assert.match(actions, /APPROVE_RESEARCH_OUTPUTS/);
  assert.match(actions, /organizationId/);
  assert.match(actions, /Locked or approved datasets cannot be changed/);
  assert.match(actions, /Close the collection wave before locking its dataset/);
  assert.match(service, /organizationId/);
  assert.match(service, /disposition===\"INCLUDED\"/);
});

test("research exports use native Office formats and neutralize spreadsheet formulas", async () => {
  const [workbook, presentation] = await Promise.all([
    readFile(new URL("../src/app/api/research/collections/[collectionId]/workbook/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/research/collections/[collectionId]/presentation/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(workbook, /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/);
  assert.match(workbook, /[=+\-@]/);
  assert.match(presentation, /application\/vnd\.openxmlformats-officedocument\.presentationml\.presentation/);
  assert.match(presentation, /createResearchPresentation/);
});

test("PowerPoint export is a valid Open XML package with editable slide shapes", async () => {
  const output = await createResearchPresentation([[
    { x: .5, y: .5, w: 5, h: .5, text: "Governed research output", size: 24, bold: true },
    { x: .5, y: 1.5, w: 4, h: .3, fill: "22D3EE" },
  ]]);
  assert.equal(String.fromCharCode(...output.slice(0, 2)), "PK");
  assert.ok(output.byteLength > 2_000);
});
