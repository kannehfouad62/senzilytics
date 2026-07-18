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
  EnterpriseAuditResponseResult,
  PermissionKey,
  Prisma,
  RiskLevel,
  Status,
} from "@prisma/client";
import { redirect } from "next/navigation";

import {
  saveEnterpriseAuditResponseService,
} from "@/modules/audit-v2/audit-execution.service";

import { revalidatePath } from "next/cache";

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

export type AuditExecutionActionResult<
  T = undefined,
> = {
  success: boolean;
  message: string;
  data?: T;
  fieldErrors?: Record<string, string>;
};

export type SavedAuditResponseActionData = {
  responseId: string;
  auditId: string;
  questionId: string;
  sectionId: string;
  result: EnterpriseAuditResponseResult;
  scoreAwarded: string | null;
  maximumScore: string | null;
  isCompliant: boolean | null;
  requiresFollowUp: boolean;
  automaticFindingId: string | null;

  sectionProgress: {
    status: string;
    answeredQuestionCount: number;
    failedQuestionCount: number;
    achievedScore: string | null;
    maximumPossibleScore: string | null;
    scorePercentage: string | null;
  };

  auditProgress: {
    status: string;
    answeredQuestionCount: number;
    failedQuestionCount: number;
    achievedScore: string | null;
    maximumPossibleScore: string | null;
    scorePercentage: string | null;
  };
};

function auditExecutionSuccessResult<T>(
  message: string,
  data: T
): AuditExecutionActionResult<T> {
  return {
    success: true,
    message,
    data,
  };
}

function auditExecutionErrorResult<T>(
  error: unknown,
  fallbackMessage: string
): AuditExecutionActionResult<T> {
  console.error(fallbackMessage, error);

  return {
    success: false,
    message:
      error instanceof Error &&
      error.message.trim()
        ? error.message
        : fallbackMessage,
  };
}

function getAuditExecutionRequiredString(
  formData: FormData,
  fieldName: string,
  label: string
) {
  const value = String(
    formData.get(fieldName) ?? ""
  ).trim();

  if (!value) {
    throw new Error(`${label} is required.`);
  }

  return value;
}

function getAuditExecutionOptionalString(
  formData: FormData,
  fieldName: string
) {
  const value = String(
    formData.get(fieldName) ?? ""
  ).trim();

  return value || null;
}

function getAuditExecutionEnumValue<
  TEnum extends Record<string, string>,
>(
  formData: FormData,
  fieldName: string,
  enumObject: TEnum,
  label: string
): TEnum[keyof TEnum] {
  const value =
    getAuditExecutionRequiredString(
      formData,
      fieldName,
      label
    );

  const allowedValues = Object.values(
    enumObject
  );

  if (!allowedValues.includes(value)) {
    throw new Error(
      `${label} contains an invalid value.`
    );
  }

  return value as TEnum[keyof TEnum];
}

function getAuditExecutionNullableBoolean(
  formData: FormData,
  fieldName: string
): boolean | null {
  if (!formData.has(fieldName)) {
    return null;
  }

  const value = String(
    formData.get(fieldName) ?? ""
  )
    .trim()
    .toLowerCase();

  if (!value) {
    return null;
  }

  if (
    ["true", "1", "yes", "on"].includes(
      value
    )
  ) {
    return true;
  }

  if (
    ["false", "0", "no", "off"].includes(
      value
    )
  ) {
    return false;
  }

  throw new Error(
    "Boolean response contains an invalid value."
  );
}

function getAuditExecutionSelectedOptions(
  formData: FormData
) {
  const submittedValues = formData
    .getAll("selectedOptionValues")
    .map((value) => String(value).trim())
    .filter(Boolean);

  if (submittedValues.length > 1) {
    return Array.from(
      new Set(submittedValues)
    );
  }

  const singleValue =
    submittedValues[0] ?? null;

  if (!singleValue) {
    return [];
  }

  if (
    singleValue.startsWith("[") &&
    singleValue.endsWith("]")
  ) {
    let parsed: unknown;

    try {
      parsed = JSON.parse(singleValue);
    } catch {
      throw new Error(
        "Selected audit options contain invalid JSON."
      );
    }

    if (
      !Array.isArray(parsed) ||
      !parsed.every(
        (value) => typeof value === "string"
      )
    ) {
      throw new Error(
        "Selected audit options must be an array of strings."
      );
    }

    return Array.from(
      new Set(
        parsed
          .map((value) => value.trim())
          .filter(Boolean)
      )
    );
  }

  return [singleValue];
}

