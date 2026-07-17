"use server";

import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { generateExecutiveReportAiDraftService } from "@/modules/report/executive-report-ai.service";
import type { ExecutiveReportAiActionState } from "@/modules/report/executive-report-ai.types";
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

function getRequiredDate(
  formData: FormData,
  fieldName: string,
  endOfDay = false
) {
  const rawValue =
    getRequiredString(
      formData,
      fieldName
    );

  const value = new Date(
    `${rawValue}T${
      endOfDay
        ? "23:59:59.999"
        : "00:00:00.000"
    }`
  );

  if (
    Number.isNaN(
      value.getTime()
    )
  ) {
    throw new Error(
      `${fieldName} must contain a valid date.`
    );
  }

  return value;
}

export async function generateExecutiveReportAiDraft(
  _previousState: ExecutiveReportAiActionState,
  formData: FormData
): Promise<ExecutiveReportAiActionState> {
  try {
    await requirePermission(
      PermissionKey.VIEW_REPORTS
    );

    await requirePermission(
      PermissionKey.USE_AI
    );

    const {
      organizationId,
      user,
    } = await getCurrentUserTenant();

    const from =
      getRequiredDate(
        formData,
        "from"
      );

    const to =
      getRequiredDate(
        formData,
        "to",
        true
      );

    if (
      from.getTime() >
      to.getTime()
    ) {
      throw new Error(
        "The report start date cannot be later than the report end date."
      );
    }

    const draft =
      await generateExecutiveReportAiDraftService({
        organizationId,
        userId: user.id,
        from,
        to,
        siteId:
          getOptionalString(
            formData,
            "siteId"
          ),
        leadershipContext:
          getOptionalString(
            formData,
            "leadershipContext"
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
      "AI executive-insights generation failed:",
      error
    );

    return {
      status: "ERROR",
      draft: null,
      error:
        error instanceof Error
          ? error.message
          : "The AI executive insights could not be generated.",
      generatedAt: null,
    };
  }
}