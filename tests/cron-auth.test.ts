import assert from "node:assert/strict";
import test from "node:test";
import { isAuthorizedCronRequest } from "../src/lib/cron-auth";

test("authorizes the configured bearer token", () => {
  assert.equal(isAuthorizedCronRequest("Bearer expected", "expected"), true);
});

test("rejects a missing or malformed authorization header", () => {
  assert.equal(isAuthorizedCronRequest(null, "expected"), false);
  assert.equal(isAuthorizedCronRequest("expected", "expected"), false);
  assert.equal(isAuthorizedCronRequest("Bearer wrong", "expected"), false);
});

test("fails closed when the cron secret is unavailable", () => {
  assert.equal(isAuthorizedCronRequest("Bearer expected", undefined), false);
  assert.equal(isAuthorizedCronRequest("Bearer expected", "   "), false);
});
