"use server";
import {
  ActivityAction,
  PermissionKey,
  ResearchSamplingDesignStatus,
  ResearchSamplingDesignType,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import type { FormActionState } from "@/core/actions/action-state";
import { logActivity } from "@/core/activity-log/activity-log.service";
import {
  getCurrentUserPermissions,
  requirePermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
const text = (data: FormData, key: string, max = 4000) =>
    String(data.get(key) ?? "")
      .trim()
      .slice(0, max),
  integer = (data: FormData, key: string) => {
    const raw = text(data, key, 20);
    return raw ? Number(raw) : null;
  },
  failure = (cause: unknown): FormActionState => ({
    status: "ERROR",
    message:
      cause instanceof Error
        ? cause.message
        : "Sampling design could not be updated.",
  }),
  refresh = (projectId: string) => {
    revalidatePath("/research", "layout");
    revalidatePath(`/research/projects/${projectId}/sampling-design`);
  };
export async function createResearchSamplingDesign(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_RESEARCH_PROJECTS);
  const { organizationId, user } = await getCurrentUserTenant();
  try {
    const projectId = text(data, "projectId", 100),
      name = text(data, "name", 160),
      type = text(data, "type", 50) as ResearchSamplingDesignType,
      populationSize = integer(data, "populationSize"),
      samplingFrameSize = integer(data, "samplingFrameSize"),
      targetSampleSize = integer(data, "targetSampleSize"),
      selectionInterval = Number(text(data, "selectionInterval", 30)) || null,
      strataVariableKey = text(data, "strataVariableKey", 160) || null,
      clusterVariableKey = text(data, "clusterVariableKey", 160) || null,
      stages = text(data, "stages"),
      assumptions = text(data, "assumptions");
    if (name.length < 3) throw new Error("Enter a sampling design name.");
    if (!Object.values(ResearchSamplingDesignType).includes(type))
      throw new Error("Select a valid sampling design.");
    if (
      !targetSampleSize ||
      !Number.isInteger(targetSampleSize) ||
      targetSampleSize < 1
    )
      throw new Error("Target sample size must be a positive whole number.");
    for (const number of [populationSize, samplingFrameSize])
      if (number !== null && (!Number.isInteger(number) || number < 1))
        throw new Error(
          "Population and frame sizes must be positive whole numbers.",
        );
    if (populationSize && targetSampleSize > populationSize)
      throw new Error("Target sample cannot exceed the population size.");
    if (populationSize && samplingFrameSize && samplingFrameSize > populationSize)
      throw new Error("Sampling frame cannot exceed the population size.");
    if (type === ResearchSamplingDesignType.SYSTEMATIC && (!selectionInterval || selectionInterval <= 1))
      throw new Error("Systematic sampling requires a selection interval greater than one.");
    if (type === ResearchSamplingDesignType.STRATIFIED && !strataVariableKey)
      throw new Error("Stratified sampling requires a strata variable key.");
    if (type === ResearchSamplingDesignType.CLUSTER && !clusterVariableKey)
      throw new Error("Cluster sampling requires a cluster variable key.");
    if (type === ResearchSamplingDesignType.MULTISTAGE && stages.length < 20)
      throw new Error("Describe the multistage selection procedure.");
    if (data.get("finitePopulationCorrection") === "on" && !populationSize)
      throw new Error("Finite-population correction requires population size.");
    if (assumptions.length < 20)
      throw new Error("Record substantive sampling assumptions.");
    const project = await prisma.researchProject.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true },
    });
    if (!project) throw new Error("Research project not found.");
    const latest = await prisma.researchSamplingDesign.aggregate({
        where: { projectId },
        _max: { version: true },
      }),
      design = await prisma.researchSamplingDesign.create({
        data: {
          organizationId,
          projectId,
          version: (latest._max.version ?? 0) + 1,
          name,
          type,
          populationSize,
          samplingFrameSize,
          targetSampleSize,
          selectionInterval,
          strataVariableKey,
          clusterVariableKey,
          stages: stages ? { description: stages } : undefined,
          finitePopulationCorrection:
            data.get("finitePopulationCorrection") === "on",
          weightMethod: text(data, "weightMethod") || null,
          nonresponseAdjustment: text(data, "nonresponseAdjustment") || null,
          calibrationMethod: text(data, "calibrationMethod") || null,
          assumptions,
          createdById: user.id,
        },
      });
    await logActivity({
      organizationId,
      userId: user.id,
      action: ActivityAction.CREATE,
      entityType: "ResearchSamplingDesign",
      entityId: design.id,
      title: "Sampling design created",
      description: `${design.name} v${design.version}`,
      metadata: { projectId, type },
    });
    refresh(projectId);
    return {
      status: "SUCCESS",
      message: "Sampling design saved as a governed draft.",
    };
  } catch (cause) {
    return failure(cause);
  }
}
export async function changeResearchSamplingDesignStatus(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  const [{ organizationId, user }, permissions] = await Promise.all([
    getCurrentUserTenant(),
    getCurrentUserPermissions(),
  ]);
  try {
    const id = text(data, "designId", 100),
      target = text(data, "status", 40) as ResearchSamplingDesignStatus,
      design = await prisma.researchSamplingDesign.findFirst({
        where: { id, organizationId },
      });
    if (!design) throw new Error("Sampling design not found.");
    const allowed: Record<
      ResearchSamplingDesignStatus,
      ResearchSamplingDesignStatus[]
    > = {
      DRAFT: [ResearchSamplingDesignStatus.UNDER_REVIEW],
      UNDER_REVIEW: [
        ResearchSamplingDesignStatus.DRAFT,
        ResearchSamplingDesignStatus.APPROVED,
      ],
      APPROVED: [ResearchSamplingDesignStatus.ARCHIVED],
      ARCHIVED: [],
    };
    if (!allowed[design.status].includes(target))
      throw new Error(`Design cannot move from ${design.status} to ${target}.`);
    if (target === ResearchSamplingDesignStatus.APPROVED) {
      if (!permissions.includes(PermissionKey.APPROVE_RESEARCH_OUTPUTS))
        throw new Error("Research output approval permission is required.");
      if (design.createdById === user.id)
        throw new Error("Independent approval is required.");
      await prisma.$transaction([
        prisma.researchSamplingDesign.updateMany({
          where: {
            projectId: design.projectId,
            status: ResearchSamplingDesignStatus.APPROVED,
          },
          data: { status: ResearchSamplingDesignStatus.ARCHIVED },
        }),
        prisma.researchSamplingDesign.update({
          where: { id },
          data: {
            status: target,
            approvedById: user.id,
            approvedAt: new Date(),
          },
        }),
      ]);
    } else {
      if (!permissions.includes(PermissionKey.MANAGE_RESEARCH_PROJECTS))
        throw new Error("Research project management permission is required.");
      await prisma.researchSamplingDesign.update({
        where: { id },
        data: {
          status: target,
          submittedAt:
            target === ResearchSamplingDesignStatus.UNDER_REVIEW
              ? new Date()
              : null,
        },
      });
    }
    await logActivity({
      organizationId,
      userId: user.id,
      action: ActivityAction.STATUS_CHANGE,
      entityType: "ResearchSamplingDesign",
      entityId: id,
      title: "Sampling design status changed",
      description: `${design.status} → ${target}`,
    });
    refresh(design.projectId);
    return { status: "SUCCESS", message: "Sampling design status updated." };
  } catch (cause) {
    return failure(cause);
  }
}
