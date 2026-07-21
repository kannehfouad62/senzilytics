import assert from "node:assert/strict";
import test from "node:test";
import { inspectProductionEnvironment } from "../src/lib/production-env";

test("accepts a complete hardened production environment", () => {
  const result = inspectProductionEnvironment({ DATABASE_URL: "postgres://database", AUTH_SECRET: "a".repeat(32), CRON_SECRET: "c".repeat(32), APP_URL: "https://senzilytics.example", INTEGRATION_ENCRYPTION_KEY: Buffer.alloc(32).toString("base64") });
  assert.equal(result.valid, true);
});

test("reports missing and weak production configuration", () => {
  const result = inspectProductionEnvironment({ AUTH_SECRET: "short", CRON_SECRET: "short", APP_URL: "http://localhost" });
  assert.equal(result.valid, false);
  assert.deepEqual(result.missing, ["DATABASE_URL"]);
  assert.equal(result.warnings.length, 4);
});
