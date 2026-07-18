import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  ActivityAction,
  EnterpriseAuditHistoryAction,
  EnterpriseAuditLinkStatus,
  NotificationType,
  PermissionKey,
  RiskLevel,
  Status,
} from "@prisma/client";
import { NextResponse } from "next/server";

function severityToRiskLevel(
  severity: string
): RiskLevel {
  switch (severity) {
    case "CRITICAL":
      return RiskLevel.CRITICAL;
    case "HIGH":
      return RiskLevel.HIGH;
    case "MEDIUM":
      return RiskLevel.MEDIUM;
    case "LOW":
    case "OBSERVATION":
    default:
      return RiskLevel.LOW;
  }
}

export async function POST(
  _request: Request,
  context: {
    params: Promise<{
      auditId: string;
      findingId: string;
      recommendationId: string;
    }>;
  }
) {
  await requirePermission(
    PermissionKey.CREATE_CAPA
  );

  const { organizationId, user } =
    await getCurrentUserTenant();

  const {
    auditId,
    findingId,
    recommendationId,
  } = await context.params;

  try {
    const result =
      await prisma.$transaction(
        async (transaction) => {
          const finding =
            await transaction.enterpriseAuditFinding.findFirst({
              where: {
                id: findingId,
                auditId,
                organizationId,
              },
              select: {
                id: true,
                reference: true,
                title: true,
                severity: true,
                status: true,
                ownerId: true,
                dueDate: true,
                audit: {
                  select: {
                    id: true,
                    reference: true,
                    title: true,
                  },
                },
              },
            });

          if (!finding) {
            throw new Error(
              "The enterprise audit finding was not found."
            );
          }

          const recommendation =
            await transaction.enterpriseAuditFindingActionLink.findFirst({
              where: {
                id: recommendationId,
                findingId,
              },
              select: {
                id: true,
                status: true,
                correctiveActionId: true,
                recommendationTitle: true,
                recommendationDescription: true,
                suggestedOwnerId: true,
                suggestedDueDate: true,
                rationale: true,
              },
            });

          if (!recommendation) {
            throw new Error(
              "The CAPA recommendation was not found."
            );
          }

          if (
            recommendation.correctiveActionId
          ) {
            return {
              duplicate: true,
              correctiveActionId:
                recommendation.correctiveActionId,
            };
          }

          if (
            recommendation.status !==
            EnterpriseAuditLinkStatus.APPROVED
          ) {
            throw new Error(
              "Only approved CAPA recommendations can be converted into corrective actions."
            );
          }

          const assignedToId =
            recommendation.suggestedOwnerId ??
            finding.ownerId;

          if (!assignedToId) {
            throw new Error(
              "A corrective-action assignee is required before materialization."
            );
          }

          const assignedUser =
            await transaction.user.findFirst({
              where: {
                id: assignedToId,
                organizationId,
              },
              select: {
                id: true,
                name: true,
                email: true,
              },
            });

          if (!assignedUser) {
            throw new Error(
              "The corrective-action assignee was not found in this organization."
            );
          }

          const dueDate =
            recommendation.suggestedDueDate ??
            finding.dueDate;

          if (!dueDate) {
            throw new Error(
              "A corrective-action due date is required before materialization."
            );
          }

          const action =
            await transaction.correctiveAction.create({
              data: {
                title:
                  recommendation.recommendationTitle ??
                  `Corrective action for ${finding.reference}`,
                description:
                  recommendation.recommendationDescription ??
                  recommendation.rationale ??
                  `Created from enterprise audit finding ${finding.reference}.`,
                status: Status.OPEN,
                riskLevel:
                  severityToRiskLevel(
                    finding.severity
                  ),
                dueDate,
                assignedToId,
              },
              select: {
                id: true,
                title: true,
                description: true,
                status: true,
                riskLevel: true,
                dueDate: true,
                assignedToId: true,
              },
            });

          await transaction.enterpriseAuditFindingActionLink.update({
            where: {
              id: recommendation.id,
            },
            data: {
              correctiveActionId:
                action.id,
              status:
                EnterpriseAuditLinkStatus.CREATED,
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
                "Corrective action created and linked",
              description:
                `${action.title} was created from ${finding.reference}.`,
              previousValue: {
                recommendationStatus:
                  recommendation.status,
                correctiveActionId:
                  null,
              },
              newValue: {
                recommendationStatus:
                  EnterpriseAuditLinkStatus.CREATED,
                correctiveActionId:
                  action.id,
                assignedToId:
                  action.assignedToId,
                dueDate:
                  action.dueDate.toISOString(),
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
                "CorrectiveAction",
              entityId:
                action.id,
              title:
                "Audit CAPA materialized",
              description:
                `${finding.reference}: ${action.title}`,
              previousValue: {
                recommendationId:
                  recommendation.id,
                recommendationStatus:
                  recommendation.status,
              },
              newValue: {
                correctiveActionId:
                  action.id,
                recommendationStatus:
                  EnterpriseAuditLinkStatus.CREATED,
                status:
                  action.status,
                riskLevel:
                  action.riskLevel,
                assignedToId:
                  action.assignedToId,
                dueDate:
                  action.dueDate.toISOString(),
              },
              metadata: {
                findingId,
                auditReference:
                  finding.audit.reference,
                source:
                  "ENTERPRISE_AUDIT_FINDING",
              },
            },
          });

          await transaction.activityLog.create({
            data: {
              organizationId,
              userId: user.id,
              action:
                ActivityAction.CREATE,
              entityType:
                "CorrectiveAction",
              entityId:
                action.id,
              title:
                "Corrective action created from audit finding",
              description:
                action.title,
              metadata: {
                auditId,
                findingId,
                findingReference:
                  finding.reference,
                recommendationId:
                  recommendation.id,
                assignedToId:
                  action.assignedToId,
                dueDate:
                  action.dueDate.toISOString(),
                riskLevel:
                  action.riskLevel,
              },
            },
          });

          await transaction.notification.create({
            data: {
              organizationId,
              userId:
                assignedUser.id,
              type:
                NotificationType.ASSIGNMENT,
              title:
                "Corrective action assigned",
              message:
                `You were assigned: ${action.title}`,
              link:
                `/actions/${action.id}`,
            },
          });

          return {
            duplicate: false,
            correctiveActionId:
              action.id,
          };
        }
      );

    return NextResponse.json({
      success: true,
      duplicate:
        result.duplicate,
      message:
        result.duplicate
          ? "This recommendation is already linked to a corrective action."
          : "The corrective action was created and linked.",
      correctiveActionId:
        result.correctiveActionId,
      correctiveActionUrl:
        `/actions/${result.correctiveActionId}`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "The corrective action could not be created.",
      },
      {
        status: 400,
      }
    );
  }
}
