import assert from "node:assert/strict";
import test from "node:test";
import { isMobileWorkspaceCacheFresh, mobileOwnerKey, parseStoredMobileContext, shouldDiscardMobileSession } from "../apps/mobile/src/session-lifecycle";

test("mobile cached workspace ownership is reconstructed only from valid secure context", () => {
  const context = parseStoredMobileContext(JSON.stringify({ organizationId: "org-1", userId: "user-1" }));
  assert.deepEqual(context, { organizationId: "org-1", userId: "user-1" });
  assert.equal(context ? mobileOwnerKey(context) : null, "org-1:user-1");
  assert.equal(parseStoredMobileContext("not-json"), null);
  assert.equal(parseStoredMobileContext(JSON.stringify({ organizationId: "org-1", userId: "other:user" })), null);
});

test("temporary network and service errors preserve the rotating mobile session", () => {
  assert.equal(shouldDiscardMobileSession({ status: 500, code: "internal_error" }), false);
  assert.equal(shouldDiscardMobileSession({ status: 429, code: "rate_limit_exceeded" }), false);
  assert.equal(shouldDiscardMobileSession({}), false);
  assert.equal(shouldDiscardMobileSession({ status: 401, code: "invalid_grant" }), true);
  assert.equal(shouldDiscardMobileSession({ status: 403, code: "mobile_not_entitled" }), true);
});

test("encrypted offline workspace access expires after the bounded grace period", () => {
  const now = Date.parse("2026-07-21T12:00:00.000Z");
  assert.equal(isMobileWorkspaceCacheFresh("2026-07-18T12:00:00.000Z", now), true);
  assert.equal(isMobileWorkspaceCacheFresh("2026-07-18T11:59:59.999Z", now), false);
  assert.equal(isMobileWorkspaceCacheFresh("invalid", now), false);
});