function auditExecutionDecimalToString(
  value: Prisma.Decimal | null
) {
  return value?.toString() ?? null;
}

function revalidateAuditExecutionPaths(
  auditId: string,
  sectionId?: string | null,
  findingId?: string | null
) {
  revalidatePath("/audits");
  revalidatePath(`/audits/${auditId}`);

  revalidatePath("/audit-management");
  revalidatePath(
    "/audit-management/audits"
  );
  revalidatePath(
    `/audit-management/audits/${auditId}`
  );

  if (sectionId) {
    revalidatePath(
      `/audit-management/audits/${auditId}/sections/${sectionId}`
    );
  }

  if (findingId) {
    revalidatePath(
      `/audit-management/audits/${auditId}/findings/${findingId}`
    );
  }
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

export async function saveEnterpriseAuditResponse(
  formData: FormData
): Promise<
  AuditExecutionActionResult<SavedAuditResponseActionData>
> {
  try {
    await requirePermission(
      PermissionKey.MANAGE_AUDITS
    );

    const { organizationId, user } =
      await getCurrentUserTenant();

    const auditId =
      getAuditExecutionRequiredString(
        formData,
        "auditId",
        "Enterprise audit"
      );

    const questionId =
      getAuditExecutionRequiredString(
        formData,
        "questionId",
        "Audit question"
      );

    const result =
      getAuditExecutionEnumValue(
        formData,
        "result",
        EnterpriseAuditResponseResult,
        "Audit response result"
      );

    const saved =
      await saveEnterpriseAuditResponseService({
        organizationId,
        auditId,
        questionId,
        userId: user.id,
        result,
        responseText:
          getAuditExecutionOptionalString(
            formData,
            "responseText"
          ),
        numericValue:
          getAuditExecutionOptionalString(
            formData,
            "numericValue"
          ),
        booleanValue:
          getAuditExecutionNullableBoolean(
            formData,
            "booleanValue"
          ),
        selectedOptionValues:
          getAuditExecutionSelectedOptions(
            formData
          ),
        comments:
          getAuditExecutionOptionalString(
            formData,
            "comments"
          ),
      });

    revalidateAuditExecutionPaths(
      saved.auditId,
      saved.sectionId,
      saved.automaticFindingId
    );

    return auditExecutionSuccessResult(
      saved.automaticFindingId
        ? "Audit response saved and a finding was created automatically."
        : "Audit response saved successfully.",
      {
        responseId: saved.responseId,
        auditId: saved.auditId,
        questionId: saved.questionId,
        sectionId: saved.sectionId,
        result: saved.result,

        scoreAwarded:
          auditExecutionDecimalToString(
            saved.scoreAwarded
          ),

        maximumScore:
          auditExecutionDecimalToString(
            saved.maximumScore
          ),

        isCompliant: saved.isCompliant,

        requiresFollowUp:
          saved.requiresFollowUp,

        automaticFindingId:
          saved.automaticFindingId,

        sectionProgress: {
          status:
            saved.sectionProgress.status,

          answeredQuestionCount:
            saved.sectionProgress
              .answeredQuestionCount,

          failedQuestionCount:
            saved.sectionProgress
              .failedQuestionCount,

          achievedScore:
            auditExecutionDecimalToString(
              saved.sectionProgress
                .achievedScore
            ),

          maximumPossibleScore:
            auditExecutionDecimalToString(
              saved.sectionProgress
                .maximumPossibleScore
            ),

          scorePercentage:
            auditExecutionDecimalToString(
              saved.sectionProgress
                .scorePercentage
            ),
        },

        auditProgress: {
          status:
            saved.auditProgress.status,

          answeredQuestionCount:
            saved.auditProgress
              .answeredQuestionCount,

          failedQuestionCount:
            saved.auditProgress
              .failedQuestionCount,

          achievedScore:
            auditExecutionDecimalToString(
              saved.auditProgress
                .achievedScore
            ),

          maximumPossibleScore:
            auditExecutionDecimalToString(
              saved.auditProgress
                .maximumPossibleScore
            ),

          scorePercentage:
            auditExecutionDecimalToString(
              saved.auditProgress
                .scorePercentage
            ),
        },
      }
    );
  } catch (error) {
    return auditExecutionErrorResult<
      SavedAuditResponseActionData
    >(
      error,
      "The audit response could not be saved."
    );
  }
}