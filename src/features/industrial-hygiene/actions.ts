"use server";

import type { FormActionState } from "@/core/actions/action-state";
import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { preparePublishedFormSubmissions } from "@/modules/forms/runtime-form.service";
import { addExposureSampleService, completeExposureAssessmentFormsService, createExposureAssessmentService, createExposureGroupService, createHygieneAgentService, transitionExposureAssessmentService } from "@/modules/industrial-hygiene/industrial-hygiene.service";
import { ConfigurableFormModule, ExposureAssessmentStatus, ExposureSampleType, HygieneAgentCategory, PermissionKey } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const text = (data: FormData, key: string) => String(data.get(key) || "").trim();
const required = (data: FormData, key: string) => { const value = text(data, key); if (!value) throw new Error(`${key} is required.`); return value; };
const optional = (data: FormData, key: string) => text(data, key) || null;
const number = (data: FormData, key: string) => { const raw = optional(data, key); if (!raw) return null; const value = Number(raw); if (!Number.isFinite(value)) throw new Error(`${key} must be a number.`); return value; };
const integer = (data: FormData, key: string) => { const value = number(data, key); if (value !== null && !Number.isInteger(value)) throw new Error(`${key} must be a whole number.`); return value; };
const date = (data: FormData, key: string) => { const raw = optional(data, key); if (!raw) return null; const value = new Date(raw); if (Number.isNaN(value.getTime())) throw new Error(`${key} must be a valid date.`); return value; };
const error = (value: unknown, fallback: string): FormActionState => ({ status: "ERROR", message: value instanceof Error ? value.message : fallback });

export async function createHygieneAgent(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_INDUSTRIAL_HYGIENE); const { organizationId, user } = await getCurrentUserTenant();
  try { const category = required(data, "category") as HygieneAgentCategory; if (!Object.values(HygieneAgentCategory).includes(category)) throw new Error("Select a valid agent category."); await createHygieneAgentService({ organizationId, userId: user.id, name: required(data, "name"), category, casNumber: optional(data, "casNumber"), description: optional(data, "description"), healthEffects: optional(data, "healthEffects"), exposureRoutes: optional(data, "exposureRoutes"), occupationalLimit: number(data, "occupationalLimit"), actionLevel: number(data, "actionLevel"), ceilingLimit: number(data, "ceilingLimit"), unit: optional(data, "unit"), limitSource: optional(data, "limitSource"), samplingMethod: optional(data, "samplingMethod"), analyticalMethod: optional(data, "analyticalMethod"), requiresSurveillance: data.get("requiresSurveillance") === "on" }); }
  catch (cause) { return error(cause, "The exposure agent could not be created."); }
  revalidatePath("/industrial-hygiene"); return { status: "SUCCESS", message: "Exposure agent created." };
}

export async function createExposureGroup(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_INDUSTRIAL_HYGIENE); const { organizationId, user } = await getCurrentUserTenant();
  try { await createExposureGroupService({ organizationId, userId: user.id, name: required(data, "name"), code: optional(data, "code"), siteId: required(data, "siteId"), departmentId: optional(data, "departmentId"), description: optional(data, "description"), jobRoles: optional(data, "jobRoles"), tasks: optional(data, "tasks"), locations: optional(data, "locations"), exposedHeadcount: integer(data, "exposedHeadcount"), existingControls: optional(data, "existingControls"), requiredPpe: optional(data, "requiredPpe"), ownerId: optional(data, "ownerId"), reviewDueDate: date(data, "reviewDueDate"), agentIds: data.getAll("agentIds").map(String).filter(Boolean) }); }
  catch (cause) { return error(cause, "The similar exposure group could not be created."); }
  revalidatePath("/industrial-hygiene"); return { status: "SUCCESS", message: "Similar exposure group created." };
}

export async function createExposureAssessment(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_INDUSTRIAL_HYGIENE); const { organizationId, user } = await getCurrentUserTenant(); let id: string;
  try { const customSubmissions = await preparePublishedFormSubmissions({ organizationId, module: ConfigurableFormModule.INDUSTRIAL_HYGIENE, data }); const assessment = await createExposureAssessmentService({ organizationId, userId: user.id, title: required(data, "title"), description: optional(data, "description"), groupId: required(data, "groupId"), assessorId: optional(data, "assessorId"), scheduledAt: date(data, "scheduledAt"), dueDate: date(data, "dueDate"), scope: optional(data, "scope"), samplingPlan: optional(data, "samplingPlan"), customSubmissions }); id = assessment.id; }
  catch (cause) { return error(cause, "The exposure assessment could not be created."); }
  redirect(`/industrial-hygiene/${id}`);
}

export async function addExposureSample(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_INDUSTRIAL_HYGIENE); const { organizationId, user } = await getCurrentUserTenant(); const assessmentId = required(data, "assessmentId");
  try { const sampleType = required(data, "sampleType") as ExposureSampleType; if (!Object.values(ExposureSampleType).includes(sampleType)) throw new Error("Select a valid sample type."); const sampledAt = date(data, "sampledAt"); if (!sampledAt) throw new Error("Sample date is required."); await addExposureSampleService({ organizationId, userId: user.id, assessmentId, agentId: required(data, "agentId"), sampleType, sampleReference: optional(data, "sampleReference"), sampledWorkerId: optional(data, "sampledWorkerId"), location: optional(data, "location"), task: optional(data, "task"), sampledAt, durationMinutes: integer(data, "durationMinutes"), resultValue: number(data, "resultValue"), reportingLimit: number(data, "reportingLimit"), occupationalLimit: number(data, "occupationalLimit"), actionLevel: number(data, "actionLevel"), unit: optional(data, "unit"), laboratory: optional(data, "laboratory"), analyticalMethod: optional(data, "analyticalMethod"), analyzedAt: date(data, "analyzedAt"), notes: optional(data, "notes") }); }
  catch (cause) { return error(cause, "The exposure sample could not be recorded."); }
  revalidatePath(`/industrial-hygiene/${assessmentId}`); return { status: "SUCCESS", message: "Exposure sample recorded and classified." };
}

export async function transitionExposureAssessment(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_INDUSTRIAL_HYGIENE); const { organizationId, user } = await getCurrentUserTenant(); const assessmentId = required(data, "assessmentId");
  try { const status = required(data, "status") as ExposureAssessmentStatus; if (!Object.values(ExposureAssessmentStatus).includes(status)) throw new Error("Select a valid assessment status."); await transitionExposureAssessmentService({ organizationId, userId: user.id, assessmentId, status, observations: optional(data, "observations"), conclusions: optional(data, "conclusions"), recommendations: optional(data, "recommendations") }); }
  catch (cause) { return error(cause, "The assessment status could not be updated."); }
  revalidatePath(`/industrial-hygiene/${assessmentId}`); revalidatePath("/industrial-hygiene"); return { status: "SUCCESS", message: "Assessment status updated." };
}

export async function completeExposureAssessmentForms(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_INDUSTRIAL_HYGIENE); const { organizationId, user } = await getCurrentUserTenant(); const assessmentId = required(data, "assessmentId");
  try { const submissions = await preparePublishedFormSubmissions({ organizationId, module: ConfigurableFormModule.INDUSTRIAL_HYGIENE, data }); await completeExposureAssessmentFormsService({ organizationId, userId: user.id, assessmentId, submissions }); }
  catch (cause) { return error(cause, "The exposure forms could not be saved."); }
  revalidatePath(`/industrial-hygiene/${assessmentId}`); return { status: "SUCCESS", message: "Exposure assessment forms captured." };
}
