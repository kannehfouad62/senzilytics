"use server";

import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  addAuditScheduleTeamMemberService,
  addAuditTeamMemberService,
  createAuditScheduleService,
  removeAuditScheduleTeamMemberService,
  removeAuditTeamMemberService,
} from "@/modules/audit/audit-schedule.service";
import {
  EnterpriseAuditFrequency,
  EnterpriseAuditScheduleTeamRole,
  EnterpriseAuditTeamRole,
  PermissionKey,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function required(formData: FormData, name: string) { const value = String(formData.get(name) ?? "").trim(); if (!value) throw new Error(`${name} is required.`); return value; }
function optional(formData: FormData, name: string) { return String(formData.get(name) ?? "").trim() || null; }
function checked(formData: FormData, name: string) { return formData.get(name) === "on"; }
function integer(formData: FormData, name: string, minimum: number) { const value = Number(formData.get(name)); if (!Number.isInteger(value) || value < minimum) throw new Error(`${name} must be a whole number of at least ${minimum}.`); return value; }
function date(formData: FormData, name: string, isRequired = false) { const value = optional(formData, name); if (!value) { if (isRequired) throw new Error(`${name} is required.`); return null; } const parsed = new Date(value); if (Number.isNaN(parsed.getTime())) throw new Error(`${name} must be a valid date.`); return parsed; }
function enumValue<T extends Record<string, string>>(values: T, value: string, message: string): T[keyof T] { if (!Object.values(values).includes(value)) throw new Error(message); return value as T[keyof T]; }

export async function createAuditSchedule(formData: FormData) {
  await requirePermission(PermissionKey.MANAGE_AUDITS);
  const { organizationId, user } = await getCurrentUserTenant();
  const startDate = date(formData, "startDate", true);
  if (!startDate) throw new Error("startDate is required.");
  const schedule = await createAuditScheduleService({
    organizationId,
    userId: user.id,
    programId: required(formData, "programId"),
    name: required(formData, "name"),
    description: optional(formData, "description"),
    frequency: enumValue(EnterpriseAuditFrequency, required(formData, "frequency"), "A valid frequency is required."),
    intervalValue: integer(formData, "intervalValue", 1),
    timezone: required(formData, "timezone"),
    startDate,
    endDate: date(formData, "endDate"),
    generateDaysBefore: integer(formData, "generateDaysBefore", 0),
    dueDaysAfter: integer(formData, "dueDaysAfter", 1),
    siteId: required(formData, "siteId"),
    departmentId: optional(formData, "departmentId"),
    leadAuditorId: optional(formData, "leadAuditorId"),
    protocolId: optional(formData, "protocolId"),
    autoGenerate: checked(formData, "autoGenerate"),
    requireTeam: checked(formData, "requireTeam"),
    requireLeadAuditor: checked(formData, "requireLeadAuditor"),
    teamMemberIds: formData.getAll("teamMemberIds").map(String).filter(Boolean),
  });
  redirect(`/audits/schedules/${schedule.id}`);
}

export async function addAuditScheduleTeamMember(formData: FormData) {
  await requirePermission(PermissionKey.MANAGE_AUDITS); const { organizationId, user } = await getCurrentUserTenant(); const scheduleId = required(formData, "scheduleId");
  await addAuditScheduleTeamMemberService({ organizationId, userId: user.id, scheduleId, memberId: required(formData, "memberId"), role: enumValue(EnterpriseAuditScheduleTeamRole, required(formData, "role"), "A valid schedule team role is required.") });
  revalidatePath(`/audits/schedules/${scheduleId}`);
}

export async function removeAuditScheduleTeamMember(formData: FormData) {
  await requirePermission(PermissionKey.MANAGE_AUDITS); const { organizationId, user } = await getCurrentUserTenant(); const scheduleId = required(formData, "scheduleId");
  await removeAuditScheduleTeamMemberService({ organizationId, userId: user.id, scheduleId, memberId: required(formData, "memberId") });
  revalidatePath(`/audits/schedules/${scheduleId}`);
}

export async function addAuditTeamMember(formData: FormData) {
  await requirePermission(PermissionKey.MANAGE_AUDITS); const { organizationId, user } = await getCurrentUserTenant(); const auditId = required(formData, "auditId");
  await addAuditTeamMemberService({ organizationId, userId: user.id, auditId, memberId: required(formData, "memberId"), role: enumValue(EnterpriseAuditTeamRole, required(formData, "role"), "A valid audit team role is required."), canEdit: checked(formData, "canEdit"), canReview: checked(formData, "canReview") });
  revalidatePath(`/audits/${auditId}`);
}

export async function removeAuditTeamMember(formData: FormData) {
  await requirePermission(PermissionKey.MANAGE_AUDITS); const { organizationId, user } = await getCurrentUserTenant(); const auditId = required(formData, "auditId");
  await removeAuditTeamMemberService({ organizationId, userId: user.id, auditId, memberId: required(formData, "memberId") });
  revalidatePath(`/audits/${auditId}`);
}
