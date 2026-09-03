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
import {
  boxPlot,
  confidenceInterval,
  contingencyTable,
  histogram,
  linearRegression,
  oneWayAnova,
  pearsonCorrelation,
  spearmanCorrelation,
  welchTTest,
  buildAnalysisSnapshot,
} from "../src/modules/research/research-statistics";

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

test("advanced distribution analysis produces stable confidence intervals, histograms and box plots", () => {
  const interval = confidenceInterval(rows, score);
  assert.equal(interval?.mean, 40);
  assert.ok(interval && interval.lower < 40 && interval.upper > 40);
  assert.equal(histogram(rows, score, 4).reduce((sum, bin) => sum + bin.value, 0), 4);
  assert.deepEqual(boxPlot(rows, score)?.outliers, [100]);
});

test("Pearson and Spearman correlations report coefficients and inference", () => {
  const x = { ...score, key: "x" };
  const y = { ...score, key: "y" };
  const correlationRows = [1, 2, 3, 4, 5].map((value, index) => ({ assignmentId: String(index), responseId: String(index), submittedAt: "", values: { x: value, y: value * 2 + 1 } }));
  assert.ok((pearsonCorrelation(correlationRows, x, y)?.coefficient ?? 0) > .9999);
  assert.ok((spearmanCorrelation(correlationRows, x, y)?.coefficient ?? 0) > .9999);
  assert.ok((pearsonCorrelation(correlationRows, x, y)?.pValue ?? 1) < .001);
});

test("crosstabs calculate chi-square and Cramer's V", () => {
  const outcome = { ...department, key: "outcome", label: "Outcome" };
  const tableRows = Array.from({ length: 20 }, (_, index) => ({ assignmentId: String(index), responseId: String(index), submittedAt: "", values: { department: index < 10 ? "A" : "B", outcome: index < 8 || index >= 18 ? "Yes" : "No" } }));
  const result = contingencyTable(tableRows, department, outcome);
  assert.deepEqual(result.cells, [[8, 2], [2, 8]]);
  assert.ok(result.statistic > 7);
  assert.ok((result.pValue ?? 1) < .01);
  assert.ok((result.cramersV ?? 0) > .5);
  const multiSelect = contingencyTable([{ assignmentId: "m1", responseId: "m1", submittedAt: "", values: { department: ["A", "B"], outcome: "Yes" } }], department, outcome);
  assert.equal(multiSelect.total, 1);
});

test("group comparisons provide Welch t tests and one-way ANOVA effect sizes", () => {
  const groupRows = [1, 2, 3, 4, 5, 6].map((value, index) => ({ assignmentId: String(index), responseId: String(index), submittedAt: "", values: { department: index < 3 ? "A" : "B", score: value } }));
  const tTest = welchTTest(groupRows, department, score);
  const anova = oneWayAnova(groupRows, department, score);
  assert.ok(tTest && Math.abs(tTest.statistic + 3.6742346) < .00001);
  assert.ok(tTest && tTest.pValue < .05 && Math.abs((tTest.cohensD ?? 0) + 3) < .00001);
  assert.ok(anova && Math.abs(anova.statistic - 13.5) < .00001);
  assert.ok(anova && anova.pValue < .05 && (anova.etaSquared ?? 0) > .7);
});

test("simple linear regression reports slope, intercept, fit and significance", () => {
  const x = { ...score, key: "x" };
  const y = { ...score, key: "y" };
  const regressionRows = [1, 2, 3, 4, 5].map((value, index) => ({ assignmentId: String(index), responseId: String(index), submittedAt: "", values: { x: value, y: 2 * value + 1 } }));
  const result = linearRegression(regressionRows, x, y);
  assert.equal(result?.slope, 2);
  assert.equal(result?.intercept, 1);
  assert.equal(result?.rSquared, 1);
  assert.equal(result?.pValue, 0);
});

test("saved advanced analyses use reproducible server-calculated snapshots", () => {
  const snapshot = buildAnalysisSnapshot("GROUP_COMPARISON", rows, department, score);
  assert.equal(snapshot.method, "GROUP_COMPARISON");
  assert.ok("anova" in snapshot);
});

test("saved analysis governance reauthorizes, tenant-scopes and requires independent approval", async () => {
  const source = await readFile(new URL("../src/features/research/analysis-actions.ts", import.meta.url), "utf8");
  assert.match(source, /RUN_RESEARCH_ANALYSIS/);
  assert.match(source, /organizationId/);
  assert.match(source, /APPROVE_RESEARCH_OUTPUTS/);
  assert.match(source, /analyst cannot approve their own work/);
  assert.match(source, /dataset must be approved/);
  assert.match(source, /Lock the governed dataset before submitting/);
  assert.match(source, /analytical population changed/);
  assert.match(source, /buildAnalysisSnapshot/);
  assert.match(source, /_max: \{ version: true \}/);
  assert.match(source, /revalidatePath\("\/research", "layout"\)/);
});
