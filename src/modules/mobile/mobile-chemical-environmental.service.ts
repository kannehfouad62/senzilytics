import {
  ConfigurableFormModule,
  EnvironmentalDataStatus,
  PermissionKey,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getChemicalNextStatuses } from "@/modules/chemicals/chemical-lifecycle";
import { getPublishedRuntimeForms } from "@/modules/forms/runtime-form.service";

export function mobileChemicalEnvironmentalCapabilities(
  permissions: readonly PermissionKey[]
) {
  const granted = new Set(permissions);
  return {
    canViewChemicals: granted.has(PermissionKey.VIEW_CHEMICALS),
    canManageChemicals: granted.has(PermissionKey.MANAGE_CHEMICALS),
    canViewEnvironmental: granted.has(PermissionKey.VIEW_ENVIRONMENTAL),
    canManageEnvironmental: granted.has(PermissionKey.MANAGE_ENVIRONMENTAL),
  };
}

export async function getMobileChemicalEnvironmentalWorkspace(input: {
  organizationId: string;
  permissions: readonly PermissionKey[];
  now?: Date;
}) {
  const capabilities = mobileChemicalEnvironmentalCapabilities(
    input.permissions
  );
  const now = input.now ?? new Date();
  const recentCutoff = new Date(now.getTime() - 370 * 86_400_000);
  const [chemicals, metrics, targets, chemicalForms, environmentalForms] =
    await Promise.all([
      capabilities.canViewChemicals
        ? prisma.chemical.findMany({
            where: { organizationId: input.organizationId },
            select: {
              id: true,
              productName: true,
              productCode: true,
              manufacturer: true,
              supplier: true,
              casNumber: true,
              description: true,
              status: true,
              signalWord: true,
              hazardClassifications: true,
              pictograms: true,
              exposureLimits: true,
              requiredPpe: true,
              firstAidMeasures: true,
              spillResponse: true,
              storageRequirements: true,
              incompatibilities: true,
              sdsRevisionDate: true,
              sdsReviewDueDate: true,
              regulatoryLists: true,
              regulatoryNotes: true,
              reviewedAt: true,
              reviewedBy: { select: { id: true, name: true } },
              inventories: {
                select: {
                  id: true,
                  storageLocation: true,
                  quantity: true,
                  unit: true,
                  maximumAllowed: true,
                  containerType: true,
                  storageNotes: true,
                  inventoriedAt: true,
                  site: { select: { id: true, name: true } },
                },
                orderBy: { inventoriedAt: "desc" },
                take: 100,
              },
            },
            orderBy: [{ status: "asc" }, { productName: "asc" }],
            take: 200,
          })
        : Promise.resolve([]),
      capabilities.canViewEnvironmental
        ? prisma.environmentalMetricDefinition.findMany({
            where: {
              organizationId: input.organizationId,
              isActive: true,
            },
            select: {
              id: true,
              code: true,
              name: true,
              description: true,
              type: true,
              sourceUnit: true,
              reportingUnit: true,
              conversionFactor: true,
              methodology: true,
              reportingFrequency: true,
              dataPoints: {
                where: {
                  OR: [
                    {
                      status: {
                        in: [
                          EnvironmentalDataStatus.DRAFT,
                          EnvironmentalDataStatus.SUBMITTED,
                          EnvironmentalDataStatus.REJECTED,
                        ],
                      },
                    },
                    { periodEnd: { gte: recentCutoff } },
                  ],
                },
                select: {
                  id: true,
                  periodStart: true,
                  periodEnd: true,
                  value: true,
                  normalizedValue: true,
                  quality: true,
                  status: true,
                  evidenceSummary: true,
                  notes: true,
                  approvedAt: true,
                  site: { select: { id: true, name: true } },
                  enteredBy: { select: { id: true, name: true } },
                  approvedBy: { select: { id: true, name: true } },
                },
                orderBy: { periodEnd: "desc" },
                take: 150,
              },
            },
            orderBy: [{ type: "asc" }, { name: "asc" }],
            take: 150,
          })
        : Promise.resolve([]),
      capabilities.canViewEnvironmental
        ? prisma.environmentalTarget.findMany({
            where: {
              organizationId: input.organizationId,
              isActive: true,
            },
            select: {
              id: true,
              metricId: true,
              name: true,
              baselineYear: true,
              baselineValue: true,
              targetYear: true,
              targetValue: true,
              description: true,
            },
            orderBy: [{ targetYear: "asc" }, { name: "asc" }],
            take: 150,
          })
        : Promise.resolve([]),
      capabilities.canViewChemicals
        ? getPublishedRuntimeForms(
            input.organizationId,
            ConfigurableFormModule.CHEMICAL
          )
        : Promise.resolve([]),
      capabilities.canViewEnvironmental
        ? getPublishedRuntimeForms(
            input.organizationId,
            ConfigurableFormModule.ENVIRONMENTAL
          )
        : Promise.resolve([]),
    ]);

  const chemicalIds = chemicals.map((chemical) => chemical.id);
  const dataPointIds = metrics.flatMap((metric) =>
    metric.dataPoints.map((point) => point.id)
  );
  const captured = chemicalIds.length || dataPointIds.length
    ? await prisma.configurableFormSubmission.findMany({
        where: {
          organizationId: input.organizationId,
          OR: [
            ...(chemicalIds.length
              ? [{
                  entityType: ConfigurableFormModule.CHEMICAL,
                  entityId: { in: chemicalIds },
                }]
              : []),
            ...(dataPointIds.length
              ? [{
                  entityType: ConfigurableFormModule.ENVIRONMENTAL,
                  entityId: { in: dataPointIds },
                }]
              : []),
          ],
        },
        select: {
          entityType: true,
          entityId: true,
          definitionId: true,
        },
      })
    : [];
  const capturedByEntity = new Map<string, Set<string>>();
  for (const submission of captured) {
    const key = `${submission.entityType}:${submission.entityId}`;
    const ids = capturedByEntity.get(key) ?? new Set<string>();
    ids.add(submission.definitionId);
    capturedByEntity.set(key, ids);
  }
  const missing = (
    module: ConfigurableFormModule,
    entityId: string,
    formIds: string[]
  ) => {
    const completed =
      capturedByEntity.get(`${module}:${entityId}`) ?? new Set<string>();
    return formIds.filter((id) => !completed.has(id));
  };
  const chemicalFormIds = chemicalForms.map((form) => form.id);
  const environmentalFormIds = environmentalForms.map((form) => form.id);

  return {
    capabilities,
    chemicals: chemicals.map((chemical) => ({
      ...chemical,
      nextStatuses: getChemicalNextStatuses(chemical.status),
      sdsReviewOverdue: Boolean(
        chemical.sdsReviewDueDate && chemical.sdsReviewDueDate < now
      ),
      missingFormDefinitionIds: missing(
        ConfigurableFormModule.CHEMICAL,
        chemical.id,
        chemicalFormIds
      ),
      inventories: chemical.inventories.map((inventory) => ({
        ...inventory,
        limitExceeded:
          inventory.maximumAllowed !== null &&
          inventory.quantity > inventory.maximumAllowed,
      })),
    })),
    metrics: metrics.map((metric) => ({
      ...metric,
      dataPoints: metric.dataPoints.map((point) => ({
        ...point,
        missingFormDefinitionIds: missing(
          ConfigurableFormModule.ENVIRONMENTAL,
          point.id,
          environmentalFormIds
        ),
      })),
    })),
    targets,
    chemicalForms,
    environmentalForms,
  };
}
