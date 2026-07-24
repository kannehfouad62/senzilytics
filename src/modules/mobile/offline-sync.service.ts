import {
  ActivityAction,
  AssetDefectStatus,
  AssetInspectionResult,
  AssetMaintenanceStatus,
  AssetStatus,
  ComplianceCalendarOccurrenceStatus,
  ConfigurableFormModule,
  ContractorStatus,
  EnterpriseAuditResponseResult,
  EnterpriseAuditStatus,
  ExposureAssessmentStatus,
  ExposureSampleType,
  FitnessOutcome,
  IncidentType,
  InspectionResponseResult,
  JsaStatus,
  MocApprovalStatus,
  MocStatus,
  MocTaskStatus,
  PermissionKey,
  PermitGasTestResult,
  PermitToWorkStatus,
  RiskCategory,
  RiskControlEffectiveness,
  RiskImpact,
  RiskLikelihood,
  RiskLevel,
  RiskReviewFrequency,
  SafetyObservationType,
  Status,
  SurveillanceProgramStatus,
  UserRole,
} from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSubscriptionFeature } from "@/lib/subscription";
import {
  recordAuditResponseService,
  startAuditExecutionService,
} from "@/modules/audit/audit-execution.service";
import { updateCapaStatusService } from "@/modules/capa/capa.service";
import {
  createPreparedSubmissions,
  prepareCapturedFormSubmissions,
} from "@/modules/forms/runtime-form.service";
import { createIncidentService } from "@/modules/incident/incident.service";
import { saveInspectionResponseService } from "@/modules/inspection/inspection-execution.service";
import {
  createRiskReviewService,
  createRiskService,
} from "@/modules/risk/risk.service";
import { completeTrainingWithCompetenciesService } from "@/modules/training/competency.service";
import {
  decideMocApprovalService,
  transitionMocStatusService,
  updateMocTaskService,
} from "@/modules/moc/moc.service";
import {
  recordPermitGasTestService,
  transitionPermitToWorkService,
  verifyPermitControlService,
} from "@/modules/permits-to-work/permit-to-work.service";
import {
  changeAssetMaintenanceStatusService,
  changeAssetStatusService,
  completeAssetMaintenanceService,
  createAssetDefectService,
  recordAssetInspectionService,
  updateAssetDefectService,
} from "@/modules/assets/asset.service";
import { updateContractorStatusService } from "@/modules/contractors/contractor.service";
import {
  addExposureSampleService,
  completeExposureAssessmentFormsService,
  transitionExposureAssessmentService,
} from "@/modules/industrial-hygiene/industrial-hygiene.service";
import {
  completeSurveillanceEnrollmentService,
  enrollSurveillanceUserService,
  removeSurveillanceEnrollmentService,
  updateSurveillanceProgramStatusService,
} from "@/modules/occupational-health/occupational-health.service";

const customValue = z.union([
  z.string().max(5000),
  z.number().finite(),
  z.boolean(),
  z.array(z.string().max(1000)).max(100),
]);

const capturedFormSchema = z.object({
  definitionId: z.string().min(1),
  versionId: z.string().min(1),
  answers: z.array(
    z.object({ fieldId: z.string().min(1), value: customValue })
  ).max(100),
});

const baseCaptureSchema = z.object({
  siteId: z.string().min(1),
  title: z.string().min(2).max(200),
  description: z.string().min(2).max(5000),
  riskLevel: z.nativeEnum(RiskLevel),
  location: z.string().max(300).optional(),
  customForms: z.array(capturedFormSchema).max(20).default([]),
});

const observationItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("SAFETY_OBSERVATION"),
  capturedAt: z.string().datetime(),
  payload: baseCaptureSchema.extend({
    type: z.nativeEnum(SafetyObservationType),
    immediateAction: z.string().max(2000).optional(),
    observedAt: z.string().datetime(),
    isAnonymous: z.boolean().default(false),
  }),
});

const incidentItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("INCIDENT"),
  capturedAt: z.string().datetime(),
  payload: baseCaptureSchema.extend({
    type: z.nativeEnum(IncidentType),
    occurredAt: z.string().datetime(),
  }),
});

const inspectionResponseItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("INSPECTION_RESPONSE"),
  capturedAt: z.string().datetime(),
  payload: z.object({
    inspectionId: z.string().min(1),
    checklistItemId: z.string().min(1),
    result: z.enum([
      InspectionResponseResult.COMPLIANT,
      InspectionResponseResult.NON_COMPLIANT,
      InspectionResponseResult.NOT_APPLICABLE,
    ]),
    responseText: z.string().max(5000).optional(),
    numericValue: z.number().finite().optional(),
    booleanValue: z.boolean().optional(),
    score: z.number().finite().min(0).max(100).optional(),
    comments: z.string().max(5000).optional(),
    createFinding: z.boolean().default(false),
    findingTitle: z.string().max(200).optional(),
    findingDescription: z.string().max(5000).optional(),
    findingRiskLevel: z.nativeEnum(RiskLevel).optional(),
    findingDueDate: z.string().datetime().optional(),
  }),
});

const auditStartItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("AUDIT_START"),
  capturedAt: z.string().datetime(),
  payload: z.object({
    auditId: z.string().min(1),
  }),
});

const auditResponseItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("AUDIT_RESPONSE"),
  capturedAt: z.string().datetime(),
  payload: z.object({
    auditId: z.string().min(1),
    questionId: z.string().min(1),
    result: z.enum([
      EnterpriseAuditResponseResult.PASS,
      EnterpriseAuditResponseResult.FAIL,
      EnterpriseAuditResponseResult.YES,
      EnterpriseAuditResponseResult.NO,
      EnterpriseAuditResponseResult.COMPLIANT,
      EnterpriseAuditResponseResult.NON_COMPLIANT,
      EnterpriseAuditResponseResult.PARTIALLY_COMPLIANT,
      EnterpriseAuditResponseResult.NOT_APPLICABLE,
      EnterpriseAuditResponseResult.OBSERVATION,
      EnterpriseAuditResponseResult.INFORMATION_ONLY,
    ]),
    responseText: z.string().max(5000).optional(),
    numericValue: z.number().finite().optional(),
    booleanValue: z.boolean().optional(),
    selectedOptionValues: z.array(z.string().min(1).max(500)).max(100).default([]),
    comments: z.string().max(5000).optional(),
    evidenceNote: z.string().max(5000).optional(),
    evidenceUrl: z.string().url().max(2000)
      .refine((value) => URL.canParse(value) && new URL(value).protocol === "https:", "Evidence URL must use HTTPS.")
      .optional(),
  }),
});

const capaStatusItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("CAPA_STATUS"),
  capturedAt: z.string().datetime(),
  payload: z.object({
    actionId: z.string().min(1).max(200),
    status: z.nativeEnum(Status),
    comments: z.string().trim().max(5000).optional(),
  }),
});

const dateOnly = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  "Use a YYYY-MM-DD date."
).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value;
}, "Enter a valid calendar date.");

const riskCaptureItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("RISK_CAPTURE"),
  capturedAt: z.string().datetime(),
  payload: z.object({
    siteId: z.string().min(1).max(200),
    departmentId: z.string().min(1).max(200).optional(),
    title: z.string().trim().min(2).max(200),
    description: z.string().trim().min(2).max(5000),
    category: z.nativeEnum(RiskCategory),
    hazardType: z.string().trim().max(300).optional(),
    process: z.string().trim().max(300).optional(),
    initialLikelihood: z.nativeEnum(RiskLikelihood),
    initialImpact: z.nativeEnum(RiskImpact),
    residualLikelihood: z.nativeEnum(RiskLikelihood),
    residualImpact: z.nativeEnum(RiskImpact),
    reviewFrequency: z.nativeEnum(RiskReviewFrequency),
    nextReviewDate: dateOnly.optional(),
  }),
});

const riskReviewItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("RISK_REVIEW"),
  capturedAt: z.string().datetime(),
  payload: z.object({
    riskId: z.string().min(1).max(200),
    likelihood: z.nativeEnum(RiskLikelihood),
    impact: z.nativeEnum(RiskImpact),
    controlEffectiveness: z.nativeEnum(RiskControlEffectiveness).optional(),
    trend: z.enum(["IMPROVING", "STABLE", "DETERIORATING"]).optional(),
    notes: z.string().trim().max(5000).optional(),
    nextReviewDate: dateOnly.optional(),
  }),
});

const jsaAcknowledgmentItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("JSA_ACKNOWLEDGMENT"),
  capturedAt: z.string().datetime(),
  payload: z.object({
    jsaId: z.string().min(1).max(200),
    statement: z.string().trim().min(5).max(1000),
  }),
});

const httpsUrl = z.string().url().max(2000)
  .refine(
    (value) => URL.canParse(value) && new URL(value).protocol === "https:",
    "Evidence URL must use HTTPS."
  );

const complianceCompletionItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("COMPLIANCE_COMPLETION"),
  capturedAt: z.string().datetime(),
  payload: z.object({
    occurrenceId: z.string().min(1).max(200),
    completionNotes: z.string().trim().max(5000).optional(),
    evidenceUrl: httpsUrl.optional(),
  }),
});

const complianceReviewItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("COMPLIANCE_REVIEW"),
  capturedAt: z.string().datetime(),
  payload: z.object({
    occurrenceId: z.string().min(1).max(200),
    decision: z.enum(["APPROVE", "REJECT"]),
    reviewNotes: z.string().trim().max(5000).optional(),
  }),
});

const trainingProgressItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("TRAINING_PROGRESS"),
  capturedAt: z.string().datetime(),
  payload: z.object({
    trainingRecordId: z.string().min(1).max(200),
    notes: z.string().trim().max(5000).optional(),
  }),
});

const trainingCompletionItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("TRAINING_COMPLETION"),
  capturedAt: z.string().datetime(),
  payload: z.object({
    trainingRecordId: z.string().min(1).max(200),
    completedAt: dateOnly,
    certificateNumber: z.string().trim().max(300).optional(),
    score: z.number().finite().min(0).max(100).optional(),
    notes: z.string().trim().max(5000).optional(),
  }),
});

const mocStatusItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("MOC_STATUS"),
  capturedAt: z.string().datetime(),
  payload: z.object({
    mocId: z.string().min(1).max(200),
    status: z.nativeEnum(MocStatus),
    comments: z.string().trim().max(5000).optional(),
  }),
});

const mocApprovalDecisionItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("MOC_APPROVAL_DECISION"),
  capturedAt: z.string().datetime(),
  payload: z.object({
    mocId: z.string().min(1).max(200),
    approvalId: z.string().min(1).max(200),
    status: z.enum([
      MocApprovalStatus.APPROVED,
      MocApprovalStatus.REJECTED,
    ]),
    comments: z.string().trim().max(5000).optional(),
  }),
});

const mocTaskStatusItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("MOC_TASK_STATUS"),
  capturedAt: z.string().datetime(),
  payload: z.object({
    mocId: z.string().min(1).max(200),
    taskId: z.string().min(1).max(200),
    status: z.nativeEnum(MocTaskStatus),
    evidenceNote: z.string().trim().max(5000).optional(),
  }),
});

const permitStatusItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("PERMIT_STATUS"),
  capturedAt: z.string().datetime(),
  payload: z.object({
    permitId: z.string().min(1).max(200),
    status: z.nativeEnum(PermitToWorkStatus),
    comments: z.string().trim().max(5000).optional(),
    closeoutNotes: z.string().trim().max(5000).optional(),
  }),
});

const permitControlItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("PERMIT_CONTROL"),
  capturedAt: z.string().datetime(),
  payload: z.object({
    permitId: z.string().min(1).max(200),
    controlId: z.string().min(1).max(200),
    verified: z.boolean(),
  }),
});

const permitGasTestItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("PERMIT_GAS_TEST"),
  capturedAt: z.string().datetime(),
  payload: z.object({
    permitId: z.string().min(1).max(200),
    oxygenPercent: z.number().finite().min(0).max(100).optional(),
    lelPercent: z.number().finite().min(0).optional(),
    h2sPpm: z.number().finite().min(0).optional(),
    coPpm: z.number().finite().min(0).optional(),
    result: z.nativeEnum(PermitGasTestResult),
    notes: z.string().trim().max(5000).optional(),
  }),
});

const assetStatusItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("ASSET_STATUS"),
  capturedAt: z.string().datetime(),
  payload: z.object({
    assetId: z.string().min(1).max(200),
    status: z.nativeEnum(AssetStatus),
    reason: z.string().trim().min(2).max(5000),
  }),
});

const assetInspectionItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("ASSET_INSPECTION"),
  capturedAt: z.string().datetime(),
  payload: z.object({
    assetId: z.string().min(1).max(200),
    inspectedAt: z.string().datetime(),
    result: z.enum([
      AssetInspectionResult.SATISFACTORY,
      AssetInspectionResult.DEFECT_FOUND,
      AssetInspectionResult.OUT_OF_SERVICE,
    ]),
    conditionScore: z.number().int().min(1).max(5).optional(),
    evidenceReference: z.string().trim().max(5000).optional(),
    observations: z.string().trim().max(5000).optional(),
    immediateAction: z.string().trim().max(5000).optional(),
    customForms: z.array(capturedFormSchema).max(20).default([]),
  }),
});

const assetDefectItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("ASSET_DEFECT"),
  capturedAt: z.string().datetime(),
  payload: z.object({
    assetId: z.string().min(1).max(200),
    title: z.string().trim().min(2).max(200),
    description: z.string().trim().min(2).max(5000),
    severity: z.nativeEnum(RiskLevel),
    ownerId: z.string().min(1).max(200).optional(),
    dueDate: dateOnly.optional(),
    immediateControls: z.string().trim().max(5000).optional(),
  }),
});

const assetDefectStatusItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("ASSET_DEFECT_STATUS"),
  capturedAt: z.string().datetime(),
  payload: z.object({
    defectId: z.string().min(1).max(200),
    status: z.nativeEnum(AssetDefectStatus),
    repairPlan: z.string().trim().max(5000).optional(),
    verificationEvidence: z.string().trim().max(5000).optional(),
  }),
});

const assetMaintenanceStatusItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("ASSET_MAINTENANCE_STATUS"),
  capturedAt: z.string().datetime(),
  payload: z.object({
    recordId: z.string().min(1).max(200),
    status: z.enum([
      AssetMaintenanceStatus.IN_PROGRESS,
      AssetMaintenanceStatus.CANCELLED,
    ]),
    reason: z.string().trim().min(2).max(5000),
  }),
});

const assetMaintenanceCompletionItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("ASSET_MAINTENANCE_COMPLETE"),
  capturedAt: z.string().datetime(),
  payload: z.object({
    recordId: z.string().min(1).max(200),
    completedAt: z.string().datetime(),
    workSummary: z.string().trim().min(2).max(5000),
    evidenceReference: z.string().trim().min(1).max(5000),
    downtimeHours: z.number().finite().min(0).max(100000).optional(),
  }),
});

const contractorStatusItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("CONTRACTOR_STATUS"),
  capturedAt: z.string().datetime(),
  payload: z.object({
    contractorId: z.string().min(1).max(200),
    status: z.nativeEnum(ContractorStatus),
    reason: z.string().trim().max(5000).optional(),
  }),
});

const hygieneAssessmentStatusItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("IH_ASSESSMENT_STATUS"),
  capturedAt: z.string().datetime(),
  payload: z.object({
    assessmentId: z.string().min(1).max(200),
    status: z.nativeEnum(ExposureAssessmentStatus),
    observations: z.string().trim().max(5000).optional(),
    conclusions: z.string().trim().max(5000).optional(),
    recommendations: z.string().trim().max(5000).optional(),
  }),
});

const hygieneSampleItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("IH_SAMPLE"),
  capturedAt: z.string().datetime(),
  payload: z.object({
    assessmentId: z.string().min(1).max(200),
    agentId: z.string().min(1).max(200),
    sampleType: z.nativeEnum(ExposureSampleType),
    sampleReference: z.string().trim().max(200).optional(),
    sampledWorkerId: z.string().min(1).max(200).optional(),
    location: z.string().trim().max(300).optional(),
    task: z.string().trim().max(500).optional(),
    sampledAt: z.string().datetime(),
    durationMinutes: z.number().int().positive().max(100_000).optional(),
    resultValue: z.number().finite().nonnegative().optional(),
    reportingLimit: z.number().finite().nonnegative().optional(),
    occupationalLimit: z.number().finite().nonnegative().optional(),
    actionLevel: z.number().finite().nonnegative().optional(),
    unit: z.string().trim().max(100).optional(),
    laboratory: z.string().trim().max(300).optional(),
    analyticalMethod: z.string().trim().max(500).optional(),
    analyzedAt: z.string().datetime().optional(),
    notes: z.string().trim().max(5000).optional(),
  }),
});

const hygieneFormsItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("IH_FORMS"),
  capturedAt: z.string().datetime(),
  payload: z.object({
    assessmentId: z.string().min(1).max(200),
    customForms: z.array(capturedFormSchema).min(1).max(20),
  }),
});

const surveillanceProgramStatusItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("OH_PROGRAM_STATUS"),
  capturedAt: z.string().datetime(),
  payload: z.object({
    programId: z.string().min(1).max(200),
    status: z.nativeEnum(SurveillanceProgramStatus),
  }),
});

const surveillanceEnrollmentItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("OH_ENROLLMENT"),
  capturedAt: z.string().datetime(),
  payload: z.object({
    programId: z.string().min(1).max(200),
    enrolledUserId: z.string().min(1).max(200),
    nextDueAt: dateOnly,
    notes: z.string().trim().max(1000).optional(),
  }),
});

const surveillanceCompletionItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("OH_ENROLLMENT_COMPLETE"),
  capturedAt: z.string().datetime(),
  payload: z.object({
    enrollmentId: z.string().min(1).max(200),
    completedAt: dateOnly,
    fitnessOutcome: z.enum([
      FitnessOutcome.CLEARED,
      FitnessOutcome.CLEARED_WITH_RESTRICTIONS,
      FitnessOutcome.TEMPORARILY_NOT_CLEARED,
    ]),
    workRestrictions: z.string().trim().max(2000).optional(),
    certificateReference: z.string().trim().max(500).optional(),
    notes: z.string().trim().max(1000).optional(),
  }).superRefine((value, context) => {
    if (
      (
        value.fitnessOutcome === FitnessOutcome.CLEARED_WITH_RESTRICTIONS ||
        value.fitnessOutcome === FitnessOutcome.TEMPORARILY_NOT_CLEARED
      ) &&
      !value.workRestrictions
    ) {
      context.addIssue({
        code: "custom",
        path: ["workRestrictions"],
        message: "Provider-issued work restrictions are required for this outcome.",
      });
    }
  }),
});

const surveillanceRemovalItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("OH_ENROLLMENT_REMOVE"),
  capturedAt: z.string().datetime(),
  payload: z.object({
    enrollmentId: z.string().min(1).max(200),
    reason: z.string().trim().min(2).max(1000),
  }),
});

const offlineItemSchema = z.discriminatedUnion("type", [
  observationItemSchema,
  incidentItemSchema,
  inspectionResponseItemSchema,
  auditStartItemSchema,
  auditResponseItemSchema,
  capaStatusItemSchema,
  riskCaptureItemSchema,
  riskReviewItemSchema,
  jsaAcknowledgmentItemSchema,
  complianceCompletionItemSchema,
  complianceReviewItemSchema,
  trainingProgressItemSchema,
  trainingCompletionItemSchema,
  mocStatusItemSchema,
  mocApprovalDecisionItemSchema,
  mocTaskStatusItemSchema,
  permitStatusItemSchema,
  permitControlItemSchema,
  permitGasTestItemSchema,
  assetStatusItemSchema,
  assetInspectionItemSchema,
  assetDefectItemSchema,
  assetDefectStatusItemSchema,
  assetMaintenanceStatusItemSchema,
  assetMaintenanceCompletionItemSchema,
  contractorStatusItemSchema,
  hygieneAssessmentStatusItemSchema,
  hygieneSampleItemSchema,
  hygieneFormsItemSchema,
  surveillanceProgramStatusItemSchema,
  surveillanceEnrollmentItemSchema,
  surveillanceCompletionItemSchema,
  surveillanceRemovalItemSchema,
]);

export const offlineSyncRequestSchema = z.object({
  items: z.array(offlineItemSchema).min(1).max(50),
});

type OfflineItem = z.infer<typeof offlineItemSchema>;
type SyncResult = {
  id: string;
  status: string;
  recordId?: string;
  error?: string;
};

export function requiredOfflinePermission(
  type: OfflineItem["type"],
  status?: Status
) {
  if (type === "SAFETY_OBSERVATION") return PermissionKey.CREATE_OBSERVATION;
  if (type === "INCIDENT") return PermissionKey.CREATE_INCIDENT;
  if (type === "INSPECTION_RESPONSE") return PermissionKey.MANAGE_INSPECTIONS;
  if (type === "RISK_CAPTURE" || type === "RISK_REVIEW") {
    return PermissionKey.MANAGE_RISKS;
  }
  if (type === "JSA_ACKNOWLEDGMENT") return PermissionKey.VIEW_RISKS;
  if (type === "COMPLIANCE_COMPLETION") return PermissionKey.VIEW_COMPLIANCE;
  if (type === "COMPLIANCE_REVIEW") return PermissionKey.MANAGE_COMPLIANCE;
  if (type === "TRAINING_PROGRESS") return PermissionKey.VIEW_TRAINING;
  if (type === "TRAINING_COMPLETION") return PermissionKey.MANAGE_TRAINING;
  if (
    type === "MOC_STATUS" ||
    type === "MOC_APPROVAL_DECISION" ||
    type === "MOC_TASK_STATUS"
  ) {
    return PermissionKey.MANAGE_MOC;
  }
  if (
    type === "PERMIT_STATUS" ||
    type === "PERMIT_CONTROL" ||
    type === "PERMIT_GAS_TEST"
  ) {
    return PermissionKey.MANAGE_PERMITS_TO_WORK;
  }
  if (
    type === "ASSET_STATUS" ||
    type === "ASSET_INSPECTION" ||
    type === "ASSET_DEFECT" ||
    type === "ASSET_DEFECT_STATUS" ||
    type === "ASSET_MAINTENANCE_STATUS" ||
    type === "ASSET_MAINTENANCE_COMPLETE"
  ) {
    return PermissionKey.MANAGE_ASSETS;
  }
  if (type === "CONTRACTOR_STATUS") {
    return PermissionKey.MANAGE_CONTRACTORS;
  }
  if (
    type === "IH_ASSESSMENT_STATUS" ||
    type === "IH_SAMPLE" ||
    type === "IH_FORMS"
  ) {
    return PermissionKey.MANAGE_INDUSTRIAL_HYGIENE;
  }
  if (
    type === "OH_PROGRAM_STATUS" ||
    type === "OH_ENROLLMENT" ||
    type === "OH_ENROLLMENT_COMPLETE" ||
    type === "OH_ENROLLMENT_REMOVE"
  ) {
    return PermissionKey.MANAGE_OCCUPATIONAL_HEALTH;
  }
  if (type === "CAPA_STATUS") {
    return status === Status.COMPLETED || status === Status.CLOSED
      ? PermissionKey.CLOSE_CAPA
      : PermissionKey.UPDATE_CAPA;
  }
  return PermissionKey.MANAGE_AUDITS;
}

