import assert from "node:assert/strict";
import test from "node:test";
import { PermissionKey } from "@prisma/client";
import {
  offlineSyncRequestSchema,
  requiredOfflinePermission,
} from "../src/modules/mobile/offline-sync.service";
import { decodeOfflineEnvelope } from "../apps/mobile/src/offline-envelope";

const id = "bcb134ce-4837-4bfa-848f-42f87d29842b";
const capturedAt = "2026-07-22T12:00:00.000Z";

test("mobile synchronization accepts typed incident and inspection payloads", () => {
  const parsed = offlineSyncRequestSchema.safeParse({
    items: [
      {
        id,
        type: "INCIDENT",
        capturedAt,
        payload: {
          siteId: "site-1",
          title: "Forklift near miss",
          description: "A pedestrian entered the operating envelope.",
          type: "NEAR_MISS",
          riskLevel: "HIGH",
          occurredAt: capturedAt,
          customForms: [],
        },
      },
      {
        id: "c58a6aa6-bd22-4f26-a8f0-765d365c61d3",
        type: "INSPECTION_RESPONSE",
        capturedAt,
        payload: {
          inspectionId: "inspection-1",
          checklistItemId: "item-1",
          result: "NON_COMPLIANT",
          comments: "Guard was missing.",
          createFinding: true,
          findingRiskLevel: "HIGH",
        },
      },
    ],
  });

  assert.equal(parsed.success, true);
});

test("mobile inspection sync rejects unanswered checklist states", () => {
  const parsed = offlineSyncRequestSchema.safeParse({
    items: [{
      id,
      type: "INSPECTION_RESPONSE",
      capturedAt,
      payload: {
        inspectionId: "inspection-1",
        checklistItemId: "item-1",
        result: "NOT_ASSESSED",
        createFinding: false,
      },
    }],
  });

  assert.equal(parsed.success, false);
});

test("each offline record type requires its governing permission", () => {
  assert.equal(requiredOfflinePermission("SAFETY_OBSERVATION"), PermissionKey.CREATE_OBSERVATION);
  assert.equal(requiredOfflinePermission("INCIDENT"), PermissionKey.CREATE_INCIDENT);
  assert.equal(requiredOfflinePermission("INSPECTION_RESPONSE"), PermissionKey.MANAGE_INSPECTIONS);
});

test("mobile outbox decoder preserves legacy observation rows", () => {
  const legacy = { siteId: "site-1", title: "Legacy observation" };
  assert.deepEqual(decodeOfflineEnvelope(legacy), {
    type: "SAFETY_OBSERVATION",
    payload: legacy,
  });
  assert.deepEqual(decodeOfflineEnvelope({ type: "INCIDENT", payload: { title: "Near miss" } }), {
    type: "INCIDENT",
    payload: { title: "Near miss" },
  });
});
