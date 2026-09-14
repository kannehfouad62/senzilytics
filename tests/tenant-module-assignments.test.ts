import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { IndustryCategory } from "@prisma/client";
import {
  filterTenantVisibleModules,
  hasAuditServicesEntitlement,
  isTenantModuleVisible,
} from "../src/core/navigation/tenant-module-catalog";

test("audit services defaults to audit-service tenants and supports manual overrides", () => {
  assert.equal(
    hasAuditServicesEntitlement(
      IndustryCategory.AUDIT_AND_ASSURANCE_SERVICES,
      [],
    ),
    true,
  );
  assert.equal(
    hasAuditServicesEntitlement(IndustryCategory.GENERAL, []),
    false,
  );
  assert.equal(
    hasAuditServicesEntitlement(IndustryCategory.GENERAL, [
      { moduleKey: "AUDIT_SERVICES", enabled: true },
    ]),
    true,
  );
  assert.equal(
    hasAuditServicesEntitlement(
      IndustryCategory.AUDIT_AND_ASSURANCE_SERVICES,
      [{ moduleKey: "AUDIT_SERVICES", enabled: false }],
    ),
    false,
  );
});

test("approved platform administrators can operate the audit service workspace", async () => {
  const source = await readFile(
    new URL(
      "../src/modules/audit/audit-services-entitlement.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(source, /getPlatformAdministrator/);
  assert.match(source, /!platformAdministrator && !entitled/);
});

test("manual module assignments override industry navigation defaults", () => {
  const items = [
    { href: "/audits" },
    { href: "/research" },
    { href: "/dashboard" },
  ];
  const visible = filterTenantVisibleModules(
    IndustryCategory.RESEARCH_AND_ANALYTICS,
    [
      { moduleKey: "AUDITS", enabled: true },
      { moduleKey: "RESEARCH", enabled: false },
    ],
    items,
  );

  assert.deepEqual(
    visible.map(item => item.href),
    ["/audits", "/dashboard"],
  );
  assert.equal(
    isTenantModuleVisible(
      IndustryCategory.GENERAL,
      [{ moduleKey: "ASSETS", enabled: true }],
      "/assets/maintenance",
    ),
    true,
  );
});

test("tenant module administration is platform-governed, audited, and tenant-scoped", async () => {
  const [actions, schema, migration, sidebar, topbar, guard] =
    await Promise.all([
      readFile(
        new URL("../src/features/identity/tenant.actions.ts", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
      readFile(
        new URL(
          "../prisma/migrations/20260919120000_tenant_module_assignments/migration.sql",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL("../src/components/layout/sidebar.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../src/components/layout/topbar.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL(
          "../src/modules/audit/audit-services-entitlement.ts",
          import.meta.url,
        ),
        "utf8",
      ),
    ]);

  assert.match(actions, /setTenantModuleAssignment/);
  assert.match(actions, /requirePlatformAdministrator\(\)/);
  assert.match(actions, /organizationId_moduleKey/);
  assert.match(actions, /logActivity\(/);
  assert.match(schema, /model TenantModuleAssignment/);
  assert.match(migration, /TenantModuleAssignment_organizationId_fkey/);
  assert.match(sidebar, /filterTenantVisibleModules/);
  assert.match(topbar, /moduleAssignments/);
  assert.match(guard, /organizationHasAuditServices/);
});
