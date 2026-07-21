import assert from "node:assert/strict";
import test from "node:test";
import { IntegrationDeliveryStatus } from "@prisma/client";
import { nextWebhookAttempt } from "../src/modules/integrations/integration-lifecycle";
import { decryptWebhookSecret, encryptWebhookSecret, generateApiCredential, isPublicAddress, parseApiCredential, secureTokenMatch, signWebhookPayload, validateWebhookUrl, verifyWebhookSignature } from "../src/modules/integrations/integration-security";

test("API credentials are parseable, hash-only verifiable, and reject tampering", () => {
  const generated = generateApiCredential();
  assert.equal(parseApiCredential(generated.token)?.prefix, generated.prefix);
  assert.equal(secureTokenMatch(generated.token, generated.hash), true);
  assert.equal(secureTokenMatch(`${generated.token}x`, generated.hash), false);
  assert.equal(parseApiCredential("not-a-token"), null);
});

test("webhook secrets use authenticated encryption and HMAC signatures", () => {
  const key = Buffer.alloc(32, 7).toString("base64");
  const encrypted = encryptWebhookSecret("whsec_example", key);
  assert.equal(decryptWebhookSecret(encrypted, key), "whsec_example");
  const signature = signWebhookPayload("whsec_example", "1721550000", '{"ok":true}');
  assert.equal(verifyWebhookSignature("whsec_example", "1721550000", '{"ok":true}', signature), true);
  assert.equal(verifyWebhookSignature("whsec_example", "1721550000", '{"ok":false}', signature), false);
});

test("private, loopback, link-local, and reserved webhook addresses are rejected", async () => {
  for (const address of ["127.0.0.1", "10.0.0.2", "172.16.1.2", "192.168.1.2", "169.254.1.1", "198.51.100.1", "203.0.113.1", "::1", "fd00::1", "::ffff:127.0.0.1", "2002:7f00:1::"]) assert.equal(isPublicAddress(address), false);
  assert.equal(isPublicAddress("8.8.8.8"), true);
  await assert.rejects(() => validateWebhookUrl("http://example.com/hook", async () => [{ address: "8.8.8.8", family: 4 }]), /HTTPS/);
  await assert.rejects(() => validateWebhookUrl("https://example.com/hook", async () => [{ address: "10.0.0.1", family: 4 }]), /private or reserved/);
  assert.equal(await validateWebhookUrl("https://example.com/hook", async () => [{ address: "8.8.8.8", family: 4 }]), "https://example.com/hook");
});

test("webhook failures follow the governed retry and abandonment lifecycle", () => {
  const now = new Date("2026-07-21T00:00:00.000Z");
  const retry = nextWebhookAttempt(1, 6, now);
  assert.equal(retry.status, IntegrationDeliveryStatus.FAILED);
  assert.equal(retry.nextAttemptAt.toISOString(), "2026-07-21T00:01:00.000Z");
  assert.equal(nextWebhookAttempt(6, 7, now).nextAttemptAt.toISOString(), "2026-07-22T00:00:00.000Z");
  assert.equal(nextWebhookAttempt(7, 7, now).status, IntegrationDeliveryStatus.ABANDONED);
});
