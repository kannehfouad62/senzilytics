import assert from "node:assert/strict";
import test from "node:test";
import { PermissionKey } from "@prisma/client";
import {
  MAX_MOBILE_EVIDENCE_BYTES,
  mobileEvidencePayloadSchema,
  requiredMobileEvidencePermission,
} from "../src/modules/mobile/mobile-evidence.service";

const base = {
  localEvidenceId: "bcb134ce-4837-4bfa-848f-42f87d29842b",
  title: "Guarding evidence",
  fileName: "machine-guard.jpg",
  mimeType: "image/jpeg",
  sizeBytes: 1024,
  checksum: "a".repeat(64),
  capturedAt: "2026-07-22T12:00:00.000Z",
};

test("mobile evidence contracts require resolvable tenant record targets", () => {
  const observation = mobileEvidencePayloadSchema.safeParse({
    ...base,
    targetType: "SAFETY_OBSERVATION",
    parentSubmissionId: "c58a6aa6-bd22-4f26-a8f0-765d365c61d3",
  });
  const inspection = mobileEvidencePayloadSchema.safeParse({
    ...base,
    targetType: "INSPECTION",
    entityId: "inspection-1",
    checklistItemId: "item-1",
  });
  const audit = mobileEvidencePayloadSchema.safeParse({
    ...base,
    targetType: "AUDIT_QUESTION",
    entityId: "audit-1",
    questionId: "question-1",
  });
  const capa = mobileEvidencePayloadSchema.safeParse({
    ...base,
    targetType: "CORRECTIVE_ACTION",
    entityId: "action-1",
  });
  const assetInspection = mobileEvidencePayloadSchema.safeParse({
    ...base,
    targetType: "ASSET_INSPECTION",
    parentSubmissionId: "f52be7a4-f13b-4e4b-ab88-8f838cdf082d",
  });
  const assetDefect = mobileEvidencePayloadSchema.safeParse({
    ...base,
    targetType: "ASSET_DEFECT",
    parentSubmissionId: "fc4b0c3a-fe09-43a4-9099-fc3c5fedafbd",
  });
  const assetMaintenance = mobileEvidencePayloadSchema.safeParse({
    ...base,
    targetType: "ASSET_MAINTENANCE",
    parentSubmissionId: "94ee294c-5711-4947-baba-0e0d850988fb",
  });
  const hygieneSample = mobileEvidencePayloadSchema.safeParse({
    ...base,
    targetType: "INDUSTRIAL_HYGIENE",
    parentSubmissionId: "aaf85f1a-1257-4a93-9be9-ad2c779270c4",
  });

  assert.equal(observation.success, true);
  assert.equal(inspection.success, true);
  assert.equal(audit.success, true);
  assert.equal(capa.success, true);
  assert.equal(assetInspection.success, true);
  assert.equal(assetDefect.success, true);
  assert.equal(assetMaintenance.success, true);
  assert.equal(hygieneSample.success, true);
  assert.equal(mobileEvidencePayloadSchema.safeParse({
    ...base,
    targetType: "INCIDENT",
  }).success, false);
  assert.equal(mobileEvidencePayloadSchema.safeParse({
    ...base,
    targetType: "INDUSTRIAL_HYGIENE",
    entityId: "assessment-1",
  }).success, false);
  assert.equal(mobileEvidencePayloadSchema.safeParse({
    ...base,
    targetType: "AUDIT_QUESTION",
    entityId: "audit-1",
  }).success, false);
  assert.equal(mobileEvidencePayloadSchema.safeParse({
    ...base,
    targetType: "ASSET_DEFECT",
    entityId: "asset-1",
  }).success, false);
});

test("mobile evidence contracts enforce private-upload file controls", () => {
  assert.equal(mobileEvidencePayloadSchema.safeParse({
    ...base,
    targetType: "INSPECTION",
    entityId: "inspection-1",
    mimeType: "application/x-msdownload",
  }).success, false);
  assert.equal(mobileEvidencePayloadSchema.safeParse({
    ...base,
    targetType: "INSPECTION",
    entityId: "inspection-1",
    sizeBytes: MAX_MOBILE_EVIDENCE_BYTES + 1,
  }).success, false);
  assert.equal(mobileEvidencePayloadSchema.safeParse({
    ...base,
    targetType: "INSPECTION",
    entityId: "inspection-1",
    fileName: "../escape.jpg",
  }).success, false);
});

test("each mobile evidence target retains its governing permission", () => {
  assert.equal(requiredMobileEvidencePermission("SAFETY_OBSERVATION"), PermissionKey.CREATE_OBSERVATION);
  assert.equal(requiredMobileEvidencePermission("INCIDENT"), PermissionKey.CREATE_INCIDENT);
  assert.equal(requiredMobileEvidencePermission("INSPECTION"), PermissionKey.MANAGE_INSPECTIONS);
  assert.equal(requiredMobileEvidencePermission("AUDIT_QUESTION"), PermissionKey.MANAGE_AUDITS);
  assert.equal(requiredMobileEvidencePermission("CORRECTIVE_ACTION"), PermissionKey.UPDATE_CAPA);
  assert.equal(requiredMobileEvidencePermission("ASSET_INSPECTION"), PermissionKey.MANAGE_ASSETS);
  assert.equal(requiredMobileEvidencePermission("ASSET_DEFECT"), PermissionKey.MANAGE_ASSETS);
  assert.equal(requiredMobileEvidencePermission("ASSET_MAINTENANCE"), PermissionKey.MANAGE_ASSETS);
  assert.equal(requiredMobileEvidencePermission("INDUSTRIAL_HYGIENE"), PermissionKey.MANAGE_INDUSTRIAL_HYGIENE);
});
