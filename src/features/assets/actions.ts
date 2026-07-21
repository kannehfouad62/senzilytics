"use server";

import type { FormActionState } from "@/core/actions/action-state";
import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  changeAssetStatusService,
  changeAssetMaintenanceStatusService,
  completeAssetMaintenanceService,
  createAssetDefectService,
  createAssetService,
  createCapaFromAssetDefectService,
  recordAssetInspectionService,
  scheduleAssetMaintenanceService,
  updateAssetDefectService,
} from "@/modules/assets/asset.service";
import { preparePublishedFormSubmissions } from "@/modules/forms/runtime-form.service";
import {
  AssetDefectStatus,
  AssetInspectionResult,
  AssetMaintenanceType,
  AssetMaintenanceStatus,
  AssetStatus,
  AssetType,
  ConfigurableFormModule,
  PermissionKey,
  RiskLevel,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const text = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const required = (data: FormData, key: string) => { const value = text(data, key); if (!value) throw new Error(`${key} is required.`); return value; };
const optional = (data: FormData, key: string) => text(data, key) || null;
const date = (data: FormData, key: string, requiredValue = false) => { const raw = optional(data, key); if (!raw) { if (requiredValue) throw new Error(`${key} is required.`); return null; } const value = new Date(raw); if (Number.isNaN(value.getTime())) throw new Error(`${key} must be a valid date.`); return value; };
const number = (data: FormData, key: string) => { const raw = optional(data, key); if (!raw) return null; const value = Number(raw); if (!Number.isFinite(value)) throw new Error(`${key} must be a number.`); return value; };
const integer = (data: FormData, key: string, fallback?: number) => { const value = optional(data, key) === null ? fallback ?? null : number(data, key); if (value === null) return null; if (!Number.isInteger(value)) throw new Error(`${key} must be a whole number.`); return value; };
const enumValue = <T extends Record<string, string>>(values: T, raw: string, message: string) => { if (!Object.values(values).includes(raw)) throw new Error(message); return raw as T[keyof T]; };
const error = (cause: unknown, fallback: string): FormActionState => ({ status: "ERROR", message: cause instanceof Error ? cause.message : fallback });
const refresh = (assetId?: string) => { revalidatePath("/assets"); revalidatePath("/assets/dashboard"); if (assetId) revalidatePath(`/assets/${assetId}`); };

export async function createAsset(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_ASSETS);
  const { organizationId, user } = await getCurrentUserTenant();
  let id = "";
  try {
    const asset = await createAssetService({
      organizationId, userId: user.id, reference: required(data, "reference"), name: required(data, "name"), description: optional(data, "description"),
      type: enumValue(AssetType, required(data, "type"), "Select a valid asset type."), criticality: enumValue(RiskLevel, required(data, "criticality"), "Select a valid criticality."),
      isSafetyCritical: data.get("isSafetyCritical") === "on", manufacturer: optional(data, "manufacturer"), modelNumber: optional(data, "modelNumber"), serialNumber: optional(data, "serialNumber"),
      siteId: required(data, "siteId"), departmentId: optional(data, "departmentId"), location: optional(data, "location"), ownerId: optional(data, "ownerId"), commissionedAt: date(data, "commissionedAt"),
      inspectionIntervalDays: integer(data, "inspectionIntervalDays", 30)!, maintenanceIntervalDays: integer(data, "maintenanceIntervalDays", 90)!, permitRequired: data.get("permitRequired") === "on",
    });
    id = asset.id;
  } catch (cause) { return error(cause, "The asset could not be registered."); }
  redirect(`/assets/${id}`);
}

export async function changeAssetStatus(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_ASSETS); const { organizationId, user } = await getCurrentUserTenant(); const assetId = required(data, "assetId");
  try { await changeAssetStatusService({ organizationId, userId: user.id, assetId, status: enumValue(AssetStatus, required(data, "status"), "Select a valid asset status."), reason: required(data, "reason") }); }
  catch (cause) { return error(cause, "The asset status could not be changed."); }
  refresh(assetId); return { status: "SUCCESS", message: "Asset status updated." };
}

