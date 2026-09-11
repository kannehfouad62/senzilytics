import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("research client portal access is relational, tenant-scoped, and project-specific", async () => {
  const [schema, migration, service] = await Promise.all([
    readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
    readFile(new URL("../prisma/migrations/20260913120000_research_client_portal_access/migration.sql", import.meta.url), "utf8"),
    readFile(new URL("../src/modules/research/research-client-portal.service.ts", import.meta.url), "utf8"),
  ]);
  assert.match(schema, /model ResearchClientPortalAccess/);
  assert.match(schema, /model ResearchClientPortalProjectAccess/);
  assert.match(schema, /@@unique\(\[clientId, userId\]\)/);
  assert.match(schema, /@@unique\(\[accessId, projectId\]\)/);
  assert.match(migration, /FOREIGN KEY \("organizationId"\)/);
  assert.match(service, /organizationId: input\.organizationId/);
  assert.match(service, /clientId: input\.clientId/);
  assert.match(service, /projects\.length !== projectIds\.length/);
});

test("client-facing project reads independently enforce active, unexpired access and approved outputs", async () => {
  const [service, page] = await Promise.all([
    readFile(new URL("../src/modules/research/research-client-portal.service.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/(platform)/research/client-portal/projects/[projectId]/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(service, /ResearchClientPortalAccessStatus\.ACTIVE/);
  assert.match(service, /expiresAt: \{ gt: new Date\(\) \}/);
  assert.match(service, /ResearchDashboardStatus\.APPROVED/);
  assert.match(service, /ResearchReportStatus\.APPROVED/);
  assert.match(service, /ResearchReportStatus\.PUBLISHED/);
  assert.match(service, /ConfigurableFormVersionStatus\.PUBLISHED/);
  assert.match(page, /if\(!assignment\)\s*notFound\(\)/);
});

test("client portal access mutations require client-management permission and are audited", async () => {
  const [actions, service] = await Promise.all([
    readFile(new URL("../src/features/research/actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/modules/research/research-client-portal.service.ts", import.meta.url), "utf8"),
  ]);
  assert.match(actions, /grantResearchClientPortalAccess/);
  assert.match(actions, /PermissionKey\.MANAGE_RESEARCH_CLIENTS/);
  assert.match(service, /logActivity/);
  assert.match(service, /ResearchClientPortalAccess/);
  assert.match(service, /ActivityAction\.STATUS_CHANGE/);
});
