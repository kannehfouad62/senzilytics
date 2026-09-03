"use server";

import { ActivityAction, PermissionKey, ResearchAnalysisStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import type { FormActionState } from "@/core/actions/action-state";
import { logActivity } from "@/core/activity-log/activity-log.service";
import { getCurrentUserPermissions, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { getResearchDataset } from "@/modules/research/research-dataset.service";
import { buildAnalysisSnapshot } from "@/modules/research/research-statistics";

const methods = new Set(["AUTO", "DISTRIBUTION", "BOX_PLOT", "CROSSTAB", "CORRELATION", "GROUP_COMPARISON", "REGRESSION"]);
const text = (data: FormData, key: string, maximum = 2000) => String(data.get(key) ?? "").trim().slice(0, maximum);
const failure = (cause: unknown): FormActionState => ({ status: "ERROR", message: cause instanceof Error ? cause.message : "The analysis could not be updated." });
const refresh = (collectionId: string) => { revalidatePath("/research", "layout"); revalidatePath(`/research/datasets/${collectionId}`); };
const categories = (value: unknown) => value === null || value === "" || value === undefined ? [] : Array.isArray(value) ? value.map(String) : [String(value)];

export async function saveResearchAnalysis(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.RUN_RESEARCH_ANALYSIS);
  const { organizationId, user } = await getCurrentUserTenant();
  try {
    const collectionId = text(data, "collectionId", 100);
    const title = text(data, "title", 160);
    const method = text(data, "method", 40);
    const xVariableKey = text(data, "xVariableKey", 160);
    const yVariableKey = text(data, "yVariableKey", 160) || null;
    const filterVariableKey = text(data, "filterVariableKey", 160) || null;
    const filterValue = text(data, "filterValue", 500) || null;
    if (!title) throw new Error("Give this analysis a title.");
    if (!methods.has(method)) throw new Error("Select a valid analytical method.");
    const dataset = await getResearchDataset(organizationId, collectionId);
    if (!dataset) throw new Error("Research dataset not found.");
    const x = dataset.variables.find(variable => variable.key === xVariableKey);
    const y = yVariableKey ? dataset.variables.find(variable => variable.key === yVariableKey) : null;
    if (!x || (yVariableKey && !y)) throw new Error("The selected variables are not part of this questionnaire version.");
    if (filterVariableKey && !dataset.variables.some(variable => variable.key === filterVariableKey)) throw new Error("The selected filter is not part of this questionnaire version.");
    const rows = filterVariableKey && filterValue ? dataset.analysisRows.filter(row => categories(row.values[filterVariableKey]).includes(filterValue)) : dataset.analysisRows;
    const resultSnapshot = JSON.parse(JSON.stringify(buildAnalysisSnapshot(method, rows, x, y)));
    const previous = await prisma.researchAnalysis.aggregate({ where: { organizationId, collectionId, title }, _max: { version: true } });
    const analysis = await prisma.researchAnalysis.create({ data: {
      organizationId,
      collectionId,
      title,
      method,
      xVariableKey,
      yVariableKey,
      filterVariableKey,
      filterValue,
      hypothesis: text(data, "hypothesis", 2000) || null,
      methodologyNotes: text(data, "methodologyNotes", 4000) || null,
      datasetResponseCount: rows.length,
      version: (previous._max.version ?? 0) + 1,
      resultSnapshot,
      analystId: user.id,
    } });
    await logActivity({ organizationId, userId: user.id, action: ActivityAction.CREATE, entityType: "ResearchAnalysis", entityId: analysis.id, title: "Research analysis saved", description: title, metadata: { collectionId, method, datasetResponseCount: rows.length } });
    refresh(collectionId);
    return { status: "SUCCESS", message: "Analysis saved as a governed draft." };
  } catch (cause) { return failure(cause); }
}

export async function changeResearchAnalysisStatus(_state: FormActionState, data: FormData): Promise<FormActionState> {
  const [{ organizationId, user }, permissions] = await Promise.all([getCurrentUserTenant(), getCurrentUserPermissions()]);
  if (!permissions.includes(PermissionKey.RUN_RESEARCH_ANALYSIS)) throw new Error("Research analysis permission is required.");
  try {
    const analysisId = text(data, "analysisId", 100);
    const target = text(data, "status", 40) as ResearchAnalysisStatus;
    const analysis = await prisma.researchAnalysis.findFirst({ where: { id: analysisId, organizationId }, include: { collection: true } });
    if (!analysis) throw new Error("Saved analysis not found.");
    const allowed: Record<ResearchAnalysisStatus, ResearchAnalysisStatus[]> = {
      DRAFT: [ResearchAnalysisStatus.UNDER_REVIEW],
      UNDER_REVIEW: [ResearchAnalysisStatus.DRAFT, ResearchAnalysisStatus.APPROVED],
      APPROVED: [ResearchAnalysisStatus.ARCHIVED],
      ARCHIVED: [],
    };
    if (!allowed[analysis.status].includes(target)) throw new Error(`Analysis cannot move from ${analysis.status} to ${target}.`);
    if (target === ResearchAnalysisStatus.UNDER_REVIEW && analysis.analystId !== user.id && !permissions.includes(PermissionKey.MANAGE_RESEARCH_DATASETS)) throw new Error("Only the analyst or a dataset manager can submit this analysis.");
    if (target === ResearchAnalysisStatus.UNDER_REVIEW && !["LOCKED", "APPROVED"].includes(analysis.collection.datasetStatus)) throw new Error("Lock the governed dataset before submitting an analysis for review.");
    if (target === ResearchAnalysisStatus.UNDER_REVIEW && (analysis.methodologyNotes?.trim().length ?? 0) < 20) throw new Error("Record substantive methodology and assumption notes before review.");
    if (target === ResearchAnalysisStatus.APPROVED) {
      if (!permissions.includes(PermissionKey.APPROVE_RESEARCH_OUTPUTS)) throw new Error("Research output approval permission is required.");
      if (analysis.analystId === user.id) throw new Error("Independent approval is required; the analyst cannot approve their own work.");
      if (analysis.collection.datasetStatus !== "APPROVED") throw new Error("The governed dataset must be approved before its analysis can be approved.");
      const currentDataset = await getResearchDataset(organizationId, analysis.collectionId);
      const currentPopulation = analysis.filterVariableKey && analysis.filterValue ? currentDataset?.analysisRows.filter(row => categories(row.values[analysis.filterVariableKey!]).includes(analysis.filterValue!)).length ?? -1 : currentDataset?.analysisRows.length ?? -1;
      if (currentPopulation !== analysis.datasetResponseCount) throw new Error("The analytical population changed; save a new analysis version before approval.");
    }
    if (target === ResearchAnalysisStatus.ARCHIVED && !permissions.includes(PermissionKey.MANAGE_RESEARCH_DATASETS)) throw new Error("Dataset management permission is required to archive an analysis.");
    const now = new Date();
    await prisma.researchAnalysis.update({ where: { id: analysis.id }, data: {
      status: target,
      submittedAt: target === ResearchAnalysisStatus.UNDER_REVIEW ? now : target === ResearchAnalysisStatus.DRAFT ? null : analysis.submittedAt,
      reviewerId: target === ResearchAnalysisStatus.APPROVED ? user.id : target === ResearchAnalysisStatus.DRAFT ? null : analysis.reviewerId,
      reviewedAt: target === ResearchAnalysisStatus.APPROVED ? now : target === ResearchAnalysisStatus.DRAFT ? null : analysis.reviewedAt,
      approvedById: target === ResearchAnalysisStatus.APPROVED ? user.id : analysis.approvedById,
      approvedAt: target === ResearchAnalysisStatus.APPROVED ? now : analysis.approvedAt,
    } });
    await logActivity({ organizationId, userId: user.id, action: ActivityAction.STATUS_CHANGE, entityType: "ResearchAnalysis", entityId: analysis.id, title: "Research analysis status changed", description: `${analysis.status} → ${target}`, metadata: { collectionId: analysis.collectionId } });
    refresh(analysis.collectionId);
    return { status: "SUCCESS", message: "Analysis governance status updated." };
  } catch (cause) { return failure(cause); }
}