export async function recordAssetInspection(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_ASSETS); const { organizationId, user } = await getCurrentUserTenant(); const assetId = required(data, "assetId");
  try { const inspectedAt = date(data, "inspectedAt", true)!; const customSubmissions = await preparePublishedFormSubmissions({ organizationId, module: ConfigurableFormModule.ASSET_SAFETY, data }); await recordAssetInspectionService({ organizationId, userId: user.id, assetId, inspectedAt, result: enumValue(AssetInspectionResult, required(data, "result"), "Select a valid inspection result."), conditionScore: integer(data, "conditionScore"), evidenceReference: optional(data, "evidenceReference"), observations: optional(data, "observations"), immediateAction: optional(data, "immediateAction"), customSubmissions }); }
  catch (cause) { return error(cause, "The asset inspection could not be recorded."); }
  refresh(assetId); return { status: "SUCCESS", message: "Inspection recorded and the next due date calculated." };
}

export async function createAssetDefect(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_ASSETS); const { organizationId, user } = await getCurrentUserTenant(); const assetId = required(data, "assetId");
  try { await createAssetDefectService({ organizationId, userId: user.id, assetId, title: required(data, "title"), description: required(data, "description"), severity: enumValue(RiskLevel, required(data, "severity"), "Select a valid defect severity."), ownerId: optional(data, "ownerId"), dueDate: date(data, "dueDate"), immediateControls: optional(data, "immediateControls") }); }
  catch (cause) { return error(cause, "The defect could not be reported."); }
  refresh(assetId); return { status: "SUCCESS", message: "Asset defect reported." };
}

export async function updateAssetDefect(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_ASSETS); const { organizationId, user } = await getCurrentUserTenant(); const assetId = required(data, "assetId");
  try { await updateAssetDefectService({ organizationId, userId: user.id, defectId: required(data, "defectId"), status: enumValue(AssetDefectStatus, required(data, "status"), "Select a valid defect status."), repairPlan: optional(data, "repairPlan"), verificationEvidence: optional(data, "verificationEvidence") }); }
  catch (cause) { return error(cause, "The defect status could not be updated."); }
  refresh(assetId); return { status: "SUCCESS", message: "Defect status updated." };
}

export async function scheduleAssetMaintenance(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_ASSETS); const { organizationId, user } = await getCurrentUserTenant(); const assetId = required(data, "assetId");
  try { await scheduleAssetMaintenanceService({ organizationId, userId: user.id, assetId, defectId: optional(data, "defectId"), type: enumValue(AssetMaintenanceType, required(data, "type"), "Select a valid maintenance type."), title: required(data, "title"), scheduledAt: date(data, "scheduledAt", true)!, dueAt: date(data, "dueAt", true)!, technicianId: optional(data, "technicianId"), serviceProvider: optional(data, "serviceProvider"), workOrderReference: optional(data, "workOrderReference") }); }
  catch (cause) { return error(cause, "Maintenance could not be scheduled."); }
  refresh(assetId); return { status: "SUCCESS", message: "Maintenance work scheduled." };
}

export async function completeAssetMaintenance(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_ASSETS); const { organizationId, user } = await getCurrentUserTenant(); const assetId = required(data, "assetId");
  try { await completeAssetMaintenanceService({ organizationId, userId: user.id, recordId: required(data, "recordId"), completedAt: date(data, "completedAt", true)!, workSummary: required(data, "workSummary"), evidenceReference: required(data, "evidenceReference"), downtimeHours: number(data, "downtimeHours") }); }
  catch (cause) { return error(cause, "Maintenance completion could not be recorded."); }
  refresh(assetId); return { status: "SUCCESS", message: "Maintenance completed and the next due date calculated." };
}

export async function changeAssetMaintenanceStatus(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_ASSETS); const { organizationId, user } = await getCurrentUserTenant(); const assetId = required(data, "assetId");
  try { await changeAssetMaintenanceStatusService({ organizationId, userId: user.id, recordId: required(data, "recordId"), status: enumValue(AssetMaintenanceStatus, required(data, "status"), "Select a valid maintenance status."), reason: required(data, "reason") }); }
  catch (cause) { return error(cause, "The maintenance status could not be updated."); }
  refresh(assetId); return { status: "SUCCESS", message: "Maintenance status updated." };
}

export async function createAssetDefectCapa(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_ASSETS); await requirePermission(PermissionKey.CREATE_CAPA); const { organizationId, user } = await getCurrentUserTenant(); const assetId = required(data, "assetId");
  try { await createCapaFromAssetDefectService({ organizationId, userId: user.id, defectId: required(data, "defectId"), title: required(data, "title"), description: optional(data, "description"), assignedToId: required(data, "assignedToId"), dueDate: date(data, "dueDate", true)! }); }
  catch (cause) { return error(cause, "The corrective action could not be created."); }
  refresh(assetId); revalidatePath("/actions"); revalidatePath("/capa"); return { status: "SUCCESS", message: "Corrective action created and linked to the asset defect." };
}
