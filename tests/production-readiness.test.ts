import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ProductionReadinessControlStatus,
  ProductionReadinessReviewStatus,
} from "@prisma/client";
import {
  assertProductionReadinessTransition,
  productionReadinessApprovalIssues,
  productionReadinessControlDefinitions,
  productionReadinessProgress,
  productionReadinessSubmissionIssues,
} from "../src/modules/platform/production-readiness";
import { safeProductionEvidenceUrl } from "../src/modules/platform/production-readiness.service";

test("production readiness uses a complete unique governed control set", () => {
  assert.equal(productionReadinessControlDefinitions.length, 12);
  assert.equal(
    new Set(productionReadinessControlDefinitions.map((item) => item.key)).size,
    12,
  );
});

test("readiness progress distinguishes pass, conditional, and failed evidence", () => {
  assert.equal(
    productionReadinessProgress([
      { status: ProductionReadinessControlStatus.PASS },
      { status: ProductionReadinessControlStatus.CONDITIONAL },
      { status: ProductionReadinessControlStatus.FAIL },
      { status: ProductionReadinessControlStatus.NOT_APPLICABLE },
    ]),
    63,
  );
  assert.equal(productionReadinessProgress([]), 0);
});

test("submission blocks failed and unassessed controls while approval also blocks conditions", () => {
  const controls = productionReadinessControlDefinitions.map(
    (_, index) => ({
      status:
        index === 0
          ? ProductionReadinessControlStatus.FAIL
          : index === 1
            ? ProductionReadinessControlStatus.NOT_ASSESSED
            : index === 2
              ? ProductionReadinessControlStatus.CONDITIONAL
              : ProductionReadinessControlStatus.PASS,
    }),
  );
  assert.equal(productionReadinessSubmissionIssues(controls).length, 2);
  assert.equal(productionReadinessApprovalIssues(controls).length, 3);
});

test("readiness review lifecycle permits review and final disposition without reopening approval", () => {
  assert.doesNotThrow(() =>
    assertProductionReadinessTransition(
      ProductionReadinessReviewStatus.DRAFT,
      ProductionReadinessReviewStatus.IN_REVIEW,
    ),
  );
  assert.doesNotThrow(() =>
    assertProductionReadinessTransition(
      ProductionReadinessReviewStatus.IN_REVIEW,
      ProductionReadinessReviewStatus.APPROVED,
    ),
  );
  assert.doesNotThrow(() =>
    assertProductionReadinessTransition(
      ProductionReadinessReviewStatus.REJECTED,
      ProductionReadinessReviewStatus.IN_REVIEW,
    ),
  );
  assert.throws(() =>
    assertProductionReadinessTransition(
      ProductionReadinessReviewStatus.APPROVED,
      ProductionReadinessReviewStatus.DRAFT,
    ),
  );
});

test("evidence references admit controlled paths and safe HTTPS URLs", () => {
  assert.equal(
    safeProductionEvidenceUrl("/documents"),
    "/documents",
  );
  assert.equal(
    safeProductionEvidenceUrl("https://evidence.example/review/123"),
    "https://evidence.example/review/123",
  );
  assert.throws(() => safeProductionEvidenceUrl("http://localhost/private"));
  assert.throws(() => safeProductionEvidenceUrl("/incidents/other-scope"));
});

test("production assurance reauthorizes platform writes and gates tenant go-live", async () => {
  const [actions, service, tenantPage, operationsPage, onboarding, migration] =
    await Promise.all([
      readFile(
        new URL(
          "../src/features/platform/production-readiness.actions.ts",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../src/modules/platform/production-readiness.service.ts",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../src/app/(platform)/platform/tenants/[id]/page.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../src/app/(platform)/platform/operations/page.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../src/modules/platform/tenant-onboarding.service.ts",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../prisma/migrations/20260725110000_production_assurance_v2/migration.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    ]);

  assert.equal(
    actions.match(/requirePlatformAdministrator\(\)/g)?.length,
    5,
  );
  assert.match(service, /organizationId: input\.organizationId/);
  assert.match(service, /review: \{ organizationId: input\.organizationId \}/);
  assert.match(tenantPage, /requirePlatformAdministrator\(\)/);
  assert.match(tenantPage, /ProductionReadinessWorkspace/);
  assert.match(operationsPage, /getProductionReadinessPortfolio/);
  assert.match(onboarding, /Approve the latest Production Assurance review/);
  assert.match(
    migration,
    /ProductionReadinessReview_organizationId_version_key/,
  );
});
