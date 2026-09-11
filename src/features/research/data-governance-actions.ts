"use server";

import type { FormActionState } from "@/core/actions/action-state";
import { getCurrentUserPermissions, requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  changeResearchDataLifecycleStatus,
  changeResearchPrivacyReviewStatus,
  createResearchPrivacyReview,
  decideResearchDatasetAccess,
  requestResearchDatasetAccess,
  saveResearchDataLifecyclePlan,
} from "@/modules/research/research-data-governance.service";
import {
  PermissionKey,
  ResearchDataDisposalMethod,
  ResearchDataLifecycleStatus,
  ResearchDatasetAccessLevel,
  ResearchDatasetAccessStatus,
  ResearchDisclosureRisk,
  ResearchPrivacyReviewStatus,
  ResearchPrivacyReviewType,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function saveDataLifecyclePlanAction(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_RESEARCH_DATASETS);
  const { organizationId, user } = await getCurrentUserTenant();
  try {
    const projectId = text(data, "projectId", 100);
    const disposalMethod = enumValue(data, "disposalMethod", ResearchDataDisposalMethod);
    await saveResearchDataLifecyclePlan({ organizationId, actorId: user.id, projectId, retentionBasis: text(data, "retentionBasis"), retentionDays: integer(data, "retentionDays"), disposalMethod, scheduledDisposalAt: requiredDate(data, "scheduledDisposalAt"), ownerId: text(data, "ownerId", 100) });
    refresh(projectId);
    return success("Research data lifecycle plan saved.");
  } catch (error) { return failure(error); }
}

export async function changeDataLifecycleStatusAction(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_RESEARCH_DATASETS);
  const [{ organizationId, user }, permissions] = await Promise.all([getCurrentUserTenant(), getCurrentUserPermissions()]);
  try {
    const projectId = text(data, "projectId", 100);
    await changeResearchDataLifecycleStatus({ organizationId, actorId: user.id, planId: text(data, "planId", 100), status: enumValue(data, "status", ResearchDataLifecycleStatus), reason: text(data, "reason") || null, evidence: text(data, "evidence", 500) || null, canApprove: permissions.includes(PermissionKey.APPROVE_RESEARCH_OUTPUTS) });
    refresh(projectId);
    return success("Data lifecycle status updated.");
  } catch (error) { return failure(error); }
}

export async function createPrivacyReviewAction(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_RESEARCH_DATASETS);
  const { organizationId, user } = await getCurrentUserTenant();
  try {
    const projectId = text(data, "projectId", 100);
    await createResearchPrivacyReview({ organizationId, actorId: user.id, projectId, datasetReference: text(data, "datasetReference", 100), type: enumValue(data, "type", ResearchPrivacyReviewType), method: text(data, "method"), directIdentifiersRemoved: data.get("directIdentifiersRemoved") === "on", quasiIdentifierControls: text(data, "quasiIdentifierControls") || null, residualRisk: enumValue(data, "residualRisk", ResearchDisclosureRisk), findings: text(data, "findings"), mitigation: text(data, "mitigation") || null, evidenceReference: text(data, "evidenceReference", 500) });
    refresh(projectId);
    return success("Versioned privacy review created.");
  } catch (error) { return failure(error); }
}

export async function changePrivacyReviewStatusAction(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_RESEARCH_DATASETS);
  const [{ organizationId, user }, permissions] = await Promise.all([getCurrentUserTenant(), getCurrentUserPermissions()]);
  try {
    const projectId = text(data, "projectId", 100);
    await changeResearchPrivacyReviewStatus({ organizationId, actorId: user.id, reviewId: text(data, "reviewId", 100), status: enumValue(data, "status", ResearchPrivacyReviewStatus), canApprove: permissions.includes(PermissionKey.APPROVE_RESEARCH_OUTPUTS) });
    refresh(projectId);
    return success("Privacy review status updated.");
  } catch (error) { return failure(error); }
}

export async function requestDatasetAccessAction(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.VIEW_RESEARCH);
  const { organizationId, user } = await getCurrentUserTenant();
  try {
    const projectId = text(data, "projectId", 100);
    await requestResearchDatasetAccess({ organizationId, actorId: user.id, projectId, datasetReference: text(data, "datasetReference", 100), accessLevel: enumValue(data, "accessLevel", ResearchDatasetAccessLevel), purpose: text(data, "purpose"), scope: text(data, "scope"), safeguards: text(data, "safeguards"), accessStartsAt: optionalDate(data, "accessStartsAt"), accessExpiresAt: optionalDate(data, "accessExpiresAt") });
    refresh(projectId);
    return success("Dataset access request submitted.");
  } catch (error) { return failure(error); }
}

export async function decideDatasetAccessAction(_state: FormActionState, data: FormData): Promise<FormActionState> {
  const [{ organizationId, user }, permissions] = await Promise.all([getCurrentUserTenant(), getCurrentUserPermissions()]);
  if (!permissions.includes(PermissionKey.MANAGE_RESEARCH_DATASETS) && !permissions.includes(PermissionKey.APPROVE_RESEARCH_OUTPUTS)) return failure(new Error("Dataset approval permission is required."));
  try {
    const projectId = text(data, "projectId", 100);
    await decideResearchDatasetAccess({ organizationId, actorId: user.id, requestId: text(data, "requestId", 100), status: enumValue(data, "status", ResearchDatasetAccessStatus), reason: text(data, "reason"), canApprove: permissions.includes(PermissionKey.APPROVE_RESEARCH_OUTPUTS) });
    refresh(projectId);
    return success("Dataset access decision recorded.");
  } catch (error) { return failure(error); }
}

function text(data: FormData, key: string, max = 8000) { return String(data.get(key) ?? "").trim().slice(0, max); }
function integer(data: FormData, key: string) { const value = Number(text(data, key, 20)); if (!Number.isInteger(value)) throw new Error(`Enter a valid ${key}.`); return value; }
function requiredDate(data: FormData, key: string) { const value = optionalDate(data, key); if (!value) throw new Error(`Enter a valid ${key}.`); return value; }
function optionalDate(data: FormData, key: string) { const raw = text(data, key, 30); if (!raw) return null; const value = new Date(raw); if (Number.isNaN(value.getTime())) throw new Error(`Enter a valid ${key}.`); return value; }
function enumValue<T extends Record<string, string>>(data: FormData, key: string, values: T): T[keyof T] { const value = text(data, key, 80); if (!Object.values(values).includes(value)) throw new Error(`Select a valid ${key}.`); return value as T[keyof T]; }
function success(message: string): FormActionState { return { status: "SUCCESS", message }; }
function failure(error: unknown): FormActionState { return { status: "ERROR", message: error instanceof Error ? error.message : "Research data governance could not be updated." }; }
function refresh(projectId: string) { revalidatePath(`/research/projects/${projectId}/data-governance`); revalidatePath(`/research/projects/${projectId}`); revalidatePath("/notifications"); }
