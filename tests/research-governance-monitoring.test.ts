import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { classifyResearchGovernanceReminder, researchGovernanceCsv } from "../src/modules/research/research-governance-monitor";

test("research governance reminders use deterministic escalation windows", () => {
  const now = new Date("2026-09-13T00:00:00.000Z");
  assert.equal(classifyResearchGovernanceReminder(new Date("2026-10-01T00:00:00.000Z"), now), "DUE_30_DAYS");
  assert.equal(classifyResearchGovernanceReminder(new Date("2026-09-20T00:00:00.000Z"), now), "DUE_7_DAYS");
  assert.equal(classifyResearchGovernanceReminder(new Date("2026-09-12T00:00:00.000Z"), now), "OVERDUE");
});

test("consent evidence CSV quotes values and neutralizes spreadsheet formulas", () => {
  const csv = researchGovernanceCsv([["Statement", "Participant"], ["=HYPERLINK(\"bad\")", "Doe, Jane"]]);
  assert.match(csv, /"'=HYPERLINK\(""bad""\)"/);
  assert.match(csv, /"Doe, Jane"/);
});

test("governance reminders are durable, tenant scoped, and deduplicated", async () => {
  const [schema, migration, service, cron] = await Promise.all([
    readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
    readFile(new URL("../prisma/migrations/20260918120000_research_governance_monitoring/migration.sql", import.meta.url), "utf8"),
    readFile(new URL("../src/modules/research/research-governance-monitor.service.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/cron/workflow-sla/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(schema, /model ResearchGovernanceReminder/);
  assert.match(schema, /@@unique\(\[organizationId, recipientId, targetType, targetId, reminderKind, dueAt\]\)/);
  assert.match(migration, /FOREIGN KEY \("organizationId"\)/);
  assert.match(service, /organizationId: candidate\.organizationId/);
  assert.match(service, /P2002/);
  assert.match(service, /pendingCandidates\.slice\(0, 25\)/);
  assert.match(service, /sendTenantNotificationEmail/);
  assert.match(service, /createNotification/);
  assert.match(service, /ActivityAction\.SYSTEM/);
  assert.match(cron, /processResearchGovernanceMonitoring\(\)/);
});

test("consent export and governance dashboard reauthorize tenant access", async () => {
  const [route, page] = await Promise.all([
    readFile(new URL("../src/app/api/research/consent-evidence/export/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/(platform)/research/governance/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(route, /PermissionKey\.MANAGE_RESEARCH_DATASETS/);
  assert.match(route, /getCurrentUserTenant/);
  assert.match(route, /private, no-store/);
  assert.match(page, /getResearchGovernanceReport\(organizationId\)/);
});
