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

test("mobile synchronization accepts field risk capture, review, and JSA acknowledgment", () => {
  const parsed = offlineSyncRequestSchema.safeParse({
    items: [
      {
        id: "2bed2fa7-f2a5-4ed9-b2b4-6e82de255f25",
        type: "RISK_CAPTURE",
        capturedAt,
        payload: {
          siteId: "site-1",
          departmentId: "department-1",
          title: "Pedestrian and forklift interaction",
          description: "Mixed pedestrian and powered industrial truck traffic at dispatch.",
          category: "SAFETY",
          hazardType: "Mobile equipment",
          process: "Dispatch",
          initialLikelihood: "LIKELY",
          initialImpact: "MAJOR",
          residualLikelihood: "UNLIKELY",
          residualImpact: "MODERATE",
          reviewFrequency: "QUARTERLY",
          nextReviewDate: "2026-10-22",
        },
      },
      {
        id: "19873e10-fe75-416c-89cf-f13c9aa206a5",
        type: "RISK_REVIEW",
        capturedAt,
        payload: {
          riskId: "risk-1",
          likelihood: "POSSIBLE",
          impact: "MAJOR",
          controlEffectiveness: "PARTIALLY_EFFECTIVE",
          trend: "IMPROVING",
          notes: "Barriers were installed; one crossing still needs warning lights.",
          nextReviewDate: "2026-10-22",
        },
      },
      {
        id: "ac029077-bd0c-444a-be7e-a737a17b9f78",
        type: "JSA_ACKNOWLEDGMENT",
        capturedAt,
        payload: {
          jsaId: "jsa-1",
          statement: "I understand the hazards and required controls.",
        },
      },
    ],
  });
  assert.equal(parsed.success, true);
});

test("mobile field risk contracts reject malformed dates and incomplete acknowledgments", () => {
  const invalidDate = offlineSyncRequestSchema.safeParse({
    items: [{
      id,
      type: "RISK_REVIEW",
      capturedAt,
      payload: {
        riskId: "risk-1",
        likelihood: "POSSIBLE",
        impact: "MAJOR",
        nextReviewDate: "10/22/2026",
      },
    }],
  });
  const invalidAcknowledgment = offlineSyncRequestSchema.safeParse({
    items: [{
      id,
      type: "JSA_ACKNOWLEDGMENT",
      capturedAt,
      payload: {
        jsaId: "jsa-1",
        statement: "yes",
      },
    }],
  });
  assert.equal(invalidDate.success, false);
  assert.equal(invalidAcknowledgment.success, false);
});

test("mobile synchronization accepts governed compliance and training updates", () => {
  const parsed = offlineSyncRequestSchema.safeParse({
    items: [
      {
        id: "39ff0c56-3d94-4b82-981c-6445dd876777",
        type: "COMPLIANCE_COMPLETION",
        capturedAt,
        payload: {
          occurrenceId: "occurrence-1",
          completionNotes: "Monthly inspection and statutory log review completed.",
          evidenceUrl: "https://www.senzilytics.cloud/documents/evidence-1",
        },
      },
      {
        id: "46145a87-c554-4241-b75e-b25e75305408",
        type: "COMPLIANCE_REVIEW",
        capturedAt,
        payload: {
          occurrenceId: "occurrence-2",
          decision: "REJECT",
          reviewNotes: "Attach the signed regulator submission receipt.",
        },
      },
      {
        id: "1782167a-64d6-494f-9428-45d924b09cdd",
        type: "TRAINING_PROGRESS",
        capturedAt,
        payload: {
          trainingRecordId: "training-1",
          notes: "Classroom module started.",
        },
      },
      {
        id: "99544235-227a-4922-a384-566c4ec1ade6",
        type: "TRAINING_COMPLETION",
        capturedAt,
        payload: {
          trainingRecordId: "training-2",
          completedAt: "2026-07-22",
          certificateNumber: "CERT-2048",
          score: 94,
          notes: "Practical assessment passed.",
        },
      },
    ],
  });
  assert.equal(parsed.success, true);
});

test("mobile compliance and training contracts reject unsafe evidence and invalid scores", () => {
  const insecureEvidence = offlineSyncRequestSchema.safeParse({
    items: [{
      id,
      type: "COMPLIANCE_COMPLETION",
      capturedAt,
      payload: {
        occurrenceId: "occurrence-1",
        evidenceUrl: "http://example.com/evidence",
      },
    }],
  });
  const invalidScore = offlineSyncRequestSchema.safeParse({
    items: [{
      id,
      type: "TRAINING_COMPLETION",
      capturedAt,
      payload: {
        trainingRecordId: "training-1",
        completedAt: "2026-07-22",
        score: 101,
      },
    }],
  });
  assert.equal(insecureEvidence.success, false);
  assert.equal(invalidScore.success, false);
});

