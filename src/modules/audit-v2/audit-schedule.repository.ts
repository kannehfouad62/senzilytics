import { prisma } from "@/lib/prisma";
import {
    EnterpriseAuditFrequency,
    EnterpriseAuditProgramStatus,
    EnterpriseAuditProtocolStatus,
    EnterpriseAuditScheduleStatus,
    EnterpriseAuditScheduleTeamRole,
  Prisma,
} from "@prisma/client";

const auditScheduleListSelect =
  Prisma.validator<Prisma.AuditScheduleSelect>()({
    id: true,
    organizationId: true,
    programId: true,
    name: true,
    description: true,
    status: true,
    frequency: true,
    intervalValue: true,
    recurrenceRule: true,
    timezone: true,
    startDate: true,
    endDate: true,
    nextRunAt: true,
    lastRunAt: true,
    generateDaysBefore: true,
    dueDaysAfter: true,
    siteId: true,
    departmentId: true,
    leadAuditorId: true,
    protocolId: true,
    autoGenerate: true,
    requireTeam: true,
    requireLeadAuditor: true,
    lastGenerationKey: true,
    generationCount: true,
    createdById: true,
    updatedById: true,
    createdAt: true,
    updatedAt: true,

    program: {
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        riskPriority: true,
      },
    },

    site: {
      select: {
        id: true,
        name: true,
      },
    },

    department: {
      select: {
        id: true,
        name: true,

        site: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    },

    leadAuditor: {
      select: {
        id: true,
        name: true,
        email: true,
      },
    },

    protocol: {
      select: {
        id: true,
        name: true,
        version: true,
        status: true,
        isActive: true,
      },
    },

    teamMembers: {
      select: {
        id: true,
        role: true,
        isRequired: true,
        createdAt: true,

        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },

      orderBy: [
        {
          role: "asc",
        },
        {
          user: {
            name: "asc",
          },
        },
      ],
    },

    _count: {
      select: {
        enterpriseAudits: true,
        teamMembers: true,
      },
    },
  });

export type AuditScheduleListItem =
  Prisma.AuditScheduleGetPayload<{
    select: typeof auditScheduleListSelect;
  }>;

export async function listTenantAuditSchedules(input: {
  organizationId: string;
  search?: string | null;
  status?: EnterpriseAuditScheduleStatus | null;
  frequency?: EnterpriseAuditFrequency | null;
  siteId?: string | null;
  programId?: string | null;
  autoGenerate?: boolean | null;
}) {
  const search =
    input.search?.trim() || null;

  return prisma.auditSchedule.findMany({
    where: {
      organizationId:
        input.organizationId,

      ...(input.status
        ? {
            status:
              input.status,
          }
        : {}),

      ...(input.frequency
        ? {
            frequency:
              input.frequency,
          }
        : {}),

      ...(input.siteId
        ? {
            siteId:
              input.siteId,
          }
        : {}),

      ...(input.programId
        ? {
            programId:
              input.programId,
          }
        : {}),

      ...(typeof input.autoGenerate ===
      "boolean"
        ? {
            autoGenerate:
              input.autoGenerate,
          }
        : {}),

      ...(search
        ? {
            OR: [
              {
                name: {
                  contains:
                    search,

                  mode:
                    "insensitive",
                },
              },
              {
                description: {
                  contains:
                    search,

                  mode:
                    "insensitive",
                },
              },
              {
                program: {
                  name: {
                    contains:
                      search,

                    mode:
                      "insensitive",
                  },
                },
              },
              {
                site: {
                  name: {
                    contains:
                      search,

                    mode:
                      "insensitive",
                  },
                },
              },
            ],
          }
        : {}),
    },

    select:
      auditScheduleListSelect,

    orderBy: [
      {
        status: "asc",
      },
      {
        nextRunAt: "asc",
      },
      {
        name: "asc",
      },
    ],
  });
}

export async function findTenantAuditSchedule(input: {
  organizationId: string;
  scheduleId: string;
}) {
  return prisma.auditSchedule.findFirst({
    where: {
      id:
        input.scheduleId,

      organizationId:
        input.organizationId,
    },

    select: {
      ...auditScheduleListSelect,

      enterpriseAudits: {
        select: {
          id: true,
          reference: true,
          title: true,
          status: true,
          source: true,
          scheduledAt: true,
          dueDate: true,
          startedAt: true,
          completedAt: true,
          scorePercentage: true,
          findingCount: true,
          openFindingCount: true,
          overallRiskLevel: true,
          generatedByScheduleKey: true,

          leadAuditor: {
            select: {
              id: true,
              name: true,
            },
          },

          site: {
            select: {
              id: true,
              name: true,
            },
          },
        },

        orderBy: {
          createdAt: "desc",
        },

        take: 50,
      },
    },
  });
}

