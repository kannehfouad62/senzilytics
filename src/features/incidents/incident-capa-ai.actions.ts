"use server";

import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { generateIncidentCorrectiveActionAiDraftService } from "@/modules/incident/incident-capa-ai.service";
import type {
  IncidentCorrectiveActionAiActionState,
} from "@/modules/incident/incident-capa-ai.types";
import {
  PermissionKey,
} from "@prisma/client";

function getRequiredString(
  formData: FormData,
  fieldName: string
) {
  const value = String(
    formData.get(fieldName) ||
      ""
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
    formData.get(fieldName) ||
      ""
  ).trim();

  return value || null;
}

export async function generateIncidentCorrectiveActionAiDraft(
  _previousState:
    IncidentCorrectiveActionAiActionState,
  formData: FormData
): Promise<IncidentCorrectiveActionAiActionState> {
  try {
    await requirePermission(
      PermissionKey.USE_AI
    );

    const {
      organizationId,
      user,
    } =
      await getCurrentUserTenant();

    const draft =
      await generateIncidentCorrectiveActionAiDraftService({
        organizationId,
        userId: user.id,

        incidentId:
          getRequiredString(
            formData,
            "incidentId"
          ),

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
      "AI corrective-action recommendation generation failed:",
      error
    );

    return {
      status: "ERROR",
      draft: null,
      error:
        error instanceof Error
          ? error.message
          : "Corrective-action recommendations could not be generated.",
      generatedAt: null,
    };
  }
}