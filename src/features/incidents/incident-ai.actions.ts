"use server";

import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { generateIncidentInvestigationAiDraftService } from "@/modules/incident/incident-ai.service";
import type {
  IncidentInvestigationAiActionState,
} from "@/modules/incident/incident-ai.types";
import {
  PermissionKey,
} from "@prisma/client";

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

export async function generateIncidentInvestigationAiDraft(
  _previousState: IncidentInvestigationAiActionState,
  formData: FormData
): Promise<IncidentInvestigationAiActionState> {
  try {
    await requirePermission(
      PermissionKey.USE_AI
    );

    const {
      organizationId,
      user,
    } = await getCurrentUserTenant();

    const draft =
      await generateIncidentInvestigationAiDraftService({
        organizationId,
        userId: user.id,
        incidentId:
          getRequiredString(
            formData,
            "incidentId"
          ),
        investigatorContext:
          getOptionalString(
            formData,
            "investigatorContext"
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
      "AI incident-investigation generation failed:",
      error
    );

    return {
      status: "ERROR",
      draft: null,
      error:
        error instanceof Error
          ? error.message
          : "The AI investigation draft could not be generated.",
      generatedAt: null,
    };
  }
}