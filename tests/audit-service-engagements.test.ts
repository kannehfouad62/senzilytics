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

test("audit planning requires independent conflict review and approval", async () => {
  const [planning, service, schema, migration] = await Promise.all([
    readFile(
      new URL(
        "../src/modules/audit/audit-service-planning.service.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../src/modules/audit/audit-service.service.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../prisma/migrations/20260921120000_audit_service_planning_governance/migration.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  assert.match(
    planning,
    /A declarant cannot review their own independence declaration/,
  );
  assert.match(planning, /The plan submitter cannot approve their own plan/);
  assert.match(planning, /auditPlanningReadiness/);
  assert.match(
    service,
    /Approve the governed audit plan before engagement readiness/,
  );
  assert.match(schema, /model AuditServiceIndependenceDeclaration/);
  assert.match(
    migration,
    /AuditServiceIndependenceDeclaration_engagementId_userId_key/,
  );
});

test("audit service deliverables are versioned, frozen, and independently approved", async () => {
  const [schema, migration, service, actions, page] = await Promise.all([
    readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
    readFile(new URL("../prisma/migrations/20260927120000_audit_service_deliverables/migration.sql", import.meta.url), "utf8"),
    readFile(new URL("../src/modules/audit/audit-service-deliverable.service.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/features/audits/audit-service-deliverable.actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/(platform)/audit-services/engagements/[id]/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(schema, /model AuditServiceDeliverable/);
  assert.match(schema, /contentSnapshot\s+Json/);
  assert.match(migration, /AuditServiceDeliverable_engagementId_reference_version_key/);
  assert.match(service, /The deliverable creator cannot approve their own deliverable/);
  assert.match(service, /Only approved, released, or withdrawn deliverables can be revised/);
  assert.match(service, /frozenAt/);
  assert.match(service, /organizationId: input\.organizationId/);
  assert.match(actions, /PermissionKey\.MANAGE_AUDITS/);
  assert.match(actions, /requireAuditServicesEntitlement/);
  assert.match(page, /Controlled reports and deliverables/);
});

test("audit service coordination governs requests, meetings, and attendance", async () => {
  const [schema, migration, service, actions, page] = await Promise.all([
    readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
    readFile(new URL("../prisma/migrations/20260922120000_audit_service_requests_meetings/migration.sql", import.meta.url), "utf8"),
    readFile(new URL("../src/modules/audit/audit-service-coordination.service.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/features/audits/audit-service-coordination.actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/(platform)/audit-services/engagements/[id]/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(schema, /model AuditServiceInformationRequest/);
  assert.match(schema, /model AuditServiceMeetingAttendee/);
  assert.match(migration, /AuditServiceMeetingAttendee_contactId_fkey/);
  assert.match(service, /Select exactly one internal user or client contact/);
  assert.match(service, /Completed meetings require minutes and outcomes/);
  assert.match(service, /Receipt notes are required/);
  assert.match(actions, /requireAuditServicesEntitlement/);
  assert.match(page, /Entrance, status and exit meetings/);
});

test("external audit access uses expiring hashed credentials without client accounts", async () => {
  const [schema, migration, service, actions, publicPage, engagementPage] =
    await Promise.all([
      readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
      readFile(
        new URL(
          "../prisma/migrations/20260923120000_audit_service_external_access/migration.sql",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../src/modules/audit/audit-external-access.service.ts",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../src/features/audits/audit-external-access.actions.ts",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL("../src/app/audit-client/[token]/page.tsx", import.meta.url),
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
  assert.match(schema, /model AuditServiceExternalAccess/);
  assert.match(migration, /AuditServiceExternalAccess_tokenHash_key/);
  assert.match(service, /randomBytes\(32\)/);
  assert.match(service, /bcrypt\.hash\(passcode, 12\)/);
  assert.match(service, /maxAttempts/);
  assert.match(service, /isAuthorizedRepresentative: true/);
  assert.doesNotMatch(service, /prisma\.user\.create/);
  assert.match(actions, /sameSite: "strict"/);
  assert.match(publicPage, /robots: \{ index: false, follow: false \}/);
  assert.match(engagementPage, /Generate and email secure access/);
});

test("external audit reviews freeze shared resources and accept one governed decision", async () => {
  const [schema, migration, service, actions, publicPage] = await Promise.all([
    readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../prisma/migrations/20260924120000_audit_external_reviews/migration.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/modules/audit/audit-external-access.service.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/features/audits/audit-external-access.actions.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../src/app/audit-client/[token]/page.tsx", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(schema, /model AuditServiceExternalDecision/);
  assert.match(schema, /accessId\s+String\s+@unique/);
  assert.match(schema, /model AuditServiceExternalComment/);
  assert.match(migration, /AuditExternalDecisionType/);
  assert.match(service, /resourceSnapshot/);
  assert.match(service, /frozenAt: now\.toISOString\(\)/);
  assert.match(service, /A denial requires an explanatory comment/);
  assert.match(service, /A final decision has already been recorded/);
  assert.match(actions, /resolveAuditExternalAccess/);
  assert.match(publicPage, /Formal response/);
  assert.match(publicPage, /Comments and feedback/);
});

test("external finding responses remain structured immutable and separate from internal CAPA", async () => {
  const [schema, migration, service, page] = await Promise.all([
    readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
    readFile(new URL("../prisma/migrations/20260925120000_audit_external_finding_responses/migration.sql", import.meta.url), "utf8"),
    readFile(new URL("../src/modules/audit/audit-external-access.service.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/audit-client/[token]/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(schema, /model AuditServiceExternalFindingResponse/);
  assert.match(schema, /accessId\s+String\s+@unique/);
  assert.match(migration, /AUDIT_FINDING/);
  assert.match(service, /A finding response has already been submitted/);
  assert.match(service, /A proposed remediation plan is required/);
  assert.doesNotMatch(service, /correctiveAction\.create/);
  assert.match(page, /Finding response/);
});

test("accepted external remediation enters governed internal CAPA controls", async () => {
  const [schema, migration, service, actions, page] = await Promise.all([
    readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
    readFile(new URL("../prisma/migrations/20260926120000_audit_finding_response_governance/migration.sql", import.meta.url), "utf8"),
    readFile(new URL("../src/modules/audit/audit-external-access.service.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/features/audits/audit-external-access.actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/(platform)/audit-services/engagements/[id]/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(schema, /AuditExternalFindingReviewStatus/);
  assert.match(migration, /CONVERTED_TO_CAPA/);
  assert.match(service, /Accept the client response before CAPA conversion/);
  assert.match(service, /createCapaFromAuditFindingService/);
  assert.match(actions, /PermissionKey\.CREATE_CAPA/);
  assert.match(page, /Convert accepted plan to CAPA/);
});
