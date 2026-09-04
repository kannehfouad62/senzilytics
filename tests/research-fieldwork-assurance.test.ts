import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { fieldworkIntegritySignals, selectDeterministicBackcheckSample, summarizeFieldworkAssurance } from "../src/modules/research/research-fieldwork-assurance";

const response = {
  id: "response-1", enumeratorId: "enumerator-1",
  interviewStartedAt: new Date("2026-09-01T10:00:00Z"), capturedAt: new Date("2026-09-01T10:01:00Z"), synchronizedAt: new Date("2026-09-05T10:01:00Z"),
  latitude: null, longitude: null, locationAccuracyM: null,
  backcheckRequired: true, backcheckStatus: "PENDING" as const, backcheckDueAt: new Date("2026-09-03T00:00:00Z"),
};

test("fieldwork integrity signals are transparent and non-dispositive", () => {
  const result = fieldworkIntegritySignals(response, new Date("2026-09-04T00:00:00Z"));
  assert.deepEqual(result.signals, ["VERY_SHORT_INTERVIEW", "DELAYED_SYNCHRONIZATION", "LOCATION_NOT_CAPTURED", "BACKCHECK_OVERDUE"]);
  assert.equal(result.risk, "HIGH");
  assert.equal(summarizeFieldworkAssurance([response], new Date("2026-09-04T00:00:00Z")).overdue, 1);
});

test("back-check sampling is deterministic and percentage bounded", () => {
  const rows = Array.from({ length: 10 }, (_, index) => ({ id: `r-${index}` }));
  assert.deepEqual(selectDeterministicBackcheckSample(rows, 20, "seed"), selectDeterministicBackcheckSample(rows, 20, "seed"));
  assert.equal(selectDeterministicBackcheckSample(rows, 20, "seed").length, 2);
  assert.throws(() => selectDeterministicBackcheckSample(rows, 0, "seed"));
});

test("fieldwork assurance actions remain tenant scoped and independently reviewed", async () => {
  const [actions, schema, migration, page] = await Promise.all([
    readFile(new URL("../src/features/research/sampling-fieldwork-actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
    readFile(new URL("../prisma/migrations/20260908170000_research_fieldwork_assurance/migration.sql", import.meta.url), "utf8"),
    readFile(new URL("../src/app/(platform)/research/projects/[id]/fieldwork/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(actions, /requirePermission\(PermissionKey\.MANAGE_RESEARCH_DATASETS\)/);
  assert.match(actions, /organizationId/);
  assert.match(actions, /response\.enumeratorId === user\.id/);
  assert.match(actions, /response\.backcheckAssignedToId !== user\.id/);
  assert.match(actions, /Research back-check assigned/);
  assert.match(actions, /MANAGE_RESEARCH_DATASETS/);
  assert.match(actions, /ResearchFieldworkBackcheckSample/);
  assert.match(schema, /backcheckRequired\s+Boolean/);
  assert.match(schema, /backcheckAssignedToId\s+String\?/);
  assert.match(migration, /backcheckDueAt/);
  assert.match(page, /Fieldwork assurance/);
});