export async function findTenantAuditScheduleByName(
  input: {
    organizationId: string;
    name: string;
    excludeScheduleId?: string | null;
  }
) {
  return prisma.auditSchedule.findFirst({
    where: {
      organizationId:
        input.organizationId,

      name: {
        equals:
          input.name.trim(),

        mode:
          "insensitive",
      },

      ...(input.excludeScheduleId
        ? {
            id: {
              not:
                input.excludeScheduleId,
            },
          }
        : {}),
    },

    select: {
      id: true,
      name: true,
    },
  });
}

export async function createTenantAuditSchedule(input: {
  organizationId: string;
  programId: string;

  name: string;
  description?: string | null;

  status: EnterpriseAuditScheduleStatus;
  frequency: EnterpriseAuditFrequency;
  intervalValue: number;

  recurrenceRule?: Prisma.InputJsonValue | null;

  timezone: string;

  startDate: Date;
  endDate?: Date | null;

  nextRunAt?: Date | null;
  lastRunAt?: Date | null;

  generateDaysBefore: number;
  dueDaysAfter: number;

  siteId: string;
  departmentId?: string | null;

  leadAuditorId?: string | null;
  protocolId?: string | null;

  autoGenerate: boolean;
  requireTeam: boolean;
  requireLeadAuditor: boolean;

  createdById?: string | null;
  updatedById?: string | null;

  teamMembers: Array<{
    userId: string;
    role: EnterpriseAuditScheduleTeamRole;
    isRequired: boolean;
  }>;
}) {
  return prisma.$transaction(
    async (transaction) => {
      const schedule =
        await transaction.auditSchedule.create({
          data: {
            organizationId:
              input.organizationId,

            programId:
              input.programId,

            name:
              input.name.trim(),

            description:
              input.description?.trim() ||
              null,

            status:
              input.status,

            frequency:
              input.frequency,

            intervalValue:
              input.intervalValue,

            recurrenceRule:
              input.recurrenceRule ??
              Prisma.JsonNull,

            timezone:
              input.timezone,

            startDate:
              input.startDate,

            endDate:
              input.endDate ||
              null,

            nextRunAt:
              input.nextRunAt ||
              null,

            lastRunAt:
              input.lastRunAt ||
              null,

            generateDaysBefore:
              input.generateDaysBefore,

            dueDaysAfter:
              input.dueDaysAfter,

            siteId:
              input.siteId,

            departmentId:
              input.departmentId ||
              null,

            leadAuditorId:
              input.leadAuditorId ||
              null,

            protocolId:
              input.protocolId ||
              null,

            autoGenerate:
              input.autoGenerate,

            requireTeam:
              input.requireTeam,

            requireLeadAuditor:
              input.requireLeadAuditor,

            createdById:
              input.createdById ||
              null,

            updatedById:
              input.updatedById ||
              null,
          },
        });

      if (
        input.teamMembers.length > 0
      ) {
        await transaction.auditScheduleTeamMember.createMany({
          data:
            input.teamMembers.map(
              (member) => ({
                scheduleId:
                  schedule.id,

                userId:
                  member.userId,

                role:
                  member.role,

                isRequired:
                  member.isRequired,
              })
            ),
        });
      }

      return transaction.auditSchedule.findUnique({
        where: {
          id:
            schedule.id,
        },

        select:
          auditScheduleListSelect,
      });
    }
  );
}

