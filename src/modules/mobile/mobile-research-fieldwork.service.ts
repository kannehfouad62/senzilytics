import { PermissionKey, ResearchCollectionStatus, ResearchSamplingExecutionStatus, ResearchSampleUnitStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const openUnitStatuses = [
  ResearchSampleUnitStatus.ASSIGNED,
  ResearchSampleUnitStatus.CONTACTED,
  ResearchSampleUnitStatus.PARTIAL,
];

export async function getMobileResearchFieldwork(input: {
  organizationId: string;
  userId: string;
  permissions: readonly PermissionKey[];
}) {
  const canCollect = input.permissions.includes(PermissionKey.COLLECT_RESEARCH_DATA);
  if (!canCollect) return { capabilities: { canCollect: false }, assignments: [] };
  const now = new Date();
  const units = await prisma.researchSampleUnit.findMany({
    where: {
      assignedToId: input.userId,
      status: { in: openUnitStatuses },
      execution: {
        organizationId: input.organizationId,
        status: ResearchSamplingExecutionStatus.ACTIVE,
      },
    },
    include: {
      execution: {
        include: {
          project: {
            include: {
              client: { select: { id: true, name: true } },
              collectionWaves: {
                where: {
                  organizationId: input.organizationId,
                  status: ResearchCollectionStatus.ACTIVE,
                  OR: [{ opensAt: null }, { opensAt: { lte: now } }],
                  AND: [{ OR: [{ closesAt: null }, { closesAt: { gt: now } }] }],
                },
                include: {
                  questionnaire: true,
                  formVersion: {
                    include: { fields: { orderBy: { sequence: "asc" } } },
                  },
                },
                orderBy: { createdAt: "desc" },
              },
            },
          },
        },
      },
    },
    orderBy: [{ dueAt: "asc" }, { assignedAt: "asc" }],
    take: 50,
  });
  return {
    capabilities: { canCollect: true },
    assignments: units.map((unit) => ({
      id: unit.id,
      unitReference: unit.unitReference,
      status: unit.status,
      stratum: unit.stratum,
      cluster: unit.cluster,
      dueAt: unit.dueAt,
      contactAttempts: unit.contactAttempts,
      project: {
        id: unit.execution.project.id,
        reference: unit.execution.project.reference,
        title: unit.execution.project.title,
        client: unit.execution.project.client,
      },
      collections: unit.execution.project.collectionWaves.map((collection) => ({
        id: collection.id,
        name: collection.name,
        instructions: collection.instructions,
        questionnaire: {
          name: collection.questionnaire.name,
          purpose: collection.questionnaire.purpose,
          consentStatement: collection.questionnaire.consentStatement,
          defaultLanguage: collection.questionnaire.defaultLanguage,
        },
        form: {
          id: collection.questionnaire.formDefinitionId,
          name: collection.questionnaire.name,
          description: collection.questionnaire.purpose,
          version: {
            id: collection.formVersion.id,
            version: collection.formVersion.version,
            instructions: collection.formVersion.instructions,
            fields: collection.formVersion.fields.map((field) => ({
              id: field.id,
              key: field.key,
              label: field.label,
              description: field.description,
              placeholder: field.placeholder,
              fieldType: field.fieldType,
              isRequired: field.isRequired,
              options: field.options,
              visibilityRule: field.visibilityRule,
              sequence: field.sequence,
            })),
          },
        },
      })),
    })),
  };
}
