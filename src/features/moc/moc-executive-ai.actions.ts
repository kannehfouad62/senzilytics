"use server";

import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { generateMocExecutiveAiSummaryService } from "@/modules/moc/moc-executive-ai.service";
import type { MocExecutiveAiActionState } from "@/modules/moc/moc-executive-ai.types";
import { PermissionKey } from "@prisma/client";

function getOptionalString(
  formData: FormData,
  fieldName: string
) {
  const value = String(
    formData.get(fieldName) ?? ""
  ).trim();

  return value || null;
}

export async function generateMocExecutiveAiSummary(
  _previousState: MocExecutiveAiActionState,
  formData: FormData
): Promise<MocExecutiveAiActionState> {
  try {
    await requirePermission(
      PermissionKey.VIEW_MOC
    );

    const {
      organizationId,
      user,
    } = await getCurrentUserTenant();

    const draft =
      await generateMocExecutiveAiSummaryService({
        organizationId,
        userId: user.id,

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
      "Executive MOC AI summary generation failed:",
      error
    );

    return {
      status: "ERROR",
      draft: null,

      error:
        error instanceof Error
          ? error.message
          : "The executive MOC summary could not be generated.",

      generatedAt: null,
    };
  }
}