export async function syncOfflineSubmissionsService(input: {
  organizationId: string;
  userId: string;
  departmentId: string | null;
  role: UserRole;
  request: unknown;
}) {
  const parsed = offlineSyncRequestSchema.safeParse(input.request);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400,
      body: {
        error: "Invalid offline submission",
        details: parsed.error.flatten(),
      },
    };
  }

  try {
    await requireSubscriptionFeature(input.organizationId, "OFFLINE_COLLECTION");
  } catch {
    return {
      ok: false as const,
      status: 403,
      body: { error: "Offline collection is not included in this subscription." },
    };
  }

  const granted = input.role === UserRole.SUPER_ADMIN
    ? new Set(Object.values(PermissionKey))
    : new Set(
        (await prisma.rolePermission.findMany({
          where: { role: input.role },
          select: { permission: true },
        })).map((row) => row.permission)
      );

  const results: SyncResult[] = [];
  for (const item of parsed.data.items) {
    const requiredPermission = requiredOfflinePermission(
      item.type,
      item.type === "CAPA_STATUS" ? item.payload.status : undefined
    );
    if (!granted.has(requiredPermission)) {
      results.push({ id: item.id, status: "failed", error: "Your role cannot synchronize this record type." });
      continue;
    }

    const existing = await prisma.offlineSubmission.findUnique({ where: { id: item.id } });
    if (existing) {
      results.push(
        existing.organizationId === input.organizationId && existing.userId === input.userId
          ? { id: item.id, status: "already_synced", recordId: existing.recordId }
          : { id: item.id, status: "failed", error: "Submission identifier is unavailable." }
      );
      continue;
    }

    const payloadHash = createHash("sha256")
      .update(`${item.type}:${JSON.stringify(item.payload)}`)
      .digest("hex");

    try {
      if (item.type === "SAFETY_OBSERVATION") {
        results.push(await syncObservation(input, item, payloadHash));
      } else if (item.type === "INCIDENT") {
        results.push(await syncIncident(input, item, payloadHash));
      } else if (item.type === "INSPECTION_RESPONSE") {
        results.push(await syncInspectionResponse(input, item, payloadHash));
      } else if (item.type === "AUDIT_START") {
        results.push(await syncAuditStart(input, item, payloadHash));
      } else if (item.type === "AUDIT_RESPONSE") {
        results.push(await syncAuditResponse(input, item, payloadHash));
      } else if (item.type === "CAPA_STATUS") {
        results.push(await syncCapaStatus(input, item, payloadHash));
      } else if (item.type === "RISK_CAPTURE") {
        results.push(await syncRiskCapture(input, item, payloadHash));
      } else if (item.type === "RISK_REVIEW") {
        results.push(await syncRiskReview(input, item, payloadHash));
      } else if (item.type === "JSA_ACKNOWLEDGMENT") {
        results.push(await syncJsaAcknowledgment(input, item, payloadHash));
      } else if (item.type === "COMPLIANCE_COMPLETION") {
        results.push(await syncComplianceCompletion(
          {
            organizationId: input.organizationId,
            userId: input.userId,
            canManageCompliance: granted.has(PermissionKey.MANAGE_COMPLIANCE),
          },
          item,
          payloadHash
        ));
      } else if (item.type === "COMPLIANCE_REVIEW") {
        results.push(await syncComplianceReview(input, item, payloadHash));
      } else if (item.type === "TRAINING_PROGRESS") {
        results.push(await syncTrainingProgress(
          {
            organizationId: input.organizationId,
            userId: input.userId,
            canManageTraining: granted.has(PermissionKey.MANAGE_TRAINING),
          },
          item,
          payloadHash
        ));
      } else if (item.type === "TRAINING_COMPLETION") {
        results.push(await syncTrainingCompletion(input, item, payloadHash));
      } else if (item.type === "MOC_STATUS") {
        results.push(await syncMocStatus(input, item, payloadHash));
      } else if (item.type === "MOC_APPROVAL_DECISION") {
        results.push(await syncMocApprovalDecision(input, item, payloadHash));
      } else if (item.type === "MOC_TASK_STATUS") {
        results.push(await syncMocTaskStatus(input, item, payloadHash));
      } else if (item.type === "PERMIT_STATUS") {
        results.push(await syncPermitStatus(input, item, payloadHash));
      } else if (item.type === "PERMIT_CONTROL") {
        results.push(await syncPermitControl(input, item, payloadHash));
      } else if (item.type === "PERMIT_GAS_TEST") {
        results.push(await syncPermitGasTest(input, item, payloadHash));
      } else if (item.type === "ASSET_STATUS") {
        results.push(await syncAssetStatus(input, item, payloadHash));
      } else if (item.type === "ASSET_INSPECTION") {
        results.push(await syncAssetInspection(input, item, payloadHash));
      } else if (item.type === "ASSET_DEFECT") {
        results.push(await syncAssetDefect(input, item, payloadHash));
      } else if (item.type === "ASSET_DEFECT_STATUS") {
        results.push(await syncAssetDefectStatus(input, item, payloadHash));
      } else if (item.type === "ASSET_MAINTENANCE_STATUS") {
        results.push(await syncAssetMaintenanceStatus(input, item, payloadHash));
      } else if (item.type === "ASSET_MAINTENANCE_COMPLETE") {
        results.push(await syncAssetMaintenanceCompletion(input, item, payloadHash));
      } else if (item.type === "CONTRACTOR_STATUS") {
        results.push(await syncContractorStatus(input, item, payloadHash));
      } else if (item.type === "IH_ASSESSMENT_STATUS") {
        results.push(await syncHygieneAssessmentStatus(input, item, payloadHash));
      } else if (item.type === "IH_SAMPLE") {
        results.push(await syncHygieneSample(input, item, payloadHash));
      } else if (item.type === "IH_FORMS") {
        results.push(await syncHygieneForms(input, item, payloadHash));
      } else if (item.type === "OH_PROGRAM_STATUS") {
        results.push(await syncSurveillanceProgramStatus(input, item, payloadHash));
      } else if (item.type === "OH_ENROLLMENT") {
        results.push(await syncSurveillanceEnrollment(input, item, payloadHash));
      } else if (item.type === "OH_ENROLLMENT_COMPLETE") {
        results.push(await syncSurveillanceCompletion(input, item, payloadHash));
      } else {
        results.push(await syncSurveillanceRemoval(input, item, payloadHash));
      }
    } catch (error) {
      results.push({ id: item.id, status: "failed", error: safeOfflineError(error) });
    }
  }

  return { ok: true as const, status: 200, body: { results } };
}

