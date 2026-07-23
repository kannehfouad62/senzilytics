import {
  ActivityAction,
  ConfigurableFormModule,
  IncidentType,
  InspectionResponseResult,
  PermissionKey,
  RiskLevel,
  SafetyObservationType,
  Status,
  UserRole,
} from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSubscriptionFeature } from "@/lib/subscription";
import {
  createPreparedSubmissions,
  prepareCapturedFormSubmissions,
} from "@/modules/forms/runtime-form.service";
import { createIncidentService } from "@/modules/incident/incident.service";
import { saveInspectionResponseService } from "@/modules/inspection/inspection-execution.service";

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

const offlineItemSchema = z.discriminatedUnion("type", [
  observationItemSchema,
  incidentItemSchema,
  inspectionResponseItemSchema,
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

export function requiredOfflinePermission(type: OfflineItem["type"]) {
  if (type === "SAFETY_OBSERVATION") return PermissionKey.CREATE_OBSERVATION;
  if (type === "INCIDENT") return PermissionKey.CREATE_INCIDENT;
  return PermissionKey.MANAGE_INSPECTIONS;
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
    if (!granted.has(requiredOfflinePermission(item.type))) {
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
      } else {
        results.push(await syncInspectionResponse(input, item, payloadHash));
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

const safeOfflineError = (error: unknown) => {
  const value = error instanceof Error ? error.message : "";
  return /captured|custom form|form version|answer|is required|must be|valid option|inspection|assigned|completed|closed|site|organization/i.test(value)
    ? value
    : "The record could not be synchronized.";
};
