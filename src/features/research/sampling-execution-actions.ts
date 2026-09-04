"use server";

import { get } from "@vercel/blob";
import { randomBytes } from "node:crypto";
import {
  ActivityAction,
  PermissionKey,
  Prisma,
  ResearchSampleUnitStatus,
  ResearchSamplingDesignStatus,
  ResearchSamplingExecutionStatus,
  ResearchSamplingFrameStatus,
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
import { parseResearchFileRows } from "@/modules/research/research-import";
import { generateSamplingSelection } from "@/modules/research/research-sampling-execution";
import { validateSamplingFrame } from "@/modules/research/research-sampling-frame";

const text = (data: FormData, key: string, max = 200) =>
  String(data.get(key) ?? "")
    .trim()
    .slice(0, max);
const fail = (error: unknown): FormActionState => ({
  status: "ERROR",
  message:
    error instanceof Error
      ? error.message
      : "Sampling execution could not be updated.",
});
const refresh = (projectId: string) => {
  revalidatePath("/research", "layout");
  revalidatePath(`/research/projects/${projectId}/sampling-design`);
};

export async function generateResearchSample(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_RESEARCH_DATASETS);
  const { organizationId, user } = await getCurrentUserTenant();
  try {
    const frameId = text(data, "frameId", 100);
    const reservePercent = Number(text(data, "reservePercent", 10) || "0");
    const suppliedSeed = text(data, "seed", 200);
    if (
      !Number.isFinite(reservePercent) ||
      reservePercent < 0 ||
      reservePercent > 100
    )
      throw new Error("Reserve percentage must be between 0 and 100.");
    const frame = await prisma.researchSamplingFrame.findFirst({
      where: {
        id: frameId,
        organizationId,
        status: ResearchSamplingFrameStatus.VALIDATED,
        samplingDesign: { status: ResearchSamplingDesignStatus.APPROVED },
      },
      include: { samplingDesign: true },
    });
    if (!frame)
      throw new Error(
        "A validated frame linked to an approved sampling design is required.",
      );
    const stored = await get(frame.sourceBlobPath, { access: "private" });
    if (!stored || stored.statusCode !== 200 || !stored.stream)
      throw new Error("The private sampling frame could not be read.");
    const bytes = await new Response(stored.stream).arrayBuffer();
    const parsed = validateSamplingFrame({
      rows: await parseResearchFileRows(
        bytes,
        frame.mimeType,
        frame.sourceFileName,
      ),
      identifierColumn: frame.identifierColumn,
      strataColumn: frame.strataColumn,
      clusterColumn: frame.clusterColumn,
    });
    if (parsed.frameRows.length !== frame.rowCount)
      throw new Error(
        "The private frame no longer matches its validated row count.",
      );
    const seed = suppliedSeed || randomBytes(24).toString("base64url");
    const reserveSampleSize = Math.ceil(
      (frame.samplingDesign.targetSampleSize * reservePercent) / 100,
    );
    const result = generateSamplingSelection({
      type: frame.samplingDesign.type,
      rows: parsed.frameRows,
      targetSampleSize: frame.samplingDesign.targetSampleSize,
      reserveSampleSize,
      seed,
    });
    const latest = await prisma.researchSamplingExecution.aggregate({
      where: { samplingDesignId: frame.samplingDesignId },
      _max: { version: true },
    });
    const primaryCount = result.units.filter((unit) => !unit.isReserve).length;
    const execution = await prisma.$transaction(async (tx) => {
      const created = await tx.researchSamplingExecution.create({
        data: {
          organizationId,
          projectId: frame.projectId,
          samplingDesignId: frame.samplingDesignId,
          samplingFrameId: frame.id,
          version: (latest._max.version ?? 0) + 1,
          seed,
          targetSampleSize: frame.samplingDesign.targetSampleSize,
          reserveSampleSize: result.units.length - primaryCount,
          selectedSampleSize: primaryCount,
          algorithmSnapshot:
            result.snapshot as unknown as Prisma.InputJsonValue,
          designSnapshot: {
            id: frame.samplingDesign.id,
            version: frame.samplingDesign.version,
            name: frame.samplingDesign.name,
            type: frame.samplingDesign.type,
            populationSize: frame.samplingDesign.populationSize,
            samplingFrameSize: frame.samplingDesign.samplingFrameSize,
            targetSampleSize: frame.samplingDesign.targetSampleSize,
            selectionInterval: frame.samplingDesign.selectionInterval,
            strataVariableKey: frame.samplingDesign.strataVariableKey,
            clusterVariableKey: frame.samplingDesign.clusterVariableKey,
            finitePopulationCorrection:
              frame.samplingDesign.finitePopulationCorrection,
            assumptions: frame.samplingDesign.assumptions,
          },
          generatedById: user.id,
        },
      });
      await tx.researchSampleUnit.createMany({
        data: result.units.map((unit) => ({
          executionId: created.id,
          unitReference: unit.unitReference,
          frameRowNumber: unit.frameRowNumber,
          stratum: unit.stratum,
          cluster: unit.cluster,
          selectionOrder: unit.selectionOrder,
          inclusionProbability: unit.inclusionProbability,
          baseWeight: unit.baseWeight,
          isReserve: unit.isReserve,
          status: unit.isReserve
            ? ResearchSampleUnitStatus.RESERVE
            : ResearchSampleUnitStatus.SELECTED,
        })),
      });
      return created;
    });
    await logActivity({
      organizationId,
      userId: user.id,
      action: ActivityAction.CREATE,
      entityType: "ResearchSamplingExecution",
      entityId: execution.id,
      title: "Reproducible research sample generated",
      description: `${frame.samplingDesign.name} execution v${execution.version}`,
      metadata: {
        projectId: frame.projectId,
        frameId: frame.id,
        selectedSampleSize: primaryCount,
        reserveSampleSize: result.units.length - primaryCount,
        seedFingerprint: result.snapshot.seedFingerprint,
      },
    });
    refresh(frame.projectId);
    return {
      status: "SUCCESS",
      message: "Reproducible sample generated and recorded for review.",
    };
  } catch (error) {
    return fail(error);
  }
}

