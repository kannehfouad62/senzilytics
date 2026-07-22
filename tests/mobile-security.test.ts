import assert from "node:assert/strict";
import test from "node:test";
import { MobilePlatform, MobilePushDeliveryStatus, UserRole } from "@prisma/client";
import { safeLoginRedirect } from "../src/lib/login-redirect";
import { mobilePushIdentityMatches, nextMobilePushAttempt } from "../src/modules/mobile/mobile-push-lifecycle";
import {
  createMobileOpaqueToken,
  hashMobileToken,
  isMobilePlatform,
  isMobileRedirectUri,
  isValidDeviceId,
  isValidMobileState,
  isValidPkceChallenge,
  pkceChallenge,
  secureHashMatch,
  signMobileAccessToken,
  verifyMobileAccessToken,
} from "../src/modules/mobile/mobile-token";

const secret = "mobile-test-secret-that-is-at-least-thirty-two-characters";

test("mobile access tokens are signed, scoped, expiring, and tamper evident", () => {
  const issued = signMobileAccessToken({
    sub: "user-1",
    organizationId: "org-1",
    sessionId: "session-1",
    role: UserRole.ORG_ADMIN,
    sessionVersion: 4,
  }, secret);
  const payload = verifyMobileAccessToken(issued.token, secret);
  assert.equal(payload?.sub, "user-1");
  assert.equal(payload?.organizationId, "org-1");
  assert.equal(payload?.sessionVersion, 4);
  assert.equal(verifyMobileAccessToken(`${issued.token.slice(0, -1)}x`, secret), null);
  assert.equal(verifyMobileAccessToken(issued.token, secret, (payload?.exp ?? 0) + 1), null);
});

test("mobile authorization inputs and PKCE challenges are narrowly validated", () => {
  const verifier = "A".repeat(64);
  const challenge = pkceChallenge(verifier);
  assert.equal(isValidPkceChallenge(challenge), true);
  assert.equal(isValidMobileState("mobile-state-value-123456"), true);
  assert.equal(isValidDeviceId("ios:device-1234"), true);
  assert.equal(isMobileRedirectUri("senzilytics://auth"), true);
  assert.equal(isMobileRedirectUri("https://attacker.example/auth"), false);
  assert.equal(isMobilePlatform(MobilePlatform.IOS), true);
  assert.equal(isMobilePlatform("WEB"), false);
});

test("opaque mobile credentials are hash-only verifiable", () => {
  const refresh = createMobileOpaqueToken("smr");
  const hash = hashMobileToken(refresh);
  assert.equal(refresh.startsWith("smr_"), true);
  assert.equal(secureHashMatch(refresh, hash), true);
  assert.equal(secureHashMatch(`${refresh}x`, hash), false);
});

test("login callback URLs only admit mobile authorization challenges", () => {
  assert.equal(safeLoginRedirect("/mobile/authorize?challenge=smc_validValue123"), "/mobile/authorize?challenge=smc_validValue123");
  for (const unsafe of ["https://attacker.example", "//attacker.example", "/dashboard", "/mobile/authorize?challenge=other", "/mobile\\authorize?challenge=smc_value"]) {
    assert.equal(safeLoginRedirect(unsafe), "/dashboard");
  }
});

test("mobile push failures retry with backoff and eventually abandon", () => {
  const now = new Date("2026-07-21T00:00:00.000Z");
  assert.equal(nextMobilePushAttempt(1, 6, now).nextAttemptAt.toISOString(), "2026-07-21T00:01:00.000Z");
  assert.equal(nextMobilePushAttempt(5, 6, now).nextAttemptAt.toISOString(), "2026-07-21T12:00:00.000Z");
  assert.equal(nextMobilePushAttempt(6, 6, now).status, MobilePushDeliveryStatus.ABANDONED);
});

test("mobile push delivery ownership cannot cross users or tenants", () => {
  const delivery = { organizationId: "org-1", userId: "user-1" };
  assert.equal(mobilePushIdentityMatches(delivery, { organizationId: "org-1", userId: "user-1" }), true);
  assert.equal(mobilePushIdentityMatches(delivery, { organizationId: "org-2", userId: "user-1" }), false);
  assert.equal(mobilePushIdentityMatches(delivery, { organizationId: "org-1", userId: "user-2" }), false);
});
