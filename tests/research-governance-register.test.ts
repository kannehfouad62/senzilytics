import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("research governance records are versioned and tenant scoped", async () => {
  const [schema, migration, service] = await Promise.all([
    readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../prisma/migrations/20260916120000_research_governance_register/migration.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/modules/research/research-governance-register.service.ts",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(schema, /model ResearchGovernanceRecord/);
  assert.match(schema, /@@unique\(\[projectId, type, reference, version\]\)/);
  assert.match(migration, /FOREIGN KEY \("organizationId"\)/);
  assert.match(service, /organizationId:input\.organizationId/);
  assert.match(service, /_max:\{version:true\}/);
});

test("governance lifecycle requires evidence and independent approval", async () => {
  const [lifecycle, service, actions, page] = await Promise.all([
    readFile(
      new URL(
        "../src/modules/research/research-governance-register.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/modules/research/research-governance-register.service.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../src/features/research/governance-actions.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/(platform)/research/projects/[id]/governance/page.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(lifecycle, /UNDER_REVIEW/);
  assert.match(service, /Independent approval is required/);
  assert.match(service, /evidenceReference/);
  assert.match(actions, /PermissionKey\.APPROVE_RESEARCH_OUTPUTS/);
  assert.match(actions, /revalidatePath/);
  assert.match(page, /canApprove=permissions\.includes/);
});

test("governance register covers the five controlled record families", async () => {
  const schema = await readFile(
    new URL("../prisma/schema.prisma", import.meta.url),
    "utf8",
  );

  for (const recordType of [
    "PROTOCOL",
    "ETHICS_REVIEW",
    "DATA_MANAGEMENT_PLAN",
    "DATA_SHARING_AGREEMENT",
    "CONFLICT_OF_INTEREST",
  ]) {
    assert.match(schema, new RegExp(`\\b${recordType}\\b`));
  }
});
