import {
  ActivityAction,
  DocumentCategory,
  DocumentEntityType,
  EnterpriseAuditEvidenceType,
  EnterpriseAuditStatus,
  PermissionKey,
  Status,
  UserRole,
} from "@prisma/client";
import { z } from "zod";
import { logActivity } from "@/core/activity-log/activity-log.service";
import { prisma } from "@/lib/prisma";
import { requireSubscriptionFeature } from "@/lib/subscription";

export const MAX_MOBILE_EVIDENCE_BYTES = 10 * 1024 * 1024;
export const MOBILE_EVIDENCE_CONTENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "text/plain",
  "text/csv",
] as const;

const contentTypes = new Set<string>(MOBILE_EVIDENCE_CONTENT_TYPES);
const targetTypeSchema = z.enum([
  "SAFETY_OBSERVATION",
  "INCIDENT",
  "INSPECTION",
  "AUDIT_QUESTION",
  "CORRECTIVE_ACTION",
]);

export const mobileEvidencePayloadSchema = z.object({
  localEvidenceId: z.string().uuid(),
  targetType: targetTypeSchema,
  parentSubmissionId: z.string().uuid().optional(),
  entityId: z.string().min(1).max(200).optional(),
  questionId: z.string().min(1).max(200).optional(),
  checklistItemId: z.string().min(1).max(200).optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  fileName: z.string().trim().min(1).max(180)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, "Evidence filename is invalid."),
  mimeType: z.string().refine((value) => contentTypes.has(value), "Evidence file type is not supported."),
  sizeBytes: z.number().int().min(1).max(MAX_MOBILE_EVIDENCE_BYTES),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
  capturedAt: z.string().datetime(),
}).superRefine((value, context) => {
  if (
    (value.targetType === "SAFETY_OBSERVATION" || value.targetType === "INCIDENT") &&
    !value.parentSubmissionId
  ) {
    context.addIssue({
      code: "custom",
      path: ["parentSubmissionId"],
      message: "A synchronized parent record is required.",
    });
  }
  if (
    (
      value.targetType === "INSPECTION" ||
      value.targetType === "AUDIT_QUESTION" ||
      value.targetType === "CORRECTIVE_ACTION"
    ) &&
    !value.entityId
  ) {
    context.addIssue({
      code: "custom",
      path: ["entityId"],
      message: "The evidence target is required.",
    });
  }
  if (value.targetType === "AUDIT_QUESTION" && !value.questionId) {
    context.addIssue({
      code: "custom",
      path: ["questionId"],
      message: "The Audit question is required.",
    });
  }
});

export type MobileEvidencePayload = z.infer<typeof mobileEvidencePayloadSchema>;

type ResolvedMobileEvidence = MobileEvidencePayload & {
  organizationId: string;
  userId: string;
  resolvedEntityId: string;
};

export function parseMobileEvidencePayload(value: string | null | undefined) {
  let decoded: unknown;
  try {
    decoded = JSON.parse(value || "null");
  } catch {
    throw new Error("Evidence upload details are invalid.");
  }
  const parsed = mobileEvidencePayloadSchema.safeParse(decoded);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Evidence upload details are invalid.");
  return parsed.data;
}

export function requiredMobileEvidencePermission(
  targetType: MobileEvidencePayload["targetType"]
) {
  if (targetType === "SAFETY_OBSERVATION") return PermissionKey.CREATE_OBSERVATION;
  if (targetType === "INCIDENT") return PermissionKey.CREATE_INCIDENT;
  if (targetType === "INSPECTION") return PermissionKey.MANAGE_INSPECTIONS;
  if (targetType === "CORRECTIVE_ACTION") return PermissionKey.UPDATE_CAPA;
  return PermissionKey.MANAGE_AUDITS;
}

