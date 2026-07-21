"use server";

import type { FormActionState } from "@/core/actions/action-state";
import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { preparePublishedFormSubmissions } from "@/modules/forms/runtime-form.service";
import { assignPermitWorkerService, completePermitFormsService, createPermitToWorkService, recordPermitGasTestService, transitionPermitToWorkService, verifyPermitControlService } from "@/modules/permits-to-work/permit-to-work.service";
import { ConfigurableFormModule, PermissionKey, PermitGasTestResult, PermitToWorkStatus, PermitToWorkType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const required = (data: FormData, key: string) => { const value = String(data.get(key) || "").trim(); if (!value) throw new Error(`${key} is required.`); return value; };
const optional = (data: FormData, key: string) => String(data.get(key) || "").trim() || null;
const date = (data: FormData, key: string) => { const value = new Date(required(data, key)); if (Number.isNaN(value.getTime())) throw new Error(`${key} must be a valid date.`); return value; };
const number = (data: FormData, key: string) => { const raw = optional(data, key); if (!raw) return null; const value = Number(raw); if (!Number.isFinite(value)) throw new Error(`${key} must be a number.`); return value; };
const errorState = (error: unknown, fallback: string): FormActionState => ({ status: "ERROR", message: error instanceof Error ? error.message : fallback });

export async function createPermitToWork(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_PERMITS_TO_WORK); const { organizationId, user } = await getCurrentUserTenant(); let id: string;
  try {
    const type = required(data, "type") as PermitToWorkType; if (!Object.values(PermitToWorkType).includes(type)) throw new Error("Select a valid permit type.");
    const customSubmissions = await preparePublishedFormSubmissions({ organizationId, module: ConfigurableFormModule.PERMIT_TO_WORK, data });
    const permit = await createPermitToWorkService({ organizationId, userId: user.id, title: required(data, "title"), description: optional(data, "description"), type, siteId: required(data, "siteId"), departmentId: optional(data, "departmentId"), contractorId: optional(data, "contractorId"), responsiblePerson: required(data, "responsiblePerson"), exactLocation: required(data, "exactLocation"), workOrderReference: optional(data, "workOrderReference"), plannedStartAt: date(data, "plannedStartAt"), plannedEndAt: date(data, "plannedEndAt"), hazardsSummary: required(data, "hazardsSummary"), controlsSummary: required(data, "controlsSummary"), requiredPpe: optional(data, "requiredPpe"), isolationDetails: optional(data, "isolationDetails"), emergencyPlan: optional(data, "emergencyPlan"), gasTestingRequired: data.get("gasTestingRequired") === "on", controls: required(data, "controls").split("\n"), workerIds: data.getAll("workerIds").map(String).filter(Boolean), customSubmissions });
    id = permit.id;
  } catch (error) { return errorState(error, "The permit to work could not be created."); }
  redirect(`/permits-to-work/${id}`);
}

export async function transitionPermitToWork(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_PERMITS_TO_WORK); const { organizationId, user } = await getCurrentUserTenant(); const permitId = required(data, "permitId");
  try { const status = required(data, "status") as PermitToWorkStatus; if (!Object.values(PermitToWorkStatus).includes(status)) throw new Error("Select a valid permit status."); await transitionPermitToWorkService({ organizationId, userId: user.id, permitId, status, comments: optional(data, "comments"), closeoutNotes: optional(data, "closeoutNotes") }); }
  catch (error) { return errorState(error, "The permit status could not be changed."); }
  revalidatePath(`/permits-to-work/${permitId}`); revalidatePath("/permits-to-work"); return { status: "SUCCESS", message: "Permit status updated." };
}

export async function verifyPermitControl(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_PERMITS_TO_WORK); const { organizationId, user } = await getCurrentUserTenant(); const permitId = required(data, "permitId");
  try { await verifyPermitControlService({ organizationId, userId: user.id, permitId, controlId: required(data, "controlId"), verified: data.get("verified") === "true" }); }
  catch (error) { return errorState(error, "The control could not be updated."); }
  revalidatePath(`/permits-to-work/${permitId}`); return { status: "SUCCESS", message: "Control verification updated." };
}

export async function recordPermitGasTest(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_PERMITS_TO_WORK); const { organizationId, user } = await getCurrentUserTenant(); const permitId = required(data, "permitId");
  try { const result = required(data, "result") as PermitGasTestResult; if (!Object.values(PermitGasTestResult).includes(result)) throw new Error("Select a valid gas test result."); await recordPermitGasTestService({ organizationId, userId: user.id, permitId, oxygenPercent: number(data, "oxygenPercent"), lelPercent: number(data, "lelPercent"), h2sPpm: number(data, "h2sPpm"), coPpm: number(data, "coPpm"), result, notes: optional(data, "notes") }); }
  catch (error) { return errorState(error, "The gas test could not be recorded."); }
  revalidatePath(`/permits-to-work/${permitId}`); return { status: "SUCCESS", message: "Gas test recorded." };
}

export async function assignPermitWorker(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_PERMITS_TO_WORK); const { organizationId, user } = await getCurrentUserTenant(); const permitId = required(data, "permitId");
  try { await assignPermitWorkerService({ organizationId, userId: user.id, permitId, workerId: required(data, "workerId"), role: optional(data, "role") }); }
  catch (error) { return errorState(error, "The worker could not be assigned."); }
  revalidatePath(`/permits-to-work/${permitId}`); return { status: "SUCCESS", message: "Worker assigned." };
}

export async function completePermitForms(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_PERMITS_TO_WORK); const { organizationId, user } = await getCurrentUserTenant(); const permitId = required(data, "permitId");
  try { const submissions = await preparePublishedFormSubmissions({ organizationId, module: ConfigurableFormModule.PERMIT_TO_WORK, data }); await completePermitFormsService({ organizationId, userId: user.id, permitId, submissions }); }
  catch (error) { return errorState(error, "The permit forms could not be saved."); }
  revalidatePath(`/permits-to-work/${permitId}`); return { status: "SUCCESS", message: "Permit forms captured." };
}
