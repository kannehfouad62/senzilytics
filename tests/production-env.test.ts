import assert from "node:assert/strict";
import test from "node:test";
import { inspectProductionEnvironment } from "../src/lib/production-env";

test("accepts a complete hardened production environment", () => {
  const result = inspectProductionEnvironment({ DATABASE_URL: "postgres://database", AUTH_SECRET: "a".repeat(32), CRON_SECRET: "c".repeat(32), MOBILE_TOKEN_SECRET: "m".repeat(32), APP_URL: "https://senzilytics.example", INTEGRATION_ENCRYPTION_KEY: Buffer.alloc(32).toString("base64") });
  assert.equal(result.valid, true);
});

test("reports missing and weak production configuration", () => {
  const result = inspectProductionEnvironment({ AUTH_SECRET: "short", CRON_SECRET: "short", APP_URL: "http://localhost" });
  assert.equal(result.valid, false);
  assert.deepEqual(result.missing, ["DATABASE_URL", "MOBILE_TOKEN_SECRET"]);
  assert.equal(result.warnings.length, 5);
});

test("requires valid store release controls before mobile enforcement", () => {
  const result = inspectProductionEnvironment({
    DATABASE_URL: "postgres://database",
    AUTH_SECRET: "a".repeat(32),
    CRON_SECRET: "c".repeat(32),
    MOBILE_TOKEN_SECRET: "m".repeat(32),
    APP_URL: "https://senzilytics.example",
    INTEGRATION_ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
    MOBILE_ENFORCE_MINIMUM_VERSION: "true",
    MOBILE_MINIMUM_IOS_VERSION: "one",
    MOBILE_MINIMUM_ANDROID_VERSION: "1.0",
    MOBILE_IOS_STORE_URL: "https://attacker.example/application",
    MOBILE_ANDROID_STORE_URL: "http://play.google.com/store/apps/details?id=com.senzilytics.mobile",
  });

  assert.equal(result.valid, false);
  assert.equal(result.warnings.length, 4);
});
