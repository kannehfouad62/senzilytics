import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { detectFieldworkLocationClusters, fieldworkIntegritySignals, selectDeterministicBackcheckSample, summarizeFieldworkAssurance } from "../src/modules/research/research-fieldwork-assurance";

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

test("location proximity signals are deterministic and remain review indicators", () => {
  const points = [
    { id: "a", latitude: 38.8977, longitude: -77.0365, capturedAt: new Date(), enumeratorId: "one" },
    { id: "b", latitude: 38.89771, longitude: -77.03651, capturedAt: new Date(), enumeratorId: "one" },
    { id: "c", latitude: 40.7128, longitude: -74.006, capturedAt: new Date(), enumeratorId: "two" },
  ];
  const result = detectFieldworkLocationClusters(points, 25);
  assert.equal(result.pairs.length, 1);
  assert.deepEqual(result.responseIds.sort(), ["a", "b"]);
  assert.equal(result.pairs[0].sameEnumerator, true);
});

test("fieldwork assurance actions remain tenant scoped and independently reviewed", async () => {
  const [actions, schema, migration, page, collectionActions, sync, sla, slaMigration] = await Promise.all([
    readFile(new URL("../src/features/research/sampling-fieldwork-actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
    readFile(new URL("../prisma/migrations/20260908170000_research_fieldwork_assurance/migration.sql", import.meta.url), "utf8"),
    readFile(new URL("../src/app/(platform)/research/projects/[id]/fieldwork/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/features/research/collection-actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/modules/mobile/offline-sync.service.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/modules/research/research-fieldwork-sla.service.ts", import.meta.url), "utf8"),
    readFile(new URL("../prisma/migrations/20260909200000_research_backcheck_sla/migration.sql", import.meta.url), "utf8"),
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
  assert.match(collectionActions, /ResearchCollectionLocationPolicy/);
  assert.match(sync, /Explicit location consent|Explicit location consent/i);
  assert.match(sync, /retainPreciseLocation/);
  assert.match(actions, /recontactDueAt/);
  assert.match(sla, /Research back-check seriously overdue/);
  assert.match(sla, /projectManager/);
  assert.match(slaMigration, /backcheckEscalationLevel/);
});
