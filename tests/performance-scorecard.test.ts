import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  buildPerformanceCsv,
  calculatePerformanceAttainment,
  evaluatePerformance,
  parsePerformanceFilters,
  performanceScopeKey,
} from "../src/modules/performance/performance-scorecard.service";
import { PerformanceIndicatorDirection } from "@prisma/client";

test("performance filters accept governed ranges and reject unsafe identifiers", () => {
  const now = new Date("2026-07-25T12:00:00.000Z");
  const filters = parsePerformanceFilters(
    {
      days: "180",
      siteId: "site_main-1",
      departmentId: "../../other-tenant",
      indicatorId: "indicator_1",
    },
    now,
  );

  assert.equal(filters.days, 180);
  assert.equal(filters.siteId, "site_main-1");
  assert.equal(filters.departmentId, null);
  assert.equal(filters.indicatorId, "indicator_1");
  assert.equal(filters.to.toISOString(), now.toISOString());
});

test("performance scope keys make nullable scopes deterministic", () => {
  assert.equal(performanceScopeKey({}), "ORGANIZATION");
  assert.equal(performanceScopeKey({ siteId: "site-1" }), "SITE:site-1");
  assert.equal(
    performanceScopeKey({ siteId: "site-1", departmentId: "dept-1" }),
    "DEPARTMENT:dept-1",
  );
});

test("higher-is-better control bands classify each threshold", () => {
  const classify = (value: number) =>
    evaluatePerformance({
      value,
      direction: PerformanceIndicatorDirection.HIGHER_IS_BETTER,
      targetValue: 95,
      warningThreshold: 90,
      criticalThreshold: 80,
    });

  assert.equal(classify(96), "ON_TARGET");
  assert.equal(classify(92), "WATCH");
  assert.equal(classify(85), "OFF_TARGET");
  assert.equal(classify(79), "CRITICAL");
});

test("lower-is-better control bands classify each threshold", () => {
  const classify = (value: number) =>
    evaluatePerformance({
      value,
      direction: PerformanceIndicatorDirection.LOWER_IS_BETTER,
      targetValue: 2,
      warningThreshold: 4,
      criticalThreshold: 7,
    });

  assert.equal(classify(1), "ON_TARGET");
  assert.equal(classify(3), "WATCH");
  assert.equal(classify(6), "OFF_TARGET");
  assert.equal(classify(8), "CRITICAL");
});

test("attainment normalizes opposing indicator directions", () => {
  assert.equal(
    calculatePerformanceAttainment({
      value: 90,
      targetValue: 100,
      direction: PerformanceIndicatorDirection.HIGHER_IS_BETTER,
    }),
    90,
  );
  assert.equal(
    calculatePerformanceAttainment({
      value: 5,
      targetValue: 4,
      direction: PerformanceIndicatorDirection.LOWER_IS_BETTER,
    }),
    80,
  );
  assert.equal(
    calculatePerformanceAttainment({
      value: 3,
      targetValue: 4,
      direction: PerformanceIndicatorDirection.LOWER_IS_BETTER,
    }),
    100,
  );
});

test("performance CSV neutralizes spreadsheet formulas", () => {
  const csv = buildPerformanceCsv({
    scopeLabel: "=HYPERLINK(\"unsafe\")",
    from: new Date("2026-07-01T00:00:00.000Z"),
    to: new Date("2026-07-31T00:00:00.000Z"),
    rows: [
      {
        code: "+CMD",
        name: "Test",
        category: "Governance",
        type: "LEADING",
        source: "MANUAL",
        value: 10,
        unit: "%",
        targetValue: 12,
        rating: "WATCH",
        attainment: 83.3,
        provenance: "@external",
      },
    ],
  });

  assert.match(csv, /"'=HYPERLINK/);
  assert.match(csv, /"'\+CMD"/);
  assert.match(csv, /"'@external"/);
});

test("performance scorecards enforce tenant scope and independent permissions", async () => {
  const [service, actions, page, route, sidebar] = await Promise.all([
    readFile(
      new URL(
        "../src/modules/performance/performance-scorecard.service.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../src/features/performance/actions.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/app/(platform)/performance/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/app/api/performance/export/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/components/layout/sidebar.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(service, /organizationId: input\.organizationId/);
  assert.match(
    actions,
    /requirePermission\(PermissionKey\.MANAGE_PERFORMANCE_SCORECARDS\)/,
  );
  assert.match(
    page,
    /requirePermission\(PermissionKey\.VIEW_PERFORMANCE_SCORECARDS\)/,
  );
  assert.match(
    route,
    /requirePermission\(PermissionKey\.VIEW_PERFORMANCE_SCORECARDS\)/,
  );
  assert.match(route, /Cache-Control": "private, no-store"/);
  assert.match(sidebar, /href: "\/performance"/);
});
