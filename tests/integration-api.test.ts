import assert from "node:assert/strict";
import test from "node:test";
import { IntegrationApiScope } from "@prisma/client";
import { integrationResources, parseIntegrationQuery } from "../src/modules/integrations/integration-api.service";

test("integration resources require explicit least-privilege scopes", () => {
  assert.equal(integrationResources.incidents, IntegrationApiScope.READ_INCIDENTS);
  assert.equal(integrationResources.audits, IntegrationApiScope.READ_AUDITS);
  assert.equal(integrationResources.assurance, IntegrationApiScope.READ_ASSURANCE);
  assert.equal(Object.keys(integrationResources).length, 8);
});

test("integration query validation accepts opaque cursor pagination", () => {
  const encoded = Buffer.from(JSON.stringify({ id: "record_1", updatedAt: "2026-07-21T01:00:00.000Z" })).toString("base64url");
  const parsed = parseIntegrationQuery(new URL(`https://example.com/api/v1/risks?limit=25&updatedSince=2026-07-01T00:00:00.000Z&cursor=${encoded}`));
  assert.equal(parsed.limit, 25);
  assert.equal(parsed.cursor?.id, "record_1");
  assert.equal(parsed.updatedSince?.toISOString(), "2026-07-01T00:00:00.000Z");
  assert.throws(() => parseIntegrationQuery(new URL("https://example.com/api/v1/risks?limit=101")), /limit/);
  assert.throws(() => parseIntegrationQuery(new URL("https://example.com/api/v1/risks?cursor=invalid")), /cursor/);
});
