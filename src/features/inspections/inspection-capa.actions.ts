"use server";

import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { convertInspectionFindingToCorrectiveActionService } from "@/modules/inspection/inspection-capa.service";
import {
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

function getRequiredDate(
  formData: FormData,
  fieldName: string
) {
  const rawValue =
    getRequiredString(
      formData,
      fieldName
    );

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

function isRiskLevel(
  value: string
): value is RiskLevel {
  return Object.values(
    RiskLevel
  ).includes(
    value as RiskLevel
  );
}

export async function convertInspectionFindingToCorrectiveAction(
  formData: FormData
) {
  await requirePermission(
    PermissionKey.CREATE_CAPA
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

  const riskLevel =
    getRequiredString(
      formData,
      "riskLevel"
    );

  if (!isRiskLevel(riskLevel)) {
    throw new Error(
      "A valid corrective-action risk level is required."
    );
  }

  await convertInspectionFindingToCorrectiveActionService({
    organizationId,
    userId: user.id,
    inspectionId,
    findingId:
      getRequiredString(
        formData,
        "findingId"
      ),
    title:
      getRequiredString(
        formData,
        "title"
      ),
    description:
      getOptionalString(
        formData,
        "description"
      ),
    riskLevel,
    assignedToId:
      getRequiredString(
        formData,
        "assignedToId"
      ),
    dueDate:
      getRequiredDate(
        formData,
        "dueDate"
      ),
  });

  redirect(
    `/inspections/${inspectionId}`
  );
}