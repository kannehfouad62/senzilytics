import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { ResearchSampleUnitStatus } from "@prisma/client";
import {
  buildFieldworkAnalytics,
  type FieldworkUnit,
} from "../src/modules/research/research-fieldwork-analytics";

const now = new Date("2026-09-07T12:00:00.000Z");
const unit = (
  status: ResearchSampleUnitStatus,
  extra: Partial<FieldworkUnit> = {},
): FieldworkUnit => ({
  status,
  isReserve: false,
  stratum: "North",
  cluster: "A",
  dueAt: null,
  completedAt: null,
  contactAttempts: 0,
  assignedTo: { name: "Researcher One" },
  ...extra,
});

test("fieldwork analytics calculate transparent response and cooperation rates", () => {
  const result = buildFieldworkAnalytics(
    [
      unit(ResearchSampleUnitStatus.COMPLETED),
      unit(ResearchSampleUnitStatus.COMPLETED),
      unit(ResearchSampleUnitStatus.REFUSED),
      unit(ResearchSampleUnitStatus.INELIGIBLE),
      unit(ResearchSampleUnitStatus.ASSIGNED, {
        dueAt: new Date("2026-09-01T00:00:00.000Z"),
      }),
      unit(ResearchSampleUnitStatus.RESERVE, { isReserve: true }),
    ],
    now,
  );
  assert.equal(result.selected, 5);
  assert.ok(Math.abs(result.responseRate - 200 / 3) < 1e-10);
  assert.ok(Math.abs(result.cooperationRate - 200 / 3) < 1e-10);
  assert.equal(result.overdue, 1);
  assert.equal(result.ineligible, 1);
});

test("fieldwork dashboard and exports remain permission and tenant scoped", async () => {
  const [page, workbook, presentation] = await Promise.all([
    readFile(
      new URL(
        "../src/app/(platform)/research/projects/[id]/fieldwork/page.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/api/research/sampling-executions/[executionId]/fieldwork-workbook/route.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/api/research/sampling-executions/[executionId]/fieldwork-presentation/route.ts",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  assert.match(page, /requirePermission\(PermissionKey\.VIEW_RESEARCH\)/);
  assert.match(page, /organizationId/);
  for (const source of [workbook, presentation]) {
    assert.match(
      source,
      /requirePermission\(PermissionKey\.EXPORT_RESEARCH_OUTPUTS\)/,
    );
    assert.match(source, /id: executionId, organizationId/);
    assert.match(source, /private, no-store/);
  }
  assert.match(workbook, /safe\(unit\.dispositionNote/);
  assert.match(presentation, /createResearchPresentation/);
});
