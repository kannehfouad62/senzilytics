"use server";

import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { saveInspectionResponseService } from "@/modules/inspection/inspection-execution.service";
import {
  InspectionResponseResult,
  PermissionKey,
  RiskLevel,
} from "@prisma/client";
import { redirect } from "next/navigation";

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

function getOptionalNumber(
  formData: FormData,
  fieldName: string
) {
  const rawValue =
    getOptionalString(
      formData,
      fieldName
    );

  if (!rawValue) {
    return null;
  }

  const value = Number(rawValue);

  if (!Number.isFinite(value)) {
    throw new Error(
      `${fieldName} must contain a valid number.`
    );
  }

  return value;
}

function getOptionalDate(
  formData: FormData,
  fieldName: string
) {
  const rawValue =
    getOptionalString(
      formData,
      fieldName
    );

  if (!rawValue) {
    return null;
  }

  const value =
    new Date(rawValue);

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

function isInspectionResponseResult(
  value: string
): value is InspectionResponseResult {
  return Object.values(
    InspectionResponseResult
  ).includes(
    value as InspectionResponseResult
  );
}

function isRiskLevel(
  value: string
): value is RiskLevel {
  return Object.values(
    RiskLevel
  ).includes(
    value as RiskLevel
  );
}

export async function saveInspectionResponse(
  formData: FormData
) {
  await requirePermission(
    PermissionKey.MANAGE_INSPECTIONS
  );

  const {
    organizationId,
    user,
  } = await getCurrentUserTenant();

  const inspectionId =
    getRequiredString(
      formData,
      "inspectionId"
    );

  const result =
    getRequiredString(
      formData,
      "result"
    );

  if (
    !isInspectionResponseResult(
      result
    )
  ) {
    throw new Error(
      "A valid inspection response result is required."
    );
  }

  const findingRisk =
    getOptionalString(
      formData,
      "findingRiskLevel"
    );

  if (
    findingRisk &&
    !isRiskLevel(findingRisk)
  ) {
    throw new Error(
      "A valid finding risk level is required."
    );
  }

  const booleanValue =
    getOptionalString(
      formData,
      "booleanValue"
    );

  await saveInspectionResponseService({
    organizationId,
    userId: user.id,
    inspectionId,
    checklistItemId:
      getRequiredString(
        formData,
        "checklistItemId"
      ),
    result,
    responseText:
      getOptionalString(
        formData,
        "responseText"
      ),
    numericValue:
      getOptionalNumber(
        formData,
        "numericValue"
      ),
    booleanValue:
      booleanValue === null
        ? null
        : booleanValue ===
          "true",
    score:
      getOptionalNumber(
        formData,
        "score"
      ),
    comments:
      getOptionalString(
        formData,
        "comments"
      ),
    createFinding:
      formData.get(
        "createFinding"
      ) === "on",
    findingTitle:
      getOptionalString(
        formData,
        "findingTitle"
      ),
    findingDescription:
      getOptionalString(
        formData,
        "findingDescription"
      ),
    findingRiskLevel:
      findingRisk as
        | RiskLevel
        | null,
    findingDueDate:
      getOptionalDate(
        formData,
        "findingDueDate"
      ),
  });

  redirect(
    `/inspections/${inspectionId}`
  );
}