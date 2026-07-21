"use server";

import type { FormActionState } from "@/core/actions/action-state";
import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  changeRegulatorySourceStatusService,
  closeRegulatoryChangeService,
  createCapaFromRegulatoryChangeService,
  createRegulatoryChangeService,
  createRegulatorySourceService,
  linkRegulatoryObligationService,
  markRegulatoryChangeImplementedService,
  recordRegulatorySourceReviewService,
  reviewRegulatoryImpactAssessmentService,
  startRegulatoryChangeReviewService,
  submitRegulatoryImpactAssessmentService,
} from "@/modules/compliance/regulatory-intelligence.service";
import { preparePublishedFormSubmissions } from "@/modules/forms/runtime-form.service";
import {
  PermissionKey,
  ConfigurableFormModule,
  RegulatoryChangeType,
  RegulatoryImpactDecision,
  RegulatoryObligationRelationship,
  RegulatorySourceStatus,
  RegulatorySourceType,
  RiskLevel,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const text = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const required = (data: FormData, key: string) => { const value = text(data, key); if (!value) throw new Error(`${key} is required.`); return value; };
const optional = (data: FormData, key: string) => text(data, key) || null;
const date = (data: FormData, key: string, requiredValue = false) => { const raw = optional(data, key); if (!raw) { if (requiredValue) throw new Error(`${key} is required.`); return null; } const value = new Date(raw); if (Number.isNaN(value.getTime())) throw new Error(`${key} must be a valid date.`); return value; };
const integer = (data: FormData, key: string) => { const value = Number(required(data, key)); if (!Number.isInteger(value)) throw new Error(`${key} must be a whole number.`); return value; };
const enumValue = <T extends Record<string, string>>(values: T, value: string, message: string) => { if (!Object.values(values).includes(value)) throw new Error(message); return value as T[keyof T]; };
const fail = (cause: unknown, fallback: string): FormActionState => ({ status: "ERROR", message: cause instanceof Error ? cause.message : fallback });
const refresh = (changeId?: string) => { revalidatePath("/compliance"); revalidatePath("/compliance/dashboard"); revalidatePath("/compliance/regulatory"); if (changeId) revalidatePath(`/compliance/regulatory/changes/${changeId}`); revalidatePath("/compliance/calendar"); revalidatePath("/assurance"); revalidatePath("/dashboard"); };

export async function createRegulatorySource(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_COMPLIANCE); const { organizationId, user } = await getCurrentUserTenant();
  try {
    await createRegulatorySourceService({ organizationId, userId: user.id, code: required(data, "code"), name: required(data, "name"), authority: required(data, "authority"), type: enumValue(RegulatorySourceType, required(data, "type"), "Select a valid source type."), jurisdiction: required(data, "jurisdiction"), sourceUrl: required(data, "sourceUrl"), description: optional(data, "description"), ownerId: required(data, "ownerId"), reviewCadenceDays: integer(data, "reviewCadenceDays"), nextReviewAt: date(data, "nextReviewAt", true)! });
  } catch (cause) { return fail(cause, "The regulatory source could not be created."); }
  refresh(); return { status: "SUCCESS", message: "Regulatory source registered." };
}

export async function changeRegulatorySourceStatus(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_COMPLIANCE); const { organizationId, user } = await getCurrentUserTenant();
  try { await changeRegulatorySourceStatusService({ organizationId, userId: user.id, sourceId: required(data, "sourceId"), status: enumValue(RegulatorySourceStatus, required(data, "status"), "Select a valid source status."), reason: required(data, "reason") }); }
  catch (cause) { return fail(cause, "The regulatory source status could not be changed."); }
  refresh(); return { status: "SUCCESS", message: "Source status updated." };
}

export async function recordRegulatorySourceReview(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_COMPLIANCE); const { organizationId, user } = await getCurrentUserTenant();
  try { await recordRegulatorySourceReviewService({ organizationId, userId: user.id, sourceId: required(data, "sourceId"), notes: required(data, "notes") }); }
  catch (cause) { return fail(cause, "The source review could not be recorded."); }
  refresh(); return { status: "SUCCESS", message: "Source review recorded and the next review scheduled." };
}

export async function createRegulatoryChange(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_COMPLIANCE); const { organizationId, user } = await getCurrentUserTenant(); let id = "";
  try {
    const customSubmissions = await preparePublishedFormSubmissions({ organizationId, module: ConfigurableFormModule.REGULATORY_INTELLIGENCE, data });
    const change = await createRegulatoryChangeService({ organizationId, userId: user.id, sourceId: required(data, "sourceId"), reference: required(data, "reference"), title: required(data, "title"), summary: required(data, "summary"), type: enumValue(RegulatoryChangeType, required(data, "type"), "Select a valid change type."), significance: enumValue(RiskLevel, required(data, "significance"), "Select a valid significance."), sourceUrl: required(data, "sourceUrl"), citation: required(data, "citation"), publishedAt: date(data, "publishedAt"), effectiveAt: date(data, "effectiveAt"), assessmentDueAt: date(data, "assessmentDueAt", true)!, ownerId: required(data, "ownerId"), customSubmissions }); id = change.id;
  } catch (cause) { return fail(cause, "The regulatory change could not be created."); }
  redirect(`/compliance/regulatory/changes/${id}`);
}