export async function resolveMobileEvidenceTarget(input: {
  payload: MobileEvidencePayload;
  organizationId: string;
  userId: string;
  role: UserRole;
}): Promise<ResolvedMobileEvidence> {
  await Promise.all([
    requireSubscriptionFeature(input.organizationId, "DOCUMENT_UPLOAD"),
    requireSubscriptionFeature(input.organizationId, "OFFLINE_COLLECTION"),
  ]);
  const permission = requiredMobileEvidencePermission(input.payload.targetType);
  const granted = input.role === UserRole.SUPER_ADMIN
    ? true
    : Boolean(await prisma.rolePermission.findFirst({
        where: { role: input.role, permission },
        select: { id: true },
      }));
  if (!granted) throw new Error("Your role cannot upload evidence for this record.");

  const alreadySynchronized = await prisma.offlineSubmission.findUnique({
    where: { id: input.payload.localEvidenceId },
    select: { organizationId: true, userId: true, recordType: true },
  });
  if (alreadySynchronized) {
    if (
      alreadySynchronized.organizationId !== input.organizationId ||
      alreadySynchronized.userId !== input.userId ||
      alreadySynchronized.recordType !== "MOBILE_EVIDENCE"
    ) {
      throw new Error("Evidence identifier is unavailable.");
    }
    throw new Error("Evidence is already synchronized.");
  }

  let resolvedEntityId = input.payload.entityId || "";
  if (
    input.payload.targetType === "SAFETY_OBSERVATION" ||
    input.payload.targetType === "INCIDENT"
  ) {
    const parent = await prisma.offlineSubmission.findFirst({
      where: {
        id: input.payload.parentSubmissionId,
        organizationId: input.organizationId,
        userId: input.userId,
        recordType: input.payload.targetType,
      },
      select: { recordId: true },
    });
    if (!parent) throw new Error("Synchronize the parent record before uploading its evidence.");
    resolvedEntityId = parent.recordId;
  } else if (input.payload.targetType === "INSPECTION") {
    const inspection = await prisma.inspection.findFirst({
      where: {
        id: input.payload.entityId,
        site: { organizationId: input.organizationId },
        status: { notIn: [Status.COMPLETED, Status.CLOSED] },
        ...(input.role === UserRole.SUPER_ADMIN
          ? {}
          : {
              OR: [
                { leadInspectorId: input.userId },
                { teamMembers: { some: { userId: input.userId } } },
              ],
            }),
      },
      select: {
        id: true,
        checklistItems: input.payload.checklistItemId
          ? {
              where: { id: input.payload.checklistItemId },
              select: { id: true },
              take: 1,
            }
          : false,
      },
    });
    if (!inspection) throw new Error("This inspection is not available for mobile evidence capture.");
    if (input.payload.checklistItemId && !inspection.checklistItems.length) {
      throw new Error("Inspection checklist item was not found.");
    }
    resolvedEntityId = inspection.id;
  } else if (input.payload.targetType === "AUDIT_QUESTION") {
    const managementRole = new Set<UserRole>([
      UserRole.SUPER_ADMIN,
      UserRole.ORG_ADMIN,
      UserRole.EHS_MANAGER,
    ]).has(input.role);
    const audit = await prisma.enterpriseAudit.findFirst({
      where: {
        id: input.payload.entityId,
        organizationId: input.organizationId,
        status: {
          notIn: [
            EnterpriseAuditStatus.COMPLETED,
            EnterpriseAuditStatus.CLOSED,
            EnterpriseAuditStatus.CANCELLED,
          ],
        },
        ...(managementRole
          ? {}
          : {
              OR: [
                { leadAuditorId: input.userId },
                { teamMembers: { some: { userId: input.userId, canEdit: true } } },
              ],
            }),
        questions: { some: { id: input.payload.questionId } },
      },
      select: { id: true },
    });
    if (!audit) throw new Error("This Audit question is not available for mobile evidence capture.");
    resolvedEntityId = audit.id;
  } else {
    const action = await prisma.correctiveAction.findFirst({
      where: {
        id: input.payload.entityId,
        assignedTo: { organizationId: input.organizationId },
      },
      select: { id: true },
    });
    if (!action) {
      throw new Error("This corrective action is not available for mobile evidence capture.");
    }
    resolvedEntityId = action.id;
  }

  return {
    ...input.payload,
    organizationId: input.organizationId,
    userId: input.userId,
    resolvedEntityId,
  };
}

export async function isMobileEvidenceSynchronized(input: {
  evidenceId: string;
  organizationId: string;
  userId: string;
}) {
  return Boolean(await prisma.offlineSubmission.findFirst({
    where: {
      id: input.evidenceId,
      organizationId: input.organizationId,
      userId: input.userId,
      recordType: "MOBILE_EVIDENCE",
    },
    select: { id: true },
  }));
}

export async function completeMobileEvidenceUpload(input: {
  payload: ResolvedMobileEvidence;
  blob: { url: string; pathname: string; contentType: string };
}) {
  const existing = await prisma.offlineSubmission.findUnique({
    where: { id: input.payload.localEvidenceId },
    select: { organizationId: true, userId: true, recordType: true },
  });
  if (existing) {
    if (
      existing.organizationId === input.payload.organizationId &&
      existing.userId === input.payload.userId &&
      existing.recordType === "MOBILE_EVIDENCE"
    ) return;
    throw new Error("Evidence identifier is unavailable.");
  }
  if (!contentTypes.has(input.blob.contentType)) {
    throw new Error("Uploaded evidence content type is invalid.");
  }

  if (input.payload.targetType === "AUDIT_QUESTION") {
    await completeAuditEvidence(input);
    return;
  }
  await completeDocumentEvidence(input);
}

