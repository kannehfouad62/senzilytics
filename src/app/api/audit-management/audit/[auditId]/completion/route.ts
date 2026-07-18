import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  EnterpriseAuditEvidenceType,
  EnterpriseAuditHistoryAction,
  EnterpriseAuditResponseResult,
  EnterpriseAuditStatus,
  PermissionKey,
  Prisma,
} from "@prisma/client";
import { NextResponse } from "next/server";

const ANSWERED_RESULTS =
  new Set<EnterpriseAuditResponseResult>(
    Object.values(
      EnterpriseAuditResponseResult
    ).filter(
      (result) =>
        result !==
        EnterpriseAuditResponseResult.NOT_ASSESSED
    )
  );

const TERMINAL_STATUSES =
  new Set<EnterpriseAuditStatus>([
    EnterpriseAuditStatus.COMPLETED,
    EnterpriseAuditStatus.CANCELLED,
    EnterpriseAuditStatus.CLOSED,
  ]);

type CompletionIssue = {
  questionId: string;
  sectionTitle: string;
  questionText: string;
  reason:
    | "RESPONSE_REQUIRED"
    | "COMMENT_REQUIRED"
    | "EVIDENCE_REQUIRED"
    | "PHOTO_REQUIRED";
  message: string;
};

async function getCompletionContext(
  organizationId: string,
  auditId: string,
  userId: string,
  database:
    | typeof prisma
    | Prisma.TransactionClient = prisma
) {
  return database.enterpriseAudit.findFirst({
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
      completedAt: true,
      teamMembers: {
        where: {
          userId,
        },
        select: {
          canEdit: true,
          canReview: true,
          role: true,
        },
      },
      sections: {
        where: {
          isActive: true,
        },
        orderBy: {
          sequence: "asc",
        },
        select: {
          id: true,
          title: true,
          questions: {
            where: {
              isActive: true,
            },
            orderBy: {
              sequence: "asc",
            },
            select: {
              id: true,
              questionText: true,
              isRequired: true,
              requireComment: true,
              requireEvidence: true,
              requirePhoto: true,
              response: {
                select: {
                  id: true,
                  result: true,
                  comments: true,
                  answeredAt: true,
                },
              },
              evidence: {
                select: {
                  id: true,
                  evidenceType: true,
                },
              },
            },
          },
        },
      },
    },
  });
}

function buildCompletionIssues(
  audit: NonNullable<
    Awaited<
      ReturnType<typeof getCompletionContext>
    >
  >
) {
  const issues: CompletionIssue[] = [];

  for (const section of audit.sections) {
    for (const question of section.questions) {
      if (!question.isRequired) {
        continue;
      }

      const response = question.response;
      const answered =
        response !== null &&
        ANSWERED_RESULTS.has(response.result) &&
        response.answeredAt !== null;

      if (!answered) {
        issues.push({
          questionId: question.id,
          sectionTitle: section.title,
          questionText:
            question.questionText,
          reason: "RESPONSE_REQUIRED",
          message:
            "A response is required.",
        });
        continue;
      }

      if (
        question.requireComment &&
        !response.comments?.trim()
      ) {
        issues.push({
          questionId: question.id,
          sectionTitle: section.title,
          questionText:
            question.questionText,
          reason: "COMMENT_REQUIRED",
          message:
            "A comment is required.",
        });
      }

      if (
        question.requireEvidence &&
        question.evidence.length === 0
      ) {
        issues.push({
          questionId: question.id,
          sectionTitle: section.title,
          questionText:
            question.questionText,
          reason: "EVIDENCE_REQUIRED",
          message:
            "Evidence is required.",
        });
      }

      if (
        question.requirePhoto &&
        !question.evidence.some(
          (item) =>
            item.evidenceType ===
            EnterpriseAuditEvidenceType.PHOTO
        )
      ) {
        issues.push({
          questionId: question.id,
          sectionTitle: section.title,
          questionText:
            question.questionText,
          reason: "PHOTO_REQUIRED",
          message:
            "Photographic evidence is required.",
        });
      }
    }
  }

  return issues;
}

