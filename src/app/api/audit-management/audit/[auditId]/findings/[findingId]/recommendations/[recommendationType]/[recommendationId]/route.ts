import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  EnterpriseAuditHistoryAction,
  EnterpriseAuditLinkStatus,
  PermissionKey,
} from "@prisma/client";
import { NextResponse } from "next/server";

type Decision =
  | "APPROVE"
  | "REJECT";

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{
      auditId: string;
      findingId: string;
      recommendationType: string;
      recommendationId: string;
    }>;
  }
) {
  await requirePermission(
    PermissionKey.MANAGE_AUDITS
  );

  const { organizationId, user } =
    await getCurrentUserTenant();

  const {
    auditId,
    findingId,
    recommendationType,
    recommendationId,
  } = await context.params;

  const body =
    (await request.json()) as {
      decision?: Decision;
      comments?: string;
    };

  if (
    body.decision !== "APPROVE" &&
    body.decision !== "REJECT"
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Select a valid recommendation decision.",
      },
      {
        status: 400,
      }
    );
  }

  const decision: Decision =
  body.decision;

  const finding =
    await prisma.enterpriseAuditFinding.findFirst({
      where: {
        id: findingId,
        auditId,
        organizationId,
      },
      select: {
        id: true,
        reference: true,
      },
    });

  if (!finding) {
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

  const nextStatus =
    decision === "APPROVE"
      ? EnterpriseAuditLinkStatus.APPROVED
      : EnterpriseAuditLinkStatus.REJECTED;

  try {
    if (
      recommendationType === "capa"
    ) {
      const existing =
        await prisma.enterpriseAuditFindingActionLink.findFirst({
          where: {
            id: recommendationId,
            findingId,
          },
        });

      if (!existing) {
        throw new Error(
          "The corrective-action recommendation was not found."
        );
      }

      if (
        existing.status !==
        EnterpriseAuditLinkStatus.PROPOSED
      ) {
        throw new Error(
          "Only proposed recommendations can be reviewed."
        );
      }

      await prisma.$transaction(
        async (transaction) => {
          await transaction.enterpriseAuditFindingActionLink.update({
            where: {
              id: recommendationId,
            },
            data: {
              status: nextStatus,
              reviewedById:
                user.id,
              reviewedAt:
                new Date(),
            },
          });

          await transaction.enterpriseAuditFindingHistory.create({
            data: {
              findingId,
              userId: user.id,
              action:
                EnterpriseAuditHistoryAction.CAPA_LINKED,
              title:
                `Corrective-action recommendation ${decision.toLowerCase()}`,
              description:
                body.comments?.trim() ||
                null,
              previousValue: {
                status:
                  existing.status,
              },
              newValue: {
                status:
                  nextStatus,
              },
            },
          });

          await transaction.enterpriseAuditHistory.create({
            data: {
              organizationId,
              auditId,
              userId: user.id,
              action:
                EnterpriseAuditHistoryAction.CAPA_LINKED,
              entityType:
                "EnterpriseAuditFindingActionLink",
              entityId:
                recommendationId,
              title:
                `CAPA recommendation ${decision.toLowerCase()}`,
              description:
                `${finding.reference}: ${body.comments?.trim() || "Recommendation reviewed."}`,
              previousValue: {
                status:
                  existing.status,
              },
              newValue: {
                status:
                  nextStatus,
              },
            },
          });
        }
      );
    } else if (
      recommendationType === "risk"
    ) {
      const existing =
        await prisma.enterpriseAuditFindingRiskLink.findFirst({
          where: {
            id: recommendationId,
            findingId,
          },
        });

      if (!existing) {
        throw new Error(
          "The risk-review recommendation was not found."
        );
      }

      if (
        existing.status !==
        EnterpriseAuditLinkStatus.PROPOSED
      ) {
        throw new Error(
          "Only proposed recommendations can be reviewed."
        );
      }

      await prisma.$transaction(
        async (transaction) => {
          await transaction.enterpriseAuditFindingRiskLink.update({
            where: {
              id: recommendationId,
            },
            data: {
              status: nextStatus,
              reviewedById:
                user.id,
              reviewedAt:
                new Date(),
            },
          });

          await transaction.enterpriseAuditFindingHistory.create({
            data: {
              findingId,
              userId: user.id,
              action:
                EnterpriseAuditHistoryAction.RISK_LINKED,
              title:
                `Risk-review recommendation ${decision.toLowerCase()}`,
              description:
                body.comments?.trim() ||
                null,
              previousValue: {
                status:
                  existing.status,
              },
              newValue: {
                status:
                  nextStatus,
              },
            },
          });

          await transaction.enterpriseAuditHistory.create({
            data: {
              organizationId,
              auditId,
              userId: user.id,
              action:
                EnterpriseAuditHistoryAction.RISK_LINKED,
              entityType:
                "EnterpriseAuditFindingRiskLink",
              entityId:
                recommendationId,
              title:
                `Risk recommendation ${decision.toLowerCase()}`,
              description:
                `${finding.reference}: ${body.comments?.trim() || "Recommendation reviewed."}`,
              previousValue: {
                status:
                  existing.status,
              },
              newValue: {
                status:
                  nextStatus,
              },
            },
          });
        }
      );
    } else {
      throw new Error(
        "The recommendation type is invalid."
      );
    }

    return NextResponse.json({
      success: true,
      message:
        `The recommendation was ${body.decision.toLowerCase()}.`,
      status: nextStatus,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "The recommendation could not be reviewed.",
      },
      {
        status: 400,
      }
    );
  }
}

