import { logActivity } from "@/core/activity-log/activity-log.service";
import { createNotification } from "@/core/notifications/notifications.service";
import { prisma } from "@/lib/prisma";
import {
  ActivityAction,
  InspectionResponseResult,
  NotificationType,
  RiskLevel,
  Status,
  UserRole,
} from "@prisma/client";

async function notifyInspectionFinding(input: {
  organizationId: string;
  inspectionId: string;
  inspectionTitle: string;
  findingTitle: string;
  riskLevel: RiskLevel;
}) {
  const recipients =
    await prisma.user.findMany({
      where: {
        organizationId: input.organizationId,
        role: {
          in: [
            UserRole.ORG_ADMIN,
            UserRole.EHS_MANAGER,
            UserRole.SUPERVISOR,
          ],
        },
      },
      select: {
        id: true,
      },
    });

  const type =
    input.riskLevel ===
    RiskLevel.CRITICAL
      ? NotificationType.CRITICAL
      : input.riskLevel ===
          RiskLevel.HIGH
        ? NotificationType.WARNING
        : NotificationType.INFO;

  await Promise.all(
    recipients.map(
      async (recipient) => {
        try {
          await createNotification({
            organizationId:
              input.organizationId,
            userId: recipient.id,
            type,
            title:
              input.riskLevel ===
              RiskLevel.CRITICAL
                ? "Critical inspection finding"
                : input.riskLevel ===
                    RiskLevel.HIGH
                  ? "High-risk inspection finding"
                  : "Inspection finding recorded",
            message:
              `"${input.findingTitle}" was recorded during ` +
              `"${input.inspectionTitle}".`,
            link:
              `/inspections/${input.inspectionId}`,
          });
        } catch (error) {
          console.error(
            `Inspection-finding notification failed for user ${recipient.id}:`,
            error
          );
        }
      }
    )
  );
}

export async function saveInspectionResponseService(input: {
  organizationId: string;
  userId: string;
  inspectionId: string;
  checklistItemId: string;
  result: InspectionResponseResult;
  responseText?: string | null;
  numericValue?: number | null;
  booleanValue?: boolean | null;
  score?: number | null;
  comments?: string | null;
  createFinding: boolean;
  findingTitle?: string | null;
  findingDescription?: string | null;
  findingRiskLevel?: RiskLevel | null;
  findingDueDate?: Date | null;
}) {
  const checklistItem =
    await prisma.inspectionChecklistItem.findFirst({
      where: {
        id: input.checklistItemId,
        inspectionId:
          input.inspectionId,
        inspection: {
          site: {
            organizationId:
              input.organizationId,
          },
        },
      },
      include: {
        response: {
          include: {
            finding: true,
          },
        },
        inspection: {
          select: {
            id: true,
            title: true,
            status: true,
            startedAt: true,
            site: {
              select: {
                organizationId: true,
              },
            },
          },
        },
      },
    });

  if (!checklistItem) {
    throw new Error(
      "Invalid inspection checklist item for this organization."
    );
  }

  if (
    checklistItem.inspection.status ===
      Status.COMPLETED ||
    checklistItem.inspection.status ===
      Status.CLOSED
  ) {
    throw new Error(
      "Responses cannot be changed after an inspection is completed or closed."
    );
  }

  const response =
    await prisma.inspectionResponse.upsert({
      where: {
        checklistItemId:
          checklistItem.id,
      },
      update: {
        answeredById:
          input.userId,
        result: input.result,
        responseText:
          input.responseText,
        numericValue:
          input.numericValue,
        booleanValue:
          input.booleanValue,
        score: input.score,
        comments: input.comments,
        answeredAt: new Date(),
      },
      create: {
        inspectionId:
          input.inspectionId,
        checklistItemId:
          checklistItem.id,
        answeredById:
          input.userId,
        result: input.result,
        responseText:
          input.responseText,
        numericValue:
          input.numericValue,
        booleanValue:
          input.booleanValue,
        score: input.score,
        comments: input.comments,
        answeredAt: new Date(),
      },
    });

  if (
    checklistItem.inspection.status ===
    Status.OPEN
  ) {
    await prisma.inspection.update({
      where: {
        id: input.inspectionId,
      },
      data: {
        status:
          Status.IN_PROGRESS,
        startedAt:
          checklistItem.inspection
            .startedAt ??
          new Date(),
      },
    });
  }

  let findingId:
    | string
    | null = null;

  if (
    input.result ===
      InspectionResponseResult.NON_COMPLIANT &&
    input.createFinding
  ) {
    const title =
      input.findingTitle?.trim() ||
      `Noncompliance: ${checklistItem.questionText}`;

    const description =
      input.findingDescription ||
      input.comments ||
      `Noncompliance identified for inspection checklist question: ${checklistItem.questionText}`;

    const riskLevel =
      input.findingRiskLevel ??
      RiskLevel.MEDIUM;

    const finding =
      await prisma.inspectionFinding.upsert({
        where: {
          responseId: response.id,
        },
        update: {
          title,
          description,
          riskLevel,
          dueDate:
            input.findingDueDate,
        },
        create: {
          inspectionId:
            input.inspectionId,
          responseId:
            response.id,
          title,
          description,
          riskLevel,
          status: Status.OPEN,
          dueDate:
            input.findingDueDate,
        },
      });

    findingId = finding.id;

    await notifyInspectionFinding({
      organizationId:
        input.organizationId,
      inspectionId:
        input.inspectionId,
      inspectionTitle:
        checklistItem.inspection
          .title,
      findingTitle:
        finding.title,
      riskLevel:
        finding.riskLevel,
    });
  }

  await logActivity({
    organizationId:
      input.organizationId,
    userId: input.userId,
    action:
      ActivityAction.UPDATE,
    entityType:
      "InspectionResponse",
    entityId: response.id,
    title:
      "Inspection checklist response saved",
    description:
      checklistItem.questionText,
    metadata: {
      inspectionId:
        input.inspectionId,
      checklistItemId:
        checklistItem.id,
      result:
        response.result,
      score:
        response.score?.toString() ??
        null,
      findingId,
      answeredAt:
        response.answeredAt?.toISOString() ??
        null,
    },
  });

  return response;
}