export async function updateTenantAuditSchedule(input: {
  organizationId: string;
  scheduleId: string;

  programId: string;

  name: string;
  description?: string | null;

  status: EnterpriseAuditScheduleStatus;
  frequency: EnterpriseAuditFrequency;
  intervalValue: number;

  recurrenceRule?: Prisma.InputJsonValue | null;

  timezone: string;

  startDate: Date;
  endDate?: Date | null;

  nextRunAt?: Date | null;

  generateDaysBefore: number;
  dueDaysAfter: number;

  siteId: string;
  departmentId?: string | null;

  leadAuditorId?: string | null;
  protocolId?: string | null;

  autoGenerate: boolean;
  requireTeam: boolean;
  requireLeadAuditor: boolean;

  updatedById?: string | null;

  teamMembers: Array<{
    userId: string;
    role: EnterpriseAuditScheduleTeamRole;
    isRequired: boolean;
  }>;
}) {
  return prisma.$transaction(
    async (transaction) => {
      const existing =
        await transaction.auditSchedule.findFirst({
          where: {
            id:
              input.scheduleId,

            organizationId:
              input.organizationId,
          },

          select: {
            id: true,
          },
        });

      if (!existing) {
        return null;
      }

      await transaction.auditSchedule.update({
        where: {
          id:
            existing.id,
        },

        data: {
          programId:
            input.programId,

          name:
            input.name.trim(),

          description:
            input.description?.trim() ||
            null,

          status:
            input.status,

          frequency:
            input.frequency,

          intervalValue:
            input.intervalValue,

          recurrenceRule:
            input.recurrenceRule ??
            Prisma.JsonNull,

          timezone:
            input.timezone,

          startDate:
            input.startDate,

          endDate:
            input.endDate ||
            null,

          nextRunAt:
            input.nextRunAt ||
            null,

          generateDaysBefore:
            input.generateDaysBefore,

          dueDaysAfter:
            input.dueDaysAfter,

          siteId:
            input.siteId,

          departmentId:
            input.departmentId ||
            null,

          leadAuditorId:
            input.leadAuditorId ||
            null,

          protocolId:
            input.protocolId ||
            null,

          autoGenerate:
            input.autoGenerate,

          requireTeam:
            input.requireTeam,

          requireLeadAuditor:
            input.requireLeadAuditor,

          updatedById:
            input.updatedById ||
            null,
        },
      });

      await transaction.auditScheduleTeamMember.deleteMany({
        where: {
          scheduleId:
            existing.id,
        },
      });

      if (
        input.teamMembers.length > 0
      ) {
        await transaction.auditScheduleTeamMember.createMany({
          data:
            input.teamMembers.map(
              (member) => ({
                scheduleId:
                  existing.id,

                userId:
                  member.userId,

                role:
                  member.role,

                isRequired:
                  member.isRequired,
              })
            ),
        });
      }

      return transaction.auditSchedule.findUnique({
        where: {
          id:
            existing.id,
        },

        select:
          auditScheduleListSelect,
      });
    }
  );
}

export async function updateAuditScheduleRuntimeState(
  input: {
    organizationId: string;
    scheduleId: string;

    nextRunAt?: Date | null;
    lastRunAt?: Date | null;

    lastGenerationKey?:
      | string
      | null;

    incrementGenerationCount?: boolean;
  }
) {
  const schedule =
    await prisma.auditSchedule.findFirst({
      where: {
        id:
          input.scheduleId,

        organizationId:
          input.organizationId,
      },

      select: {
        id: true,
      },
    });

  if (!schedule) {
    return null;
  }

  return prisma.auditSchedule.update({
    where: {
      id:
        schedule.id,
    },

    data: {
      ...(input.nextRunAt !==
      undefined
        ? {
            nextRunAt:
              input.nextRunAt,
          }
        : {}),

      ...(input.lastRunAt !==
      undefined
        ? {
            lastRunAt:
              input.lastRunAt,
          }
        : {}),

      ...(input.lastGenerationKey !==
      undefined
        ? {
            lastGenerationKey:
              input.lastGenerationKey,
          }
        : {}),

      ...(input.incrementGenerationCount
        ? {
            generationCount: {
              increment: 1,
            },
          }
        : {}),
    },

    select:
      auditScheduleListSelect,
  });
}

export async function changeAuditScheduleStatus(input: {
  organizationId: string;
  scheduleId: string;
  status: EnterpriseAuditScheduleStatus;
  updatedById?: string | null;
}) {
  const schedule =
    await prisma.auditSchedule.findFirst({
      where: {
        id:
          input.scheduleId,

        organizationId:
          input.organizationId,
      },

      select: {
        id: true,
      },
    });

  if (!schedule) {
    return null;
  }

  return prisma.auditSchedule.update({
    where: {
      id:
        schedule.id,
    },

    data: {
      status:
        input.status,

      updatedById:
        input.updatedById ||
        null,

      ...(input.status ===
      EnterpriseAuditScheduleStatus.ACTIVE
        ? {}
        : {
            nextRunAt:
              null,
          }),
    },

    select:
      auditScheduleListSelect,
  });
}

export async function listSchedulesReadyForGeneration(
  now: Date
) {
  return prisma.auditSchedule.findMany({
    where: {
      status:
        EnterpriseAuditScheduleStatus.ACTIVE,

      autoGenerate: true,

      nextRunAt: {
        not: null,
        lte: now,
      },

      startDate: {
        lte: now,
      },

      OR: [
        {
          endDate: null,
        },
        {
          endDate: {
            gte: now,
          },
        },
      ],

      program: {
        isActive: true,

        status: {
          notIn: [
            "ARCHIVED",
            "INACTIVE",
            "PAUSED",
          ],
        },
      },
    },

    select:
      auditScheduleListSelect,

    orderBy: {
      nextRunAt: "asc",
    },
  });
}

