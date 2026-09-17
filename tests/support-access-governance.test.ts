import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SupportAccessStatus } from "@prisma/client";
import { supportAccessTransitionAllowed } from "../src/modules/platform/support-access.service";

const actions = readFileSync("src/features/platform/support-access.actions.ts", "utf8");
const tenant = readFileSync("src/lib/tenant.ts", "utf8");
const permissions = readFileSync("src/core/permissions/permissions.service.ts", "utf8");
const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync("prisma/migrations/20261003120000_governed_support_access/migration.sql", "utf8");

test("support access follows tenant-controlled terminal transitions", () => {
  assert.equal(supportAccessTransitionAllowed(SupportAccessStatus.REQUESTED, SupportAccessStatus.APPROVED), true);
  assert.equal(supportAccessTransitionAllowed(SupportAccessStatus.APPROVED, SupportAccessStatus.ACTIVE), true);
  assert.equal(supportAccessTransitionAllowed(SupportAccessStatus.ACTIVE, SupportAccessStatus.COMPLETED), true);
  assert.equal(supportAccessTransitionAllowed(SupportAccessStatus.DENIED, SupportAccessStatus.ACTIVE), false);
  assert.equal(supportAccessTransitionAllowed(SupportAccessStatus.COMPLETED, SupportAccessStatus.ACTIVE), false);
});

test("support sessions are opaque time limited and preserve the real administrator identity", () => {
  assert.match(actions, /httpOnly: true/);
  assert.match(actions, /sameSite: "strict"/);
  assert.match(actions, /requestedById: admin\.id/);
  assert.match(actions, /Read-only support session entered/);
  assert.match(tenant, /getActiveSupportAccess\(user\.id\)/);
  assert.doesNotMatch(actions, /password/i);
});

test("support mode grants only view permissions and tenant owners control approval", () => {
  assert.match(permissions, /supportReadPermissions/);
  assert.doesNotMatch(permissions.match(/const supportReadPermissions = \[[\s\S]*?\] as const/)?.[0] ?? "", /MANAGE_|CREATE_|UPDATE_|DELETE_|CLOSE_|APPROVE_/);
  assert.match(actions, /Only the tenant owner can approve support access/);
  assert.match(actions, /A platform administrator cannot approve their own support access/);
});

test("support grants are tenant scoped relational audit records", () => {
  assert.match(schema, /model SupportAccessGrant/);
  assert.match(migration, /SupportAccessGrant_organizationId_fkey/);
  assert.match(actions, /organizationId, userId: admin\.id/);
  assert.match(actions, /ActivityAction\.STATUS_CHANGE/);
});
