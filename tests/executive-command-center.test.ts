import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PermissionKey } from "@prisma/client";
import {
  buildExecutiveDashboardCsv,
  parseExecutiveDashboardFilters,
  type ExecutiveCommandCenterData,
} from "../src/core/analytics/executive-command-center.service";
import { canViewExecutiveModule } from "../src/core/analytics/global-executive-dashboard.service";

test("executive dashboard filters accept governed ranges and reject unsafe IDs", () => {
  const now = new Date("2026-07-25T12:00:00.000Z");
  const filters = parseExecutiveDashboardFilters(
    {
      days: "180",
      siteId: "site_main-1",
      departmentId: "../../other-tenant",
    },
    now,
  );

  assert.equal(filters.days, 180);
  assert.equal(filters.siteId, "site_main-1");
  assert.equal(filters.departmentId, null);
  assert.equal(filters.to.toISOString(), now.toISOString());
  assert.equal(filters.from.toISOString(), "2026-01-26T12:00:00.000Z");
});

test("executive portfolio module visibility follows module permissions", () => {
  assert.equal(
    canViewExecutiveModule("Audits", [PermissionKey.VIEW_AUDITS]),
    true,
  );
  assert.equal(
    canViewExecutiveModule("Audits", [PermissionKey.VIEW_INCIDENT]),
    false,
  );
  assert.equal(
    canViewExecutiveModule("CAPA", [PermissionKey.VIEW_REPORTS]),
    true,
  );
  assert.equal(canViewExecutiveModule("Unknown module", Object.values(PermissionKey)), false);
});

test("executive dashboard CSV quotes values and neutralizes spreadsheet formulas", () => {
  const data = {
    generatedAt: new Date("2026-07-25T12:00:00.000Z"),
    scope: { label: "=Unsafe" },
    filters: {
      from: new Date("2026-06-25T12:00:00.000Z"),
      to: new Date("2026-07-25T12:00:00.000Z"),
    },
    headline: [{ label: "+KPI", value: 2, note: "@note" }],
    portfolio: {
      modules: [{ label: "Audits", value: 1, note: "open", tone: "warning" }],
    },
    priorities: [],
    freshness: [],
  } as unknown as ExecutiveCommandCenterData;
  const csv = buildExecutiveDashboardCsv(data);

  assert.match(csv, /"'=Unsafe"/);
  assert.match(csv, /"'\+KPI"/);
  assert.match(csv, /"'@note"/);
});

test("executive dashboard route and export enforce dashboard permission", async () => {
  const [page, route, service] = await Promise.all([
    readFile(
      new URL("../src/app/(platform)/dashboard/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/app/api/dashboard/export/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/core/analytics/executive-command-center.service.ts",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(
    page,
    /requirePermission\(PermissionKey\.VIEW_DASHBOARD\)/,
  );
  assert.match(
    route,
    /requirePermission\(PermissionKey\.VIEW_DASHBOARD\)/,
  );
  assert.match(route, /Cache-Control": "private, no-store"/);
  assert.match(service, /organizationId: input\.organizationId/);
  assert.match(service, /departmentId: scope\.departmentId/);
});
