import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ResearchSampleUnitStatus,
  ResearchSamplingExecutionStatus,
} from "@prisma/client";
import { fieldworkEscalationLevel } from "../src/modules/research/research-fieldwork-sla.service";
import {
  assertActiveExecution,
  assertFieldworkTransition,
  summarizeFieldwork,
} from "../src/modules/research/research-fieldwork";

test("fieldwork lifecycle prevents ungoverned disposition shortcuts", () => {
  assert.doesNotThrow(() =>
    assertFieldworkTransition(
      ResearchSampleUnitStatus.SELECTED,
      ResearchSampleUnitStatus.ASSIGNED,
    ),
  );
  assert.doesNotThrow(() =>
    assertFieldworkTransition(
      ResearchSampleUnitStatus.ASSIGNED,
      ResearchSampleUnitStatus.CONTACTED,
    ),
  );
  assert.throws(
    () =>
      assertFieldworkTransition(
        ResearchSampleUnitStatus.SELECTED,
        ResearchSampleUnitStatus.COMPLETED,
      ),
    /cannot move/,
  );
  assert.throws(
    () => assertActiveExecution(ResearchSamplingExecutionStatus.APPROVED),
    /active sampling execution/,
  );
});

test("fieldwork response metrics separate assignment and response denominators", () => {
  const summary = summarizeFieldwork([
    { status: ResearchSampleUnitStatus.COMPLETED, isReserve: false },
    { status: ResearchSampleUnitStatus.REFUSED, isReserve: false },
    { status: ResearchSampleUnitStatus.ASSIGNED, isReserve: false },
    { status: ResearchSampleUnitStatus.RESERVE, isReserve: true },
  ]);
  assert.equal(summary.primary, 3);
  assert.equal(summary.assigned, 2);
  assert.equal(summary.completed, 1);
  assert.equal(summary.responseRate, 50);
});

test("fieldwork SLA levels are deterministic and progressive", () => {
  const now = new Date("2026-09-06T12:00:00.000Z");
  assert.equal(
    fieldworkEscalationLevel(new Date("2026-09-07T13:00:00.000Z"), now),
    0,
  );
  assert.equal(
    fieldworkEscalationLevel(new Date("2026-09-07T11:00:00.000Z"), now),
    1,
  );
  assert.equal(
    fieldworkEscalationLevel(new Date("2026-09-06T11:00:00.000Z"), now),
    2,
  );
  assert.equal(
    fieldworkEscalationLevel(new Date("2026-09-03T11:00:00.000Z"), now),
    3,
  );
});

test("fieldwork actions remain tenant scoped audited and scheduler integrated", async () => {
  const [actions, scheduler, migration] = await Promise.all([
    readFile(
      new URL(
        "../src/features/research/sampling-fieldwork-actions.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../src/app/api/cron/workflow-sla/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../prisma/migrations/20260905220000_research_sampling_fieldwork/migration.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  assert.match(
    actions,
    /requirePermission\(PermissionKey\.COLLECT_RESEARCH_DATA\)/,
  );
  assert.match(actions, /execution: \{ organizationId \}/);
  assert.match(actions, /logActivity/);
  assert.match(actions, /replacementForId/);
  assert.match(scheduler, /processResearchFieldworkSla/);
  assert.match(migration, /ResearchSampleUnit_assignedToId_fkey/);
});
