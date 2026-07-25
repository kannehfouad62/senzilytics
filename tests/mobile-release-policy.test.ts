import assert from "node:assert/strict";
import test from "node:test";
import {
  compareMobileVersions,
  parseMobileVersion,
  readMobileReleasePolicy,
  safeStoreUrl,
} from "../src/modules/mobile/mobile-release-policy";

function request(headers: Record<string, string>) {
  return new Request("https://www.senzilytics.cloud/api/mobile/release", {
    headers,
  });
}

test("mobile semantic versions are strict and compare predictably", () => {
  assert.deepEqual(parseMobileVersion("2.10.3"), [2, 10, 3]);
  assert.equal(parseMobileVersion("2.10"), null);
  assert.equal(parseMobileVersion("v2.10.3"), null);
  assert.equal(compareMobileVersions("1.9.9", "2.0.0"), -1);
  assert.equal(compareMobileVersions("2.0.0", "2.0.0"), 0);
  assert.equal(compareMobileVersions("2.0.1", "2.0.0"), 1);
});

test("mandatory mobile upgrades require explicit enforcement and a trusted store URL", () => {
  const base = {
    MOBILE_ENFORCE_MINIMUM_VERSION: "true",
    MOBILE_MINIMUM_IOS_VERSION: "2.0.0",
    MOBILE_RECOMMENDED_IOS_VERSION: "2.1.0",
  };
  const headers = {
    "x-senzilytics-mobile-platform": "ios",
    "x-senzilytics-mobile-version": "1.0.0",
    "x-senzilytics-mobile-api-version": "1",
  };

  const unready = readMobileReleasePolicy(request(headers), base);
  assert.equal(unready.enforcementEnabled, false);
  assert.equal(unready.updateRequired, false);

  const ready = readMobileReleasePolicy(request(headers), {
    ...base,
    MOBILE_MINIMUM_ANDROID_VERSION: "2.0.0",
    MOBILE_IOS_STORE_URL: "https://apps.apple.com/us/app/senzilytics/id123",
    MOBILE_ANDROID_STORE_URL:
      "https://play.google.com/store/apps/details?id=com.senzilytics.mobile",
  });
  assert.equal(ready.enforcementEnabled, true);
  assert.equal(ready.updateRequired, true);
  assert.equal(ready.meetsMinimum, false);
});

test("enforcement identifies clients that omit release metadata once both stores are ready", () => {
  const policy = readMobileReleasePolicy(request({}), {
    MOBILE_ENFORCE_MINIMUM_VERSION: "true",
    MOBILE_MINIMUM_IOS_VERSION: "1.0.0",
    MOBILE_MINIMUM_ANDROID_VERSION: "1.0.0",
    MOBILE_IOS_STORE_URL:
      "https://apps.apple.com/us/app/senzilytics/id123",
    MOBILE_ANDROID_STORE_URL:
      "https://play.google.com/store/apps/details?id=com.senzilytics.mobile",
  });

  assert.equal(policy.enforcementEnabled, true);
  assert.equal(policy.platform, null);
  assert.equal(policy.apiVersion, null);
});

test("mobile store links reject redirects to arbitrary origins", () => {
  assert.equal(
    safeStoreUrl(
      "android",
      "https://play.google.com/store/apps/details?id=com.senzilytics.mobile"
    ),
    "https://play.google.com/store/apps/details?id=com.senzilytics.mobile"
  );
  assert.equal(
    safeStoreUrl("ios", "https://apps.apple.com/us/app/senzilytics/id123"),
    "https://apps.apple.com/us/app/senzilytics/id123"
  );
  assert.equal(
    safeStoreUrl("android", "https://play.google.com.attacker.example/app"),
    null
  );
});

test("maintenance messages are bounded before being returned publicly", () => {
  const policy = readMobileReleasePolicy(
    request({}),
    {
      MOBILE_MAINTENANCE_MODE: "true",
      MOBILE_MAINTENANCE_MESSAGE: "M".repeat(500),
    },
    new Date("2026-07-24T12:00:00.000Z")
  );
  assert.equal(policy.maintenance, true);
  assert.equal(policy.message?.length, 240);
  assert.equal(policy.checkedAt, "2026-07-24T12:00:00.000Z");
});
