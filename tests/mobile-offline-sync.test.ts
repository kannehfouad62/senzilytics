import assert from "node:assert/strict";
import test from "node:test";
import { PermissionKey, Status } from "@prisma/client";
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

test("mobile synchronization preserves Audit lifecycle order and assessed responses", () => {
  const parsed = offlineSyncRequestSchema.safeParse({
    items: [
      {
        id: "d55b0f7d-c75c-48ee-8f4e-9c106709f3ed",
        type: "AUDIT_START",
        capturedAt,
        payload: { auditId: "audit-1" },
      },
      {
        id: "23dd23ca-c46e-4b7f-a153-a15ce3810de8",
        type: "AUDIT_RESPONSE",
        capturedAt,
        payload: {
          auditId: "audit-1",
          questionId: "question-1",
          result: "FAIL",
          selectedOptionValues: ["guarding-deficient"],
          comments: "The fixed guard was not installed.",
          evidenceNote: "Verified against equipment drawing EQ-42.",
        },
      },
    ],
  });

  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.deepEqual(parsed.data.items.map((item) => item.type), ["AUDIT_START", "AUDIT_RESPONSE"]);
  }
});

test("mobile Audit sync rejects unassessed results and malformed evidence URLs", () => {
  for (const payload of [
    {
      auditId: "audit-1",
      questionId: "question-1",
      result: "NOT_ASSESSED",
      selectedOptionValues: [],
    },
    {
      auditId: "audit-1",
      questionId: "question-1",
      result: "PASS",
      selectedOptionValues: [],
      evidenceUrl: "not-a-url",
    },
    {
      auditId: "audit-1",
      questionId: "question-1",
      result: "PASS",
      selectedOptionValues: [],
      evidenceUrl: "http://example.com/evidence",
    },
  ]) {
    const parsed = offlineSyncRequestSchema.safeParse({
      items: [{
        id: "32bd4777-25bf-40db-9cac-462c8829d681",
        type: "AUDIT_RESPONSE",
        capturedAt,
        payload,
      }],
    });
    assert.equal(parsed.success, false);
  }
});

test("mobile synchronization accepts governed CAPA progress and closure", () => {
  const parsed = offlineSyncRequestSchema.safeParse({
    items: [
      {
        id: "d55b0f7d-c75c-48ee-8f4e-9c106709f3ed",
        type: "CAPA_STATUS",
        capturedAt,
        payload: {
          actionId: "action-1",
          status: "IN_PROGRESS",
          comments: "Replacement guarding has been ordered.",
        },
      },
      {
        id: "23dd23ca-c46e-4b7f-a153-a15ce3810de8",
        type: "CAPA_STATUS",
        capturedAt,
        payload: {
          actionId: "action-2",
          status: "CLOSED",
          comments: "Verified effective during the follow-up inspection.",
        },
      },
    ],
  });
  assert.equal(parsed.success, true);
});

test("each offline record type requires its governing permission", () => {
  assert.equal(requiredOfflinePermission("SAFETY_OBSERVATION"), PermissionKey.CREATE_OBSERVATION);
  assert.equal(requiredOfflinePermission("INCIDENT"), PermissionKey.CREATE_INCIDENT);
  assert.equal(requiredOfflinePermission("INSPECTION_RESPONSE"), PermissionKey.MANAGE_INSPECTIONS);
  assert.equal(requiredOfflinePermission("AUDIT_START"), PermissionKey.MANAGE_AUDITS);
  assert.equal(requiredOfflinePermission("AUDIT_RESPONSE"), PermissionKey.MANAGE_AUDITS);
  assert.equal(requiredOfflinePermission("CAPA_STATUS", Status.IN_PROGRESS), PermissionKey.UPDATE_CAPA);
  assert.equal(requiredOfflinePermission("CAPA_STATUS", Status.COMPLETED), PermissionKey.CLOSE_CAPA);
  assert.equal(requiredOfflinePermission("CAPA_STATUS", Status.CLOSED), PermissionKey.CLOSE_CAPA);
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
  assert.deepEqual(decodeOfflineEnvelope({ type: "AUDIT_START", payload: { auditId: "audit-1" } }), {
    type: "AUDIT_START",
    payload: { auditId: "audit-1" },
  });
  assert.deepEqual(decodeOfflineEnvelope({ type: "CAPA_STATUS", payload: { actionId: "action-1", status: "IN_PROGRESS" } }), {
    type: "CAPA_STATUS",
    payload: { actionId: "action-1", status: "IN_PROGRESS" },
  });
});
