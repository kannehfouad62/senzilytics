import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Form Studio submissions enqueue durable and deduplicated workflow events", async () => {
  const source = await readFile(
    new URL("../src/modules/forms/runtime-form.service.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /enqueueWorkflowAutomationEvent/);
  assert.match(source, /WorkflowTriggerEvent\.FORM_SUBMITTED/);
  assert.match(source, /dedupeKey:`form-submitted:\$\{created\.id\}`/);
});

test("workflow automation processing is bounded, tenant-aware, and retry-limited", async () => {
  const source = await readFile(
    new URL(
      "../src/core/workflow/workflow-automation-event.service.ts",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(source, /MAX_ATTEMPTS = 3/);
  assert.match(source, /organizationId: input\.organizationId/);
  assert.match(source, /take: limit/);
  assert.match(source, /attempts: \{ increment: 1 \}/);
  assert.match(source, /signalWorkflowAutomation/);
});

test("workflow administration reauthorizes and derives tenant ownership", async () => {
  const [actions, newPage] = await Promise.all([
    readFile(
      new URL(
        "../src/core/workflow/workflow.admin.actions.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/(platform)/workflows/new/page.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(actions, /requirePermission\(PermissionKey\.MANAGE_WORKFLOWS\)/);
  assert.match(actions, /getCurrentUserTenant\(\)/);
  assert.match(actions, /triggerConditions/);
  assert.match(newPage, /requirePermission\(PermissionKey\.MANAGE_WORKFLOWS\)/);
  assert.match(newPage, /WorkflowTriggerSettingsFields/);
});

test("the existing production scheduler processes the automation queue", async () => {
  const route = await readFile(
    new URL(
      "../src/app/api/workflows/process-sla/route.ts",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(route, /processWorkflowAutomationEvents\(\)/);
  assert.match(route, /workflowAutomationResult/);
  assert.match(route, /runTrackedScheduledJob\("workflow-sla"/);
});
