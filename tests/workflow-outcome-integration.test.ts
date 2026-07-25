import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path: string) =>
  readFile(new URL(path, import.meta.url), "utf8");

test("workflow outcome persistence is idempotent and tenant indexed", async () => {
  const [schema, migration] = await Promise.all([
    source("../prisma/schema.prisma"),
    source(
      "../prisma/migrations/20260725090000_workflow_automated_outcomes/migration.sql",
    ),
  ]);

  assert.match(schema, /model WorkflowOutcomeExecution/);
  assert.match(schema, /@@unique\(\[organizationId, idempotencyKey\]\)/);
  assert.match(schema, /model WorkflowGeneratedTask/);
  assert.match(migration, /WorkflowOutcomeExecution_organizationId_status_createdAt_idx/);
  assert.match(migration, /ON DELETE RESTRICT/);
});

test("outcome execution is bounded, retry-limited, and deterministic", async () => {
  const service = await source(
    "../src/core/workflow/workflow-outcome.service.ts",
  );

  assert.match(service, /const MAX_ATTEMPTS = 3/);
  assert.match(service, /take: limit/);
  assert.match(service, /organizationId: input\.organizationId/);
  assert.match(service, /skipDuplicates: true/);
  assert.match(service, /outcomeRecordId\("task", execution\.id\)/);
  assert.match(service, /outcomeRecordId\("capa", execution\.id\)/);
  assert.match(service, /outcomeRecordId\("risk", execution\.id\)/);
});

test("workflow decisions and SLA escalation enqueue governed outcomes", async () => {
  const [workflow, sla] = await Promise.all([
    source("../src/core/workflow/workflow.service.ts"),
    source("../src/core/workflow/workflow-sla.service.ts"),
  ]);

  assert.match(workflow, /WorkflowOutcomeEvent\.STEP_APPROVED/);
  assert.match(workflow, /WorkflowOutcomeEvent\.STEP_REJECTED/);
  assert.match(workflow, /WorkflowOutcomeEvent\.WORKFLOW_COMPLETED/);
  assert.match(sla, /WorkflowOutcomeEvent\.STEP_ESCALATED/);
  assert.match(sla, /queueWorkflowOutcomesSafely/);
});

test("the existing hourly processor runs outcomes after workflow events and SLA", async () => {
  const route = await source(
    "../src/app/api/workflows/process-sla/route.ts",
  );
  const automationIndex = route.indexOf(
    "await processWorkflowAutomationEvents()",
  );
  const slaIndex = route.indexOf("processWorkflowSlaNotifications()");
  const outcomeIndex = route.indexOf(
    "await processWorkflowOutcomeExecutions()",
  );

  assert.ok(automationIndex >= 0);
  assert.ok(slaIndex > automationIndex);
  assert.ok(outcomeIndex > slaIndex);
  assert.match(route, /runTrackedScheduledJob\("workflow-sla"/);
  assert.match(route, /workflowOutcomesCompleted/);
});

test("outcome administration and generated tasks enforce tenant access", async () => {
  const [actions, tasks, calendar] = await Promise.all([
    source("../src/core/workflow/workflow-outcome.actions.ts"),
    source("../src/app/(platform)/tasks/page.tsx"),
    source("../src/modules/compliance/unified-calendar.service.ts"),
  ]);

  assert.match(actions, /requirePermission\(PermissionKey\.MANAGE_WORKFLOWS\)/);
  assert.match(actions, /getCurrentUserTenant\(\)/);
  assert.match(actions, /organizationId/);
  assert.match(tasks, /workflowGeneratedTask\.findMany/);
  assert.match(tasks, /updateWorkflowGeneratedTask/);
  assert.match(calendar, /generatedWorkflowTasks/);
  assert.match(calendar, /sourceLabel:"Workflow Action"/);
});
