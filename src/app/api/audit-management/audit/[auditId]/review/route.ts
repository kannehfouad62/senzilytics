import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  EnterpriseAuditHistoryAction,
  EnterpriseAuditSectionStatus,
  EnterpriseAuditStatus,
  PermissionKey,
} from "@prisma/client";
import { NextResponse } from "next/server";

type ReviewDecision =
  | "APPROVE"
  | "RETURN";

function normalizeComments(
  value: unknown
) {
  return String(value ?? "").trim();
}

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      auditId: string;
    }>;
  }
) {
  await requirePermission(
    PermissionKey.MANAGE_AUDITS
  );

  const { organizationId, user } =
    await getCurrentUserTenant();

  const { auditId } =
    await context.params;

  const body =
    (await request.json()) as {
      decision?: ReviewDecision;
      comments?: string;
    };

  const decision = body.decision;
  const comments =
    normalizeComments(body.comments);

  if (
    decision !== "APPROVE" &&
    decision !== "RETURN"
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Select a valid review decision.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    decision === "RETURN" &&
    !comments
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Review comments are required when returning an audit.",
      },
      {
        status: 400,
      }
    );
  }

  const result =
    await prisma.$transaction(
      async (transaction) => {
        const audit =
          await transaction.enterpriseAudit.findFirst({
            where: {
              id: auditId,
              organizationId,
            },
            select: {
              id: true,
              reference: true,
              title: true,
              status: true,
              leadAuditorId: true,
              ownerId: true,
              totalQuestionCount: true,
              answeredQuestionCount: true,
              failedQuestionCount: true,
              achievedScore: true,
              maximumPossibleScore: true,
              scorePercentage: true,
              teamMembers: {
                where: {
                  userId: user.id,
                },
                select: {
                  canReview: true,
                  role: true,
                },
              },
            },
          });

        if (!audit) {
          throw new Error(
            "The enterprise audit was not found."
          );
        }

        if (
          audit.status !==
          EnterpriseAuditStatus.PENDING_REVIEW
        ) {
          throw new Error(
            "Only audits pending review can receive a review decision."
          );
        }

        const canReview =
          audit.leadAuditorId === user.id ||
          audit.ownerId === user.id ||
          audit.teamMembers.some(
            (member) =>
              member.canReview
          );

        if (!canReview) {
          throw new Error(
            "You are not authorized to review this audit."
          );
        }

        const now = new Date();

        if (decision === "RETURN") {
          const returned =
            await transaction.enterpriseAudit.update({
              where: {
                id: audit.id,
              },
              data: {
                status:
                  EnterpriseAuditStatus.IN_PROGRESS,
                completedAt: null,
                updatedById: user.id,
              },
              select: {
                status: true,
                completedAt: true,
              },
            });

          await transaction.enterpriseAuditHistory.create({
            data: {
              organizationId,
              auditId: audit.id,
              userId: user.id,
              action:
                EnterpriseAuditHistoryAction.REOPENED,
              entityType:
                "EnterpriseAudit",
              entityId: audit.id,
              title:
                "Enterprise audit returned for correction",
              description:
                comments,
              previousValue: {
                status: audit.status,
              },
              newValue: {
                status: returned.status,
              },
              metadata: {
                decision,
                reviewComments:
                  comments,
                reviewedAt:
                  now.toISOString(),
              },
            },
          });

          return {
            status: returned.status,
            completedAt: null,
            message:
              "The audit was returned for correction.",
          };
        }

        await transaction.enterpriseAuditSection.updateMany({
          where: {
            auditId: audit.id,
            isActive: true,
          },
          data: {
            status:
              EnterpriseAuditSectionStatus.COMPLETED,
            completedAt: now,
          },
        });

        const approved =
          await transaction.enterpriseAudit.update({
            where: {
              id: audit.id,
            },
            data: {
              status:
                EnterpriseAuditStatus.COMPLETED,
              completedAt: now,
              updatedById: user.id,
            },
            select: {
              status: true,
              completedAt: true,
            },
          });

        await transaction.enterpriseAuditHistory.create({
          data: {
            organizationId,
            auditId: audit.id,
            userId: user.id,
            action:
              EnterpriseAuditHistoryAction.COMPLETED,
            entityType:
              "EnterpriseAudit",
            entityId: audit.id,
            title:
              "Enterprise audit approved and completed",
            description:
              comments ||
              `${audit.reference}: ${audit.title} passed review and was completed.`,
            previousValue: {
              status: audit.status,
            },
            newValue: {
              status: approved.status,
              completedAt:
                approved.completedAt?.toISOString() ??
                null,
            },
            metadata: {
              decision,
              reviewComments:
                comments || null,
              reviewedAt:
                now.toISOString(),
              totalQuestionCount:
                audit.totalQuestionCount,
              answeredQuestionCount:
                audit.answeredQuestionCount,
              failedQuestionCount:
                audit.failedQuestionCount,
              achievedScore:
                audit.achievedScore?.toString() ??
                null,
              maximumPossibleScore:
                audit.maximumPossibleScore?.toString() ??
                null,
              scorePercentage:
                audit.scorePercentage?.toString() ??
                null,
            },
          },
        });

        return {
          status: approved.status,
          completedAt:
            approved.completedAt?.toISOString() ??
            null,
          message:
            "The audit was approved, completed, and locked.",
        };
      }
    );

  return NextResponse.json({
    success: true,
    ...result,
  });
}
