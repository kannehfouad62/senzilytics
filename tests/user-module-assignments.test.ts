import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PermissionKey } from "@prisma/client";
import { filterUserModulePermissions, filterUserVisibleModules } from "../src/core/navigation/tenant-module-catalog";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync("prisma/migrations/20261002120000_user_module_assignments/migration.sql", "utf8");
const actions = readFileSync("src/features/identity/tenant.actions.ts", "utf8");
const usersPage = readFileSync("src/app/(platform)/users/page.tsx", "utf8");
const permissions = readFileSync("src/core/permissions/permissions.service.ts", "utf8");

test("user module assignments filter navigation without granting role permissions", () => {
  const items = [{ href: "/research" }, { href: "/audits" }, { href: "/dashboard" }];
  assert.deepEqual(filterUserVisibleModules([{ moduleKey: "RESEARCH", enabled: true }, { moduleKey: "AUDITS", enabled: false }], items), [items[0], items[2]]);
  assert.deepEqual(filterUserVisibleModules([], items), items);
});

test("module-specific permissions are denied while core tenant administration remains governed separately", () => {
  const granted = [PermissionKey.VIEW_RESEARCH, PermissionKey.VIEW_AUDITS, PermissionKey.VIEW_DASHBOARD, PermissionKey.MANAGE_USERS];
  assert.deepEqual(filterUserModulePermissions(granted, [{ moduleKey: "RESEARCH", enabled: true }, { moduleKey: "AUDITS", enabled: false }]), [PermissionKey.VIEW_RESEARCH, PermissionKey.VIEW_DASHBOARD, PermissionKey.MANAGE_USERS]);
});

test("user module persistence is tenant scoped and invitation aware", () => {
  assert.match(schema, /model UserModuleAssignment/);
  assert.match(schema, /moduleKeys\s+String\[\]/);
  assert.match(migration, /UserModuleAssignment_organizationId_fkey/);
  assert.match(actions, /organizationId,userId:target\.id/);
  assert.match(actions, /invitation\.moduleKeys/);
});

test("only tenant owners manage user modules and changes are audited", () => {
  assert.match(actions, /requireTenantOwner\(user\.role\)/);
  assert.match(actions, /User module access updated/);
  assert.match(usersPage, /Save module access/);
  assert.match(permissions, /filterUserModulePermissions/);
});


test("phase 8 web tenant identity changes preserve administrator continuity and audit evidence", () => {
  assert.match(actions, /assertAnotherActiveAdministrator/);
  assert.match(actions, /At least one other active organization administrator is required/);
  assert.match(actions, /title:\"Tenant user invited\"/);
  assert.match(actions, /title:active\?\"Tenant user restored\":\"Tenant user suspended\"/);
  assert.match(actions, /ActivityAction\.STATUS_CHANGE/);
  assert.match(actions, /if\(id===user\.id\)throw new Error\(\"You cannot suspend your own account\.\"\)/);
});
