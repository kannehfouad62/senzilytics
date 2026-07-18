"use server";
import { auditActionError, type AuditActionFeedback } from "@/features/audits/audit-action-feedback";

import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  activateAuditProgramService,
  activateAuditProtocolService,
  addAuditProtocolQuestionService,
  addAuditProtocolSectionService,
  createAuditProgramService,
  createAuditProtocolService,
} from "@/modules/audit/audit-governance.service";
import {
  EnterpriseAuditFindingTrigger,
  EnterpriseAuditFrequency,
  EnterpriseAuditQuestionResponseType,
  EnterpriseAuditRiskPriority,
  EnterpriseAuditSeverity,
  PermissionKey,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function required(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
function optional(formData: FormData, name: string) { return String(formData.get(name) ?? "").trim() || null; }
function checked(formData: FormData, name: string) { return formData.get(name) === "on"; }
function positiveInteger(formData: FormData, name: string, fallback = 1) { const value = Number(formData.get(name) ?? fallback); if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive whole number.`); return value; }
function optionalDate(formData: FormData, name: string) { const value = optional(formData, name); if (!value) return null; const date = new Date(value); if (Number.isNaN(date.getTime())) throw new Error(`${name} must be a valid date.`); return date; }
function enumValue<T extends Record<string, string>>(enumeration: T, value: string, message: string): T[keyof T] { if (!Object.values(enumeration).includes(value)) throw new Error(message); return value as T[keyof T]; }

export async function createAuditProgram(formData: FormData) {
  await requirePermission(PermissionKey.MANAGE_AUDITS);
  const { organizationId, user } = await getCurrentUserTenant();
  const program = await createAuditProgramService({
    organizationId,
    userId: user.id,
    name: required(formData, "name"),
    code: optional(formData, "code"),
    description: optional(formData, "description"),
    standardName: optional(formData, "standardName"),
    standardVersion: optional(formData, "standardVersion"),
    framework: optional(formData, "framework"),
    objectives: optional(formData, "objectives"),
    scope: optional(formData, "scope"),
    frequency: enumValue(EnterpriseAuditFrequency, required(formData, "frequency"), "A valid frequency is required."),
    riskPriority: enumValue(EnterpriseAuditRiskPriority, required(formData, "riskPriority"), "A valid risk priority is required."),
    ownerId: optional(formData, "ownerId"),
    defaultProtocolId: optional(formData, "defaultProtocolId"),
    effectiveFrom: optionalDate(formData, "effectiveFrom"),
    effectiveTo: optionalDate(formData, "effectiveTo"),
    siteIds: formData.getAll("siteIds").map(String).filter(Boolean),
    departmentIds: formData.getAll("departmentIds").map(String).filter(Boolean),
  });
  redirect(`/audits/programs/${program.id}`);
}

export async function createAuditProtocol(formData: FormData) {
  await requirePermission(PermissionKey.MANAGE_AUDITS);
  const { organizationId, user } = await getCurrentUserTenant();
  const protocol = await createAuditProtocolService({ organizationId, userId: user.id, name: required(formData, "name"), code: optional(formData, "code"), description: optional(formData, "description"), standardName: optional(formData, "standardName"), standardVersion: optional(formData, "standardVersion"), framework: optional(formData, "framework"), effectiveFrom: optionalDate(formData, "effectiveFrom"), effectiveTo: optionalDate(formData, "effectiveTo") });
  redirect(`/audits/protocols/${protocol.id}`);
}

export async function addAuditProtocolSection(formData: FormData) {
  await requirePermission(PermissionKey.MANAGE_AUDITS);
  const { organizationId, user } = await getCurrentUserTenant();
  const protocolId = required(formData, "protocolId");
  await addAuditProtocolSectionService({ organizationId, userId: user.id, protocolId, title: required(formData, "title"), description: optional(formData, "description"), guidance: optional(formData, "guidance"), standardRef: optional(formData, "standardRef"), weight: positiveInteger(formData, "weight") });
  revalidatePath(`/audits/protocols/${protocolId}`);
}

export async function addAuditProtocolQuestion(formData: FormData) {
  await requirePermission(PermissionKey.MANAGE_AUDITS);
  const { organizationId, user } = await getCurrentUserTenant();
  const protocolId = required(formData, "protocolId");
  const severity = optional(formData, "defaultSeverity");
  await addAuditProtocolQuestionService({
    organizationId,
    userId: user.id,
    protocolId,
    sectionId: required(formData, "sectionId"),
    questionText: required(formData, "questionText"),
    description: optional(formData, "description"),
    guidance: optional(formData, "guidance"),
    standardClause: optional(formData, "standardClause"),
    regulatoryRef: optional(formData, "regulatoryRef"),
    responseType: enumValue(EnterpriseAuditQuestionResponseType, required(formData, "responseType"), "A valid response type is required."),
    weight: positiveInteger(formData, "weight"),
    allowNotApplicable: checked(formData, "allowNotApplicable"),
    requireComment: checked(formData, "requireComment"),
    requireEvidence: checked(formData, "requireEvidence"),
    requirePhoto: checked(formData, "requirePhoto"),
    findingTrigger: enumValue(EnterpriseAuditFindingTrigger, required(formData, "findingTrigger"), "A valid finding trigger is required."),
    defaultSeverity: severity ? enumValue(EnterpriseAuditSeverity, severity, "A valid severity is required.") : null,
    automaticallyCreateFinding: checked(formData, "automaticallyCreateFinding"),
    automaticallySuggestCapa: checked(formData, "automaticallySuggestCapa"),
    automaticallySuggestRisk: checked(formData, "automaticallySuggestRisk"),
    optionLabels: String(formData.get("optionLabels") ?? "").split("\n").map((value) => value.trim()).filter(Boolean),
  });
  revalidatePath(`/audits/protocols/${protocolId}`);
}

export async function activateAuditProtocol(formData: FormData) {
  await requirePermission(PermissionKey.MANAGE_AUDITS);
  const { organizationId, user } = await getCurrentUserTenant();
  const protocolId = required(formData, "protocolId");
  await activateAuditProtocolService({ organizationId, userId: user.id, protocolId });
  revalidatePath(`/audits/protocols/${protocolId}`);
  revalidatePath("/audits/protocols");
}

export async function activateAuditProgram(formData: FormData) {
  await requirePermission(PermissionKey.MANAGE_AUDITS);
  const { organizationId, user } = await getCurrentUserTenant();
  const programId = required(formData, "programId");
  await activateAuditProgramService({ organizationId, userId: user.id, programId });
  revalidatePath(`/audits/programs/${programId}`);
  revalidatePath("/audits/programs");
}
export async function activateAuditProgramWithFeedback(_state: AuditActionFeedback, formData: FormData): Promise<AuditActionFeedback> {
  try { await activateAuditProgram(formData); return { status: "success", message: "Audit program activated." }; }
  catch (error) { return auditActionError(error, "The Audit program could not be activated."); }
}