test("mobile synchronization accepts governed MOC and permit execution updates", () => {
  const parsed = offlineSyncRequestSchema.safeParse({
    items: [
      {
        id: "9f0b0bd5-27a2-45fa-b42c-698dcc948d7f",
        type: "MOC_STATUS",
        capturedAt,
        payload: {
          mocId: "moc-1",
          status: "TECHNICAL_REVIEW",
          comments: "Technical review package is ready.",
        },
      },
      {
        id: "5fe5aa14-f520-496f-b5fd-6fb7459cb248",
        type: "MOC_APPROVAL_DECISION",
        capturedAt,
        payload: {
          mocId: "moc-1",
          approvalId: "approval-1",
          status: "APPROVED",
          comments: "Engineering controls are suitable.",
        },
      },
      {
        id: "5df39b1d-c47f-4bcf-a013-85778dd726a0",
        type: "MOC_TASK_STATUS",
        capturedAt,
        payload: {
          mocId: "moc-1",
          taskId: "task-1",
          status: "COMPLETED",
          evidenceNote: "Updated drawing and field verification recorded.",
        },
      },
      {
        id: "1fe13048-439a-44ec-b365-bac2d36fbfc0",
        type: "PERMIT_CONTROL",
        capturedAt,
        payload: {
          permitId: "permit-1",
          controlId: "control-1",
          verified: true,
        },
      },
      {
        id: "75a1cc72-f565-49b1-8ac3-135228cf4f9f",
        type: "PERMIT_GAS_TEST",
        capturedAt,
        payload: {
          permitId: "permit-1",
          oxygenPercent: 20.9,
          lelPercent: 0,
          h2sPpm: 0,
          coPpm: 1,
          result: "PASS",
          notes: "Pre-entry atmospheric test.",
        },
      },
      {
        id: "926573ca-8175-4e70-9df9-e6e9413ac9e5",
        type: "PERMIT_STATUS",
        capturedAt,
        payload: {
          permitId: "permit-1",
          status: "ACTIVE",
          comments: "Work party briefed and controls verified.",
        },
      },
    ],
  });
  assert.equal(parsed.success, true);
});

test("mobile permit gas-test contracts reject impossible readings", () => {
  for (const payload of [
    {
      permitId: "permit-1",
      oxygenPercent: 101,
      result: "PASS",
    },
    {
      permitId: "permit-1",
      h2sPpm: -1,
      result: "FAIL",
    },
  ]) {
    const parsed = offlineSyncRequestSchema.safeParse({
      items: [{
        id,
        type: "PERMIT_GAS_TEST",
        capturedAt,
        payload,
      }],
    });
    assert.equal(parsed.success, false);
  }
});

test("mobile synchronization accepts governed asset and contractor field updates", () => {
  const parsed = offlineSyncRequestSchema.safeParse({
    items: [
      {
        id: "9e06e500-c84f-4d88-9df1-34d5278347ac",
        type: "ASSET_STATUS",
        capturedAt,
        payload: {
          assetId: "asset-1",
          status: "OUT_OF_SERVICE",
          reason: "Guard interlock failed during the pre-use check.",
        },
      },
      {
        id: "0e3873d6-ef4f-499b-b527-1221165df98f",
        type: "ASSET_INSPECTION",
        capturedAt,
        payload: {
          assetId: "asset-1",
          inspectedAt: capturedAt,
          result: "DEFECT_FOUND",
          conditionScore: 2,
          observations: "The fixed guard is loose at two anchor points.",
          immediateAction: "Equipment isolated pending repair.",
          customForms: [],
        },
      },
      {
        id: "543bf5df-864c-44d8-867b-05cd36941843",
        type: "ASSET_DEFECT",
        capturedAt,
        payload: {
          assetId: "asset-1",
          title: "Loose fixed guard",
          description: "Two guard anchor bolts do not retain torque.",
          severity: "HIGH",
          ownerId: "user-1",
          dueDate: "2026-08-15",
          immediateControls: "Asset locked out and tagged.",
        },
      },
      {
        id: "73c38123-8de7-4f22-ae7b-a4baa3b42da7",
        type: "ASSET_DEFECT_STATUS",
        capturedAt,
        payload: {
          defectId: "defect-1",
          status: "REPAIR_PLANNED",
          repairPlan: "Replace fasteners and complete functional verification.",
        },
      },
      {
        id: "36c002a7-6bdd-45f1-8523-f779cd6a88eb",
        type: "ASSET_MAINTENANCE_STATUS",
        capturedAt,
        payload: {
          recordId: "maintenance-1",
          status: "IN_PROGRESS",
          reason: "Technician accepted the work order and isolated the equipment.",
        },
      },
      {
        id: "4d0da25d-3c79-4a57-b73d-cba25c92b583",
        type: "ASSET_MAINTENANCE_COMPLETE",
        capturedAt,
        payload: {
          recordId: "maintenance-2",
          completedAt: capturedAt,
          workSummary: "Guard anchors replaced and interlock function tested.",
          evidenceReference: "WO-2048",
          downtimeHours: 3.5,
        },
      },
      {
        id: "a2fe06e7-d54e-4fc4-948b-e2e07f61bc36",
        type: "CONTRACTOR_STATUS",
        capturedAt,
        payload: {
          contractorId: "contractor-1",
          status: "SUSPENDED",
          reason: "Insurance certificate expired.",
        },
      },
    ],
  });
  assert.equal(parsed.success, true);
});

