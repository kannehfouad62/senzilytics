import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const topbar = readFileSync("src/components/layout/topbar.tsx", "utf8");
const profile = readFileSync("src/app/(platform)/profile/page.tsx", "utf8");
const usersPage = readFileSync("src/app/(platform)/users/page.tsx", "utf8");
const actions = readFileSync("src/features/identity/tenant.actions.ts", "utf8");

test("the authenticated identity links to an immutable profile", () => {
  assert.match(topbar, /href="\/profile"/);
  assert.match(topbar, /Open my profile/);
  assert.match(profile, /This profile is intentionally read-only/);
  assert.doesNotMatch(profile, /<form|action=/);
});

test("self-service access changes are blocked in UI and server actions", () => {
  assert.match(usersPage, /user\.id===currentUser\.id/);
  assert.match(usersPage, /Managed by another owner or super administrator/);
  assert.match(actions, /targetUserId===user\.id/);
  assert.match(actions, /You cannot change your own module access/);
  assert.match(actions, /You cannot suspend your own account/);
});

test("profile explains role-filtered module governance", () => {
  assert.match(profile, /filterUserVisibleModules/);
  assert.match(profile, /tenantAssignableModules/);
  assert.match(profile, /Module visibility never grants authority beyond your governed role permissions/);
});
