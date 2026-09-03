import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  reportAnalysisEvidence,
  researchResultLines,
} from "../src/modules/research/research-report";

test("research reports accept only structurally governed analysis evidence", () => {
  const evidence = reportAnalysisEvidence({
    analyses: [
      {
        id: "analysis-1",
        title: "Performance model",
        method: "MULTIPLE_REGRESSION",
        version: 2,
        population: 150,
        result: { result: { rSquared: 0.72 } },
        approvedAt: "2026-09-03T00:00:00.000Z",
        approvedBy: { name: "Independent reviewer" },
        collection: { name: "Employee wave", datasetStatus: "APPROVED" },
      },
      { id: "incomplete" },
    ],
  });
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0]?.title, "Performance model");
});

test("research report result summaries are bounded and omit row diagnostics", () => {
  const lines = researchResultLines(
    {
      method: "REGRESSION",
      result: {
        rSquared: 0.712345,
        intercept: 4.2,
        diagnostics: Array.from({ length: 100 }, (_, index) => ({ index })),
      },
    },
    2,
  );
  assert.equal(lines.length, 2);
  assert.equal(lines[1]?.value, "0.7123");
  assert.ok(lines.every((line) => !line.label.includes("Diagnostics")));
});

test("governed report actions reauthorize, tenant-scope and enforce independent approval", async () => {
  const source = await readFile(
    new URL("../src/features/research/report-actions.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /RUN_RESEARCH_ANALYSIS/);
  assert.match(source, /APPROVE_RESEARCH_OUTPUTS/);
  assert.match(source, /organizationId/);
  assert.match(source, /authorId === user\.id/);
  assert.match(source, /ResearchAnalysisStatus\.APPROVED/);
  assert.match(source, /evidenceSnapshot/);
  assert.match(source, /logActivity/);
  assert.match(source, /revalidatePath/);
});

test("research report exports are private, tenant-scoped native outputs", async () => {
  const [printPage, presentation] = await Promise.all([
    readFile(
      new URL(
        "../src/app/(platform)/research/reports/[reportId]/print/page.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/api/research/reports/[reportId]/presentation/route.ts",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  for (const source of [printPage, presentation]) {
    assert.match(source, /EXPORT_RESEARCH_OUTPUTS/);
    assert.match(source, /organizationId/);
  }
  assert.match(presentation, /createResearchPresentation/);
  assert.match(presentation, /no-store/);
});
