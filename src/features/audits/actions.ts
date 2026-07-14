"use server";

import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  addAuditTeamMemberService,
  createAuditFindingService,
  createAuditService,
  removeAuditTeamMemberService,
  saveAuditResponseService,
  updateAuditFindingStatusService,
  updateAuditStatusService,
  convertAuditFindingToCorrectiveActionService,
} from "@/modules/audit/audit.service";
import {
  AuditResponseResult,
  AuditTeamRole,
  AuditType,
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
  const rawValue =
    getOptionalString(
      formData,
      fieldName
    );

  if (!rawValue) {
    return null;
  }

  const value = new Date(rawValue);

  if (
    Number.isNaN(value.getTime())
  ) {
    throw new Error(
      `${fieldName} must contain a valid date.`
    );
  }

  return value;
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

function isAuditType(
  value: string
): value is AuditType {
  return Object.values(
    AuditType
  ).includes(value as AuditType);
}

function isAuditTeamRole(
  value: string
): value is AuditTeamRole {
  return Object.values(
    AuditTeamRole
  ).includes(
    value as AuditTeamRole
  );
}

function isAuditResponseResult(
  value: string
): value is AuditResponseResult {
  return Object.values(
    AuditResponseResult
  ).includes(
    value as AuditResponseResult
  );
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

  const auditType =
    getRequiredString(
      formData,
      "type"
    );

  if (!isAuditType(auditType)) {
    throw new Error(
      "A valid audit type is required."
    );
  }

  const audit =
    await createAuditService({
      organizationId,
      userId: user.id,
      title: getRequiredString(
        formData,
        "title"
      ),
      reference:
        getOptionalString(
          formData,
          "reference"
        ),
      scope: getOptionalString(
        formData,
        "scope"
      ),
      type: auditType,
      siteId: getRequiredString(
        formData,
        "siteId"
      ),
      scheduledAt:
        getOptionalDate(
          formData,
          "scheduledAt"
        ),
      dueDate: getOptionalDate(
        formData,
        "dueDate"
      ),
      leadAuditorId:
        getOptionalString(
          formData,
          "leadAuditorId"
        ),
      checklistTemplateId:
        getOptionalString(
          formData,
          "checklistTemplateId"
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

export async function addAuditTeamMember(
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

  const teamRole =
    getRequiredString(
      formData,
      "teamRole"
    );

  if (
    !isAuditTeamRole(teamRole)
  ) {
    throw new Error(
      "A valid audit team role is required."
    );
  }

  await addAuditTeamMemberService({
    organizationId,
    userId: user.id,
    auditId,
    teamMemberId:
      getRequiredString(
        formData,
        "teamMemberId"
      ),
    teamRole,
  });

  redirect(`/audits/${auditId}`);
}

export async function removeAuditTeamMember(
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

  await removeAuditTeamMemberService({
    organizationId,
    userId: user.id,
    auditId,
    teamMemberId:
      getRequiredString(
        formData,
        "teamMemberId"
      ),
  });

  redirect(`/audits/${auditId}`);
}

export async function saveAuditResponse(
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

  const resultValue =
    getRequiredString(
      formData,
      "result"
    );

  if (
    !isAuditResponseResult(
      resultValue
    )
  ) {
    throw new Error(
      "A valid audit response result is required."
    );
  }

  const findingRiskLevelValue =
    getOptionalString(
      formData,
      "findingRiskLevel"
    );

  if (
    findingRiskLevelValue &&
    !isRiskLevel(
      findingRiskLevelValue
    )
  ) {
    throw new Error(
      "A valid finding risk level is required."
    );
  }

  const booleanValueRaw =
    getOptionalString(
      formData,
      "booleanValue"
    );

  await saveAuditResponseService({
    organizationId,
    userId: user.id,
    auditId,
    checklistItemId:
      getRequiredString(
        formData,
        "checklistItemId"
      ),
    result: resultValue,
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
      booleanValueRaw === null
        ? null
        : booleanValueRaw === "true",
    score: getOptionalNumber(
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
      findingRiskLevelValue as
        | RiskLevel
        | null,
    findingDueDate:
      getOptionalDate(
        formData,
        "findingDueDate"
      ),
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
    dueDate: getOptionalDate(
      formData,
      "dueDate"
    ),
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
    findingId:
      getRequiredString(
        formData,
        "findingId"
      ),
    status: statusValue,
  });

  redirect(`/audits/${auditId}`);
}

export async function convertAuditFindingToCorrectiveAction(
  formData: FormData
) {
  await requirePermission(
    PermissionKey.CREATE_CAPA
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

  if (!isRiskLevel(riskLevelValue)) {
    throw new Error(
      "A valid corrective-action risk level is required."
    );
  }

  const dueDate =
    getOptionalDate(
      formData,
      "dueDate"
    );

  if (!dueDate) {
    throw new Error(
      "A corrective-action due date is required."
    );
  }

  await convertAuditFindingToCorrectiveActionService({
    organizationId,
    userId: user.id,
    auditId,
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
    riskLevel:
      riskLevelValue,
    assignedToId:
      getRequiredString(
        formData,
        "assignedToId"
      ),
    dueDate,
  });

  redirect(`/audits/${auditId}`);
}