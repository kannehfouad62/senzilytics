import { prisma } from "@/lib/prisma";
import {
  getEsgDisclosureNextStatuses,
  getEsgInitiativeNextStatuses,
} from "@/modules/esg/esg-lifecycle";
import { getPublishedRuntimeForms } from "@/modules/forms/runtime-form.service";
import { ConfigurableFormModule, PermissionKey } from "@prisma/client";

export function mobileEsgCapabilities(
  permissions: readonly PermissionKey[]
) {
  const granted = new Set(permissions);
  return {
    canView: granted.has(PermissionKey.VIEW_ESG),
    canManage: granted.has(PermissionKey.MANAGE_ESG),
  };
}

export async function getMobileEsgWorkspace(input: {
  organizationId: string;
  permissions: readonly PermissionKey[];
}) {
  const capabilities = mobileEsgCapabilities(input.permissions);
  if (!capabilities.canView) {
    return {
      capabilities,
      periods: [],
      metrics: [],
      targets: [],
      initiatives: [],
      forms: [],
    };
  }

  const [periods, metrics, targets, initiatives, forms] = await Promise.all([
    prisma.esgDisclosurePeriod.findMany({
      where: { organizationId: input.organizationId },
      select: {
        id: true,
        name: true,
        periodStart: true,
        periodEnd: true,
        boundaryDescription: true,
        status: true,
        approvedAt: true,
        publishedAt: true,
        approvedBy: { select: { id: true, name: true } },
        publishedBy: { select: { id: true, name: true } },
        dataPoints: {
          where: { metric: { isActive: true } },
          select: {
            id: true,
            metricId: true,
            value: true,
            quality: true,
            evidenceSummary: true,
            sourceDescription: true,
            isAutoCalculated: true,
            sourceRecordCount: true,
            enteredBy: { select: { id: true, name: true } },
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { metric: { code: "asc" } },
        },
      },
      orderBy: { periodEnd: "desc" },
      take: 50,
    }),
    prisma.esgMetricDefinition.findMany({
      where: { organizationId: input.organizationId, isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        pillar: true,
        unit: true,
        disclosureReference: true,
        methodology: true,
        framework: {
          select: { id: true, code: true, name: true, version: true },
        },
      },
      orderBy: [{ pillar: "asc" }, { code: "asc" }],
      take: 250,
    }),
    prisma.esgTarget.findMany({
      where: {
        metric: {
          organizationId: input.organizationId,
          isActive: true,
        },
      },
      select: {
        id: true,
        metricId: true,
        baselineYear: true,
        baselineValue: true,
        targetYear: true,
        targetValue: true,
        description: true,
      },
      orderBy: [{ targetYear: "asc" }, { createdAt: "desc" }],
      take: 250,
    }),
    prisma.esgInitiative.findMany({
      where: { organizationId: input.organizationId },
      select: {
        id: true,
        name: true,
        description: true,
        pillar: true,
        status: true,
        startDate: true,
        targetDate: true,
        budget: true,
        expectedOutcome: true,
        owner: { select: { id: true, name: true } },
      },
      orderBy: [{ status: "asc" }, { targetDate: "asc" }],
      take: 250,
    }),
    getPublishedRuntimeForms(
      input.organizationId,
      ConfigurableFormModule.ESG
    ),
  ]);

  const periodIds = periods.map((period) => period.id);
  const capturedForms = periodIds.length
    ? await prisma.configurableFormSubmission.findMany({
        where: {
          organizationId: input.organizationId,
          entityType: ConfigurableFormModule.ESG,
          entityId: { in: periodIds },
        },
        select: { entityId: true, definitionId: true },
      })
    : [];
  const capturedByPeriod = new Map<string, Set<string>>();
  for (const submission of capturedForms) {
    const ids =
      capturedByPeriod.get(submission.entityId) ?? new Set<string>();
    ids.add(submission.definitionId);
    capturedByPeriod.set(submission.entityId, ids);
  }
  const formIds = forms.map((form) => form.id);
  const metricIds = new Set(metrics.map((metric) => metric.id));

  return {
    capabilities,
    periods: periods.map((period) => {
      const captured = capturedByPeriod.get(period.id) ?? new Set<string>();
      const recordedMetricIds = new Set(
        period.dataPoints
          .map((point) => point.metricId)
          .filter((id) => metricIds.has(id))
      );
      const missingMetricIds = metrics
        .map((metric) => metric.id)
        .filter((id) => !recordedMetricIds.has(id));
      return {
        ...period,
        nextStatuses: getEsgDisclosureNextStatuses(period.status),
        missingMetricIds,
        missingFormDefinitionIds: formIds.filter(
          (id) => !captured.has(id)
        ),
        completenessPercent: metrics.length
          ? Math.round((recordedMetricIds.size / metrics.length) * 100)
          : 0,
      };
    }),
    metrics,
    targets,
    initiatives: initiatives.map((initiative) => ({
      ...initiative,
      nextStatuses: getEsgInitiativeNextStatuses(initiative.status),
    })),
    forms,
  };
}