test("mobile asset contracts reject unsafe inspection and maintenance values", () => {
  const invalidInspection = offlineSyncRequestSchema.safeParse({
    items: [{
      id,
      type: "ASSET_INSPECTION",
      capturedAt,
      payload: {
        assetId: "asset-1",
        inspectedAt: capturedAt,
        result: "NOT_INSPECTED",
        conditionScore: 6,
        customForms: [],
      },
    }],
  });
  const invalidDowntime = offlineSyncRequestSchema.safeParse({
    items: [{
      id,
      type: "ASSET_MAINTENANCE_COMPLETE",
      capturedAt,
      payload: {
        recordId: "maintenance-1",
        completedAt: capturedAt,
        workSummary: "Completed",
        evidenceReference: "WO-1",
        downtimeHours: -1,
      },
    }],
  });
  assert.equal(invalidInspection.success, false);
  assert.equal(invalidDowntime.success, false);
});

test("mobile synchronization accepts governed hygiene and occupational-health updates", () => {
  const parsed = offlineSyncRequestSchema.safeParse({
    items: [
      {
        id: "a5d6fbf1-158c-46ea-a82a-859a1574e003",
        type: "IH_ASSESSMENT_STATUS",
        capturedAt,
        payload: {
          assessmentId: "assessment-1",
          status: "IN_PROGRESS",
          observations: "Baseline walkthrough complete.",
        },
      },
      {
        id: "b99c9d24-7dc5-49d0-96ed-ed93f6f999c9",
        type: "IH_SAMPLE",
        capturedAt,
        payload: {
          assessmentId: "assessment-1",
          agentId: "agent-1",
          sampleType: "PERSONAL",
          sampleReference: "COC-2048",
          sampledAt: capturedAt,
          durationMinutes: 480,
          resultValue: 0.42,
          reportingLimit: 0.01,
          occupationalLimit: 0.5,
          actionLevel: 0.25,
          unit: "mg/m³",
        },
      },
      {
        id: "ef93e096-6e94-41b1-8222-61752835118d",
        type: "IH_FORMS",
        capturedAt,
        payload: {
          assessmentId: "assessment-1",
          customForms: [{
            definitionId: "definition-1",
            versionId: "version-1",
            answers: [{ fieldId: "field-1", value: true }],
          }],
        },
      },
      {
        id: "c7618a12-0d69-48e2-8096-a9f795626b64",
        type: "OH_PROGRAM_STATUS",
        capturedAt,
        payload: {
          programId: "program-1",
          status: "ACTIVE",
        },
      },
      {
        id: "345771af-15dc-4437-a30e-394695478141",
        type: "OH_ENROLLMENT",
        capturedAt,
        payload: {
          programId: "program-1",
          enrolledUserId: "user-1",
          nextDueAt: "2026-08-15",
          notes: "Appointment coordination requested.",
        },
      },
      {
        id: "fd9e50f2-41ae-4881-84c1-0f2784601903",
        type: "OH_ENROLLMENT_COMPLETE",
        capturedAt,
        payload: {
          enrollmentId: "enrollment-1",
          completedAt: "2026-07-22",
          fitnessOutcome: "CLEARED_WITH_RESTRICTIONS",
          workRestrictions: "No respirator use pending provider reassessment.",
          certificateReference: "FIT-2048",
        },
      },
      {
        id: "40c74379-e5a0-4eb0-9cbc-7a350a112ec8",
        type: "OH_ENROLLMENT_REMOVE",
        capturedAt,
        payload: {
          enrollmentId: "enrollment-2",
          reason: "Worker transferred outside the exposure group.",
        },
      },
    ],
  });
  assert.equal(parsed.success, true);
});

