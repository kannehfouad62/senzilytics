import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  OrganizationStatus,
  PlatformReleaseCheckStatus,
  PlatformReleaseStatus,
  ProductionReadinessReviewStatus,
  TenantOnboardingStatus,
} from "@prisma/client";
import {
  assertPlatformReleaseTransition,
  normalizePlatformReleaseCommit,
  normalizePlatformReleaseVersion,
  pilotTenantEligibilityIssues,
  platformReleaseCheckDefinitions,
  platformReleaseProgress,
  platformReleaseSubmissionIssues,
  safePlatformReleaseEvidenceUrl,
  safePlatformReleaseUrl,
} from "../src/modules/platform/release-candidate";

test("release certification uses a complete unique governed check set", () => {
  assert.equal(platformReleaseCheckDefinitions.length, 8);
  assert.equal(
    new Set(platformReleaseCheckDefinitions.map((check) => check.key)).size,
    8,
  );
});

test("release progress counts only passed and not-applicable checks", () => {
  assert.equal(
    platformReleaseProgress([
      { status: PlatformReleaseCheckStatus.PASS },
      { status: PlatformReleaseCheckStatus.NOT_APPLICABLE },
      { status: PlatformReleaseCheckStatus.FAIL },
      { status: PlatformReleaseCheckStatus.NOT_RUN },
    ]),
    50,
  );
  assert.equal(platformReleaseProgress([]), 0);
});

test("release submission blocks incomplete evidence, metadata, and pilot scope", () => {
  const issues = platformReleaseSubmissionIssues({
    releaseNotes: "short",
    riskSummary: null,
    rollbackPlan: null,
    checks: platformReleaseCheckDefinitions.map((_, index) => ({
      status:
        index === 0
          ? PlatformReleaseCheckStatus.FAIL
          : index === 1
            ? PlatformReleaseCheckStatus.NOT_RUN
            : PlatformReleaseCheckStatus.PASS,
    })),
    pilotCount: 0,
  });
  assert.equal(issues.length, 6);
});

test("release lifecycle requires certification before pilot and final disposition", () => {
  assert.doesNotThrow(() =>
    assertPlatformReleaseTransition(
      PlatformReleaseStatus.DRAFT,
      PlatformReleaseStatus.IN_REVIEW,
    ),
  );
  assert.doesNotThrow(() =>
    assertPlatformReleaseTransition(
      PlatformReleaseStatus.IN_REVIEW,
      PlatformReleaseStatus.APPROVED,
    ),
  );
  assert.doesNotThrow(() =>
    assertPlatformReleaseTransition(
      PlatformReleaseStatus.APPROVED,
      PlatformReleaseStatus.PILOT_ACTIVE,
    ),
  );
  assert.doesNotThrow(() =>
    assertPlatformReleaseTransition(
      PlatformReleaseStatus.PILOT_ACTIVE,
      PlatformReleaseStatus.RELEASED,
    ),
  );
  assert.throws(() =>
    assertPlatformReleaseTransition(
      PlatformReleaseStatus.DRAFT,
      PlatformReleaseStatus.RELEASED,
    ),
  );
});

test("pilot eligibility requires approved assurance and strengthens at launch", () => {
  assert.deepEqual(
    pilotTenantEligibilityIssues({
      organizationStatus: OrganizationStatus.ACTIVE,
      isDemo: false,
      onboardingStatus: TenantOnboardingStatus.READY_FOR_REVIEW,
      readinessStatus: ProductionReadinessReviewStatus.APPROVED,
      requireLive: false,
    }),
    [],
  );
  assert.equal(
    pilotTenantEligibilityIssues({
      organizationStatus: OrganizationStatus.ACTIVE,
      isDemo: false,
      onboardingStatus: TenantOnboardingStatus.READY_FOR_REVIEW,
      readinessStatus: ProductionReadinessReviewStatus.APPROVED,
      requireLive: true,
    }).length,
    1,
  );
});

test("release identifiers and evidence references are normalized safely", () => {
  assert.equal(normalizePlatformReleaseVersion(" 1.2.0-rc.1 "), "1.2.0-rc.1");
  assert.equal(normalizePlatformReleaseCommit(" A1B2C3D "), "a1b2c3d");
  assert.equal(
    safePlatformReleaseUrl("https://candidate.senzilytics.cloud", "Candidate"),
    "https://candidate.senzilytics.cloud/",
  );
  assert.equal(
    safePlatformReleaseEvidenceUrl("/platform/operations"),
    "/platform/operations",
  );
  assert.throws(() => safePlatformReleaseUrl("http://localhost:3000", "Candidate"));
  assert.throws(() => safePlatformReleaseEvidenceUrl("/incidents/tenant-record"));
});

test("release certification reauthorizes platform writes and persists pilot gates", async () => {
  const [actions, service, page, operations, migration] = await Promise.all([
    readFile(
      new URL(
        "../src/features/platform/release-candidate.actions.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/modules/platform/release-candidate.service.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/(platform)/platform/releases/page.tsx",
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
        "../prisma/migrations/20260726030000_release_candidate_certification/migration.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.equal(actions.match(/requirePlatformAdministrator\(\)/g)?.length, 9);
  assert.match(service, /requireLive: true/);
  assert.match(service, /pilotTenantEligibilityIssues/);
  assert.match(page, /requirePlatformAdministrator\(\)/);
  assert.match(operations, /getPlatformReleaseMetrics/);
  assert.match(
    migration,
    /PlatformReleasePilot_releaseId_organizationId_key/,
  );
});
