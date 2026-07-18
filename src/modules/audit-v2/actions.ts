"use server";

import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  changeAuditScheduleStatusService,
  createAuditScheduleService,
  generateAuditFromScheduleService,
  updateAuditScheduleService,
  type AuditScheduleTeamMemberInput,
} from "@/modules/audit-v2/audit-schedule.service";
import {
  EnterpriseAuditFrequency,
  EnterpriseAuditScheduleStatus,
  EnterpriseAuditScheduleTeamRole,
  PermissionKey,
  Prisma,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

const AUDIT_ROOT_PATH = "/audit-management";
const AUDIT_SCHEDULES_PATH = `${AUDIT_ROOT_PATH}/schedules`;
const ENTERPRISE_AUDITS_PATH = `${AUDIT_ROOT_PATH}/audits`;

export type AuditV2ActionResult<T = undefined> = {
  success: boolean;
  message: string;
  data?: T;
  fieldErrors?: Record<string, string>;
};

function successResult<T>(
  message: string,
  data?: T
): AuditV2ActionResult<T> {
  return {
    success: true,
    message,
    ...(data === undefined ? {} : { data }),
  };
}

function errorResult<T = undefined>(
  error: unknown,
  fallbackMessage: string
): AuditV2ActionResult<T> {
  console.error(fallbackMessage, error);

  if (error instanceof Error && error.message.trim()) {
    return {
      success: false,
      message: error.message,
    };
  }

  return {
    success: false,
    message: fallbackMessage,
  };
}

function getRequiredString(
  formData: FormData,
  fieldName: string,
  label = fieldName
) {
  const value = String(formData.get(fieldName) ?? "").trim();

  if (!value) {
    throw new Error(`${label} is required.`);
  }

  return value;
}

function getOptionalString(
  formData: FormData,
  fieldName: string
) {
  const value = String(formData.get(fieldName) ?? "").trim();

  return value || null;
}

function getRequiredInteger(
  formData: FormData,
  fieldName: string,
  label = fieldName
) {
  const rawValue = getRequiredString(
    formData,
    fieldName,
    label
  );

  const value = Number(rawValue);

  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be a whole number.`);
  }

  return value;
}

function getBoolean(
  formData: FormData,
  fieldName: string,
  defaultValue = false
) {
  const rawValue = formData.get(fieldName);

  if (rawValue === null) {
    return defaultValue;
  }

  const normalized = String(rawValue).trim().toLowerCase();

  return ["true", "1", "yes", "on"].includes(normalized);
}

function getRequiredDate(
  formData: FormData,
  fieldName: string,
  label = fieldName
) {
  const rawValue = getRequiredString(
    formData,
    fieldName,
    label
  );

  const value = new Date(rawValue);

  if (Number.isNaN(value.getTime())) {
    throw new Error(`${label} must contain a valid date.`);
  }

  return value;
}

function getOptionalDate(
  formData: FormData,
  fieldName: string,
  label = fieldName
) {
  const rawValue = getOptionalString(formData, fieldName);

  if (!rawValue) {
    return null;
  }

  const value = new Date(rawValue);

  if (Number.isNaN(value.getTime())) {
    throw new Error(`${label} must contain a valid date.`);
  }

  return value;
}

function getEnumValue<T extends string>(
  formData: FormData,
  fieldName: string,
  enumObject: Record<string, T>,
  label = fieldName
): T {
  const rawValue = getRequiredString(
    formData,
    fieldName,
    label
  );

  const validValues = Object.values(enumObject);

  if (!validValues.includes(rawValue as T)) {
    throw new Error(`${label} is invalid.`);
  }

  return rawValue as T;
}

function parseJsonValue(
  formData: FormData,
  fieldName: string
): Prisma.InputJsonValue | null {
  const rawValue = getOptionalString(formData, fieldName);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as Prisma.InputJsonValue;
  } catch {
    throw new Error(
      `${fieldName} must contain valid JSON.`
    );
  }
}

function isScheduleTeamRole(
  value: unknown
): value is EnterpriseAuditScheduleTeamRole {
  return (
    typeof value === "string" &&
    Object.values(
      EnterpriseAuditScheduleTeamRole
    ).includes(value as EnterpriseAuditScheduleTeamRole)
  );
}

function parseTeamMembers(
  formData: FormData
): AuditScheduleTeamMemberInput[] {
  const rawJson = getOptionalString(
    formData,
    "teamMembers"
  );

  if (rawJson) {
    let parsedValue: unknown;

    try {
      parsedValue = JSON.parse(rawJson);
    } catch {
      throw new Error(
        "Audit team members must contain valid JSON."
      );
    }

    if (!Array.isArray(parsedValue)) {
      throw new Error(
        "Audit team members must be provided as an array."
      );
    }

    return parsedValue.map((member, index) => {
      if (
        !member ||
        typeof member !== "object" ||
        Array.isArray(member)
      ) {
        throw new Error(
          `Audit team member ${index + 1} is invalid.`
        );
      }

      const record = member as Record<string, unknown>;
      const userId =
        typeof record.userId === "string"
          ? record.userId.trim()
          : "";

      if (!userId) {
        throw new Error(
          `Audit team member ${index + 1} requires a user.`
        );
      }

      if (!isScheduleTeamRole(record.role)) {
        throw new Error(
          `Audit team member ${index + 1} has an invalid role.`
        );
      }

      return {
        userId,
        role: record.role,
        isRequired:
          typeof record.isRequired === "boolean"
            ? record.isRequired
            : true,
      };
    });
  }

  /*
   * This fallback supports standard HTML forms that submit parallel fields:
   *
   * teamMemberUserId
   * teamMemberRole
   * teamMemberRequired
   */
  const userIds = formData
    .getAll("teamMemberUserId")
    .map(String)
    .map((value) => value.trim());

  const roles = formData
    .getAll("teamMemberRole")
    .map(String);

  const requiredValues = formData
    .getAll("teamMemberRequired")
    .map(String);

  return userIds
    .map((userId, index) => {
      if (!userId) {
        return null;
      }

      const role = roles[index];

      if (!isScheduleTeamRole(role)) {
        throw new Error(
          `Audit team member ${index + 1} has an invalid role.`
        );
      }

      return {
        userId,
        role,
        isRequired:
          requiredValues[index] === undefined
            ? true
            : ["true", "1", "yes", "on"].includes(
                requiredValues[index].toLowerCase()
              ),
      };
    })
    .filter(
      (
        member
      ): member is AuditScheduleTeamMemberInput =>
        member !== null
    );
}

function revalidateAuditSchedulePaths(
  scheduleId?: string | null,
  auditId?: string | null
) {
  revalidatePath(AUDIT_ROOT_PATH);
  revalidatePath(AUDIT_SCHEDULES_PATH);
  revalidatePath(ENTERPRISE_AUDITS_PATH);

  if (scheduleId) {
    revalidatePath(
      `${AUDIT_SCHEDULES_PATH}/${scheduleId}`
    );
  }

  if (auditId) {
    revalidatePath(
      `${ENTERPRISE_AUDITS_PATH}/${auditId}`
    );
  }

  /*
   * Keep legacy audit pages synchronized during the Audit 2.0 transition.
   */
  revalidatePath("/audits");
}

function parseAuditScheduleFormData(
  formData: FormData
) {
  return {
    programId: getRequiredString(
      formData,
      "programId",
      "Audit program"
    ),

    name: getRequiredString(
      formData,
      "name",
      "Schedule name"
    ),

    description: getOptionalString(
      formData,
      "description"
    ),

    status: getEnumValue(
      formData,
      "status",
      EnterpriseAuditScheduleStatus,
      "Schedule status"
    ),

    frequency: getEnumValue(
      formData,
      "frequency",
      EnterpriseAuditFrequency,
      "Schedule frequency"
    ),

    intervalValue: getRequiredInteger(
      formData,
      "intervalValue",
      "Schedule interval"
    ),

    recurrenceRule: parseJsonValue(
      formData,
      "recurrenceRule"
    ),

    timezone: getOptionalString(
      formData,
      "timezone"
    ),

    startDate: getRequiredDate(
      formData,
      "startDate",
      "Start date"
    ),

    endDate: getOptionalDate(
      formData,
      "endDate",
      "End date"
    ),

    generateDaysBefore: getRequiredInteger(
      formData,
      "generateDaysBefore",
      "Generate-days-before value"
    ),

    dueDaysAfter: getRequiredInteger(
      formData,
      "dueDaysAfter",
      "Due-days-after value"
    ),

    siteId: getRequiredString(
      formData,
      "siteId",
      "Site"
    ),

    departmentId: getOptionalString(
      formData,
      "departmentId"
    ),

    leadAuditorId: getOptionalString(
      formData,
      "leadAuditorId"
    ),

    protocolId: getOptionalString(
      formData,
      "protocolId"
    ),

    autoGenerate: getBoolean(
      formData,
      "autoGenerate",
      true
    ),

    requireTeam: getBoolean(
      formData,
      "requireTeam"
    ),

    requireLeadAuditor: getBoolean(
      formData,
      "requireLeadAuditor"
    ),

    teamMembers: parseTeamMembers(formData),
  };
}

export async function createAuditScheduleAction(
  formData: FormData
): Promise<
  AuditV2ActionResult<{
    scheduleId: string;
  }>
> {
  try {
    await requirePermission(
      PermissionKey.MANAGE_AUDITS
    );

    const { organizationId, user } =
      await getCurrentUserTenant();

    const schedule = await createAuditScheduleService({
      organizationId,
      userId: user.id,
      ...parseAuditScheduleFormData(formData),
    });

    revalidateAuditSchedulePaths(schedule.id);

    return successResult(
      "Audit schedule created successfully.",
      {
        scheduleId: schedule.id,
      }
    );
  } catch (error) {
    return errorResult<{
      scheduleId: string;
    }>(
      error,
      "The audit schedule could not be created."
    );
  }
}

export async function updateAuditScheduleAction(
  formData: FormData
): Promise<
  AuditV2ActionResult<{
    scheduleId: string;
  }>
> {
  try {
    await requirePermission(
      PermissionKey.MANAGE_AUDITS
    );

    const { organizationId, user } =
      await getCurrentUserTenant();

    const scheduleId = getRequiredString(
      formData,
      "scheduleId",
      "Audit schedule"
    );

    const schedule = await updateAuditScheduleService({
      organizationId,
      userId: user.id,
      scheduleId,
      ...parseAuditScheduleFormData(formData),
    });

    revalidateAuditSchedulePaths(schedule.id);

    return successResult(
      "Audit schedule updated successfully.",
      {
        scheduleId: schedule.id,
      }
    );
  } catch (error) {
    return errorResult<{
      scheduleId: string;
    }>(
      error,
      "The audit schedule could not be updated."
    );
  }
}

export async function changeAuditScheduleStatusAction(
  formData: FormData
): Promise<
  AuditV2ActionResult<{
    scheduleId: string;
    status: EnterpriseAuditScheduleStatus;
  }>
> {
  try {
    await requirePermission(
      PermissionKey.MANAGE_AUDITS
    );

    const { organizationId, user } =
      await getCurrentUserTenant();

    const scheduleId = getRequiredString(
      formData,
      "scheduleId",
      "Audit schedule"
    );

    const status = getEnumValue(
      formData,
      "status",
      EnterpriseAuditScheduleStatus,
      "Schedule status"
    );

    const schedule =
      await changeAuditScheduleStatusService({
        organizationId,
        userId: user.id,
        scheduleId,
        status,
      });

    revalidateAuditSchedulePaths(scheduleId);

    return successResult(
      "Audit schedule status updated successfully.",
      {
        scheduleId,
        status: schedule?.status ?? status,
      }
    );
  } catch (error) {
    return errorResult<{
      scheduleId: string;
      status: EnterpriseAuditScheduleStatus;
    }>(
      error,
      "The audit schedule status could not be updated."
    );
  }
}

export async function generateAuditFromScheduleAction(
  formData: FormData
): Promise<
  AuditV2ActionResult<{
    scheduleId: string;
    auditId: string;
    auditReference: string;
    duplicate: boolean;
  }>
> {
  try {
    await requirePermission(
      PermissionKey.MANAGE_AUDITS
    );

    const { organizationId, user } =
      await getCurrentUserTenant();

    const scheduleId = getRequiredString(
      formData,
      "scheduleId",
      "Audit schedule"
    );

    const result =
      await generateAuditFromScheduleService({
        organizationId,
        scheduleId,
        generatedByUserId: user.id,
        generationDate: new Date(),
      });

    revalidateAuditSchedulePaths(
      scheduleId,
      result.audit.id
    );

    return successResult(
      result.duplicate
        ? "This scheduled audit had already been generated."
        : "Enterprise audit generated successfully.",
      {
        scheduleId,
        auditId: result.audit.id,
        auditReference: result.audit.reference,
        duplicate: result.duplicate,
      }
    );
  } catch (error) {
    return errorResult<{
      scheduleId: string;
      auditId: string;
      auditReference: string;
      duplicate: boolean;
    }>(
      error,
      "The enterprise audit could not be generated."
    );
  }
}