test("mobile hygiene and health contracts reject unsafe or clinical-state values", () => {
  const negativeSample = offlineSyncRequestSchema.safeParse({
    items: [{
      id,
      type: "IH_SAMPLE",
      capturedAt,
      payload: {
        assessmentId: "assessment-1",
        agentId: "agent-1",
        sampleType: "PERSONAL",
        sampledAt: capturedAt,
        durationMinutes: -1,
        resultValue: -0.1,
      },
    }],
  });
  const invalidOutcome = offlineSyncRequestSchema.safeParse({
    items: [{
      id,
      type: "OH_ENROLLMENT_COMPLETE",
      capturedAt,
      payload: {
        enrollmentId: "enrollment-1",
        completedAt: "2026-07-22",
        fitnessOutcome: "NOT_ASSESSED",
      },
    }],
  });
  const missingRestrictions = offlineSyncRequestSchema.safeParse({
    items: [{
      id,
      type: "OH_ENROLLMENT_COMPLETE",
      capturedAt,
      payload: {
        enrollmentId: "enrollment-1",
        completedAt: "2026-07-22",
        fitnessOutcome: "TEMPORARILY_NOT_CLEARED",
      },
    }],
  });
  assert.equal(negativeSample.success, false);
  assert.equal(invalidOutcome.success, false);
  assert.equal(missingRestrictions.success, false);
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
  assert.equal(requiredOfflinePermission("RISK_CAPTURE"), PermissionKey.MANAGE_RISKS);
  assert.equal(requiredOfflinePermission("RISK_REVIEW"), PermissionKey.MANAGE_RISKS);
  assert.equal(requiredOfflinePermission("JSA_ACKNOWLEDGMENT"), PermissionKey.VIEW_RISKS);
  assert.equal(requiredOfflinePermission("COMPLIANCE_COMPLETION"), PermissionKey.VIEW_COMPLIANCE);
  assert.equal(requiredOfflinePermission("COMPLIANCE_REVIEW"), PermissionKey.MANAGE_COMPLIANCE);
  assert.equal(requiredOfflinePermission("TRAINING_PROGRESS"), PermissionKey.VIEW_TRAINING);
  assert.equal(requiredOfflinePermission("TRAINING_COMPLETION"), PermissionKey.MANAGE_TRAINING);
  assert.equal(requiredOfflinePermission("MOC_STATUS"), PermissionKey.MANAGE_MOC);
  assert.equal(requiredOfflinePermission("MOC_APPROVAL_DECISION"), PermissionKey.MANAGE_MOC);
  assert.equal(requiredOfflinePermission("MOC_TASK_STATUS"), PermissionKey.MANAGE_MOC);
  assert.equal(requiredOfflinePermission("PERMIT_STATUS"), PermissionKey.MANAGE_PERMITS_TO_WORK);
  assert.equal(requiredOfflinePermission("PERMIT_CONTROL"), PermissionKey.MANAGE_PERMITS_TO_WORK);
  assert.equal(requiredOfflinePermission("PERMIT_GAS_TEST"), PermissionKey.MANAGE_PERMITS_TO_WORK);
  assert.equal(requiredOfflinePermission("ASSET_STATUS"), PermissionKey.MANAGE_ASSETS);
  assert.equal(requiredOfflinePermission("ASSET_INSPECTION"), PermissionKey.MANAGE_ASSETS);
  assert.equal(requiredOfflinePermission("ASSET_DEFECT"), PermissionKey.MANAGE_ASSETS);
  assert.equal(requiredOfflinePermission("ASSET_DEFECT_STATUS"), PermissionKey.MANAGE_ASSETS);
  assert.equal(requiredOfflinePermission("ASSET_MAINTENANCE_STATUS"), PermissionKey.MANAGE_ASSETS);
  assert.equal(requiredOfflinePermission("ASSET_MAINTENANCE_COMPLETE"), PermissionKey.MANAGE_ASSETS);
  assert.equal(requiredOfflinePermission("CONTRACTOR_STATUS"), PermissionKey.MANAGE_CONTRACTORS);
  assert.equal(requiredOfflinePermission("IH_ASSESSMENT_STATUS"), PermissionKey.MANAGE_INDUSTRIAL_HYGIENE);
  assert.equal(requiredOfflinePermission("IH_SAMPLE"), PermissionKey.MANAGE_INDUSTRIAL_HYGIENE);
  assert.equal(requiredOfflinePermission("IH_FORMS"), PermissionKey.MANAGE_INDUSTRIAL_HYGIENE);
  assert.equal(requiredOfflinePermission("OH_PROGRAM_STATUS"), PermissionKey.MANAGE_OCCUPATIONAL_HEALTH);
  assert.equal(requiredOfflinePermission("OH_ENROLLMENT"), PermissionKey.MANAGE_OCCUPATIONAL_HEALTH);
  assert.equal(requiredOfflinePermission("OH_ENROLLMENT_COMPLETE"), PermissionKey.MANAGE_OCCUPATIONAL_HEALTH);
  assert.equal(requiredOfflinePermission("OH_ENROLLMENT_REMOVE"), PermissionKey.MANAGE_OCCUPATIONAL_HEALTH);
  assert.equal(requiredOfflinePermission("CHEMICAL_INVENTORY"), PermissionKey.MANAGE_CHEMICALS);
  assert.equal(requiredOfflinePermission("CHEMICAL_STATUS"), PermissionKey.MANAGE_CHEMICALS);
  assert.equal(requiredOfflinePermission("CHEMICAL_FORMS"), PermissionKey.MANAGE_CHEMICALS);
  assert.equal(requiredOfflinePermission("ENVIRONMENTAL_DATA"), PermissionKey.MANAGE_ENVIRONMENTAL);
  assert.equal(requiredOfflinePermission("ENVIRONMENTAL_REVIEW"), PermissionKey.MANAGE_ENVIRONMENTAL);
  assert.equal(requiredOfflinePermission("ENVIRONMENTAL_FORMS"), PermissionKey.MANAGE_ENVIRONMENTAL);
  assert.equal(requiredOfflinePermission("ESG_DATA"), PermissionKey.MANAGE_ESG);
  assert.equal(requiredOfflinePermission("ESG_FORMS"), PermissionKey.MANAGE_ESG);
  assert.equal(requiredOfflinePermission("ESG_DISCLOSURE_STATUS"), PermissionKey.MANAGE_ESG);
  assert.equal(requiredOfflinePermission("ESG_INITIATIVE_STATUS"), PermissionKey.MANAGE_ESG);
});

