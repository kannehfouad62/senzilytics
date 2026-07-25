import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildWorkflowProcessCsv,
  parseWorkflowProcessFilters,
  percentile,
  type WorkflowProcessIntelligence,
} from "../src/core/workflow/workflow-process-intelligence.service";

test("workflow analytics filters accept only governed ranges and opaque IDs", () => {
  const now = new Date("2026-07-25T12:00:00.000Z");
  const accepted = parseWorkflowProcessFilters(
    {
      days: "180",
      templateId: "workflow_template-123",
    },
    now,
  );
  assert.equal(accepted.days, 180);
  assert.equal(accepted.templateId, "workflow_template-123");
  assert.equal(accepted.to.toISOString(), now.toISOString());
  assert.equal(
    accepted.from.toISOString(),
    "2026-01-26T12:00:00.000Z",
  );

  const rejected = parseWorkflowProcessFilters(
    {
      days: "9999",
      templateId: "../../another-tenant",
    },
    now,
  );
  assert.equal(rejected.days, 90);
  assert.equal(rejected.templateId, null);
});

test("workflow duration percentiles are deterministic and non-mutating", () => {
  const values = [8, 2, 4, 6];
  assert.equal(percentile(values, 0.5), 5);
  assert.equal(percentile(values, 0.9), 7.4);
  assert.equal(percentile([], 0.9), null);
  assert.deepEqual(values, [8, 2, 4, 6]);
});

test("workflow analytics CSV quotes values and neutralizes formulas", () => {
  const filters = parseWorkflowProcessFilters(
    { days: "30" },
    new Date("2026-07-25T12:00:00.000Z"),
  );
  const report: WorkflowProcessIntelligence = {
    filters,
    summary: {
      started: 1,
      completed: 1,
      active: 0,
      completionRate: 100,
      averageCycleHours: 4,
      medianCycleHours: 4,
      p90CycleHours: 4,
      slaMeasuredSteps: 1,
      slaBreaches: 0,
      slaAdherenceRate: 100,
      rejectionRate: 0,
      overdueActiveSteps: 0,
      automationSuccessRate: 100,
      outcomeSuccessRate: 100,
      outcomesAwaitingApproval: 0,
      outcomesFailed: 0,
      activeTemplates: 1,
      automatedTemplates: 1,
      automationCoverageRate: 100,
    },
    trend: [],
    templatePerformance: [
      {
        templateId: "template-1",
        templateName: "=HYPERLINK(\"https://example.com\")",
        entityType: "INCIDENT",
        started: 1,
        completed: 1,
        active: 0,
        completionRate: 100,
        averageCycleHours: 4,
        slaAdherenceRate: 100,
        rejectionRate: 0,
      },
    ],
    bottlenecks: [],
    outcomeReliability: [],
    ownerWorkload: [],
    automation: {
      isTemplateScoped: false,
      received: 1,
      processed: 1,
      failed: 0,
      pending: 0,
      workflowsStarted: 1,
      averageAttempts: 1,
    },
    templates: [],
  };
  const csv = buildWorkflowProcessCsv(report);

  assert.match(
    csv,
    /"'=HYPERLINK\(""https:\/\/example\.com""\)"/,
  );
  assert.match(csv, /"SLA adherence \(%\)","100"/);
});

test("workflow process intelligence is tenant scoped and permission protected", async () => {
  const [service, page, route, workflowsPage] = await Promise.all([
    readFile(
      new URL(
        "../src/core/workflow/workflow-process-intelligence.service.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/(platform)/workflows/analytics/page.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/api/workflows/analytics/export/route.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/(platform)/workflows/page.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(service, /organizationId/);
  assert.match(service, /templateId: filters\.templateId/);
  assert.match(
    page,
    /requirePermission\(PermissionKey\.MANAGE_WORKFLOWS\)/,
  );
  assert.match(
    route,
    /requirePermission\(PermissionKey\.MANAGE_WORKFLOWS\)/,
  );
  assert.match(route, /Cache-Control": "private, no-store"/);
  assert.match(route, /Workflow analytics exported/);
  assert.match(workflowsPage, /href="\/workflows\/analytics"/);
});