async function syncObservation(
  actor: { organizationId: string; userId: string; departmentId: string | null },
  item: z.infer<typeof observationItemSchema>,
  payloadHash: string
): Promise<SyncResult> {
  const site = await prisma.site.findFirst({
    where: { id: item.payload.siteId, organizationId: actor.organizationId },
    select: { id: true },
  });
  if (!site) return { id: item.id, status: "failed", error: "Site is not available to this tenant." };

  const capturedAt = new Date(item.capturedAt);
  const submissions = await prepareCapturedFormSubmissions({
    organizationId: actor.organizationId,
    module: ConfigurableFormModule.OBSERVATION,
    capturedAt,
    forms: item.payload.customForms,
  });
  const observation = await prisma.$transaction(async (tx) => {
    const created = await tx.safetyObservation.create({
      data: {
        organizationId: actor.organizationId,
        siteId: site.id,
        departmentId: actor.departmentId,
        reportedById: actor.userId,
        reference: `OBS-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
        title: item.payload.title,
        description: item.payload.description,
        type: item.payload.type,
        riskLevel: item.payload.riskLevel,
        location: item.payload.location || null,
        immediateAction: item.payload.immediateAction || null,
        observedAt: new Date(item.payload.observedAt),
        isAnonymous: item.payload.isAnonymous,
      },
    });
    await createPreparedSubmissions(tx, {
      organizationId: actor.organizationId,
      userId: actor.userId,
      module: ConfigurableFormModule.OBSERVATION,
      entityId: created.id,
      submissions,
    });
    await tx.offlineSubmission.create({
      data: {
        id: item.id,
        organizationId: actor.organizationId,
        userId: actor.userId,
        recordType: item.type,
        recordId: created.id,
        capturedAt,
        payloadHash,
      },
    });
    await tx.activityLog.create({
      data: {
        organizationId: actor.organizationId,
        userId: actor.userId,
        action: ActivityAction.CREATE,
        entityType: "SafetyObservation",
        entityId: created.id,
        title: "Offline safety observation synchronized",
        description: created.title,
        metadata: { offlineSubmissionId: item.id, customFormCount: submissions.length },
      },
    });
    return created;
  });
  return { id: item.id, status: "synced", recordId: observation.id };
}

async function syncIncident(
  actor: { organizationId: string; userId: string },
  item: z.infer<typeof incidentItemSchema>,
  payloadHash: string
): Promise<SyncResult> {
  const capturedAt = new Date(item.capturedAt);
  const submissions = await prepareCapturedFormSubmissions({
    organizationId: actor.organizationId,
    module: ConfigurableFormModule.INCIDENT,
    capturedAt,
    forms: item.payload.customForms,
  });
  const incident = await createIncidentService({
    organizationId: actor.organizationId,
    userId: actor.userId,
    title: item.payload.title,
    description: item.payload.description,
    type: item.payload.type,
    riskLevel: item.payload.riskLevel,
    siteId: item.payload.siteId,
    location: item.payload.location || "",
    occurredAt: new Date(item.payload.occurredAt),
    customSubmissions: submissions,
    offlineSubmission: { id: item.id, capturedAt, payloadHash },
  });
  return { id: item.id, status: "synced", recordId: incident.id };
}

async function syncInspectionResponse(
  actor: { organizationId: string; userId: string; role: UserRole },
  item: z.infer<typeof inspectionResponseItemSchema>,
  payloadHash: string
): Promise<SyncResult> {
  const inspection = await prisma.inspection.findFirst({
    where: {
      id: item.payload.inspectionId,
      site: { organizationId: actor.organizationId },
      status: { notIn: [Status.COMPLETED, Status.CLOSED] },
      ...(actor.role === UserRole.SUPER_ADMIN
        ? {}
        : {
            OR: [
              { leadInspectorId: actor.userId },
              { teamMembers: { some: { userId: actor.userId } } },
            ],
          }),
    },
    select: { id: true },
  });
  if (!inspection) {
    return { id: item.id, status: "failed", error: "This inspection is not active and assigned to you." };
  }

  const response = await saveInspectionResponseService({
    organizationId: actor.organizationId,
    userId: actor.userId,
    inspectionId: inspection.id,
    checklistItemId: item.payload.checklistItemId,
    result: item.payload.result,
    responseText: item.payload.responseText || null,
    numericValue: item.payload.numericValue ?? null,
    booleanValue: item.payload.booleanValue ?? null,
    score: item.payload.score ?? null,
    comments: item.payload.comments || null,
    createFinding: item.payload.createFinding,
    findingTitle: item.payload.findingTitle || null,
    findingDescription: item.payload.findingDescription || null,
    findingRiskLevel: item.payload.findingRiskLevel || null,
    findingDueDate: item.payload.findingDueDate ? new Date(item.payload.findingDueDate) : null,
    offlineSubmission: {
      id: item.id,
      capturedAt: new Date(item.capturedAt),
      payloadHash,
    },
  });
  return { id: item.id, status: "synced", recordId: response.id };
}

const auditManagementRoles = new Set<UserRole>([
  UserRole.SUPER_ADMIN,
  UserRole.ORG_ADMIN,
  UserRole.EHS_MANAGER,
]);

async function syncAuditStart(
  actor: { organizationId: string; userId: string; role: UserRole },
  item: z.infer<typeof auditStartItemSchema>,
  payloadHash: string
): Promise<SyncResult> {
  const editableAudit = await prisma.enterpriseAudit.findFirst({
    where: {
      id: item.payload.auditId,
      organizationId: actor.organizationId,
      ...(auditManagementRoles.has(actor.role)
        ? {}
        : {
            OR: [
              { leadAuditorId: actor.userId },
              { teamMembers: { some: { userId: actor.userId, canEdit: true } } },
            ],
          }),
    },
    select: { id: true, status: true },
  });
  if (!editableAudit) {
    return { id: item.id, status: "failed", error: "This Audit is not assigned to you for execution." };
  }

  const capturedAt = new Date(item.capturedAt);
  if (editableAudit.status === EnterpriseAuditStatus.IN_PROGRESS) {
    await prisma.offlineSubmission.create({
      data: {
        id: item.id,
        organizationId: actor.organizationId,
        userId: actor.userId,
        recordType: item.type,
        recordId: editableAudit.id,
        capturedAt,
        payloadHash,
      },
    });
    return { id: item.id, status: "synced", recordId: editableAudit.id };
  }

  const audit = await startAuditExecutionService({
    organizationId: actor.organizationId,
    userId: actor.userId,
    userRole: actor.role,
    auditId: editableAudit.id,
    offlineSubmission: { id: item.id, capturedAt, payloadHash },
  });
  return { id: item.id, status: "synced", recordId: audit.id };
}

async function syncAuditResponse(
  actor: { organizationId: string; userId: string; role: UserRole },
  item: z.infer<typeof auditResponseItemSchema>,
  payloadHash: string
): Promise<SyncResult> {
  const recordId = await recordAuditResponseService({
    organizationId: actor.organizationId,
    userId: actor.userId,
    userRole: actor.role,
    auditId: item.payload.auditId,
    questionId: item.payload.questionId,
    result: item.payload.result,
    responseText: item.payload.responseText || null,
    numericValue: item.payload.numericValue ?? null,
    booleanValue: item.payload.booleanValue ?? null,
    selectedOptionValues: item.payload.selectedOptionValues,
    comments: item.payload.comments || null,
    evidenceNote: item.payload.evidenceNote || null,
    evidenceUrl: item.payload.evidenceUrl || null,
    offlineSubmission: {
      id: item.id,
      capturedAt: new Date(item.capturedAt),
      payloadHash,
    },
  });
  return { id: item.id, status: "synced", recordId };
}

async function syncCapaStatus(
  actor: { organizationId: string; userId: string },
  item: z.infer<typeof capaStatusItemSchema>,
  payloadHash: string
): Promise<SyncResult> {
  const action = await updateCapaStatusService({
    organizationId: actor.organizationId,
    userId: actor.userId,
    actionId: item.payload.actionId,
    status: item.payload.status,
    comments: item.payload.comments || null,
    offlineSubmission: {
      id: item.id,
      capturedAt: new Date(item.capturedAt),
      payloadHash,
    },
  });
  return { id: item.id, status: "synced", recordId: action.id };
}

async function syncRiskCapture(
  actor: { organizationId: string; userId: string },
  item: z.infer<typeof riskCaptureItemSchema>,
  payloadHash: string
): Promise<SyncResult> {
  const capturedAt = new Date(item.capturedAt);
  const risk = await createRiskService({
    organizationId: actor.organizationId,
    userId: actor.userId,
    title: item.payload.title,
    description: item.payload.description,
    category: item.payload.category,
    hazardType: item.payload.hazardType || null,
    process: item.payload.process || null,
    siteId: item.payload.siteId,
    departmentId: item.payload.departmentId || null,
    ownerId: actor.userId,
    initialLikelihood: item.payload.initialLikelihood,
    initialImpact: item.payload.initialImpact,
    currentLikelihood: item.payload.initialLikelihood,
    currentImpact: item.payload.initialImpact,
    residualLikelihood: item.payload.residualLikelihood,
    residualImpact: item.payload.residualImpact,
    reviewFrequency: item.payload.reviewFrequency,
    nextReviewDate: parseFutureReviewDate(
      item.payload.nextReviewDate,
      capturedAt
    ),
    offlineSubmission: {
      id: item.id,
      capturedAt,
      payloadHash,
    },
  });
  return { id: item.id, status: "synced", recordId: risk.id };
}

async function syncRiskReview(
  actor: { organizationId: string; userId: string },
  item: z.infer<typeof riskReviewItemSchema>,
  payloadHash: string
): Promise<SyncResult> {
  const capturedAt = new Date(item.capturedAt);
  const review = await createRiskReviewService({
    organizationId: actor.organizationId,
    userId: actor.userId,
    riskId: item.payload.riskId,
    likelihood: item.payload.likelihood,
    impact: item.payload.impact,
    controlEffectiveness:
      item.payload.controlEffectiveness ?? null,
    trend: item.payload.trend ?? null,
    notes: item.payload.notes || null,
    nextReviewDate: parseFutureReviewDate(
      item.payload.nextReviewDate,
      capturedAt
    ),
    offlineSubmission: {
      id: item.id,
      capturedAt,
      payloadHash,
    },
  });
  return { id: item.id, status: "synced", recordId: review.id };
}

async function syncJsaAcknowledgment(
  actor: { organizationId: string; userId: string },
  item: z.infer<typeof jsaAcknowledgmentItemSchema>,
  payloadHash: string
): Promise<SyncResult> {
  const jsa = await prisma.jobSafetyAnalysis.findFirst({
    where: {
      id: item.payload.jsaId,
      organizationId: actor.organizationId,
      status: JsaStatus.ACTIVE,
    },
    select: {
      id: true,
      reference: true,
      title: true,
    },
  });
  if (!jsa) {
    return {
      id: item.id,
      status: "failed",
      error: "Only an active JSA in this organization can be acknowledged.",
    };
  }

  const acknowledgedAt = new Date(item.capturedAt);
  const acknowledgment = await prisma.$transaction(async (transaction) => {
    const record = await transaction.jsaAcknowledgment.upsert({
      where: {
        jsaId_userId: {
          jsaId: jsa.id,
          userId: actor.userId,
        },
      },
      update: {
        acknowledgedAt,
        statement: item.payload.statement,
      },
      create: {
        jsaId: jsa.id,
        userId: actor.userId,
        acknowledgedAt,
        statement: item.payload.statement,
      },
    });
    await transaction.offlineSubmission.create({
      data: {
        id: item.id,
        organizationId: actor.organizationId,
        userId: actor.userId,
        recordType: item.type,
        recordId: record.id,
        capturedAt: acknowledgedAt,
        payloadHash,
      },
    });
    await transaction.activityLog.create({
      data: {
        organizationId: actor.organizationId,
        userId: actor.userId,
        action: ActivityAction.UPDATE,
        entityType: "JobSafetyAnalysis",
        entityId: jsa.id,
        title: "JSA acknowledged from mobile",
        description: `${jsa.reference}: ${jsa.title}`,
        metadata: {
          offlineSubmissionId: item.id,
          acknowledgmentId: record.id,
          acknowledgedAt: acknowledgedAt.toISOString(),
        },
      },
    });
    return record;
  });
  return {
    id: item.id,
    status: "synced",
    recordId: acknowledgment.id,
  };
}

const completableComplianceStatuses =
  new Set<ComplianceCalendarOccurrenceStatus>([
    ComplianceCalendarOccurrenceStatus.UPCOMING,
    ComplianceCalendarOccurrenceStatus.DUE,
    ComplianceCalendarOccurrenceStatus.IN_PROGRESS,
    ComplianceCalendarOccurrenceStatus.REJECTED,
    ComplianceCalendarOccurrenceStatus.OVERDUE,
  ]);

async function syncComplianceCompletion(
  actor: {
    organizationId: string;
    userId: string;
    canManageCompliance: boolean;
  },
  item: z.infer<typeof complianceCompletionItemSchema>,
  payloadHash: string
): Promise<SyncResult> {
  const occurrence = await prisma.complianceCalendarOccurrence.findFirst({
    where: {
      id: item.payload.occurrenceId,
      organizationId: actor.organizationId,
    },
    include: {
      task: {
        select: {
          title: true,
          evidenceRequired: true,
          approvalRequired: true,
        },
      },
    },
  });
  if (!occurrence) {
    return {
      id: item.id,
      status: "failed",
      error: "Compliance calendar task not found in this organization.",
    };
  }
  if (
    occurrence.assignedToId !== actor.userId &&
    !actor.canManageCompliance
  ) {
    return {
      id: item.id,
      status: "failed",
      error: "Only the assignee or a compliance manager can complete this task.",
    };
  }
  if (!completableComplianceStatuses.has(occurrence.status)) {
    return {
      id: item.id,
      status: "failed",
      error: "This compliance task is no longer available for completion.",
    };
  }
  const completionNotes = item.payload.completionNotes?.trim() || null;
  const evidenceUrl = item.payload.evidenceUrl || null;
  if (occurrence.task.evidenceRequired && !completionNotes && !evidenceUrl) {
    return {
      id: item.id,
      status: "failed",
      error: "Completion evidence or notes are required.",
    };
  }

  const capturedAt = new Date(item.capturedAt);
  const updated = await prisma.$transaction(async (transaction) => {
    const record = await transaction.complianceCalendarOccurrence.update({
      where: { id: occurrence.id },
      data: {
        completionNotes,
        evidenceUrl,
        completedAt: capturedAt,
        completedById: actor.userId,
        status: occurrence.task.approvalRequired
          ? ComplianceCalendarOccurrenceStatus.SUBMITTED
          : ComplianceCalendarOccurrenceStatus.COMPLETED,
      },
    });
    await transaction.offlineSubmission.create({
      data: {
        id: item.id,
        organizationId: actor.organizationId,
        userId: actor.userId,
        recordType: item.type,
        recordId: record.id,
        capturedAt,
        payloadHash,
      },
    });
    await transaction.activityLog.create({
      data: {
        organizationId: actor.organizationId,
        userId: actor.userId,
        action: ActivityAction.UPDATE,
        entityType: "ComplianceCalendarOccurrence",
        entityId: record.id,
        title: "Compliance calendar work submitted from mobile",
        description: occurrence.task.title,
        metadata: {
          offlineSubmissionId: item.id,
          approvalRequired: occurrence.task.approvalRequired,
          evidenceUrlProvided: Boolean(evidenceUrl),
        },
      },
    });
    return record;
  });
  return { id: item.id, status: "synced", recordId: updated.id };
}

async function syncComplianceReview(
  actor: { organizationId: string; userId: string },
  item: z.infer<typeof complianceReviewItemSchema>,
  payloadHash: string
): Promise<SyncResult> {
  const occurrence = await prisma.complianceCalendarOccurrence.findFirst({
    where: {
      id: item.payload.occurrenceId,
      organizationId: actor.organizationId,
      status: ComplianceCalendarOccurrenceStatus.SUBMITTED,
    },
    include: {
      task: { select: { title: true } },
    },
  });
  if (!occurrence) {
    return {
      id: item.id,
      status: "failed",
      error: "A submitted compliance task could not be found for review.",
    };
  }

  const capturedAt = new Date(item.capturedAt);
  const status = item.payload.decision === "APPROVE"
    ? ComplianceCalendarOccurrenceStatus.COMPLETED
    : ComplianceCalendarOccurrenceStatus.REJECTED;
  const updated = await prisma.$transaction(async (transaction) => {
    const record = await transaction.complianceCalendarOccurrence.update({
      where: { id: occurrence.id },
      data: {
        status,
        reviewedAt: capturedAt,
        reviewedById: actor.userId,
        reviewNotes: item.payload.reviewNotes?.trim() || null,
      },
    });
    await transaction.offlineSubmission.create({
      data: {
        id: item.id,
        organizationId: actor.organizationId,
        userId: actor.userId,
        recordType: item.type,
        recordId: record.id,
        capturedAt,
        payloadHash,
      },
    });
    await transaction.activityLog.create({
      data: {
        organizationId: actor.organizationId,
        userId: actor.userId,
        action: ActivityAction.UPDATE,
        entityType: "ComplianceCalendarOccurrence",
        entityId: record.id,
        title: `Compliance calendar submission ${
          item.payload.decision === "APPROVE" ? "approved" : "rejected"
        }`,
        description: occurrence.task.title,
        metadata: {
          offlineSubmissionId: item.id,
          decision: item.payload.decision,
        },
      },
    });
    return record;
  });
  return { id: item.id, status: "synced", recordId: updated.id };
}

async function syncTrainingProgress(
  actor: {
    organizationId: string;
    userId: string;
    canManageTraining: boolean;
  },
  item: z.infer<typeof trainingProgressItemSchema>,
  payloadHash: string
): Promise<SyncResult> {
  const assignment = await prisma.trainingRecord.findFirst({
    where: {
      id: item.payload.trainingRecordId,
      user: { organizationId: actor.organizationId },
    },
    select: {
      id: true,
      userId: true,
      status: true,
      courseName: true,
    },
  });
  if (!assignment) {
    return {
      id: item.id,
      status: "failed",
      error: "Training assignment not found in this organization.",
    };
  }
  if (
    assignment.userId !== actor.userId &&
    !actor.canManageTraining
  ) {
    return {
      id: item.id,
      status: "failed",
      error: "Only the learner or a training manager can start this assignment.",
    };
  }
  if (
    assignment.status === Status.COMPLETED ||
    assignment.status === Status.CLOSED
  ) {
    return {
      id: item.id,
      status: "failed",
      error: "This training assignment is already completed.",
    };
  }

  const capturedAt = new Date(item.capturedAt);
  const updated = await prisma.$transaction(async (transaction) => {
    const record = await transaction.trainingRecord.update({
      where: { id: assignment.id },
      data: {
        status: Status.IN_PROGRESS,
        ...(item.payload.notes?.trim()
          ? { notes: item.payload.notes.trim() }
          : {}),
      },
    });
    await transaction.offlineSubmission.create({
      data: {
        id: item.id,
        organizationId: actor.organizationId,
        userId: actor.userId,
        recordType: item.type,
        recordId: record.id,
        capturedAt,
        payloadHash,
      },
    });
    await transaction.activityLog.create({
      data: {
        organizationId: actor.organizationId,
        userId: actor.userId,
        action: ActivityAction.UPDATE,
        entityType: "TrainingRecord",
        entityId: record.id,
        title: "Training started from mobile",
        description: assignment.courseName,
        metadata: { offlineSubmissionId: item.id },
      },
    });
    return record;
  });
  return { id: item.id, status: "synced", recordId: updated.id };
}

async function syncTrainingCompletion(
  actor: { organizationId: string; userId: string },
  item: z.infer<typeof trainingCompletionItemSchema>,
  payloadHash: string
): Promise<SyncResult> {
  const result = await completeTrainingWithCompetenciesService({
    organizationId: actor.organizationId,
    userId: actor.userId,
    recordId: item.payload.trainingRecordId,
    completedAt: new Date(`${item.payload.completedAt}T00:00:00.000Z`),
    certificateNumber: item.payload.certificateNumber?.trim() || null,
    score: item.payload.score ?? null,
    notes: item.payload.notes?.trim() || null,
    offlineSubmission: {
      id: item.id,
      capturedAt: new Date(item.capturedAt),
      payloadHash,
    },
  });
  return {
    id: item.id,
    status: "synced",
    recordId: result.record.id,
  };
}

async function syncMocStatus(
  actor: { organizationId: string; userId: string },
  item: z.infer<typeof mocStatusItemSchema>,
  payloadHash: string
): Promise<SyncResult> {
  const updated = await transitionMocStatusService({
    organizationId: actor.organizationId,
    userId: actor.userId,
    mocId: item.payload.mocId,
    status: item.payload.status,
    comments: item.payload.comments?.trim() || null,
    offlineSubmission: {
      id: item.id,
      capturedAt: new Date(item.capturedAt),
      payloadHash,
    },
  });
  return { id: item.id, status: "synced", recordId: updated.id };
}

async function syncMocApprovalDecision(
  actor: { organizationId: string; userId: string },
  item: z.infer<typeof mocApprovalDecisionItemSchema>,
  payloadHash: string
): Promise<SyncResult> {
  const updated = await decideMocApprovalService({
    organizationId: actor.organizationId,
    userId: actor.userId,
    mocId: item.payload.mocId,
    approvalId: item.payload.approvalId,
    status: item.payload.status,
    comments: item.payload.comments?.trim() || null,
    offlineSubmission: {
      id: item.id,
      capturedAt: new Date(item.capturedAt),
      payloadHash,
    },
  });
  return { id: item.id, status: "synced", recordId: updated.id };
}

async function syncMocTaskStatus(
  actor: { organizationId: string; userId: string },
  item: z.infer<typeof mocTaskStatusItemSchema>,
  payloadHash: string
): Promise<SyncResult> {
  const updated = await updateMocTaskService({
    organizationId: actor.organizationId,
    userId: actor.userId,
    mocId: item.payload.mocId,
    taskId: item.payload.taskId,
    status: item.payload.status,
    evidenceNote: item.payload.evidenceNote?.trim() || null,
    offlineSubmission: {
      id: item.id,
      capturedAt: new Date(item.capturedAt),
      payloadHash,
    },
  });
  return { id: item.id, status: "synced", recordId: updated.id };
}

async function syncPermitStatus(
  actor: { organizationId: string; userId: string },
  item: z.infer<typeof permitStatusItemSchema>,
  payloadHash: string
): Promise<SyncResult> {
  const updated = await transitionPermitToWorkService({
    organizationId: actor.organizationId,
    userId: actor.userId,
    permitId: item.payload.permitId,
    status: item.payload.status,
    comments: item.payload.comments?.trim() || null,
    closeoutNotes: item.payload.closeoutNotes?.trim() || null,
    offlineSubmission: {
      id: item.id,
      capturedAt: new Date(item.capturedAt),
      payloadHash,
    },
  });
  return { id: item.id, status: "synced", recordId: updated.id };
}

async function syncPermitControl(
  actor: { organizationId: string; userId: string },
  item: z.infer<typeof permitControlItemSchema>,
  payloadHash: string
): Promise<SyncResult> {
  const updated = await verifyPermitControlService({
    organizationId: actor.organizationId,
    userId: actor.userId,
    permitId: item.payload.permitId,
    controlId: item.payload.controlId,
    verified: item.payload.verified,
    offlineSubmission: {
      id: item.id,
      capturedAt: new Date(item.capturedAt),
      payloadHash,
    },
  });
  return { id: item.id, status: "synced", recordId: updated.id };
}

async function syncPermitGasTest(
  actor: { organizationId: string; userId: string },
  item: z.infer<typeof permitGasTestItemSchema>,
  payloadHash: string
): Promise<SyncResult> {
  const gasTest = await recordPermitGasTestService({
    organizationId: actor.organizationId,
    userId: actor.userId,
    permitId: item.payload.permitId,
    oxygenPercent: item.payload.oxygenPercent ?? null,
    lelPercent: item.payload.lelPercent ?? null,
    h2sPpm: item.payload.h2sPpm ?? null,
    coPpm: item.payload.coPpm ?? null,
    result: item.payload.result,
    notes: item.payload.notes?.trim() || null,
    offlineSubmission: {
      id: item.id,
      capturedAt: new Date(item.capturedAt),
      payloadHash,
    },
  });
  return { id: item.id, status: "synced", recordId: gasTest.id };
}

async function syncAssetStatus(
  actor: { organizationId: string; userId: string },
  item: z.infer<typeof assetStatusItemSchema>,
  payloadHash: string
): Promise<SyncResult> {
  const asset = await changeAssetStatusService({
    organizationId: actor.organizationId,
    userId: actor.userId,
    assetId: item.payload.assetId,
    status: item.payload.status,
    reason: item.payload.reason,
    offlineSubmission: {
      id: item.id,
      capturedAt: new Date(item.capturedAt),
      payloadHash,
    },
  });
  return { id: item.id, status: "synced", recordId: asset.id };
}

async function syncAssetInspection(
  actor: { organizationId: string; userId: string },
  item: z.infer<typeof assetInspectionItemSchema>,
  payloadHash: string
): Promise<SyncResult> {
  const capturedAt = new Date(item.capturedAt);
  const submissions = await prepareCapturedFormSubmissions({
    organizationId: actor.organizationId,
    module: ConfigurableFormModule.ASSET_SAFETY,
    capturedAt,
    forms: item.payload.customForms,
  });
  const result = await recordAssetInspectionService({
    organizationId: actor.organizationId,
    userId: actor.userId,
    assetId: item.payload.assetId,
    inspectedAt: new Date(item.payload.inspectedAt),
    result: item.payload.result,
    conditionScore: item.payload.conditionScore ?? null,
    evidenceReference: item.payload.evidenceReference?.trim() || null,
    observations: item.payload.observations?.trim() || null,
    immediateAction: item.payload.immediateAction?.trim() || null,
    customSubmissions: submissions,
    offlineSubmission: {
      id: item.id,
      capturedAt,
      payloadHash,
    },
  });
  return {
    id: item.id,
    status: "synced",
    recordId: result.inspection.id,
  };
}

async function syncAssetDefect(
  actor: { organizationId: string; userId: string },
  item: z.infer<typeof assetDefectItemSchema>,
  payloadHash: string
): Promise<SyncResult> {
  const defect = await createAssetDefectService({
    organizationId: actor.organizationId,
    userId: actor.userId,
    assetId: item.payload.assetId,
    title: item.payload.title,
    description: item.payload.description,
    severity: item.payload.severity,
    ownerId: item.payload.ownerId || null,
    dueDate: parseDateOnly(item.payload.dueDate),
    immediateControls: item.payload.immediateControls?.trim() || null,
    offlineSubmission: {
      id: item.id,
      capturedAt: new Date(item.capturedAt),
      payloadHash,
    },
  });
  return { id: item.id, status: "synced", recordId: defect.id };
}

async function syncAssetDefectStatus(
  actor: { organizationId: string; userId: string },
  item: z.infer<typeof assetDefectStatusItemSchema>,
  payloadHash: string
): Promise<SyncResult> {
  const defect = await updateAssetDefectService({
    organizationId: actor.organizationId,
    userId: actor.userId,
    defectId: item.payload.defectId,
    status: item.payload.status,
    repairPlan: item.payload.repairPlan?.trim() || null,
    verificationEvidence:
      item.payload.verificationEvidence?.trim() || null,
    offlineSubmission: {
      id: item.id,
      capturedAt: new Date(item.capturedAt),
      payloadHash,
    },
  });
  return { id: item.id, status: "synced", recordId: defect.id };
}

async function syncAssetMaintenanceStatus(
  actor: { organizationId: string; userId: string },
  item: z.infer<typeof assetMaintenanceStatusItemSchema>,
  payloadHash: string
): Promise<SyncResult> {
  const record = await changeAssetMaintenanceStatusService({
    organizationId: actor.organizationId,
    userId: actor.userId,
    recordId: item.payload.recordId,
    status: item.payload.status,
    reason: item.payload.reason,
    offlineSubmission: {
      id: item.id,
      capturedAt: new Date(item.capturedAt),
      payloadHash,
    },
  });
  return { id: item.id, status: "synced", recordId: record.id };
}

async function syncAssetMaintenanceCompletion(
  actor: { organizationId: string; userId: string },
  item: z.infer<typeof assetMaintenanceCompletionItemSchema>,
  payloadHash: string
): Promise<SyncResult> {
  const record = await completeAssetMaintenanceService({
    organizationId: actor.organizationId,
    userId: actor.userId,
    recordId: item.payload.recordId,
    completedAt: new Date(item.payload.completedAt),
    workSummary: item.payload.workSummary,
    evidenceReference: item.payload.evidenceReference,
    downtimeHours: item.payload.downtimeHours ?? null,
    offlineSubmission: {
      id: item.id,
      capturedAt: new Date(item.capturedAt),
      payloadHash,
    },
  });
  return { id: item.id, status: "synced", recordId: record.id };
}

async function syncContractorStatus(
  actor: { organizationId: string; userId: string },
  item: z.infer<typeof contractorStatusItemSchema>,
  payloadHash: string
): Promise<SyncResult> {
  const contractor = await updateContractorStatusService({
    organizationId: actor.organizationId,
    userId: actor.userId,
    contractorId: item.payload.contractorId,
    status: item.payload.status,
    reason: item.payload.reason?.trim() || null,
    offlineSubmission: {
      id: item.id,
      capturedAt: new Date(item.capturedAt),
      payloadHash,
    },
  });
  return { id: item.id, status: "synced", recordId: contractor.id };
}

async function syncHygieneAssessmentStatus(
  actor: { organizationId: string; userId: string },
  item: z.infer<typeof hygieneAssessmentStatusItemSchema>,
  payloadHash: string
): Promise<SyncResult> {
  const assessment = await transitionExposureAssessmentService({
    organizationId: actor.organizationId,
    userId: actor.userId,
    assessmentId: item.payload.assessmentId,
    status: item.payload.status,
    observations: item.payload.observations?.trim() || null,
    conclusions: item.payload.conclusions?.trim() || null,
    recommendations: item.payload.recommendations?.trim() || null,
    offlineSubmission: {
      id: item.id,
      capturedAt: new Date(item.capturedAt),
      payloadHash,
    },
  });
  return { id: item.id, status: "synced", recordId: assessment.id };
}

async function syncHygieneSample(
  actor: { organizationId: string; userId: string },
  item: z.infer<typeof hygieneSampleItemSchema>,
  payloadHash: string
): Promise<SyncResult> {
  const sample = await addExposureSampleService({
    organizationId: actor.organizationId,
    userId: actor.userId,
    assessmentId: item.payload.assessmentId,
    agentId: item.payload.agentId,
    sampleType: item.payload.sampleType,
    sampleReference: item.payload.sampleReference?.trim() || null,
    sampledWorkerId: item.payload.sampledWorkerId || null,
    location: item.payload.location?.trim() || null,
    task: item.payload.task?.trim() || null,
    sampledAt: new Date(item.payload.sampledAt),
    durationMinutes: item.payload.durationMinutes ?? null,
    resultValue: item.payload.resultValue ?? null,
    reportingLimit: item.payload.reportingLimit ?? null,
    occupationalLimit: item.payload.occupationalLimit ?? null,
    actionLevel: item.payload.actionLevel ?? null,
    unit: item.payload.unit?.trim() || null,
    laboratory: item.payload.laboratory?.trim() || null,
    analyticalMethod: item.payload.analyticalMethod?.trim() || null,
    analyzedAt: item.payload.analyzedAt
      ? new Date(item.payload.analyzedAt)
      : null,
    notes: item.payload.notes?.trim() || null,
    offlineSubmission: {
      id: item.id,
      capturedAt: new Date(item.capturedAt),
      payloadHash,
    },
  });
  return { id: item.id, status: "synced", recordId: sample.id };
}

async function syncHygieneForms(
  actor: { organizationId: string; userId: string },
  item: z.infer<typeof hygieneFormsItemSchema>,
  payloadHash: string
): Promise<SyncResult> {
  const submissions = await prepareCapturedFormSubmissions({
    organizationId: actor.organizationId,
    module: ConfigurableFormModule.INDUSTRIAL_HYGIENE,
    capturedAt: new Date(item.capturedAt),
    forms: item.payload.customForms,
  });
  await completeExposureAssessmentFormsService({
    organizationId: actor.organizationId,
    userId: actor.userId,
    assessmentId: item.payload.assessmentId,
    submissions,
    offlineSubmission: {
      id: item.id,
      capturedAt: new Date(item.capturedAt),
      payloadHash,
    },
  });
  return {
    id: item.id,
    status: "synced",
    recordId: item.payload.assessmentId,
  };
}

async function syncSurveillanceProgramStatus(
  actor: { organizationId: string; userId: string },
  item: z.infer<typeof surveillanceProgramStatusItemSchema>,
  payloadHash: string
): Promise<SyncResult> {
  const program = await updateSurveillanceProgramStatusService({
    organizationId: actor.organizationId,
    userId: actor.userId,
    programId: item.payload.programId,
    status: item.payload.status,
    offlineSubmission: {
      id: item.id,
      capturedAt: new Date(item.capturedAt),
      payloadHash,
    },
  });
  return { id: item.id, status: "synced", recordId: program.id };
}

async function syncSurveillanceEnrollment(
  actor: { organizationId: string; userId: string },
  item: z.infer<typeof surveillanceEnrollmentItemSchema>,
  payloadHash: string
): Promise<SyncResult> {
  const enrollment = await enrollSurveillanceUserService({
    organizationId: actor.organizationId,
    userId: actor.userId,
    programId: item.payload.programId,
    enrolledUserId: item.payload.enrolledUserId,
    nextDueAt: parseDateOnly(item.payload.nextDueAt)!,
    notes: item.payload.notes?.trim() || null,
    offlineSubmission: {
      id: item.id,
      capturedAt: new Date(item.capturedAt),
      payloadHash,
    },
  });
  return { id: item.id, status: "synced", recordId: enrollment.id };
}

async function syncSurveillanceCompletion(
  actor: { organizationId: string; userId: string },
  item: z.infer<typeof surveillanceCompletionItemSchema>,
  payloadHash: string
): Promise<SyncResult> {
  const enrollment = await completeSurveillanceEnrollmentService({
    organizationId: actor.organizationId,
    userId: actor.userId,
    enrollmentId: item.payload.enrollmentId,
    completedAt: parseDateOnly(item.payload.completedAt)!,
    fitnessOutcome: item.payload.fitnessOutcome,
    workRestrictions: item.payload.workRestrictions?.trim() || null,
    certificateReference: item.payload.certificateReference?.trim() || null,
    notes: item.payload.notes?.trim() || null,
    offlineSubmission: {
      id: item.id,
      capturedAt: new Date(item.capturedAt),
      payloadHash,
    },
  });
  return { id: item.id, status: "synced", recordId: enrollment.id };
}

async function syncSurveillanceRemoval(
  actor: { organizationId: string; userId: string },
  item: z.infer<typeof surveillanceRemovalItemSchema>,
  payloadHash: string
): Promise<SyncResult> {
  const enrollment = await removeSurveillanceEnrollmentService({
    organizationId: actor.organizationId,
    userId: actor.userId,
    enrollmentId: item.payload.enrollmentId,
    reason: item.payload.reason.trim(),
    offlineSubmission: {
      id: item.id,
      capturedAt: new Date(item.capturedAt),
      payloadHash,
    },
  });
  return { id: item.id, status: "synced", recordId: enrollment.id };
}

function parseDateOnly(value?: string) {
  return value ? new Date(`${value}T12:00:00.000Z`) : null;
}

function parseFutureReviewDate(value: string | undefined, capturedAt: Date) {
  const reviewDate = parseDateOnly(value);
  if (reviewDate && reviewDate.getTime() <= capturedAt.getTime()) {
    throw new Error("Next review date must be after the field capture date.");
  }
  return reviewDate;
}

const safeOfflineError = (error: unknown) => {
  const value = error instanceof Error ? error.message : "";
  return /captured|custom form|form version|answer|is required|must be|valid option|inspection|audit|capa|corrective action|risk|hazard|jsa|acknowledg|assigned|assignee|authorized|planned|scheduled|started|completed|closed|site|department|organization|evidence|photo|comment|not applicable|compliance|training|course|learner|review|management of change|moc|permit|control|gas test|atmospheric|oxygen|contractor|worker|approval|implementation|verification|asset|equipment|defect|repair|maintenance|downtime|insurance|qualification|induction|exposure|hygiene|sample|surveillance|fitness|restriction|certificate|provider/i.test(value)
    ? value
    : "The record could not be synchronized.";
};
