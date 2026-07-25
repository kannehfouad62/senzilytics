import {
  DocumentStatus,
  PermissionKey,
  Status,
  SubscriptionPlan,
} from "@prisma/client";
import { z } from "zod";
import {
  archiveDocument,
  restoreDocument,
} from "@/core/documents/document.service";
import { prisma } from "@/lib/prisma";
import { planEntitlements } from "@/lib/subscription";
import { evaluateComplianceObligationService } from "@/modules/compliance/compliance.service";

export const mobileComplianceDocumentActionSchema = z.discriminatedUnion(
  "action",
  [
    z.object({
      action: z.literal("EVALUATE_OBLIGATION"),
      complianceItemId: z.string().min(1).max(100),
      isCompliant: z.boolean(),
      findings: z.string().trim().max(5_000).optional(),
      evidenceSummary: z.string().trim().max(5_000).optional(),
    }),
    z.object({
      action: z.literal("ARCHIVE_DOCUMENT"),
      documentId: z.string().min(1).max(100),
    }),
    z.object({
      action: z.literal("RESTORE_DOCUMENT"),
      documentId: z.string().min(1).max(100),
    }),
  ]
);

export class MobileComplianceDocumentError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string
  ) {
    super(message);
  }
}

export function mobileComplianceDocumentCapabilities(input: {
  permissions: readonly PermissionKey[];
  subscriptionPlan: SubscriptionPlan;
}) {
  const granted = new Set(input.permissions);
  const canManageDocuments = granted.has(PermissionKey.MANAGE_DOCUMENTS);

  return {
    canViewCompliance: granted.has(PermissionKey.VIEW_COMPLIANCE),
    canManageCompliance: granted.has(PermissionKey.MANAGE_COMPLIANCE),
    canManageDocuments,
    canUploadDocuments:
      canManageDocuments &&
      planEntitlements[input.subscriptionPlan].DOCUMENT_UPLOAD,
  };
}