export async function changeSamplingExecutionStatus(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  const [{ organizationId, user }, permissions] = await Promise.all([
    getCurrentUserTenant(),
    getCurrentUserPermissions(),
  ]);
  try {
    const executionId = text(data, "executionId", 100);
    const target = text(data, "status", 40) as ResearchSamplingExecutionStatus;
    const execution = await prisma.researchSamplingExecution.findFirst({
      where: { id: executionId, organizationId },
    });
    if (!execution) throw new Error("Sampling execution not found.");
    const allowed: Partial<
      Record<ResearchSamplingExecutionStatus, ResearchSamplingExecutionStatus[]>
    > = {
      GENERATED: [
        ResearchSamplingExecutionStatus.UNDER_REVIEW,
        ResearchSamplingExecutionStatus.CANCELLED,
      ],
      UNDER_REVIEW: [
        ResearchSamplingExecutionStatus.GENERATED,
        ResearchSamplingExecutionStatus.APPROVED,
      ],
      APPROVED: [ResearchSamplingExecutionStatus.ARCHIVED],
    };
    if (!(allowed[execution.status] ?? []).includes(target))
      throw new Error(
        `Sampling execution cannot move from ${execution.status} to ${target}.`,
      );
    if (target === ResearchSamplingExecutionStatus.APPROVED) {
      if (!permissions.includes(PermissionKey.APPROVE_RESEARCH_OUTPUTS))
        throw new Error("Research output approval permission is required.");
      if (execution.generatedById === user.id)
        throw new Error("Independent sampling execution approval is required.");
      await prisma.$transaction([
        prisma.researchSamplingExecution.updateMany({
          where: {
            samplingDesignId: execution.samplingDesignId,
            status: ResearchSamplingExecutionStatus.APPROVED,
          },
          data: {
            status: ResearchSamplingExecutionStatus.ARCHIVED,
            archivedAt: new Date(),
          },
        }),
        prisma.researchSamplingExecution.update({
          where: { id: execution.id },
          data: {
            status: target,
            approvedById: user.id,
            approvedAt: new Date(),
          },
        }),
      ]);
    } else {
      if (!permissions.includes(PermissionKey.MANAGE_RESEARCH_DATASETS))
        throw new Error("Research dataset management permission is required.");
      await prisma.researchSamplingExecution.update({
        where: { id: execution.id },
        data: {
          status: target,
          submittedAt:
            target === ResearchSamplingExecutionStatus.UNDER_REVIEW
              ? new Date()
              : target === ResearchSamplingExecutionStatus.GENERATED
                ? null
                : execution.submittedAt,
          archivedAt:
            target === ResearchSamplingExecutionStatus.ARCHIVED
              ? new Date()
              : execution.archivedAt,
        },
      });
    }
    await logActivity({
      organizationId,
      userId: user.id,
      action: ActivityAction.STATUS_CHANGE,
      entityType: "ResearchSamplingExecution",
      entityId: execution.id,
      title: "Sampling execution status changed",
      description: `${execution.status} → ${target}`,
      metadata: { projectId: execution.projectId },
    });
    refresh(execution.projectId);
    return { status: "SUCCESS", message: "Sampling execution status updated." };
  } catch (error) {
    return fail(error);
  }
}
