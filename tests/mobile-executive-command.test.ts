import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  AiIntelligenceUseCase,
  PermissionKey,
} from "@prisma/client";
import {
  executeMobileExecutiveAction,
  getMobileExecutiveReportingWindow,
  mobileExecutiveActionSchema,
  mobileExecutiveCapabilities,
  MobileExecutiveActionError,
} from "../src/modules/mobile/mobile-executive.service";
import { getMobileModuleCatalog } from "../src/modules/mobile/mobile-module-catalog";

const user = {
  email: "leader@example.com",
  role: "EHS_MANAGER",
  isActive: true,
  isPlatformAdmin: false,
};

test("native executive capabilities preserve dashboard, reports, AI, and review boundaries", () => {
  assert.deepEqual(
    mobileExecutiveCapabilities([PermissionKey.VIEW_DASHBOARD]),
    {
      canViewDashboard: true,
      canViewReports: false,
      canUseAi: false,
      canReviewAi: false,
    }
  );
  assert.deepEqual(
    mobileExecutiveCapabilities([
      PermissionKey.VIEW_DASHBOARD,
      PermissionKey.USE_AI,
    ]),
    {
      canViewDashboard: true,
      canViewReports: false,
      canUseAi: true,
      canReviewAi: false,
    }
  );
  assert.deepEqual(
    mobileExecutiveCapabilities([
      PermissionKey.VIEW_DASHBOARD,
      PermissionKey.VIEW_REPORTS,
      PermissionKey.USE_AI,
    ]),
    {
      canViewDashboard: true,
      canViewReports: true,
      canUseAi: true,
      canReviewAi: true,
    }
  );
  assert.equal(
    mobileExecutiveCapabilities([PermissionKey.USE_AI]).canUseAi,
    false
  );
});

test("authorized command modules open their matching native executive views", () => {
  const catalog = getMobileModuleCatalog({
    permissions: [
      PermissionKey.VIEW_DASHBOARD,
      PermissionKey.VIEW_REPORTS,
      PermissionKey.USE_AI,
    ],
    user,
  });
  const nativeByKey = new Map(
    catalog.map((module) => [module.key, module.nativeCapability])
  );

  assert.equal(nativeByKey.get("dashboard"), "EXECUTIVE_DASHBOARD");
  assert.equal(nativeByKey.get("assurance"), "OPERATIONAL_ASSURANCE");
  assert.equal(nativeByKey.get("reports"), "EXECUTIVE_REPORTING");
  assert.equal(nativeByKey.get("intelligence"), "AI_INTELLIGENCE");
});

test("AI Intelligence is hidden unless dashboard access is also assigned", () => {
  const catalog = getMobileModuleCatalog({
    permissions: [PermissionKey.USE_AI],
    user,
  });

  assert.equal(
    catalog.some((module) => module.key === "intelligence"),
    false
  );
});

test("mobile executive reporting uses a deterministic rolling 12-month window", () => {
  const window = getMobileExecutiveReportingWindow(
    new Date("2026-07-24T15:30:00.000Z")
  );

  assert.equal(window.from.toISOString(), "2025-08-01T00:00:00.000Z");
  assert.equal(window.to.toISOString(), "2026-07-24T23:59:59.999Z");
});

test("mobile executive action contracts reject malformed or oversized AI requests", () => {
  assert.equal(
    mobileExecutiveActionSchema.safeParse({
      action: "GENERATE_AI_ANALYSIS",
      useCase: AiIntelligenceUseCase.EXECUTIVE_RISK,
    }).success,
    true
  );
  assert.equal(
    mobileExecutiveActionSchema.safeParse({
      action: "GENERATE_AI_ANALYSIS",
      useCase: "UNSUPPORTED",
    }).success,
    false
  );
  assert.equal(
    mobileExecutiveActionSchema.safeParse({
      action: "REVIEW_AI_ANALYSIS",
      analysisId: "analysis-1",
      decision: "PENDING_REVIEW",
    }).success,
    false
  );
  assert.equal(
    mobileExecutiveActionSchema.safeParse({
      action: "RECORD_AI_FEEDBACK",
      analysisId: "analysis-1",
      rating: "HELPFUL",
      comment: "x".repeat(1501),
    }).success,
    false
  );
});

test("mobile AI writes fail before persistence when required permissions are absent", async () => {
  await assert.rejects(
    executeMobileExecutiveAction({
      organizationId: "organization-1",
      userId: "user-1",
      permissions: [PermissionKey.VIEW_REPORTS],
      payload: {
        action: "GENERATE_AI_ANALYSIS",
        useCase: AiIntelligenceUseCase.DAILY_BRIEFING,
      },
    }),
    (error) =>
      error instanceof MobileExecutiveActionError &&
      error.status === 403 &&
      error.code === "forbidden"
  );
});

test("cached executive report refreshes do not create duplicate activity entries", async () => {
  const [reportService, mobileService, bootstrapRoute, executiveRoute] =
    await Promise.all([
      readFile(
        new URL(
          "../src/core/analytics/executive-report.service.ts",
          import.meta.url
        ),
        "utf8"
      ),
      readFile(
        new URL(
          "../src/modules/mobile/mobile-executive.service.ts",
          import.meta.url
        ),
        "utf8"
      ),
      readFile(
        new URL("../src/app/api/mobile/bootstrap/route.ts", import.meta.url),
        "utf8"
      ),
      readFile(
        new URL("../src/app/api/mobile/executive/route.ts", import.meta.url),
        "utf8"
      ),
    ]);

  assert.match(reportService, /if \(input\.recordActivity !== false\)/);
  assert.match(mobileService, /recordActivity: false/);
  assert.doesNotMatch(bootstrapRoute, /getMobileExecutiveWorkspace\(/);
  assert.match(executiveRoute, /export async function GET\(/);
});