export async function getMobileComplianceDocumentWorkspace(input: {
  organizationId: string;
  userId: string;
  permissions: readonly PermissionKey[];
  subscriptionPlan: SubscriptionPlan;
  now?: Date;
}) {
  const capabilities = mobileComplianceDocumentCapabilities(input);
  const now = input.now ?? new Date();
  const recentEvaluationCutoff = new Date(
    now.getTime() - 365 * 86_400_000
  );

  const [obligations, permits, documents, complianceCounts, documentCounts] =
    await Promise.all([
      capabilities.canViewCompliance
        ? prisma.complianceItem.findMany({
            where: {
              site: { organizationId: input.organizationId },
              OR: [
                {
                  status: {
                    notIn: [Status.COMPLETED, Status.CLOSED],
                  },
                },
                {
                  lastEvaluatedAt: { gte: recentEvaluationCutoff },
                },
              ],
            },
            select: {
              id: true,
              title: true,
              description: true,
              status: true,
              dueDate: true,
              reference: true,
              obligationType: true,
              authority: true,
              jurisdiction: true,
              legalReference: true,
              applicability: true,
              recurrence: true,
              intervalValue: true,
              evidenceRequired: true,
              completedAt: true,
              lastEvaluatedAt: true,
              evaluationNotes: true,
              site: { select: { id: true, name: true } },
              owner: { select: { id: true, name: true } },
              regulatorySource: {
                select: { id: true, code: true, name: true },
              },
              evaluations: {
                select: {
                  id: true,
                  evaluatedAt: true,
                  isCompliant: true,
                  findings: true,
                  evidenceSummary: true,
                  nextDueDate: true,
                  evaluatedBy: { select: { id: true, name: true } },
                },
                orderBy: { evaluatedAt: "desc" },
                take: 10,
              },
            },
            orderBy: [{ dueDate: "asc" }, { title: "asc" }],
            take: 250,
          })
        : Promise.resolve([]),
      capabilities.canViewCompliance
        ? prisma.permit.findMany({
            where: { organizationId: input.organizationId },
            select: {
              id: true,
              number: true,
              name: true,
              description: true,
              authority: true,
              permitType: true,
              status: true,
              effectiveDate: true,
              expirationDate: true,
              renewalDueDate: true,
              conditions: true,
              limits: true,
              reportingRequirements: true,
              notes: true,
              site: { select: { id: true, name: true } },
              owner: { select: { id: true, name: true } },
            },
            orderBy: [
              { expirationDate: { sort: "asc", nulls: "last" } },
              { number: "asc" },
            ],
            take: 250,
          })
        : Promise.resolve([]),
      capabilities.canManageDocuments
        ? prisma.document.findMany({
            where: {
              organizationId: input.organizationId,
              isLatest: true,
              status: { not: DocumentStatus.DELETED },
            },
            select: {
              id: true,
              entityType: true,
              entityId: true,
              category: true,
              status: true,
              name: true,
              originalName: true,
              description: true,
              mimeType: true,
              sizeBytes: true,
              version: true,
              versionGroupId: true,
              checksum: true,
              createdAt: true,
              archivedAt: true,
              uploadedBy: {
                select: { id: true, name: true, email: true },
              },
            },
            orderBy: { createdAt: "desc" },
            take: 250,
          })
        : Promise.resolve([]),
      capabilities.canViewCompliance
        ? Promise.all([
            prisma.complianceItem.count({
              where: {
                site: { organizationId: input.organizationId },
              },
            }),
            prisma.complianceItem.count({
              where: {
                site: { organizationId: input.organizationId },
                dueDate: { lt: now },
                status: {
                  notIn: [Status.COMPLETED, Status.CLOSED],
                },
              },
            }),
            prisma.complianceItem.count({
              where: {
                site: { organizationId: input.organizationId },
                status: Status.IN_PROGRESS,
              },
            }),
            prisma.permit.count({
              where: {
                organizationId: input.organizationId,
                expirationDate: {
                  gte: now,
                  lte: new Date(now.getTime() + 60 * 86_400_000),
                },
              },
            }),
          ])
        : Promise.resolve([0, 0, 0, 0]),
      capabilities.canManageDocuments
        ? Promise.all([
            prisma.document.count({
              where: {
                organizationId: input.organizationId,
                isLatest: true,
                status: DocumentStatus.ACTIVE,
              },
            }),
            prisma.document.count({
              where: {
                organizationId: input.organizationId,
                isLatest: true,
                status: DocumentStatus.ARCHIVED,
              },
            }),
            prisma.document.aggregate({
              where: {
                organizationId: input.organizationId,
                status: { not: DocumentStatus.DELETED },
              },
              _sum: { sizeBytes: true },
            }),
          ]).then(([active, archived, storage]) => ({
            active,
            archived,
            storageBytes: storage._sum.sizeBytes ?? 0,
          }))
        : Promise.resolve({
            active: 0,
            archived: 0,
            storageBytes: 0,
          }),
    ]);

  const versionGroups = documents.map((document) => document.versionGroupId);
  const versions = versionGroups.length
    ? await prisma.document.findMany({
        where: {
          organizationId: input.organizationId,
          versionGroupId: { in: versionGroups },
          status: { not: DocumentStatus.DELETED },
        },
        select: {
          id: true,
          versionGroupId: true,
          version: true,
          name: true,
          originalName: true,
          mimeType: true,
          sizeBytes: true,
          status: true,
          isLatest: true,
          createdAt: true,
          uploadedBy: { select: { id: true, name: true } },
        },
        orderBy: [{ versionGroupId: "asc" }, { version: "desc" }],
      })
    : [];
  const versionsByGroup = new Map<
    string,
    typeof versions
  >();
  for (const version of versions) {
    const group = versionsByGroup.get(version.versionGroupId) ?? [];
    group.push(version);
    versionsByGroup.set(version.versionGroupId, group);
  }

  return {
    generatedAt: now,
    capabilities,
    metrics: {
      obligations: complianceCounts[0],
      overdueObligations: complianceCounts[1],
      noncompliantObligations: complianceCounts[2],
      permitsExpiringWithin60Days: complianceCounts[3],
      activeDocuments: documentCounts.active,
      archivedDocuments: documentCounts.archived,
      documentStorageBytes: documentCounts.storageBytes,
    },
    obligations: obligations.map((obligation) => ({
      ...obligation,
      isOwner: obligation.owner?.id === input.userId,
      isOverdue:
        obligation.dueDate < now &&
        obligation.status !== Status.COMPLETED &&
        obligation.status !== Status.CLOSED,
    })),
    permits: permits.map((permit) => ({
      ...permit,
      isOwner: permit.owner?.id === input.userId,
      expiresWithin60Days:
        Boolean(permit.expirationDate) &&
        permit.expirationDate! >= now &&
        permit.expirationDate! <=
          new Date(now.getTime() + 60 * 86_400_000),
      isExpired:
        Boolean(permit.expirationDate) && permit.expirationDate! < now,
    })),
    documents: documents.map((document) => ({
      ...document,
      versions: versionsByGroup.get(document.versionGroupId) ?? [],
    })),
  };
}

export async function executeMobileComplianceDocumentAction(input: {
  organizationId: string;
  userId: string;
  permissions: readonly PermissionKey[];
  subscriptionPlan: SubscriptionPlan;
  payload: z.infer<typeof mobileComplianceDocumentActionSchema>;
}) {
  const capabilities = mobileComplianceDocumentCapabilities(input);

  if (input.payload.action === "EVALUATE_OBLIGATION") {
    if (!capabilities.canManageCompliance) {
      throw new MobileComplianceDocumentError(
        "Your role cannot record formal compliance evaluations.",
        403,
        "forbidden"
      );
    }

    const evaluation = await evaluateComplianceObligationService({
      organizationId: input.organizationId,
      userId: input.userId,
      complianceItemId: input.payload.complianceItemId,
      isCompliant: input.payload.isCompliant,
      findings: input.payload.findings,
      evidenceSummary: input.payload.evidenceSummary,
    });

    return { action: input.payload.action, evaluationId: evaluation.id };
  }

  if (!capabilities.canManageDocuments) {
    throw new MobileComplianceDocumentError(
      "Your role cannot manage controlled documents.",
      403,
      "forbidden"
    );
  }

  if (input.payload.action === "ARCHIVE_DOCUMENT") {
    await archiveDocument({
      organizationId: input.organizationId,
      userId: input.userId,
      documentId: input.payload.documentId,
    });
  } else {
    await restoreDocument({
      organizationId: input.organizationId,
      userId: input.userId,
      documentId: input.payload.documentId,
    });
  }

  return {
    action: input.payload.action,
    documentId: input.payload.documentId,
  };
}