export async function startRegulatoryChangeReview(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_COMPLIANCE); const { organizationId, user } = await getCurrentUserTenant(); const changeId = required(data, "changeId");
  try { await startRegulatoryChangeReviewService({ organizationId, userId: user.id, changeId, note: required(data, "note") }); }
  catch (cause) { return fail(cause, "The change review could not be started."); }
  refresh(changeId); return { status: "SUCCESS", message: "Regulatory change review started." };
}

export async function submitRegulatoryImpactAssessment(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_COMPLIANCE); const { organizationId, user } = await getCurrentUserTenant(); const changeId = required(data, "changeId");
  try { await submitRegulatoryImpactAssessmentService({ organizationId, userId: user.id, changeId, decision: enumValue(RegulatoryImpactDecision, required(data, "decision"), "Select a valid applicability decision."), applicabilityRationale: required(data, "applicabilityRationale"), impactSummary: optional(data, "impactSummary"), gapSummary: optional(data, "gapSummary"), requiredActions: optional(data, "requiredActions"), implementationDueAt: date(data, "implementationDueAt") }); }
  catch (cause) { return fail(cause, "The impact assessment could not be submitted."); }
  refresh(changeId); return { status: "SUCCESS", message: "Impact assessment submitted for approval." };
}

export async function reviewRegulatoryImpactAssessment(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_COMPLIANCE); const { organizationId, user } = await getCurrentUserTenant(); const changeId = required(data, "changeId");
  try {
    const decision = required(data, "decision");
    if (decision !== "APPROVE" && decision !== "REJECT") throw new Error("Select approve or reject.");
    await reviewRegulatoryImpactAssessmentService({ organizationId, userId: user.id, assessmentId: required(data, "assessmentId"), approved: decision === "APPROVE", reviewNotes: required(data, "reviewNotes") });
  }
  catch (cause) { return fail(cause, "The impact assessment decision could not be recorded."); }
  refresh(changeId); return { status: "SUCCESS", message: "Impact assessment decision recorded." };
}

export async function linkRegulatoryObligation(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_COMPLIANCE); const { organizationId, user } = await getCurrentUserTenant(); const changeId = required(data, "changeId");
  try { await linkRegulatoryObligationService({ organizationId, userId: user.id, changeId, complianceItemId: required(data, "complianceItemId"), relationship: enumValue(RegulatoryObligationRelationship, required(data, "relationship"), "Select a valid obligation relationship."), notes: optional(data, "notes") }); }
  catch (cause) { return fail(cause, "The compliance obligation could not be linked."); }
  refresh(changeId); return { status: "SUCCESS", message: "Compliance obligation linked to the regulatory change." };
}

export async function createRegulatoryChangeCapa(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_COMPLIANCE); await requirePermission(PermissionKey.CREATE_CAPA); const { organizationId, user } = await getCurrentUserTenant(); const changeId = required(data, "changeId");
  try { await createCapaFromRegulatoryChangeService({ organizationId, userId: user.id, changeId, title: required(data, "title"), description: optional(data, "description"), assignedToId: required(data, "assignedToId"), dueDate: date(data, "dueDate", true)! }); }
  catch (cause) { return fail(cause, "The regulatory corrective action could not be created."); }
  refresh(changeId); revalidatePath("/actions"); return { status: "SUCCESS", message: "Corrective action created and linked." };
}

export async function markRegulatoryChangeImplemented(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_COMPLIANCE); const { organizationId, user } = await getCurrentUserTenant(); const changeId = required(data, "changeId");
  try { await markRegulatoryChangeImplementedService({ organizationId, userId: user.id, changeId, implementationSummary: required(data, "implementationSummary") }); }
  catch (cause) { return fail(cause, "The regulatory change could not be marked implemented."); }
  refresh(changeId); return { status: "SUCCESS", message: "Implementation recorded." };
}

export async function closeRegulatoryChange(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_COMPLIANCE); const { organizationId, user } = await getCurrentUserTenant(); const changeId = required(data, "changeId");
  try { await closeRegulatoryChangeService({ organizationId, userId: user.id, changeId, rationale: required(data, "rationale") }); }
  catch (cause) { return fail(cause, "The regulatory change could not be closed."); }
  refresh(changeId); return { status: "SUCCESS", message: "Regulatory change closed." };
}
