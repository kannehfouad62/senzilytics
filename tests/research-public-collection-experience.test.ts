import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public research links are governed and accept separate external submissions", async () => {
  const [schema, linkActions, publicActions, migration] = await Promise.all([
    readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
    readFile(new URL("../src/features/research/public-survey-link-actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/features/research/public-survey-actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../prisma/migrations/20260905120000_research_public_survey_links/migration.sql", import.meta.url), "utf8"),
  ]);
  assert.match(schema, /model ResearchPublicSurveyLink/);
  assert.match(schema, /model ResearchPublicResponse/);
  assert.match(schema, /submittedById\s+String\?/);
  assert.match(linkActions, /randomBytes\(32\)/);
  assert.match(linkActions, /MANAGE_RESEARCH_DATASETS/);
  assert.match(linkActions, /organizationId/);
  assert.match(publicActions, /TransactionIsolationLevel\.Serializable/);
  assert.match(publicActions, /maxResponses/);
  assert.match(publicActions, /preparePublishedFormVersionSubmission/);
  assert.match(migration, /ALTER COLUMN "submittedById" DROP NOT NULL/);
});

test("assigned and public responses share the governed research dataset pipeline", async () => {
  const [dataset, quality, exportRoute] = await Promise.all([
    readFile(new URL("../src/modules/research/research-dataset.service.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/features/research/dataset-actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/research/collections/[collectionId]/export/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(dataset, /publicResponses/);
  assert.match(dataset, /responseRows/);
  assert.match(dataset, /disposition === "INCLUDED"/);
  assert.match(quality, /researchPublicResponse\.update/);
  assert.match(quality, /datasetStatus === ResearchDatasetStatus\.LOCKED/);
  assert.match(exportRoute, /"PUBLIC"/);
  assert.match(exportRoute, /response_source/);
});

test("desktop navigation starts collapsed and the executive dashboard includes research", async () => {
  const [shell, dashboard, loginRedirect, topbar] = await Promise.all([
    readFile(new URL("../src/components/layout/collapsible-app-shell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/(platform)/dashboard/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/login-redirect.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/components/layout/topbar.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(shell, /useState\(false\)/);
  assert.match(shell, /aria-expanded/);
  assert.match(dashboard, /getResearchExecutiveSummary/);
  assert.match(dashboard, /Research & Analytics intelligence/);
  assert.match(loginRedirect, /return "\/dashboard"/);
  assert.match(topbar, /Research & Analytics/);
});