test("ESG offline contracts enforce finite governed disclosure data", () => {
  const capturedAt = "2026-07-24T12:00:00.000Z";
  const valid = offlineSyncRequestSchema.safeParse({
    items: [
      {
        id: "907ba83a-da5c-4efe-988e-7fdd28681bd9",
        type: "ESG_DATA",
        capturedAt,
        payload: {
          periodId: "period-1",
          metricId: "metric-1",
          value: 42.5,
          quality: "VERIFIED",
          evidenceSummary: "Assured source register",
        },
      },
      {
        id: "b5f7a6a0-a9d4-40cf-964d-63bf7b69b88c",
        type: "ESG_DISCLOSURE_STATUS",
        capturedAt,
        payload: {
          periodId: "period-1",
          status: "UNDER_REVIEW",
        },
      },
      {
        id: "de95473f-011b-40ad-a089-d6a02ece7b47",
        type: "ESG_INITIATIVE_STATUS",
        capturedAt,
        payload: {
          initiativeId: "initiative-1",
          status: "IN_PROGRESS",
        },
      },
    ],
  });
  const invalidQuality = offlineSyncRequestSchema.safeParse({
    items: [
      {
        id: "8d4fc5ec-a18c-4a00-99d5-a79eeff2e93a",
        type: "ESG_DATA",
        capturedAt,
        payload: {
          periodId: "period-1",
          metricId: "metric-1",
          value: 10,
          quality: "UNVERIFIED",
        },
      },
    ],
  });
  assert.equal(valid.success, true);
  assert.equal(invalidQuality.success, false);
});

