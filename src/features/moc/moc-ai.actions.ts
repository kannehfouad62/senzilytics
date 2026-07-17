"use server";

import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { generateMocAiAssessmentService } from "@/modules/moc/moc-ai.service";
import type { MocAiActionState } from "@/modules/moc/moc-ai.types";
import { applyMocAiRecommendationsService } from "@/modules/moc/moc-ai-apply.service";
import type {
  MocAiApplyActionState,
} from "@/modules/moc/moc-ai.types";
import {  MocApprovalRole,
  MocTaskType,
  PermissionKey,
  RiskImpact,
  RiskLikelihood, } from "@prisma/client";

function getRequiredString(
  formData: FormData,
  fieldName: string
) {
  const value = String(
    formData.get(fieldName) ?? ""
  ).trim();

  if (!value) {
    throw new Error(
      `${fieldName} is required.`
    );
  }

  return value;
}

function getOptionalString(
  formData: FormData,
  fieldName: string
) {
  const value = String(
    formData.get(fieldName) ?? ""
  ).trim();

  return value || null;
}

function getBoolean(
  formData: FormData,
  fieldName: string
) {
  const value =
    formData.get(fieldName);

  return (
    value === "true" ||
    value === "on" ||
    value === "1"
  );
}

function isEnumValue<
  T extends Record<string, string>,
>(
  enumObject: T,
  value: string
): value is T[keyof T] {
  return Object.values(
    enumObject
  ).includes(
    value as T[keyof T]
  );
}

function parseJsonArray(
  formData: FormData,
  fieldName: string
): unknown[] {
  const rawValue =
    getOptionalString(
      formData,
      fieldName
    );

  if (!rawValue) {
    return [];
  }

  try {
    const parsedValue =
      JSON.parse(rawValue);

    if (
      !Array.isArray(
        parsedValue
      )
    ) {
      throw new Error();
    }

    return parsedValue;
  } catch {
    throw new Error(
      `${fieldName} contains invalid recommendation data.`
    );
  }
}

export async function generateMocAiAssessment(
  _previousState: MocAiActionState,
  formData: FormData
): Promise<MocAiActionState> {
  try {
    await requirePermission(
      PermissionKey.MANAGE_MOC
    );

    const {
      organizationId,
      user,
    } = await getCurrentUserTenant();

    const mocId =
      getRequiredString(
        formData,
        "mocId"
      );

    const draft =
      await generateMocAiAssessmentService({
        organizationId,
        userId: user.id,
        mocId,

        reviewerContext:
          getOptionalString(
            formData,
            "reviewerContext"
          ),
      });

    return {
      status: "SUCCESS",
      draft,
      error: null,
      generatedAt:
        new Date().toISOString(),
    };
  } catch (error) {
    console.error(
      "AI MOC assessment generation failed:",
      error
    );

    return {
      status: "ERROR",
      draft: null,

      error:
        error instanceof Error
          ? error.message
          : "The AI change assessment could not be generated.",

      generatedAt: null,
    };
  }
}

