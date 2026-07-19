import assert from "node:assert/strict";
import test from "node:test";
import { isApprovedPlatformAdministrator } from "../src/lib/platform-admin";

const administrator = {
  email: "admin@senzilytics.com",
  role: "SUPER_ADMIN",
  isActive: true,
  isPlatformAdmin: true,
};

test("allows an approved Senzilytics platform administrator", () => {
  assert.equal(isApprovedPlatformAdministrator(administrator), true);
});

test("rejects tenant super administrators and other email domains", () => {
  assert.equal(isApprovedPlatformAdministrator({ ...administrator, isPlatformAdmin: false }), false);
  assert.equal(isApprovedPlatformAdministrator({ ...administrator, email: "admin@customer.com" }), false);
  assert.equal(isApprovedPlatformAdministrator({ ...administrator, role: "ORG_ADMIN" }), false);
});
