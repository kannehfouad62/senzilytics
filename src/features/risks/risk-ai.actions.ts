"use server";

import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { generateRiskAiDraftService } from "@/modules/risk/risk-ai.service";
import type { RiskAiActionState } from "@/modules/risk/risk-ai.types";
import { PermissionKey } from "@prisma/client";

function getRequiredString(
  formData: FormData,
  fieldName: string
) {
  const value = String(
    formData.get(fieldName) || ""
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
    formData.get(fieldName) || ""
  ).trim();

  return value || null;
}

export async function generateRiskAiDraft(
  _previousState: RiskAiActionState,
  formData: FormData
): Promise<RiskAiActionState> {
  try {
    await requirePermission(
      PermissionKey.VIEW_RISKS
    );

    await requirePermission(
      PermissionKey.USE_AI
    );

    const {
      organizationId,
      user,
    } = await getCurrentUserTenant();

    const draft =
      await generateRiskAiDraftService({
        organizationId,
        userId: user.id,

        riskId:
          getRequiredString(
            formData,
            "riskId"
          ),

        advisorContext:
          getOptionalString(
            formData,
            "advisorContext"
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
      "AI risk-advisor generation failed:",
      error
    );

    return {
      status: "ERROR",
      draft: null,
      error:
        error instanceof Error
          ? error.message
          : "The AI risk analysis could not be generated.",
      generatedAt: null,
    };
  }
}