function serializeReadiness(
  audit: NonNullable<
    Awaited<
      ReturnType<typeof getCompletionContext>
    >
  >,
  userId: string
) {
  const issues =
    buildCompletionIssues(audit);

  const membership =
    audit.teamMembers[0] ?? null;

  return {
    auditId: audit.id,
    status: audit.status,
    ready: issues.length === 0,
    issueCount: issues.length,
    issues,
    completedAt:
      audit.completedAt?.toISOString() ??
      null,
    access: {
      canEdit:
        audit.leadAuditorId === userId ||
        audit.ownerId === userId ||
        membership?.canEdit === true,
      canReview:
        audit.leadAuditorId === userId ||
        audit.ownerId === userId ||
        membership?.canReview === true,
    },
    metrics: {
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
  };
}

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      auditId: string;
    }>;
  }
) {
  await requirePermission(
    PermissionKey.VIEW_AUDITS
  );

  const { organizationId, user } =
    await getCurrentUserTenant();

  const { auditId } =
    await context.params;

  const audit =
    await getCompletionContext(
      organizationId,
      auditId,
      user.id
    );

  if (!audit) {
    return NextResponse.json(
      {
        success: false,
        message:
          "The enterprise audit was not found.",
      },
      {
        status: 404,
      }
    );
  }

  return NextResponse.json({
    success: true,
    readiness:
      serializeReadiness(
        audit,
        user.id
      ),
  });
}

export async function POST(
  _request: Request,
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

  const result =
    await prisma.$transaction(
      async (transaction) => {
        const audit =
          await getCompletionContext(
            organizationId,
            auditId,
            user.id,
            transaction
          );

        if (!audit) {
          throw new Error(
            "The enterprise audit was not found."
          );
        }

        if (
          audit.status ===
          EnterpriseAuditStatus.PENDING_REVIEW
        ) {
          return {
            alreadySubmitted: true,
            readiness:
              serializeReadiness(
                audit,
                user.id
              ),
          };
        }

        if (
          TERMINAL_STATUSES.has(
            audit.status
          )
        ) {
          throw new Error(
            "This audit cannot be submitted from its current status."
          );
        }

        const readiness =
          serializeReadiness(
            audit,
            user.id
          );

        if (!readiness.access.canEdit) {
          throw new Error(
            "You are not authorized to submit this audit for review."
          );
        }

        if (!readiness.ready) {
          return {
            alreadySubmitted: false,
            readiness,
          };
        }

        const submittedAt =
          new Date();

        const submitted =
          await transaction.enterpriseAudit.update({
            where: {
              id: audit.id,
            },
            data: {
              status:
                EnterpriseAuditStatus.PENDING_REVIEW,
              updatedById: user.id,
            },
            select: {
              status: true,
            },
          });

        await transaction.enterpriseAuditHistory.create({
          data: {
            organizationId,
            auditId: audit.id,
            userId: user.id,
            action:
              EnterpriseAuditHistoryAction.SUBMITTED_FOR_REVIEW,
            entityType:
              "EnterpriseAudit",
            entityId: audit.id,
            title:
              "Enterprise audit submitted for review",
            description:
              `${audit.reference}: ${audit.title} was submitted for independent review.`,
            previousValue: {
              status: audit.status,
            },
            newValue: {
              status: submitted.status,
            },
            metadata: {
              submittedAt:
                submittedAt.toISOString(),
              totalQuestionCount:
                readiness.metrics.totalQuestionCount,
              answeredQuestionCount:
                readiness.metrics.answeredQuestionCount,
              failedQuestionCount:
                readiness.metrics.failedQuestionCount,
              scorePercentage:
                readiness.metrics.scorePercentage,
            },
          },
        });

        return {
          alreadySubmitted: false,
          readiness: {
            ...readiness,
            status: submitted.status,
          },
        };
      }
    );

  if (!result.readiness.ready) {
    return NextResponse.json(
      {
        success: false,
        message:
          "The audit is not ready for review.",
        readiness:
          result.readiness,
      },
      {
        status: 409,
      }
    );
  }

  return NextResponse.json({
    success: true,
    message:
      result.alreadySubmitted
        ? "The audit is already pending review."
        : "The audit was submitted for review.",
    readiness:
      result.readiness,
  });
}
