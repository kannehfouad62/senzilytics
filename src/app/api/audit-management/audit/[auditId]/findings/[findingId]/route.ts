import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  findTenantEnterpriseAuditFinding,
  updateTenantEnterpriseAuditFinding,
} from "@/modules/audit-v2/audit-findings.repository";
import {
  EnterpriseAuditFindingStatus,
  EnterpriseAuditHistoryAction,
  EnterpriseAuditSeverity,
  PermissionKey,
} from "@prisma/client";
import { NextResponse } from "next/server";

const ALLOWED_TRANSITIONS: Record<
  EnterpriseAuditFindingStatus,
  EnterpriseAuditFindingStatus[]
> = {
  DRAFT: [
    EnterpriseAuditFindingStatus.OPEN,
    EnterpriseAuditFindingStatus.REJECTED,
    EnterpriseAuditFindingStatus.CANCELLED,
  ],
  OPEN: [
    EnterpriseAuditFindingStatus.UNDER_REVIEW,
    EnterpriseAuditFindingStatus.ACTION_REQUIRED,
    EnterpriseAuditFindingStatus.IN_PROGRESS,
    EnterpriseAuditFindingStatus.REJECTED,
    EnterpriseAuditFindingStatus.CANCELLED,
  ],
  UNDER_REVIEW: [
    EnterpriseAuditFindingStatus.OPEN,
    EnterpriseAuditFindingStatus.ACTION_REQUIRED,
    EnterpriseAuditFindingStatus.IN_PROGRESS,
    EnterpriseAuditFindingStatus.REJECTED,
  ],
  ACTION_REQUIRED: [
    EnterpriseAuditFindingStatus.IN_PROGRESS,
    EnterpriseAuditFindingStatus.CANCELLED,
  ],
  IN_PROGRESS: [
    EnterpriseAuditFindingStatus.PENDING_VERIFICATION,
    EnterpriseAuditFindingStatus.CANCELLED,
  ],
  PENDING_VERIFICATION: [
    EnterpriseAuditFindingStatus.VERIFIED,
    EnterpriseAuditFindingStatus.IN_PROGRESS,
  ],
  VERIFIED: [
    EnterpriseAuditFindingStatus.CLOSED,
    EnterpriseAuditFindingStatus.IN_PROGRESS,
  ],
  CLOSED: [
    EnterpriseAuditFindingStatus.IN_PROGRESS,
  ],
  REJECTED: [
    EnterpriseAuditFindingStatus.OPEN,
  ],
  CANCELLED: [
    EnterpriseAuditFindingStatus.OPEN,
  ],
};

function optionalText(
  value: unknown
) {
  const normalized =
    String(value ?? "").trim();

  return normalized || null;
}