async function completeAuditEvidence(input: {
  payload: ResolvedMobileEvidence;
  blob: { url: string; pathname: string; contentType: string };
}) {
  const response = await prisma.enterpriseAuditResponse.findUnique({
    where: { questionId: input.payload.questionId! },
    select: { id: true },
  });
  await prisma.$transaction(async (transaction) => {
    const evidence = await transaction.enterpriseAuditEvidence.create({
      data: {
        organizationId: input.payload.organizationId,
        auditId: input.payload.resolvedEntityId,
        questionId: input.payload.questionId,
        responseId: response?.id,
        evidenceType: evidenceType(input.blob.contentType),
        title: input.payload.title,
        description: input.payload.description || null,
        fileName: input.payload.fileName,
        fileUrl: input.blob.url,
        mimeType: input.blob.contentType,
        fileSize: input.payload.sizeBytes,
        capturedAt: new Date(input.payload.capturedAt),
        capturedById: input.payload.userId,
        metadata: {
          pathname: input.blob.pathname,
          checksum: input.payload.checksum,
          mobileEvidenceId: input.payload.localEvidenceId,
        },
      },
    });
    await transaction.enterpriseAuditHistory.create({
      data: {
        organizationId: input.payload.organizationId,
        auditId: input.payload.resolvedEntityId,
        userId: input.payload.userId,
        action: "EVIDENCE_ADDED",
        entityType: "EnterpriseAuditEvidence",
        entityId: evidence.id,
        title: "Mobile Audit evidence uploaded",
        description: input.payload.title,
      },
    });
    await transaction.offlineSubmission.create({
      data: offlineSubmissionData(input.payload, evidence.id),
    });
  });
}

async function completeDocumentEvidence(input: {
  payload: ResolvedMobileEvidence;
  blob: { url: string; pathname: string; contentType: string };
}) {
  const target = documentTarget(input.payload.targetType);
  const document = await prisma.$transaction(async (transaction) => {
    const record = await transaction.document.create({
      data: {
        organizationId: input.payload.organizationId,
        uploadedById: input.payload.userId,
        entityType: target.entityType,
        entityId: input.payload.resolvedEntityId,
        category: documentCategory(input.blob.contentType),
        name: input.payload.title,
        originalName: input.payload.fileName,
        description: [
          input.payload.description,
          input.payload.checklistItemId
            ? `Inspection checklist item: ${input.payload.checklistItemId}`
            : null,
        ].filter(Boolean).join("\n") || null,
        storageKey: input.blob.pathname,
        storageUrl: input.blob.url,
        mimeType: input.blob.contentType,
        sizeBytes: input.payload.sizeBytes,
        checksum: input.payload.checksum,
      },
    });
    await transaction.offlineSubmission.create({
      data: offlineSubmissionData(input.payload, record.id),
    });
    return record;
  });
  await logActivity({
    organizationId: input.payload.organizationId,
    userId: input.payload.userId,
    action: ActivityAction.CREATE,
    entityType: "Document",
    entityId: document.id,
    title: "Mobile evidence uploaded",
    description: document.name,
    metadata: {
      relatedEntityType: target.entityType,
      relatedEntityId: input.payload.resolvedEntityId,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      mobileEvidenceId: input.payload.localEvidenceId,
    },
  });
}

function offlineSubmissionData(
  payload: ResolvedMobileEvidence,
  recordId: string
) {
  return {
    id: payload.localEvidenceId,
    organizationId: payload.organizationId,
    userId: payload.userId,
    recordType: "MOBILE_EVIDENCE",
    recordId,
    capturedAt: new Date(payload.capturedAt),
    payloadHash: payload.checksum,
  };
}

function documentTarget(
  type: MobileEvidencePayload["targetType"]
) {
  if (type === "SAFETY_OBSERVATION") {
    return { entityType: DocumentEntityType.SAFETY_OBSERVATION };
  }
  if (type === "INCIDENT") {
    return { entityType: DocumentEntityType.INCIDENT };
  }
  if (type === "AUDIT_QUESTION") {
    throw new Error("Audit question evidence must use the governed Audit evidence record.");
  }
  if (type === "CORRECTIVE_ACTION") {
    return { entityType: DocumentEntityType.CORRECTIVE_ACTION };
  }
  return { entityType: DocumentEntityType.INSPECTION };
}

function documentCategory(mimeType: string) {
  if (mimeType.startsWith("image/")) return DocumentCategory.PHOTO;
  if (mimeType.startsWith("video/")) return DocumentCategory.VIDEO;
  return DocumentCategory.EVIDENCE;
}

function evidenceType(mimeType: string) {
  if (mimeType.startsWith("image/")) return EnterpriseAuditEvidenceType.PHOTO;
  if (mimeType.startsWith("video/")) return EnterpriseAuditEvidenceType.VIDEO;
  return EnterpriseAuditEvidenceType.DOCUMENT;
}

export type MobileEvidenceTokenPayload = ResolvedMobileEvidence;
