"use server";

import {
  ActivityAction,
  PermissionKey,
  ResearchAnalysisStatus,
  ResearchReportStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

import type { FormActionState } from "@/core/actions/action-state";
import { logActivity } from "@/core/activity-log/activity-log.service";
import { getCurrentUserPermissions, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";

const value = (data: FormData, key: string, maximum: number) =>
  String(data.get(key) ?? "").trim().slice(0, maximum);
const fail = (cause: unknown): FormActionState => ({
  status: "ERROR",
  message:
    cause instanceof Error ? cause.message : "The research report could not be updated.",
});
const refresh = (projectId: string, reportId?: string) => {
  revalidatePath("/research", "layout");
  revalidatePath(`/research/projects/${projectId}/reports`);
  if (reportId) revalidatePath(`/research/reports/${reportId}`);
};

export async function createResearchReport(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  await requirePermission(PermissionKey.RUN_RESEARCH_ANALYSIS);
  const { organizationId, user } = await getCurrentUserTenant();
  try {
    const projectId = value(data, "projectId", 100);
    const title = value(data, "title", 180);
    const sections = {
      executiveSummary: value(data, "executiveSummary", 6000),
      background: value(data, "background", 10000) || null,
      methodology: value(data, "methodology", 10000),
      findings: value(data, "findings", 12000),
      discussion: value(data, "discussion", 12000) || null,
      conclusions: value(data, "conclusions", 8000),
      recommendations: value(data, "recommendations", 8000),
      limitations: value(data, "limitations", 6000),
    };
    const analysisIds = [
      ...new Set(data.getAll("analysisIds").map(String).filter(Boolean)),
    ].slice(0, 50);
    if (!title) throw new Error("Give the report a title.");
    if (
      [
        sections.executiveSummary,
        sections.methodology,
        sections.findings,
        sections.conclusions,
        sections.recommendations,
        sections.limitations,
      ].some((section) => section.length < 20)
    ) {
      throw new Error("Complete every required report section with substantive content.");
    }
    if (!analysisIds.length) {
      throw new Error("Select at least one approved analysis for the evidence snapshot.");
    }

    const [project, analyses, reportCount] = await Promise.all([
      prisma.researchProject.findFirst({
        where: { id: projectId, organizationId },
        include: { client: true },
      }),
      prisma.researchAnalysis.findMany({
        where: {
          id: { in: analysisIds },
          organizationId,
          status: ResearchAnalysisStatus.APPROVED,
          OR: [{ collection: { projectId } }, { datasetVersion: { dataset: { projectId } } }],
        },
        include: {
          collection: {
            select: {
              id: true,
              name: true,
              datasetStatus: true,
              datasetApprovedAt: true,
            },
          },
          datasetVersion: { select: { id:true,version:true,dataset:{select:{name:true}} } },
          analyst: { select: { id: true, name: true } },
          approvedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.researchReport.count({ where: { organizationId, projectId } }),
    ]);
    if (!project) throw new Error("Research project not found.");
    if (analyses.length !== analysisIds.length) {
      throw new Error(
        "Every selected analysis must belong to this project and have independent approval.",
      );
    }

    const reference = `RPT-${project.reference}-${String(reportCount + 1).padStart(2, "0")}`;
    const snapshot = JSON.parse(
      JSON.stringify({
        generatedAt: new Date().toISOString(),
        project: {
          id: project.id,
          reference: project.reference,
          title: project.title,
          purpose: project.purpose,
          client: project.client?.name ?? "Internal research",
          dataOwner:
            project.client?.dataOwnerName ?? project.dataOwnershipStatement ?? null,
        },
        analyses: analyses.map((analysis) => ({
          id: analysis.id,
          title: analysis.title,
          method: analysis.method,
          version: analysis.version,
          variables: analysis.variableKeys,
          population: analysis.datasetResponseCount,
          result: analysis.resultSnapshot,
          collection: analysis.collection??{id:analysis.datasetVersion?.id,name:`${analysis.datasetVersion?.dataset.name} v${analysis.datasetVersion?.version}`,datasetStatus:"APPROVED",datasetApprovedAt:analysis.approvedAt},
          analyst: analysis.analyst,
          approvedBy: analysis.approvedBy,
          approvedAt: analysis.approvedAt,
        })),
      }),
    );
    const report = await prisma.researchReport.create({
      data: {
        organizationId,
        projectId,
        reference,
        title,
        ...sections,
        analysisIds,
        evidenceSnapshot: snapshot,
        authorId: user.id,
      },
    });
    await logActivity({
      organizationId,
      userId: user.id,
      action: ActivityAction.CREATE,
      entityType: "ResearchReport",
      entityId: report.id,
      title: "Governed research report created",
      description: `${reference} — ${title}`,
      metadata: { projectId, analysisIds },
    });
    refresh(projectId, report.id);
    return { status: "SUCCESS", message: "Governed report draft created." };
  } catch (cause) {
    return fail(cause);
  }
}

export async function changeResearchReportStatus(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  const [{ organizationId, user }, permissions] = await Promise.all([
    getCurrentUserTenant(),
    getCurrentUserPermissions(),
  ]);
  if (!permissions.includes(PermissionKey.RUN_RESEARCH_ANALYSIS)) {
    throw new Error("Research analysis permission is required.");
  }
  try {
    const reportId = value(data, "reportId", 100);
    const target = value(data, "status", 40) as ResearchReportStatus;
    if (!Object.values(ResearchReportStatus).includes(target)) {
      throw new Error("Select a valid report status.");
    }
    const report = await prisma.researchReport.findFirst({
      where: { id: reportId, organizationId },
    });
    if (!report) throw new Error("Research report not found.");
    const allowed: Record<ResearchReportStatus, ResearchReportStatus[]> = {
      DRAFT: [ResearchReportStatus.UNDER_REVIEW],
      UNDER_REVIEW: [ResearchReportStatus.DRAFT, ResearchReportStatus.APPROVED],
      APPROVED: [ResearchReportStatus.PUBLISHED],
      PUBLISHED: [ResearchReportStatus.ARCHIVED],
      ARCHIVED: [],
    };
    if (!allowed[report.status].includes(target)) {
      throw new Error(`Report cannot move from ${report.status} to ${target}.`);
    }
    if (
      target === ResearchReportStatus.UNDER_REVIEW &&
      report.authorId !== user.id &&
      !permissions.includes(PermissionKey.MANAGE_RESEARCH_PROJECTS)
    ) {
      throw new Error("Only the author or a research manager can submit this report.");
    }
    if (target === ResearchReportStatus.APPROVED) {
      if (!permissions.includes(PermissionKey.APPROVE_RESEARCH_OUTPUTS)) {
        throw new Error("Research output approval permission is required.");
      }
      if (report.authorId === user.id) {
        throw new Error("Independent approval is required; authors cannot approve their own reports.");
      }
      const approvedCount = await prisma.researchAnalysis.count({
        where: {
          id: { in: report.analysisIds },
          organizationId,
          status: ResearchAnalysisStatus.APPROVED,
          OR: [{ collection: { projectId: report.projectId } }, { datasetVersion: { dataset: { projectId: report.projectId } } }],
        },
      });
      if (approvedCount !== report.analysisIds.length) {
        throw new Error("A supporting analysis is no longer approved or project-scoped.");
      }
    }
    if (
      (target === ResearchReportStatus.PUBLISHED ||
        target === ResearchReportStatus.ARCHIVED) &&
      !permissions.includes(PermissionKey.MANAGE_RESEARCH_PROJECTS)
    ) {
      throw new Error("Research project management permission is required.");
    }

    const now = new Date();
    await prisma.researchReport.update({
      where: { id: report.id },
      data: {
        status: target,
        submittedAt:
          target === ResearchReportStatus.UNDER_REVIEW
            ? now
            : target === ResearchReportStatus.DRAFT
              ? null
              : report.submittedAt,
        reviewerId:
          target === ResearchReportStatus.APPROVED
            ? user.id
            : target === ResearchReportStatus.DRAFT
              ? null
              : report.reviewerId,
        reviewedAt:
          target === ResearchReportStatus.APPROVED
            ? now
            : target === ResearchReportStatus.DRAFT
              ? null
              : report.reviewedAt,
        approvedById:
          target === ResearchReportStatus.APPROVED ? user.id : report.approvedById,
        approvedAt:
          target === ResearchReportStatus.APPROVED ? now : report.approvedAt,
        publishedById:
          target === ResearchReportStatus.PUBLISHED ? user.id : report.publishedById,
        publishedAt:
          target === ResearchReportStatus.PUBLISHED ? now : report.publishedAt,
        archivedAt:
          target === ResearchReportStatus.ARCHIVED ? now : report.archivedAt,
      },
    });
    await logActivity({
      organizationId,
      userId: user.id,
      action: ActivityAction.STATUS_CHANGE,
      entityType: "ResearchReport",
      entityId: report.id,
      title: "Research report status changed",
      description: `${report.status} → ${target}`,
      metadata: { projectId: report.projectId },
    });
    refresh(report.projectId, report.id);
    return { status: "SUCCESS", message: "Report governance status updated." };
  } catch (cause) {
    return fail(cause);
  }
}

export async function updateResearchReportDraft(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  await requirePermission(PermissionKey.RUN_RESEARCH_ANALYSIS);
  const { organizationId, user } = await getCurrentUserTenant();
  try {
    const reportId = value(data, "reportId", 100);
    const report = await prisma.researchReport.findFirst({
      where: { id: reportId, organizationId },
    });
    if (!report) throw new Error("Research report not found.");
    if (report.status !== ResearchReportStatus.DRAFT) {
      throw new Error("Only draft reports can be edited.");
    }
    if (report.authorId !== user.id) {
      const permissions = await getCurrentUserPermissions();
      if (!permissions.includes(PermissionKey.MANAGE_RESEARCH_PROJECTS)) {
        throw new Error("Only the author or a research manager can edit this draft.");
      }
    }
    const title = value(data, "title", 180);
    const sections = {
      executiveSummary: value(data, "executiveSummary", 6000),
      background: value(data, "background", 10000) || null,
      methodology: value(data, "methodology", 10000),
      findings: value(data, "findings", 12000),
      discussion: value(data, "discussion", 12000) || null,
      conclusions: value(data, "conclusions", 8000),
      recommendations: value(data, "recommendations", 8000),
      limitations: value(data, "limitations", 6000),
    };
    if (!title) throw new Error("Give the report a title.");
    if (
      [
        sections.executiveSummary,
        sections.methodology,
        sections.findings,
        sections.conclusions,
        sections.recommendations,
        sections.limitations,
      ].some((section) => section.length < 20)
    ) {
      throw new Error("Complete every required report section with substantive content.");
    }
    await prisma.researchReport.update({
      where: { id: report.id },
      data: { title, ...sections },
    });
    await logActivity({
      organizationId,
      userId: user.id,
      action: ActivityAction.UPDATE,
      entityType: "ResearchReport",
      entityId: report.id,
      title: "Research report draft revised",
      description: title,
      metadata: { projectId: report.projectId },
    });
    refresh(report.projectId, report.id);
    return { status: "SUCCESS", message: "Report draft updated." };
  } catch (cause) {
    return fail(cause);
  }
}
