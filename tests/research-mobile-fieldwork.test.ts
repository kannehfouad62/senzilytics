import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("mobile research fieldwork is assignment, tenant and permission scoped", async () => {
  const [service, bootstrap, catalog] = await Promise.all([
    readFile(new URL("../src/modules/mobile/mobile-research-fieldwork.service.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/mobile/bootstrap/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/modules/mobile/mobile-module-catalog.ts", import.meta.url), "utf8"),
  ]);
  assert.match(service, /COLLECT_RESEARCH_DATA/);
  assert.match(service, /assignedToId: input\.userId/);
  assert.match(service, /organizationId: input\.organizationId/);
  assert.match(service, /ResearchSamplingExecutionStatus\.ACTIVE/);
  assert.match(service, /ResearchCollectionStatus\.ACTIVE/);
  assert.match(bootstrap, /researchFieldworkAssignments/);
  assert.match(catalog, /nativeCapability: "RESEARCH_FIELDWORK"/);
});

test("offline interviews preserve immutable lineage and idempotency", async () => {
  const [schema, migration, sync, envelope, storage, app, dataset, exportRoute] = await Promise.all([
    readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
    readFile(new URL("../prisma/migrations/20260908120000_research_mobile_fieldwork/migration.sql", import.meta.url), "utf8"),
    readFile(new URL("../src/modules/mobile/offline-sync.service.ts", import.meta.url), "utf8"),
    readFile(new URL("../apps/mobile/src/offline-envelope.ts", import.meta.url), "utf8"),
    readFile(new URL("../apps/mobile/src/storage.ts", import.meta.url), "utf8"),
    readFile(new URL("../apps/mobile/App.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/modules/research/research-dataset.service.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/research/collections/[collectionId]/export/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(schema, /model ResearchFieldworkResponse/);
  assert.match(schema, /deviceSubmissionId String\s+@unique/);
  assert.match(schema, /backcheckStatus\s+ResearchFieldworkBackcheckStatus/);
  assert.match(migration, /ResearchFieldworkResponse_deviceSubmissionId_key/);
  assert.match(sync, /type: z\.literal\("RESEARCH_FIELDWORK_RESPONSE"\)/);
  assert.match(sync, /item\.payload\.form\.versionId !== collection\.formVersionId/);
  assert.match(sync, /assignedToId: actor\.userId/);
  assert.match(sync, /offlineSubmission\.create/);
  assert.match(envelope, /"RESEARCH_FIELDWORK_RESPONSE"/);
  assert.match(storage, /queueResearchFieldworkResponse/);
  assert.match(app, /Encrypted offline interview/i);
  assert.match(dataset, /source: "FIELDWORK"/);
  assert.match(exportRoute, /"FIELDWORK"/);
});
