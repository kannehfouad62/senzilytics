import assert from "node:assert/strict";
import test from "node:test";
import { PermissionKey, UserRole } from "@prisma/client";
import { decodeOfflineEnvelope } from "../apps/mobile/src/offline-envelope";
import {
  mobileEvidencePayloadSchema,
  requiredMobileEvidencePermission,
} from "../src/modules/mobile/mobile-evidence.service";
import {
  offlineSyncRequestSchema,
  requiredOfflinePermission,
} from "../src/modules/mobile/offline-sync.service";
import { getMobileModuleCatalog } from "../src/modules/mobile/mobile-module-catalog";
import { mobileRegulatoryCapabilities } from "../src/modules/mobile/mobile-regulatory-intelligence.service";

const capturedAt = "2026-07-24T12:00:00.000Z";

test("native regulatory capabilities separate read and governed management access", () => {
  assert.deepEqual(
    mobileRegulatoryCapabilities([PermissionKey.VIEW_COMPLIANCE]),
    { canView: true, canManage: false }
  );
  assert.deepEqual(
    mobileRegulatoryCapabilities([
      PermissionKey.VIEW_COMPLIANCE,
      PermissionKey.MANAGE_COMPLIANCE,
    ]),
    { canView: true, canManage: true }
  );
  assert.deepEqual(mobileRegulatoryCapabilities([]), {
    canView: false,
    canManage: false,
  });
});

test("the authorized module catalog opens Regulatory Intelligence natively", () => {
  const modules = getMobileModuleCatalog({
    permissions: [PermissionKey.VIEW_COMPLIANCE],
    user: {
      email: "compliance@example.com",
      role: UserRole.EHS_MANAGER,
      isActive: true,
      isPlatformAdmin: false,
    },
  });
  assert.equal(
    modules.find((module) => module.key === "regulatory")?.nativeCapability,
    "REGULATORY_INTELLIGENCE"
  );
});

test("offline regulatory contracts accept the complete governed lifecycle", () => {
  const records = [
    {
      id: "08de183b-a6a3-4dda-bc3c-23621877f175",
      type: "REGULATORY_SOURCE_REVIEW",
      capturedAt,
      payload: { sourceId: "source-1", notes: "Official source checked." },
    },
    {
      id: "c805ae09-d27f-4719-84da-35f0b311b74b",
      type: "REGULATORY_CHANGE_REVIEW",
      capturedAt,
      payload: { changeId: "change-1", note: "Formal review started." },
    },
    {
      id: "966e254a-57b4-4d4e-8963-8b20d23cf0dc",
      type: "REGULATORY_IMPACT_ASSESSMENT",
      capturedAt,
      payload: {
        changeId: "change-1",
        decision: "APPLICABLE",
        applicabilityRationale: "The requirement applies to the operating site.",
        impactSummary: "The permit procedure must be revised.",
        requiredActions: "Revise the procedure and train affected workers.",
        implementationDueAt: "2026-09-01T12:00:00.000Z",
      },
    },
    {
      id: "98c6bb12-0403-41ca-96d0-1ca5274a54fa",
      type: "REGULATORY_ASSESSMENT_REVIEW",
      capturedAt,
      payload: {
        assessmentId: "assessment-1",
        approved: true,
        reviewNotes: "Applicability and actions are adequately supported.",
      },
    },
    {
      id: "1306637f-f7ac-4016-83d6-7515181df480",
      type: "REGULATORY_IMPLEMENTATION",
      capturedAt,
      payload: {
        changeId: "change-1",
        implementationSummary: "Procedure issued and training verified.",
      },
    },
    {
      id: "a08bbdc2-733c-43f8-b5bc-51819b5703ef",
      type: "REGULATORY_CHANGE_CLOSE",
      capturedAt,
      payload: {
        changeId: "change-1",
        rationale: "All governed implementation work is complete.",
      },
    },
  ];
  const parsed = offlineSyncRequestSchema.safeParse({ items: records });
  assert.equal(parsed.success, true);
  assert.equal(
    decodeOfflineEnvelope(records[2]).type,
    "REGULATORY_IMPACT_ASSESSMENT"
  );
  for (const record of records) {
    assert.equal(
      requiredOfflinePermission(
        record.type as Parameters<typeof requiredOfflinePermission>[0]
      ),
      PermissionKey.MANAGE_COMPLIANCE
    );
  }
});

test("applicable changes cannot synchronize without impact, actions, and due date", () => {
  const parsed = offlineSyncRequestSchema.safeParse({
    items: [
      {
        id: "966e254a-57b4-4d4e-8963-8b20d23cf0dc",
        type: "REGULATORY_IMPACT_ASSESSMENT",
        capturedAt,
        payload: {
          changeId: "change-1",
          decision: "APPLICABLE",
          applicabilityRationale: "The requirement applies.",
        },
      },
    ],
  });
  assert.equal(parsed.success, false);
});

test("regulatory evidence requires a synchronized parent and compliance management", () => {
  const evidence = {
    localEvidenceId: "a44be3ce-88ad-4e1f-804c-54723446f3c0",
    targetType: "REGULATORY_CHANGE",
    title: "Impact assessment evidence",
    fileName: "permit-analysis.pdf",
    mimeType: "application/pdf",
    sizeBytes: 4096,
    checksum: "b".repeat(64),
    capturedAt,
  };
  assert.equal(
    mobileEvidencePayloadSchema.safeParse({
      ...evidence,
      parentSubmissionId: "966e254a-57b4-4d4e-8963-8b20d23cf0dc",
    }).success,
    true
  );
  assert.equal(mobileEvidencePayloadSchema.safeParse(evidence).success, false);
  assert.equal(
    requiredMobileEvidencePermission("REGULATORY_CHANGE"),
    PermissionKey.MANAGE_COMPLIANCE
  );
});