export async function findGeneratedAuditByScheduleKey(
  input: {
    scheduleId: string;
    generationKey: string;
  }
) {
  return prisma.enterpriseAudit.findFirst({
    where: {
      scheduleId:
        input.scheduleId,

      generatedByScheduleKey:
        input.generationKey,
    },

    select: {
      id: true,
      reference: true,
      status: true,
      generatedByScheduleKey: true,
    },
  });
}

export async function getAuditScheduleFormOptions(
  organizationId: string
) {
  const [
    programs,
    sites,
    departments,
    users,
    protocols,
  ] = await Promise.all([
    prisma.auditProgram.findMany({
      where: {
        organizationId,
        isActive: true,

        status: {
          notIn: [
            "ARCHIVED",
            "INACTIVE",
          ],
        },
      },

      select: {
        id: true,
        name: true,
        code: true,
        frequency: true,
        riskPriority: true,

        sites: {
          select: {
            siteId: true,
          },
        },

        departments: {
          select: {
            departmentId: true,
          },
        },

        defaultProtocol: {
          select: {
            id: true,
            name: true,
            version: true,
            status: true,
          },
        },
      },

      orderBy: {
        name: "asc",
      },
    }),

    prisma.site.findMany({
      where: {
        organizationId,
      },

      select: {
        id: true,
        name: true,
      },

      orderBy: {
        name: "asc",
      },
    }),

    prisma.department.findMany({
      where: {
        site: {
          organizationId,
        },
      },

      select: {
        id: true,
        name: true,
        siteId: true,

        site: {
          select: {
            id: true,
            name: true,
          },
        },
      },

      orderBy: [
        {
          site: {
            name: "asc",
          },
        },
        {
          name: "asc",
        },
      ],
    }),

    prisma.user.findMany({
      where: {
        organizationId,
      },

      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },

      orderBy: {
        name: "asc",
      },
    }),

    prisma.auditProtocol.findMany({
      where: {
        organizationId,
        isActive: true,
        status: "ACTIVE",
      },

      select: {
        id: true,
        name: true,
        code: true,
        version: true,
        status: true,
      },

      orderBy: [
        {
          name: "asc",
        },
        {
          version: "desc",
        },
      ],
    }),
  ]);

  return {
    programs,
    sites,
    departments,
    users,
    protocols,
  };
}

export async function getScheduleGenerationContext(
  input: {
    organizationId: string;
    scheduleId: string;
  }
) {
  return prisma.auditSchedule.findFirst({
    where: {
      id:
        input.scheduleId,

      organizationId:
        input.organizationId,
    },

    select: {
      id: true,
      organizationId: true,
      name: true,
      description: true,
      frequency: true,
      recurrenceRule: true,
      timezone: true,
      startDate: true,
      endDate: true,
      nextRunAt: true,
      lastRunAt: true,
      generateDaysBefore: true,
      dueDaysAfter: true,
      siteId: true,
      departmentId: true,
      leadAuditorId: true,
      protocolId: true,
      requireTeam: true,
      requireLeadAuditor: true,
      generationCount: true,

      program: {
        select: {
          id: true,
          name: true,
          code: true,
          description: true,
          objectives: true,
          scope: true,
          framework: true,
          standardName: true,
          standardVersion: true,
          riskPriority: true,
          defaultProtocolId: true,
        },
      },

      site: {
        select: {
          id: true,
          name: true,
        },
      },

      department: {
        select: {
          id: true,
          name: true,
        },
      },

      leadAuditor: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },

      protocol: {
        select: {
          id: true,
          name: true,
          version: true,
          status: true,
          isActive: true,

          sections: {
            where: {
              isActive: true,
            },

            select: {
              id: true,
              title: true,
              description: true,
              guidance: true,
              standardRef: true,
              sequence: true,
              weight: true,
              isRequired: true,

              questions: {
                where: {
                  isActive: true,
                },

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
                    where: {
                      isActive: true,
                    },

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
                    },

                    orderBy: {
                      sequence: "asc",
                    },
                  },
                },

                orderBy: {
                  sequence: "asc",
                },
              },
            },

            orderBy: {
              sequence: "asc",
            },
          },
        },
      },

      teamMembers: {
        select: {
          userId: true,
          role: true,
          isRequired: true,

          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },

        orderBy: [
          {
            role: "asc",
          },
          {
            user: {
              name: "asc",
            },
          },
        ],
      },
    },
  });
}