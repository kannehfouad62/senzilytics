import { logActivity } from "@/core/activity-log/activity-log.service";
import { prisma } from "@/lib/prisma";
import { findTenantMocById } from "@/modules/moc/moc.repository";
import { calculateRiskRating } from "@/modules/risk/risk-scoring";
import {
  ActivityAction,
  MocApprovalRole,
  MocApprovalStatus,
  MocStatus,
  MocTaskStatus,
  MocTaskType,
  RiskImpact,
  RiskLikelihood,
} from "@prisma/client";

type ApprovalRecommendationInput = {
  role: MocApprovalRole;
  sequence: number;
  rationale: string;
  required: boolean;
};

type TaskRecommendationInput = {
  recommendationId: string;
  title: string;
  description: string;
  taskType: MocTaskType;
  sequence: number;
  required: boolean;
  suggestedOwnerFunction: string;
  suggestedDueDays: number;
  completionEvidence: string;
  verificationCriteria: string[];
};

function normalizeText(
  value: string
) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function addDays(
  value: Date,
  days: number
) {
  const result = new Date(value);

  result.setDate(
    result.getDate() + days
  );

  return result;
}

export async function applyMocAiRecommendationsService(
  input: {
    organizationId: string;
    userId: string;
    mocId: string;

    applyResidualRisk: boolean;
    applyApprovals: boolean;
    applyTasks: boolean;

    residualRiskRecommendation?: {
      likelihood: RiskLikelihood;
      impact: RiskImpact;
      rationale: string;
    } | null;

    recommendedApprovals:
      ApprovalRecommendationInput[];

    recommendedTasks:
      TaskRecommendationInput[];
  }
) {
  const moc =
    await findTenantMocById({
      organizationId:
        input.organizationId,

      mocId:
        input.mocId,
    });

  if (!moc) {
    throw new Error(
      "Management of change record not found in this organization."
    );
  }

  if (
    moc.status ===
      MocStatus.CLOSED ||
    moc.status ===
      MocStatus.CANCELLED
  ) {
    throw new Error(
      "AI recommendations cannot be applied to a closed or cancelled change."
    );
  }

  const result = {
    residualRiskUpdated: false,
    approvalsCreated: 0,
    approvalsSkipped: 0,
    tasksCreated: 0,
    tasksSkipped: 0,
  };

  const existingApprovalRoles =
    new Set(
      moc.approvals.map(
        (approval) =>
          approval.role
      )
    );

  const existingTasks =
    new Set(
      moc.tasks.map(
        (task) =>
          `${task.taskType}:${normalizeText(
            task.title
          )}`
      )
    );

  await prisma.$transaction(
    async (transaction) => {
      if (
        input.applyResidualRisk &&
        input.residualRiskRecommendation
      ) {
        const rating =
          calculateRiskRating({
            likelihood:
              input
                .residualRiskRecommendation
                .likelihood,

            impact:
              input
                .residualRiskRecommendation
                .impact,
          });

        await transaction.managementOfChange.update({
          where: {
            id: moc.id,
          },

          data: {
            residualLikelihood:
              input
                .residualRiskRecommendation
                .likelihood,

            residualImpact:
              input
                .residualRiskRecommendation
                .impact,

            residualScore:
              rating.score,

            residualRiskLevel:
              rating.riskLevel,
          },
        });

        result.residualRiskUpdated =
          true;
      }

      if (input.applyApprovals) {
        const orderedApprovals =
          [...input.recommendedApprovals]
            .filter(
              (approval) =>
                approval.required
            )
            .sort(
              (first, second) =>
                first.sequence -
                second.sequence
            );

        for (
          const approval
          of orderedApprovals
        ) {
          if (
            existingApprovalRoles.has(
              approval.role
            )
          ) {
            result.approvalsSkipped +=
              1;

            continue;
          }

          let sequence =
            Math.max(
              approval.sequence,
              1
            );

          while (
            moc.approvals.some(
              (existingApproval) =>
                existingApproval.sequence ===
                  sequence
            )
          ) {
            sequence += 1;
          }

          await transaction.mocApproval.create({
            data: {
              mocId:
                moc.id,

              role:
                approval.role,

              sequence,

              status:
                MocApprovalStatus.PENDING,

              comments:
                `AI recommendation rationale: ${approval.rationale}`,
            },
          });

          existingApprovalRoles.add(
            approval.role
          );

          result.approvalsCreated +=
            1;
        }
      }

      if (input.applyTasks) {
        const orderedTasks =
          [...input.recommendedTasks]
            .sort(
              (first, second) =>
                first.sequence -
                second.sequence
            );

        for (
          const task
          of orderedTasks
        ) {
          const title =
            task.title.trim();

          if (!title) {
            result.tasksSkipped +=
              1;

            continue;
          }

          const duplicateKey =
            `${task.taskType}:${normalizeText(
              title
            )}`;

          if (
            existingTasks.has(
              duplicateKey
            )
          ) {
            result.tasksSkipped +=
              1;

            continue;
          }

          const suggestedDueDays =
            Math.min(
              Math.max(
                task.suggestedDueDays,
                1
              ),
              365
            );

          const verificationText =
            task.verificationCriteria
              .filter(Boolean)
              .map(
                (criterion) =>
                  `• ${criterion}`
              )
              .join("\n");

          const description = [
            task.description.trim(),

            task.suggestedOwnerFunction
              ? `Suggested owner function: ${task.suggestedOwnerFunction}`
              : null,

            task.completionEvidence
              ? `Completion evidence: ${task.completionEvidence}`
              : null,

            verificationText
              ? `Verification criteria:\n${verificationText}`
              : null,

            task.recommendationId
              ? `AI recommendation: ${task.recommendationId}`
              : null,
          ]
            .filter(Boolean)
            .join("\n\n");

          await transaction.mocTask.create({
            data: {
              mocId:
                moc.id,

              title,

              description:
                description ||
                null,

              taskType:
                task.taskType,

              status:
                MocTaskStatus.NOT_STARTED,

              sequence:
                task.sequence > 0
                  ? task.sequence
                  : null,

              isRequired:
                task.required,

              dueDate:
                addDays(
                  new Date(),
                  suggestedDueDays
                ),
            },
          });

          existingTasks.add(
            duplicateKey
          );

          result.tasksCreated +=
            1;
        }
      }
    }
  );

  await logActivity({
    organizationId:
      input.organizationId,

    userId:
      input.userId,

    action:
      ActivityAction.UPDATE,

    entityType:
      "MocAI",

    entityId:
      moc.id,

    title:
      "AI MOC recommendations applied",

    description:
      `Reviewed AI recommendations were applied to ${moc.reference}.`,

    metadata: {
      mocId:
        moc.id,

      mocReference:
        moc.reference,

      residualRiskUpdated:
        result.residualRiskUpdated,

      approvalsCreated:
        result.approvalsCreated,

      approvalsSkipped:
        result.approvalsSkipped,

      tasksCreated:
        result.tasksCreated,

      tasksSkipped:
        result.tasksSkipped,

      automaticallyApproved:
        false,

      appliedAt:
        new Date().toISOString(),
    },
  });

  return result;
}