test("chemical inventory and environmental data offline contracts reject unsafe field values", () => {
  const capturedAt = "2026-07-24T12:00:00.000Z";
  const validChemical = offlineSyncRequestSchema.safeParse({
    items: [{
      id: "96f5b642-584e-4fa8-8d02-a7c041132f32",
      type: "CHEMICAL_INVENTORY",
      capturedAt,
      payload: {
        chemicalId: "chemical-1",
        siteId: "site-1",
        storageLocation: "Flammable cabinet A",
        quantity: 5,
        unit: "L",
        maximumAllowed: 10,
      },
    }],
  });
  const negativeChemical = offlineSyncRequestSchema.safeParse({
    items: [{
      id: "a3467127-c3a9-494b-9685-686cc93e1e15",
      type: "CHEMICAL_INVENTORY",
      capturedAt,
      payload: {
        chemicalId: "chemical-1",
        siteId: "site-1",
        storageLocation: "Cabinet",
        quantity: -1,
        unit: "L",
      },
    }],
  });
  const validEnvironmental = offlineSyncRequestSchema.safeParse({
    items: [{
      id: "75230862-a215-49da-a78e-03897066d032",
      type: "ENVIRONMENTAL_DATA",
      capturedAt,
      payload: {
        metricId: "metric-1",
        siteId: "site-1",
        value: 125.5,
        quality: "MEASURED",
        periodStart: "2026-07-01",
        periodEnd: "2026-07-31",
        customForms: [],
      },
    }],
  });
  const reversedPeriod = offlineSyncRequestSchema.safeParse({
    items: [{
      id: "6fd0d1b7-b522-4e98-a98d-6628796de5ca",
      type: "ENVIRONMENTAL_DATA",
      capturedAt,
      payload: {
        metricId: "metric-1",
        siteId: "site-1",
        value: 125.5,
        quality: "MEASURED",
        periodStart: "2026-07-31",
        periodEnd: "2026-07-01",
        customForms: [],
      },
    }],
  });
  assert.equal(validChemical.success, true);
  assert.equal(negativeChemical.success, false);
  assert.equal(validEnvironmental.success, true);
  assert.equal(reversedPeriod.success, false);
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
  assert.deepEqual(decodeOfflineEnvelope({ type: "RISK_REVIEW", payload: { riskId: "risk-1" } }), {
    type: "RISK_REVIEW",
    payload: { riskId: "risk-1" },
  });
  assert.deepEqual(decodeOfflineEnvelope({ type: "JSA_ACKNOWLEDGMENT", payload: { jsaId: "jsa-1" } }), {
    type: "JSA_ACKNOWLEDGMENT",
    payload: { jsaId: "jsa-1" },
  });
  assert.deepEqual(decodeOfflineEnvelope({ type: "COMPLIANCE_COMPLETION", payload: { occurrenceId: "occurrence-1" } }), {
    type: "COMPLIANCE_COMPLETION",
    payload: { occurrenceId: "occurrence-1" },
  });
  assert.deepEqual(decodeOfflineEnvelope({ type: "TRAINING_COMPLETION", payload: { trainingRecordId: "training-1" } }), {
    type: "TRAINING_COMPLETION",
    payload: { trainingRecordId: "training-1" },
  });
  assert.deepEqual(decodeOfflineEnvelope({ type: "MOC_APPROVAL_DECISION", payload: { mocId: "moc-1" } }), {
    type: "MOC_APPROVAL_DECISION",
    payload: { mocId: "moc-1" },
  });
  assert.deepEqual(decodeOfflineEnvelope({ type: "PERMIT_GAS_TEST", payload: { permitId: "permit-1" } }), {
    type: "PERMIT_GAS_TEST",
    payload: { permitId: "permit-1" },
  });
  assert.deepEqual(decodeOfflineEnvelope({ type: "ASSET_INSPECTION", payload: { assetId: "asset-1" } }), {
    type: "ASSET_INSPECTION",
    payload: { assetId: "asset-1" },
  });
  assert.deepEqual(decodeOfflineEnvelope({ type: "CONTRACTOR_STATUS", payload: { contractorId: "contractor-1" } }), {
    type: "CONTRACTOR_STATUS",
    payload: { contractorId: "contractor-1" },
  });
  assert.deepEqual(decodeOfflineEnvelope({ type: "IH_SAMPLE", payload: { assessmentId: "assessment-1" } }), {
    type: "IH_SAMPLE",
    payload: { assessmentId: "assessment-1" },
  });
  assert.deepEqual(decodeOfflineEnvelope({ type: "OH_ENROLLMENT_COMPLETE", payload: { enrollmentId: "enrollment-1" } }), {
    type: "OH_ENROLLMENT_COMPLETE",
    payload: { enrollmentId: "enrollment-1" },
  });
});
