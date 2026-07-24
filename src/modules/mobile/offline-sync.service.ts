import {
  ActivityAction,
  ConfigurableFormModule,
  EnterpriseAuditResponseResult,
  EnterpriseAuditStatus,
  IncidentType,
  InspectionResponseResult,
  JsaStatus,
  PermissionKey,
  RiskCategory,
  RiskControlEffectiveness,
  RiskImpact,
  RiskLikelihood,
  RiskLevel,
  RiskReviewFrequency,
  SafetyObservationType,
  Status,
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
);

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
      } else {
        results.push(await syncJsaAcknowledgment(input, item, payloadHash));
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
  return /captured|custom form|form version|answer|is required|must be|valid option|inspection|audit|capa|corrective action|risk|hazard|jsa|acknowledg|assigned|authorized|planned|scheduled|started|completed|closed|site|department|organization|evidence|photo|comment|not applicable/i.test(value)
    ? value
    : "The record could not be synchronized.";
};