function optionalDate(
  value: unknown
) {
  const normalized =
    optionalText(value);

  if (!normalized) {
    return null;
  }

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    throw new Error(
      "The finding due date is invalid."
    );
  }

  return date;
}

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{
      auditId: string;
      findingId: string;
    }>;
  }
) {
  await requirePermission(
    PermissionKey.MANAGE_AUDITS
  );

  const { organizationId, user } =
    await getCurrentUserTenant();

  const { auditId, findingId } =
    await context.params;

  const existing =
    await findTenantEnterpriseAuditFinding({
      organizationId,
      auditId,
      findingId,
    });

  if (!existing) {
    return NextResponse.json(
      {
        success: false,
        message:
          "The audit finding was not found.",
      },
      {
        status: 404,
      }
    );
  }

  const body =
    (await request.json()) as Record<
      string,
      unknown
    >;

  try {
    const nextStatus =
      body.status
        ? String(
            body.status
          ) as EnterpriseAuditFindingStatus
        : existing.status;

    if (
      nextStatus !==
        existing.status &&
      !ALLOWED_TRANSITIONS[
        existing.status
      ].includes(nextStatus)
    ) {
      throw new Error(
        `The finding cannot move from ${existing.status} to ${nextStatus}.`
      );
    }

    const severity =
      body.severity
        ? String(
            body.severity
          ) as EnterpriseAuditSeverity
        : existing.severity;

    if (
      !Object.values(
        EnterpriseAuditSeverity
      ).includes(severity)
    ) {
      throw new Error(
        "The finding severity is invalid."
      );
    }

    const ownerId =
      body.ownerId === undefined
        ? existing.ownerId
        : optionalText(
            body.ownerId
          );

    if (ownerId) {
      const owner =
        await prisma.user.findFirst({
          where: {
            id: ownerId,
            organizationId,
          },
          select: {
            id: true,
          },
        });

      if (!owner) {
        throw new Error(
          "The selected owner was not found in this organization."
        );
      }
    }

    const now = new Date();

    const updated =
      await prisma.$transaction(
        async (transaction) => {
          const record =
            await updateTenantEnterpriseAuditFinding(
              {
                findingId,
                data: {
                  title:
                    optionalText(
                      body.title
                    ) ??
                    existing.title,
                  description:
                    body.description ===
                    undefined
                      ? existing.description
                      : optionalText(
                          body.description
                        ),
                  objectiveEvidence:
                    body.objectiveEvidence ===
                    undefined
                      ? existing.objectiveEvidence
                      : optionalText(
                          body.objectiveEvidence
                        ),
                  immediateCorrection:
                    body.immediateCorrection ===
                    undefined
                      ? existing.immediateCorrection
                      : optionalText(
                          body.immediateCorrection
                        ),
                  containmentAction:
                    body.containmentAction ===
                    undefined
                      ? existing.containmentAction
                      : optionalText(
                          body.containmentAction
                        ),
                  rootCause:
                    body.rootCause ===
                    undefined
                      ? existing.rootCause
                      : optionalText(
                          body.rootCause
                        ),
                  rootCauseCategory:
                    body.rootCauseCategory ===
                    undefined
                      ? existing.rootCauseCategory
                      : optionalText(
                          body.rootCauseCategory
                        ),
                  severity,
                  status: nextStatus,
                  ownerId,
                  dueDate:
                    body.dueDate ===
                    undefined
                      ? existing.dueDate
                      : optionalDate(
                          body.dueDate
                        ),
                  requiresCapa:
                    body.requiresCapa ===
                    undefined
                      ? existing.requiresCapa
                      : body.requiresCapa ===
                        true,
                  requiresRiskReview:
                    body.requiresRiskReview ===
                    undefined
                      ? existing.requiresRiskReview
                      : body.requiresRiskReview ===
                        true,
                  capaSuggestedAt:
                    body.requiresCapa ===
                    true &&
                    !existing.capaSuggestedAt
                      ? now
                      : existing.capaSuggestedAt,
                  riskSuggestedAt:
                    body.requiresRiskReview ===
                    true &&
                    !existing.riskSuggestedAt
                      ? now
                      : existing.riskSuggestedAt,
                  submittedAt:
                    nextStatus ===
                      EnterpriseAuditFindingStatus.UNDER_REVIEW &&
                    !existing.submittedAt
                      ? now
                      : existing.submittedAt,
                  acceptedAt:
                    nextStatus ===
                      EnterpriseAuditFindingStatus.ACTION_REQUIRED &&
                    !existing.acceptedAt
                      ? now
                      : existing.acceptedAt,
                  completedAt:
                    nextStatus ===
                      EnterpriseAuditFindingStatus.PENDING_VERIFICATION &&
                    !existing.completedAt
                      ? now
                      : nextStatus ===
                        EnterpriseAuditFindingStatus.IN_PROGRESS
                        ? null
                        : existing.completedAt,
                  verifiedAt:
                    nextStatus ===
                      EnterpriseAuditFindingStatus.VERIFIED
                      ? now
                      : nextStatus ===
                        EnterpriseAuditFindingStatus.IN_PROGRESS
                        ? null
                        : existing.verifiedAt,
                  closedAt:
                    nextStatus ===
                      EnterpriseAuditFindingStatus.CLOSED
                      ? now
                      : nextStatus ===
                        EnterpriseAuditFindingStatus.IN_PROGRESS
                        ? null
                        : existing.closedAt,
                  reopenedAt:
                    existing.status ===
                      EnterpriseAuditFindingStatus.CLOSED &&
                    nextStatus ===
                      EnterpriseAuditFindingStatus.IN_PROGRESS
                      ? now
                      : existing.reopenedAt,
                  closureSummary:
                    body.closureSummary ===
                    undefined
                      ? existing.closureSummary
                      : optionalText(
                          body.closureSummary
                        ),
                  updatedById:
                    user.id,
                },
              },
              transaction
            );

          await transaction.enterpriseAuditFindingHistory.create({
            data: {
              findingId,
              userId: user.id,
              action:
                EnterpriseAuditHistoryAction.FINDING_UPDATED,
              title:
                "Audit finding updated",
              description:
                `${record.reference}: ${record.title}`,
              previousValue: {
                status:
                  existing.status,
                severity:
                  existing.severity,
                ownerId:
                  existing.ownerId,
                dueDate:
                  existing.dueDate?.toISOString() ??
                  null,
              },
              newValue: {
                status:
                  record.status,
                severity:
                  record.severity,
                ownerId:
                  record.ownerId,
                dueDate:
                  record.dueDate?.toISOString() ??
                  null,
              },
            },
          });

          await transaction.enterpriseAuditHistory.create({
            data: {
              organizationId,
              auditId,
              userId: user.id,
              action:
                EnterpriseAuditHistoryAction.FINDING_UPDATED,
              entityType:
                "EnterpriseAuditFinding",
              entityId:
                findingId,
              title:
                "Enterprise audit finding updated",
              description:
                `${record.reference}: ${record.title}`,
              previousValue: {
                status:
                  existing.status,
                severity:
                  existing.severity,
                ownerId:
                  existing.ownerId,
              },
              newValue: {
                status:
                  record.status,
                severity:
                  record.severity,
                ownerId:
                  record.ownerId,
              },
            },
          });

          return record;
        }
      );

    return NextResponse.json({
      success: true,
      message:
        "The audit finding was updated.",
      findingId:
        updated.id,
      status:
        updated.status,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "The audit finding could not be updated.",
      },
      {
        status: 400,
      }
    );
  }
}
