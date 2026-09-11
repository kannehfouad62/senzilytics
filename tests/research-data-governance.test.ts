import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  dataLifecycleTransitions,
  datasetAccessTransitions,
  privacyReviewTransitions,
} from "../src/modules/research/research-data-governance";
import {
  ResearchDataLifecycleStatus,
  ResearchDatasetAccessStatus,
  ResearchPrivacyReviewStatus,
} from "@prisma/client";

test("research data lifecycle prevents disposal and approval shortcuts", () => {
  assert.deepEqual(dataLifecycleTransitions.DRAFT, [ResearchDataLifecycleStatus.ACTIVE]);
  assert.equal(dataLifecycleTransitions.ACTIVE.includes(ResearchDataLifecycleStatus.DISPOSED), false);
  assert.deepEqual(dataLifecycleTransitions.DISPOSED, []);
});

test("privacy and dataset access use controlled terminal decisions", () => {
  assert.equal(privacyReviewTransitions.DRAFT.includes(ResearchPrivacyReviewStatus.APPROVED), false);
  assert.deepEqual(privacyReviewTransitions.APPROVED, []);
  assert.equal(datasetAccessTransitions.PENDING.includes(ResearchDatasetAccessStatus.APPROVED), true);
  assert.deepEqual(datasetAccessTransitions.REVOKED, []);
});

test("data-governance persistence is tenant scoped and relational", async () => {
  const [schema, migration, service] = await Promise.all([
    readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
    readFile(new URL("../prisma/migrations/20260917120000_research_data_governance/migration.sql", import.meta.url), "utf8"),
    readFile(new URL("../src/modules/research/research-data-governance.service.ts", import.meta.url), "utf8"),
  ]);
  assert.match(schema, /model ResearchDataLifecyclePlan/);
  assert.match(schema, /model ResearchPrivacyReview/);
  assert.match(schema, /model ResearchDatasetAccessRequest/);
  assert.match(migration, /FOREIGN KEY \("organizationId"\)/);
  assert.match(service, /organizationId: input\.organizationId/);
  assert.match(service, /requestedById: viewerId/);
});

test("sensitive dataset access requires independent approval and disclosure evidence", async () => {
  const [service, actions, page] = await Promise.all([
    readFile(new URL("../src/modules/research/research-data-governance.service.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/features/research/data-governance-actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/(platform)/research/projects/[id]/data-governance/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(service, /requesters cannot decide their own access/);
  assert.match(service, /DISCLOSURE_RISK/);
  assert.match(service, /Approved low- or medium-risk disclosure review is required/);
  assert.match(actions, /PermissionKey\.APPROVE_RESEARCH_OUTPUTS/);
  assert.match(actions, /revalidatePath/);
  assert.match(page, /Non-managers see only their own requests/);
});
