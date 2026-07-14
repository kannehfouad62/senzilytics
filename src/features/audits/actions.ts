"use server";

import {
  createAuditFindingService,
  createAuditService,
  updateAuditFindingStatusService,
  updateAuditStatusService,
} from "@/modules/audit/audit.service";
import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  PermissionKey,
  RiskLevel,
  Status,
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

function getOptionalDate(
  formData: FormData,
  fieldName: string
) {
  const value =
    getOptionalString(
      formData,
      fieldName
    );

  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    throw new Error(
      `${fieldName} must contain a valid date.`
    );
  }

  return date;
}

function isRiskLevel(
  value: string
): value is RiskLevel {
  return Object.values(
    RiskLevel
  ).includes(value as RiskLevel);
}

function isStatus(
  value: string
): value is Status {
  return Object.values(
    Status
  ).includes(value as Status);
}

export async function createAudit(
  formData: FormData
) {
  await requirePermission(
    PermissionKey.MANAGE_AUDITS
  );

  const {
    organizationId,
    user,
  } = await getCurrentUserTenant();

  const audit =
    await createAuditService({
      organizationId,
      userId: user.id,
      title: getRequiredString(
        formData,
        "title"
      ),
      scope: getOptionalString(
        formData,
        "scope"
      ),
      siteId: getRequiredString(
        formData,
        "siteId"
      ),
      scheduledAt:
        getOptionalDate(
          formData,
          "scheduledAt"
        ),
    });

  redirect(`/audits/${audit.id}`);
}

export async function updateAuditStatus(
  formData: FormData
) {
  await requirePermission(
    PermissionKey.MANAGE_AUDITS
  );

  const {
    organizationId,
    user,
  } = await getCurrentUserTenant();

  const auditId =
    getRequiredString(
      formData,
      "auditId"
    );

  const statusValue =
    getRequiredString(
      formData,
      "status"
    );

  if (!isStatus(statusValue)) {
    throw new Error(
      "A valid audit status is required."
    );
  }

  await updateAuditStatusService({
    organizationId,
    userId: user.id,
    auditId,
    status: statusValue,
  });

  redirect(`/audits/${auditId}`);
}

export async function createAuditFinding(
  formData: FormData
) {
  await requirePermission(
    PermissionKey.MANAGE_AUDITS
  );

  const {
    organizationId,
    user,
  } = await getCurrentUserTenant();

  const auditId =
    getRequiredString(
      formData,
      "auditId"
    );

  const riskLevelValue =
    getRequiredString(
      formData,
      "riskLevel"
    );

  if (
    !isRiskLevel(
      riskLevelValue
    )
  ) {
    throw new Error(
      "A valid risk level is required."
    );
  }

  await createAuditFindingService({
    organizationId,
    userId: user.id,
    auditId,
    title: getRequiredString(
      formData,
      "title"
    ),
    description:
      getOptionalString(
        formData,
        "description"
      ),
    riskLevel: riskLevelValue,
  });

  redirect(`/audits/${auditId}`);
}

export async function updateAuditFindingStatus(
  formData: FormData
) {
  await requirePermission(
    PermissionKey.MANAGE_AUDITS
  );

  const {
    organizationId,
    user,
  } = await getCurrentUserTenant();

  const auditId =
    getRequiredString(
      formData,
      "auditId"
    );

  const findingId =
    getRequiredString(
      formData,
      "findingId"
    );

  const statusValue =
    getRequiredString(
      formData,
      "status"
    );

  if (!isStatus(statusValue)) {
    throw new Error(
      "A valid finding status is required."
    );
  }

  await updateAuditFindingStatusService({
    organizationId,
    userId: user.id,
    auditId,
    findingId,
    status: statusValue,
  });

  redirect(`/audits/${auditId}`);
}