export async function applyMocAiRecommendations(
  _previousState: MocAiApplyActionState,
  formData: FormData
): Promise<MocAiApplyActionState> {
  try {
    await requirePermission(
      PermissionKey.MANAGE_MOC
    );

    const {
      organizationId,
      user,
    } =
      await getCurrentUserTenant();

    const mocId =
      getRequiredString(
        formData,
        "mocId"
      );

    const applyResidualRisk =
      getBoolean(
        formData,
        "applyResidualRisk"
      );

    const applyApprovals =
      getBoolean(
        formData,
        "applyApprovals"
      );

    const applyTasks =
      getBoolean(
        formData,
        "applyTasks"
      );

    if (
      !applyResidualRisk &&
      !applyApprovals &&
      !applyTasks
    ) {
      return {
        status: "ERROR",
        message:
          "Select at least one recommendation category to apply.",
        result: null,
      };
    }

    const likelihoodValue =
      getOptionalString(
        formData,
        "residualLikelihood"
      );

    const impactValue =
      getOptionalString(
        formData,
        "residualImpact"
      );

    let residualRiskRecommendation:
      | {
          likelihood: RiskLikelihood;
          impact: RiskImpact;
          rationale: string;
        }
      | null = null;

    if (applyResidualRisk) {
      if (
        !likelihoodValue ||
        !impactValue ||
        !isEnumValue(
          RiskLikelihood,
          likelihoodValue
        ) ||
        !isEnumValue(
          RiskImpact,
          impactValue
        )
      ) {
        return {
          status: "ERROR",
          message:
            "The recommended residual-risk values are invalid.",
          result: null,
        };
      }

      residualRiskRecommendation =
        {
          likelihood:
            likelihoodValue,

          impact:
            impactValue,

          rationale:
            getOptionalString(
              formData,
              "residualRiskRationale"
            ) ??
            "Reviewed AI residual-risk recommendation.",
        };
    }

    const rawApprovals =
      parseJsonArray(
        formData,
        "recommendedApprovals"
      );

    const recommendedApprovals =
      rawApprovals.flatMap(
        (value) => {
          if (
            !value ||
            typeof value !==
              "object"
          ) {
            return [];
          }

          const item =
            value as Record<
              string,
              unknown
            >;

          const role =
            String(
              item.role ?? ""
            );

          const sequence =
            Number(
              item.sequence
            );

          if (
            !isEnumValue(
              MocApprovalRole,
              role
            ) ||
            !Number.isInteger(
              sequence
            )
          ) {
            return [];
          }

          return [
            {
              role,

              sequence,

              rationale:
                String(
                  item.rationale ??
                    ""
                ),

              required:
                item.required ===
                true,
            },
          ];
        }
      );

    const rawTasks =
      parseJsonArray(
        formData,
        "recommendedTasks"
      );

    const recommendedTasks =
      rawTasks.flatMap(
        (value) => {
          if (
            !value ||
            typeof value !==
              "object"
          ) {
            return [];
          }

          const item =
            value as Record<
              string,
              unknown
            >;

          const taskType =
            String(
              item.taskType ??
                ""
            );

          const sequence =
            Number(
              item.sequence
            );

          const suggestedDueDays =
            Number(
              item.suggestedDueDays
            );

          if (
            !isEnumValue(
              MocTaskType,
              taskType
            ) ||
            !Number.isInteger(
              sequence
            ) ||
            !Number.isInteger(
              suggestedDueDays
            )
          ) {
            return [];
          }

          return [
            {
              recommendationId:
                String(
                  item.recommendationId ??
                    ""
                ),

              title:
                String(
                  item.title ??
                    ""
                ),

              description:
                String(
                  item.description ??
                    ""
                ),

              taskType,

              sequence,

              required:
                item.required ===
                true,

              suggestedOwnerFunction:
                String(
                  item.suggestedOwnerFunction ??
                    ""
                ),

              suggestedDueDays,

              completionEvidence:
                String(
                  item.completionEvidence ??
                    ""
                ),

              verificationCriteria:
                Array.isArray(
                  item.verificationCriteria
                )
                  ? item.verificationCriteria.map(
                      String
                    )
                  : [],
            },
          ];
        }
      );

    const result =
      await applyMocAiRecommendationsService({
        organizationId,
        userId: user.id,
        mocId,

        applyResidualRisk,
        applyApprovals,
        applyTasks,

        residualRiskRecommendation,

        recommendedApprovals,

        recommendedTasks,
      });

    return {
      status: "SUCCESS",

      message:
        "The selected AI recommendations were applied successfully.",

      result,
    };
  } catch (error) {
    console.error(
      "Applying AI MOC recommendations failed:",
      error
    );

    return {
      status: "ERROR",

      message:
        error instanceof Error
          ? error.message
          : "The selected AI recommendations could not be applied.",

      result: null,
    };
  }
}