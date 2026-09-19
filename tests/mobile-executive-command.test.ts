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
  MOBILE_EXECUTIVE_LIMITS,
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


test("phase 7 executive command drills through governed analytics using the existing native router", async () => {
  const [screen, app] = await Promise.all([
    readFile(new URL("../apps/mobile/src/executive-command.tsx", import.meta.url), "utf8"),
    readFile(new URL("../apps/mobile/App.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(screen, /resolveNativeRecordTarget/);
  assert.match(screen, /openExecutiveHref\(module\.href/);
  assert.match(screen, /openExecutiveHref\(signal\.href/);
  assert.match(screen, /openExecutiveHref\(connection\.href/);
  assert.match(screen, /openExecutiveHref\(item\.link/);
  assert.match(screen, /`\/incidents\/\$\{incident\.id\}`/);
  assert.match(screen, /`\/actions\/\$\{action\.id\}`/);
  assert.match(app, /onOpenNativeTarget=\{openNativeTarget\}/);
  assert.doesNotMatch(screen, /WebView/);
});

test("phase 7 executive portfolio register links do not masquerade as record identities", async () => {
  const routing = await readFile(
    new URL("../apps/mobile/src/native-routing.ts", import.meta.url),
    "utf8"
  );
  assert.match(routing, /REGISTER_SEGMENTS/);
  for (const segment of ["dashboard", "report", "analytics", "governance", "operations"]) {
    assert.match(routing, new RegExp(`"${segment}"`));
  }
  assert.match(routing, /case "capa": return \{ tab: "actions", view: "capa" \}/);
  assert.match(routing, /case "research": return \{ tab: "research"/);
});


test("phase 7 decision snapshot reuses governed portfolio domains including research", async () => {
  const [screen, portfolio] = await Promise.all([
    readFile(new URL("../apps/mobile/src/executive-command.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/core/analytics/global-executive-dashboard.service.ts", import.meta.url), "utf8"),
  ]);
  assert.match(screen, /title="Decision snapshot"/);
  for (const label of ["CAPA", "Risk", "Audits", "Audit Findings", "Inspections", "Compliance", "Research"]) {
    assert.match(screen, new RegExp(`"${label}"`));
  }
  assert.match(portfolio, /Research: \[PermissionKey\.VIEW_RESEARCH\]/);
  assert.match(portfolio, /label: "Research"/);
  assert.match(portfolio, /href: "\/research"/);
});


test("phase 7 mobile executive payload uses one explicit bounded analytics contract", async () => {
  assert.deepEqual(MOBILE_EXECUTIVE_LIMITS, {
    trendMonths: 12,
    recentIncidents: 5,
    overdueActions: 5,
    assuranceSignals: 30,
    sitePerformance: 15,
    managementAttention: 30,
    aiAnalyses: 20,
  });

  const service = await readFile(
    new URL("../src/modules/mobile/mobile-executive.service.ts", import.meta.url),
    "utf8"
  );
  assert.match(service, /limit: MOBILE_EXECUTIVE_LIMITS\.assuranceSignals/);
  assert.match(service, /MOBILE_EXECUTIVE_LIMITS\.aiAnalyses/);
  assert.match(service, /MOBILE_EXECUTIVE_LIMITS\.sitePerformance/);
  assert.match(service, /MOBILE_EXECUTIVE_LIMITS\.managementAttention/);
});

test("phase 7 executive trends stay on the rolling twelve-month mobile window and outside bootstrap", async () => {
  const [service, bootstrap, route] = await Promise.all([
    readFile(new URL("../src/modules/mobile/mobile-executive.service.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/mobile/bootstrap/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/mobile/executive/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(service, /monthlyTrend: dashboard\.charts\.monthlyTrend\.slice/);
  assert.match(service, /monthlyTrend: report\.monthlyTrend\.slice/);
  assert.match(service, /MOBILE_EXECUTIVE_LIMITS\.trendMonths/);
  assert.doesNotMatch(bootstrap, /getMobileExecutiveWorkspace\(/);
  assert.match(route, /headers: \{ "cache-control": "no-store" \}/);
});
