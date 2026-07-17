import { prisma } from "@/lib/prisma";
import {
  EnterpriseAuditFindingTrigger,
  EnterpriseAuditProtocolStatus,
  EnterpriseAuditQuestionResponseType,
  EnterpriseAuditSeverity,
  Prisma,
} from "@prisma/client";

const auditProtocolListSelect = {
  id: true,
  organizationId: true,
  name: true,
  description: true,
  code: true,
  standardName: true,
  standardVersion: true,
  framework: true,
  version: true,
  status: true,
  isActive: true,
  effectiveFrom: true,
  effectiveTo: true,
  previousVersionId: true,
  createdAt: true,
  updatedAt: true,

  createdBy: {
    select: {
      id: true,
      name: true,
    },
  },

  updatedBy: {
    select: {
      id: true,
      name: true,
    },
  },

  _count: {
    select: {
      sections: true,
      defaultForPrograms: true,
      schedules: true,
      enterpriseAudits: true,
      newerVersions: true,
    },
  },
} as const;

export async function listTenantAuditProtocols(input: {
  organizationId: string;
  search?: string | null;
  status?: EnterpriseAuditProtocolStatus | null;
  isActive?: boolean | null;
}) {
  const search =
    input.search?.trim() || null;

  return prisma.auditProtocol.findMany({
    where: {
      organizationId:
        input.organizationId,

      ...(input.status
        ? {
            status:
              input.status,
          }
        : {}),

      ...(typeof input.isActive ===
      "boolean"
        ? {
            isActive:
              input.isActive,
          }
        : {}),

      ...(search
        ? {
            OR: [
              {
                name: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                code: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                description: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                standardName: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                framework: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    },

    select:
      auditProtocolListSelect,

    orderBy: [
      {
        isActive: "desc",
      },
      {
        name: "asc",
      },
      {
        version: "desc",
      },
    ],
  });
}

export async function findTenantAuditProtocol(input: {
  organizationId: string;
  protocolId: string;
}) {
  return prisma.auditProtocol.findFirst({
    where: {
      id: input.protocolId,

      organizationId:
        input.organizationId,
    },

    select: {
      ...auditProtocolListSelect,

      previousVersion: {
        select: {
          id: true,
          name: true,
          version: true,
          status: true,
        },
      },

      newerVersions: {
        select: {
          id: true,
          name: true,
          version: true,
          status: true,
        },

        orderBy: {
          version: "desc",
        },
      },

      sections: {
        select: {
          id: true,
          title: true,
          description: true,
          guidance: true,
          standardRef: true,
          sequence: true,
          weight: true,
          isRequired: true,
          isActive: true,

          questions: {
            select: {
              id: true,
              questionText: true,
              description: true,
              guidance: true,
              standardClause: true,
              regulatoryRef: true,
              responseType: true,
              sequence: true,
              weight: true,
              isRequired: true,
              isActive: true,
              allowNotApplicable: true,
              requireComment: true,
              requireEvidence: true,
              requirePhoto: true,
              minimumNumericValue: true,
              maximumNumericValue: true,
              minimumPassingScore: true,
              maximumScore: true,
              findingTrigger: true,
              defaultSeverity: true,
              automaticallyCreateFinding: true,
              automaticallySuggestCapa: true,
              automaticallySuggestRisk: true,
              findingTitleTemplate: true,
              findingDescriptionTemplate: true,
              aiGuidance: true,

              options: {
                select: {
                  id: true,
                  label: true,
                  value: true,
                  description: true,
                  sequence: true,
                  scoreValue: true,
                  isPassing: true,
                  triggersFinding: true,
                  findingSeverity: true,
                  isActive: true,
                },

                orderBy: {
                  sequence: "asc",
                },
              },

              _count: {
                select: {
                  executionSnapshots: true,
                },
              },
            },

            orderBy: {
              sequence: "asc",
            },
          },

          _count: {
            select: {
              executionSnapshots: true,
            },
          },
        },

        orderBy: {
          sequence: "asc",
        },
      },
    },
  });
}

export async function findTenantAuditProtocolByNameAndVersion(
  input: {
    organizationId: string;
    name: string;
    version: number;
    excludeProtocolId?: string | null;
  }
) {
  return prisma.auditProtocol.findFirst({
    where: {
      organizationId:
        input.organizationId,

      name: {
        equals:
          input.name.trim(),

        mode: "insensitive",
      },

      version:
        input.version,

      ...(input.excludeProtocolId
        ? {
            id: {
              not:
                input.excludeProtocolId,
            },
          }
        : {}),
    },

    select: {
      id: true,
      name: true,
      version: true,
    },
  });
}

export async function getLatestAuditProtocolVersion(
  input: {
    organizationId: string;
    name: string;
  }
) {
  return prisma.auditProtocol.findFirst({
    where: {
      organizationId:
        input.organizationId,

      name: {
        equals:
          input.name.trim(),

        mode: "insensitive",
      },
    },

    select: {
      id: true,
      version: true,
    },

    orderBy: {
      version: "desc",
    },
  });
}

export async function createTenantAuditProtocol(input: {
  organizationId: string;

  name: string;
  description?: string | null;
  code?: string | null;

  standardName?: string | null;
  standardVersion?: string | null;
  framework?: string | null;

  version: number;

  status: EnterpriseAuditProtocolStatus;
  isActive: boolean;

  effectiveFrom?: Date | null;
  effectiveTo?: Date | null;

  previousVersionId?: string | null;

  createdById?: string | null;
  updatedById?: string | null;
}) {
  return prisma.auditProtocol.create({
    data: {
      organizationId:
        input.organizationId,

      name:
        input.name.trim(),

      description:
        input.description?.trim() ||
        null,

      code:
        input.code?.trim() ||
        null,

      standardName:
        input.standardName?.trim() ||
        null,

      standardVersion:
        input.standardVersion?.trim() ||
        null,

      framework:
        input.framework?.trim() ||
        null,

      version:
        input.version,

      status:
        input.status,

      isActive:
        input.isActive,

      effectiveFrom:
        input.effectiveFrom ||
        null,

      effectiveTo:
        input.effectiveTo ||
        null,

      previousVersionId:
        input.previousVersionId ||
        null,

      createdById:
        input.createdById ||
        null,

      updatedById:
        input.updatedById ||
        null,
    },

    select:
      auditProtocolListSelect,
  });
}

export async function updateTenantAuditProtocol(input: {
  organizationId: string;
  protocolId: string;

  name: string;
  description?: string | null;
  code?: string | null;

  standardName?: string | null;
  standardVersion?: string | null;
  framework?: string | null;

  status: EnterpriseAuditProtocolStatus;
  isActive: boolean;

  effectiveFrom?: Date | null;
  effectiveTo?: Date | null;

  updatedById?: string | null;
}) {
  const protocol =
    await prisma.auditProtocol.findFirst({
      where: {
        id: input.protocolId,

        organizationId:
          input.organizationId,
      },

      select: {
        id: true,
      },
    });

  if (!protocol) {
    return null;
  }

  return prisma.auditProtocol.update({
    where: {
      id: protocol.id,
    },

    data: {
      name:
        input.name.trim(),

      description:
        input.description?.trim() ||
        null,

      code:
        input.code?.trim() ||
        null,

      standardName:
        input.standardName?.trim() ||
        null,

      standardVersion:
        input.standardVersion?.trim() ||
        null,

      framework:
        input.framework?.trim() ||
        null,

      status:
        input.status,

      isActive:
        input.isActive,

      effectiveFrom:
        input.effectiveFrom ||
        null,

      effectiveTo:
        input.effectiveTo ||
        null,

      updatedById:
        input.updatedById ||
        null,
    },

    select:
      auditProtocolListSelect,
  });
}

export async function createAuditProtocolSection(input: {
  organizationId: string;
  protocolId: string;

  title: string;
  description?: string | null;
  guidance?: string | null;
  standardRef?: string | null;

  sequence: number;
  weight: number;
  isRequired: boolean;
  isActive: boolean;
}) {
  const protocol =
    await prisma.auditProtocol.findFirst({
      where: {
        id: input.protocolId,

        organizationId:
          input.organizationId,
      },

      select: {
        id: true,
      },
    });

  if (!protocol) {
    return null;
  }

  return prisma.auditProtocolSection.create({
    data: {
      protocolId:
        protocol.id,

      title:
        input.title.trim(),

      description:
        input.description?.trim() ||
        null,

      guidance:
        input.guidance?.trim() ||
        null,

      standardRef:
        input.standardRef?.trim() ||
        null,

      sequence:
        input.sequence,

      weight:
        input.weight,

      isRequired:
        input.isRequired,

      isActive:
        input.isActive,
    },
  });
}

export async function updateAuditProtocolSection(input: {
  organizationId: string;
  sectionId: string;

  title: string;
  description?: string | null;
  guidance?: string | null;
  standardRef?: string | null;

  sequence: number;
  weight: number;
  isRequired: boolean;
  isActive: boolean;
}) {
  const section =
    await prisma.auditProtocolSection.findFirst({
      where: {
        id: input.sectionId,

        protocol: {
          organizationId:
            input.organizationId,
        },
      },

      select: {
        id: true,
      },
    });

  if (!section) {
    return null;
  }

  return prisma.auditProtocolSection.update({
    where: {
      id: section.id,
    },

    data: {
      title:
        input.title.trim(),

      description:
        input.description?.trim() ||
        null,

      guidance:
        input.guidance?.trim() ||
        null,

      standardRef:
        input.standardRef?.trim() ||
        null,

      sequence:
        input.sequence,

      weight:
        input.weight,

      isRequired:
        input.isRequired,

      isActive:
        input.isActive,
    },
  });
}

export async function deleteAuditProtocolSection(input: {
  organizationId: string;
  sectionId: string;
}) {
  const section =
    await prisma.auditProtocolSection.findFirst({
      where: {
        id: input.sectionId,

        protocol: {
          organizationId:
            input.organizationId,
        },
      },

      select: {
        id: true,

        _count: {
          select: {
            executionSnapshots: true,
          },
        },
      },
    });

  if (!section) {
    return {
      deleted: false,
      reason: "NOT_FOUND" as const,
    };
  }

  if (
    section._count
      .executionSnapshots >
    0
  ) {
    return {
      deleted: false,

      reason:
        "HAS_EXECUTION_HISTORY" as const,
    };
  }

  await prisma.auditProtocolSection.delete({
    where: {
      id: section.id,
    },
  });

  return {
    deleted: true,
    reason: null,
  };
}

export async function createAuditProtocolQuestion(input: {
  organizationId: string;
  sectionId: string;

  questionText: string;
  description?: string | null;
  guidance?: string | null;

  standardClause?: string | null;
  regulatoryRef?: string | null;

  responseType: EnterpriseAuditQuestionResponseType;

  sequence: number;
  weight: number;

  isRequired: boolean;
  isActive: boolean;

  allowNotApplicable: boolean;
  requireComment: boolean;
  requireEvidence: boolean;
  requirePhoto: boolean;

  minimumNumericValue?: Prisma.Decimal | number | null;
  maximumNumericValue?: Prisma.Decimal | number | null;

  minimumPassingScore?: Prisma.Decimal | number | null;
  maximumScore?: Prisma.Decimal | number | null;

  findingTrigger: EnterpriseAuditFindingTrigger;

  defaultSeverity?: EnterpriseAuditSeverity | null;

  automaticallyCreateFinding: boolean;
  automaticallySuggestCapa: boolean;
  automaticallySuggestRisk: boolean;

  findingTitleTemplate?: string | null;
  findingDescriptionTemplate?: string | null;

  aiGuidance?: string | null;
}) {
  const section =
    await prisma.auditProtocolSection.findFirst({
      where: {
        id: input.sectionId,

        protocol: {
          organizationId:
            input.organizationId,
        },
      },

      select: {
        id: true,
      },
    });

  if (!section) {
    return null;
  }

  return prisma.auditProtocolQuestion.create({
    data: {
      sectionId:
        section.id,

      questionText:
        input.questionText.trim(),

      description:
        input.description?.trim() ||
        null,

      guidance:
        input.guidance?.trim() ||
        null,

      standardClause:
        input.standardClause?.trim() ||
        null,

      regulatoryRef:
        input.regulatoryRef?.trim() ||
        null,

      responseType:
        input.responseType,

      sequence:
        input.sequence,

      weight:
        input.weight,

      isRequired:
        input.isRequired,

      isActive:
        input.isActive,

      allowNotApplicable:
        input.allowNotApplicable,

      requireComment:
        input.requireComment,

      requireEvidence:
        input.requireEvidence,

      requirePhoto:
        input.requirePhoto,

      minimumNumericValue:
        input.minimumNumericValue ??
        null,

      maximumNumericValue:
        input.maximumNumericValue ??
        null,

      minimumPassingScore:
        input.minimumPassingScore ??
        null,

      maximumScore:
        input.maximumScore ??
        null,

      findingTrigger:
        input.findingTrigger,

      defaultSeverity:
        input.defaultSeverity ||
        null,

      automaticallyCreateFinding:
        input.automaticallyCreateFinding,

      automaticallySuggestCapa:
        input.automaticallySuggestCapa,

      automaticallySuggestRisk:
        input.automaticallySuggestRisk,

      findingTitleTemplate:
        input.findingTitleTemplate?.trim() ||
        null,

      findingDescriptionTemplate:
        input.findingDescriptionTemplate?.trim() ||
        null,

      aiGuidance:
        input.aiGuidance?.trim() ||
        null,
    },
  });
}

export async function updateAuditProtocolQuestion(input: {
  organizationId: string;
  questionId: string;

  questionText: string;
  description?: string | null;
  guidance?: string | null;

  standardClause?: string | null;
  regulatoryRef?: string | null;

  responseType: EnterpriseAuditQuestionResponseType;

  sequence: number;
  weight: number;

  isRequired: boolean;
  isActive: boolean;

  allowNotApplicable: boolean;
  requireComment: boolean;
  requireEvidence: boolean;
  requirePhoto: boolean;

  minimumNumericValue?: Prisma.Decimal | number | null;
  maximumNumericValue?: Prisma.Decimal | number | null;

  minimumPassingScore?: Prisma.Decimal | number | null;
  maximumScore?: Prisma.Decimal | number | null;

  findingTrigger: EnterpriseAuditFindingTrigger;

  defaultSeverity?: EnterpriseAuditSeverity | null;

  automaticallyCreateFinding: boolean;
  automaticallySuggestCapa: boolean;
  automaticallySuggestRisk: boolean;

  findingTitleTemplate?: string | null;
  findingDescriptionTemplate?: string | null;

  aiGuidance?: string | null;
}) {
  const question =
    await prisma.auditProtocolQuestion.findFirst({
      where: {
        id: input.questionId,

        section: {
          protocol: {
            organizationId:
              input.organizationId,
          },
        },
      },

      select: {
        id: true,
      },
    });

  if (!question) {
    return null;
  }

  return prisma.auditProtocolQuestion.update({
    where: {
      id: question.id,
    },

    data: {
      questionText:
        input.questionText.trim(),

      description:
        input.description?.trim() ||
        null,

      guidance:
        input.guidance?.trim() ||
        null,

      standardClause:
        input.standardClause?.trim() ||
        null,

      regulatoryRef:
        input.regulatoryRef?.trim() ||
        null,

      responseType:
        input.responseType,

      sequence:
        input.sequence,

      weight:
        input.weight,

      isRequired:
        input.isRequired,

      isActive:
        input.isActive,

      allowNotApplicable:
        input.allowNotApplicable,

      requireComment:
        input.requireComment,

      requireEvidence:
        input.requireEvidence,

      requirePhoto:
        input.requirePhoto,

      minimumNumericValue:
        input.minimumNumericValue ??
        null,

      maximumNumericValue:
        input.maximumNumericValue ??
        null,

      minimumPassingScore:
        input.minimumPassingScore ??
        null,

      maximumScore:
        input.maximumScore ??
        null,

      findingTrigger:
        input.findingTrigger,

      defaultSeverity:
        input.defaultSeverity ||
        null,

      automaticallyCreateFinding:
        input.automaticallyCreateFinding,

      automaticallySuggestCapa:
        input.automaticallySuggestCapa,

      automaticallySuggestRisk:
        input.automaticallySuggestRisk,

      findingTitleTemplate:
        input.findingTitleTemplate?.trim() ||
        null,

      findingDescriptionTemplate:
        input.findingDescriptionTemplate?.trim() ||
        null,

      aiGuidance:
        input.aiGuidance?.trim() ||
        null,
    },
  });
}

export async function deleteAuditProtocolQuestion(input: {
  organizationId: string;
  questionId: string;
}) {
  const question =
    await prisma.auditProtocolQuestion.findFirst({
      where: {
        id: input.questionId,

        section: {
          protocol: {
            organizationId:
              input.organizationId,
          },
        },
      },

      select: {
        id: true,

        _count: {
          select: {
            executionSnapshots: true,
          },
        },
      },
    });

  if (!question) {
    return {
      deleted: false,
      reason: "NOT_FOUND" as const,
    };
  }

  if (
    question._count
      .executionSnapshots >
    0
  ) {
    return {
      deleted: false,

      reason:
        "HAS_EXECUTION_HISTORY" as const,
    };
  }

  await prisma.auditProtocolQuestion.delete({
    where: {
      id: question.id,
    },
  });

  return {
    deleted: true,
    reason: null,
  };
}

export async function replaceAuditQuestionOptions(input: {
  organizationId: string;
  questionId: string;

  options: Array<{
    label: string;
    value: string;
    description?: string | null;
    sequence: number;

    scoreValue?: Prisma.Decimal | number | null;

    isPassing?: boolean | null;

    triggersFinding: boolean;

    findingSeverity?: EnterpriseAuditSeverity | null;

    isActive: boolean;
  }>;
}) {
  const question =
    await prisma.auditProtocolQuestion.findFirst({
      where: {
        id: input.questionId,

        section: {
          protocol: {
            organizationId:
              input.organizationId,
          },
        },
      },

      select: {
        id: true,
      },
    });

  if (!question) {
    return null;
  }

  return prisma.$transaction(
    async (transaction) => {
      await transaction.auditQuestionOption.deleteMany({
        where: {
          questionId:
            question.id,
        },
      });

      if (input.options.length > 0) {
        await transaction.auditQuestionOption.createMany({
          data:
            input.options.map(
              (option) => ({
                questionId:
                  question.id,

                label:
                  option.label.trim(),

                value:
                  option.value.trim(),

                description:
                  option.description?.trim() ||
                  null,

                sequence:
                  option.sequence,

                scoreValue:
                  option.scoreValue ??
                  null,

                isPassing:
                  option.isPassing ??
                  null,

                triggersFinding:
                  option.triggersFinding,

                findingSeverity:
                  option.findingSeverity ||
                  null,

                isActive:
                  option.isActive,
              })
            ),
        });
      }

      return transaction.auditProtocolQuestion.findUnique({
        where: {
          id: question.id,
        },

        include: {
          options: {
            orderBy: {
              sequence: "asc",
            },
          },
        },
      });
    }
  );
}

export async function archiveTenantAuditProtocol(input: {
  organizationId: string;
  protocolId: string;
  updatedById?: string | null;
}) {
  const protocol =
    await prisma.auditProtocol.findFirst({
      where: {
        id: input.protocolId,

        organizationId:
          input.organizationId,
      },

      select: {
        id: true,
      },
    });

  if (!protocol) {
    return null;
  }

  return prisma.auditProtocol.update({
    where: {
      id: protocol.id,
    },

    data: {
      status:
        EnterpriseAuditProtocolStatus.ARCHIVED,

      isActive: false,

      updatedById:
        input.updatedById ||
        null,
    },

    select:
      auditProtocolListSelect,
  });
}