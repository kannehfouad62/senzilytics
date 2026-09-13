import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { AuditServiceEngagementStatus } from "@prisma/client";
import {
  assertAuditServiceEngagementTransition,
  auditServiceEngagementTransitions,
} from "../src/modules/audit/audit-service-engagement-lifecycle";

test("audit service engagements follow controlled forward transitions", () => {
  assert.deepEqual(
    auditServiceEngagementTransitions(AuditServiceEngagementStatus.DRAFT),
    [
      AuditServiceEngagementStatus.PLANNING,
      AuditServiceEngagementStatus.CANCELLED,
    ],
  );
  assert.doesNotThrow(() =>
    assertAuditServiceEngagementTransition(
      AuditServiceEngagementStatus.UNDER_REVIEW,
      AuditServiceEngagementStatus.COMPLETED,
    ),
  );
  assert.throws(() =>
    assertAuditServiceEngagementTransition(
      AuditServiceEngagementStatus.DRAFT,
      AuditServiceEngagementStatus.COMPLETED,
    ),
  );
  assert.deepEqual(
    auditServiceEngagementTransitions(AuditServiceEngagementStatus.COMPLETED),
    [],
  );
});

test("audit service delivery is tenant-scoped, entitled, and excludes financial data", async () => {
  const [schema, service, actions, page, migration, navigation] =
    await Promise.all([
      readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
      readFile(
        new URL(
          "../src/modules/audit/audit-service.service.ts",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../src/features/audits/audit-service.actions.ts",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../src/app/(platform)/audit-services/page.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../prisma/migrations/20260920120000_audit_service_clients_engagements/migration.sql",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL("../src/components/layout/sidebar.tsx", import.meta.url),
        "utf8",
      ),
    ]);

  assert.match(schema, /model AuditServiceClient/);
  assert.match(schema, /model AuditServiceClientContact/);
  assert.match(schema, /model AuditServiceEngagement/);
  assert.match(schema, /engagement\s+AuditServiceEngagement\?/);
  assert.doesNotMatch(
    schema,
    /AuditService(?:Client|Engagement)[\s\S]{0,3000}(?:invoice|payment|amount|currency|fee)/i,
  );
  assert.match(service, /organizationId: input\.organizationId/);
  assert.match(service, /External engagements require an audit client/);
  assert.match(
    service,
    /Internal engagements cannot be assigned to an external client/,
  );
  assert.match(service, /logActivity\(/);
  assert.match(actions, /requireAuditServicesEntitlement/);
  assert.match(actions, /PermissionKey\.MANAGE_AUDITS/);
  assert.match(page, /never receive tenant accounts/);
  assert.match(migration, /EnterpriseAudit_engagementId_fkey/);
  assert.match(navigation, /href: "\/audit-services"/);
});

test("audit client and engagement operations preserve tenant ownership and existing audit lineage", async () => {
  const [service, actions, clientPage, engagementPage] = await Promise.all([
    readFile(
      new URL("../src/modules/audit/audit-service.service.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/features/audits/audit-service.actions.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/(platform)/audit-services/clients/[id]/page.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/(platform)/audit-services/engagements/[id]/page.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  assert.match(
    service,
    /Complete or cancel all open client engagements before archival/,
  );
  assert.match(service, /This audit is already linked to another engagement/);
  assert.match(service, /organizationId: input\.organizationId/);
  assert.match(actions, /linkAuditServiceEngagementAudit/);
  assert.match(actions, /requireAuditServicesEntitlement/);
  assert.match(clientPage, /findAuditServiceClient\(organizationId, id\)/);
  assert.match(engagementPage, /engagementId: null/);
  assert.match(engagementPage, /href=\{`\/audits\/\$\{audit\.id\}`\}/);
});
