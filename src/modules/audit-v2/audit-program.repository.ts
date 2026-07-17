import { prisma } from "@/lib/prisma";
import {
  EnterpriseAuditFrequency,
  EnterpriseAuditProgramStatus,
  EnterpriseAuditRiskPriority,
  Prisma,
} from "@prisma/client";


const auditProgramSummarySelect =
  Prisma.validator<Prisma.AuditProgramSelect>()({
    id: true,
    organizationId: true,
    name: true,
    description: true,
    code: true,
    standardName: true,
    standardVersion: true,
    framework: true,
    objectives: true,
    scope: true,
    status: true,
    frequency: true,
    riskPriority: true,
    effectiveFrom: true,
    effectiveTo: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,

    owner: {
      select: {
        id: true,
        name: true,
        email: true,
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

    sites: {
      select: {
        id: true,
        isPrimary: true,

        site: {
          select: {
            id: true,
            name: true,
          },
        },
      },

      orderBy: [
        {
          isPrimary: "desc",
        },
        {
          site: {
            name: "asc",
          },
        },
      ],
    },

    departments: {
      select: {
        id: true,
        isPrimary: true,

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
      },

      orderBy: [
        {
          isPrimary: "desc",
        },
        {
          department: {
            name: "asc",
          },
        },
      ],
    },

    _count: {
      select: {
        schedules: true,
        enterpriseAudits: true,
      },
    },
  });

export async function listTenantAuditPrograms(input: {
  organizationId: string;

  search?: string | null;
  status?: EnterpriseAuditProgramStatus | null;
  riskPriority?: EnterpriseAuditRiskPriority | null;
  frequency?: EnterpriseAuditFrequency | null;
  isActive?: boolean | null;
}) {
  const search =
    input.search?.trim() || null;

  return prisma.auditProgram.findMany({
    where: {
      organizationId:
        input.organizationId,

      ...(input.status
        ? {
            status: input.status,
          }
        : {}),

      ...(input.riskPriority
        ? {
            riskPriority:
              input.riskPriority,
          }
        : {}),

      ...(input.frequency
        ? {
            frequency:
              input.frequency,
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
      auditProgramSummarySelect,

    orderBy: [
      {
        isActive: "desc",
      },
      {
        riskPriority: "desc",
      },
      {
        name: "asc",
      },
    ],
  });
}

export async function findTenantAuditProgram(input: {
  organizationId: string;
  programId: string;
}) {
  return prisma.auditProgram.findFirst({
    where: {
      id: input.programId,
      organizationId:
        input.organizationId,
    },

    select: {
      ...auditProgramSummarySelect,

      schedules: {
        select: {
          id: true,
          name: true,
          status: true,
          frequency: true,
          startDate: true,
          endDate: true,
          nextRunAt: true,
          lastRunAt: true,
          autoGenerate: true,
          generationCount: true,

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
            },
          },

          protocol: {
            select: {
              id: true,
              name: true,
              version: true,
            },
          },
        },

        orderBy: [
          {
            status: "asc",
          },
          {
            nextRunAt: "asc",
          },
        ],
      },

      enterpriseAudits: {
        select: {
          id: true,
          reference: true,
          title: true,
          status: true,
          auditType: true,
          scheduledAt: true,
          dueDate: true,
          completedAt: true,
          scorePercentage: true,
          findingCount: true,
          openFindingCount: true,
          overallRiskLevel: true,

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

        take: 20,
      },
    },
  });
}

export async function findTenantAuditProgramByName(
  input: {
    organizationId: string;
    name: string;
    excludeProgramId?: string | null;
  }
) {
  return prisma.auditProgram.findFirst({
    where: {
      organizationId:
        input.organizationId,

      name: {
        equals:
          input.name.trim(),

        mode: "insensitive",
      },

      ...(input.excludeProgramId
        ? {
            id: {
              not:
                input.excludeProgramId,
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

export async function findTenantAuditProgramByCode(
  input: {
    organizationId: string;
    code: string;
    excludeProgramId?: string | null;
  }
) {
  return prisma.auditProgram.findFirst({
    where: {
      organizationId:
        input.organizationId,

      code: {
        equals:
          input.code.trim(),

        mode: "insensitive",
      },

      ...(input.excludeProgramId
        ? {
            id: {
              not:
                input.excludeProgramId,
            },
          }
        : {}),
    },

    select: {
      id: true,
      code: true,
    },
  });
}

export async function createTenantAuditProgram(input: {
  organizationId: string;

  name: string;
  description?: string | null;
  code?: string | null;

  standardName?: string | null;
  standardVersion?: string | null;
  framework?: string | null;
  objectives?: string | null;
  scope?: string | null;

  status: EnterpriseAuditProgramStatus;
  frequency: EnterpriseAuditFrequency;
  riskPriority: EnterpriseAuditRiskPriority;

  effectiveFrom?: Date | null;
  effectiveTo?: Date | null;

  ownerId?: string | null;
  defaultProtocolId?: string | null;

  isActive: boolean;

  siteIds: string[];
  primarySiteId?: string | null;

  departmentIds: string[];
  primaryDepartmentId?: string | null;
}) {
  return prisma.$transaction(
    async (transaction) => {
      const program =
        await transaction.auditProgram.create({
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

            objectives:
              input.objectives?.trim() ||
              null,

            scope:
              input.scope?.trim() ||
              null,

            status:
              input.status,

            frequency:
              input.frequency,

            riskPriority:
              input.riskPriority,

            effectiveFrom:
              input.effectiveFrom ||
              null,

            effectiveTo:
              input.effectiveTo ||
              null,

            ownerId:
              input.ownerId ||
              null,

            defaultProtocolId:
              input.defaultProtocolId ||
              null,

            isActive:
              input.isActive,
          },
        });

      const uniqueSiteIds = [
        ...new Set(input.siteIds),
      ];

      if (uniqueSiteIds.length > 0) {
        await transaction.auditProgramSite.createMany({
          data:
            uniqueSiteIds.map(
              (siteId) => ({
                programId:
                  program.id,

                siteId,

                isPrimary:
                  siteId ===
                  input.primarySiteId,
              })
            ),
        });
      }

      const uniqueDepartmentIds = [
        ...new Set(
          input.departmentIds
        ),
      ];

      if (
        uniqueDepartmentIds.length >
        0
      ) {
        await transaction.auditProgramDepartment.createMany({
          data:
            uniqueDepartmentIds.map(
              (departmentId) => ({
                programId:
                  program.id,

                departmentId,

                isPrimary:
                  departmentId ===
                  input.primaryDepartmentId,
              })
            ),
        });
      }

      return transaction.auditProgram.findUnique({
        where: {
          id: program.id,
        },

        select:
          auditProgramSummarySelect,
      });
    }
  );
}

export async function updateTenantAuditProgram(input: {
  organizationId: string;
  programId: string;

  name: string;
  description?: string | null;
  code?: string | null;

  standardName?: string | null;
  standardVersion?: string | null;
  framework?: string | null;
  objectives?: string | null;
  scope?: string | null;

  status: EnterpriseAuditProgramStatus;
  frequency: EnterpriseAuditFrequency;
  riskPriority: EnterpriseAuditRiskPriority;

  effectiveFrom?: Date | null;
  effectiveTo?: Date | null;

  ownerId?: string | null;
  defaultProtocolId?: string | null;

  isActive: boolean;

  siteIds: string[];
  primarySiteId?: string | null;

  departmentIds: string[];
  primaryDepartmentId?: string | null;
}) {
  return prisma.$transaction(
    async (transaction) => {
      const existing =
        await transaction.auditProgram.findFirst({
          where: {
            id: input.programId,
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

      await transaction.auditProgram.update({
        where: {
          id: existing.id,
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

          objectives:
            input.objectives?.trim() ||
            null,

          scope:
            input.scope?.trim() ||
            null,

          status:
            input.status,

          frequency:
            input.frequency,

          riskPriority:
            input.riskPriority,

          effectiveFrom:
            input.effectiveFrom ||
            null,

          effectiveTo:
            input.effectiveTo ||
            null,

          ownerId:
            input.ownerId ||
            null,

          defaultProtocolId:
            input.defaultProtocolId ||
            null,

          isActive:
            input.isActive,
        },
      });

      await transaction.auditProgramSite.deleteMany({
        where: {
          programId:
            existing.id,
        },
      });

      const uniqueSiteIds = [
        ...new Set(input.siteIds),
      ];

      if (uniqueSiteIds.length > 0) {
        await transaction.auditProgramSite.createMany({
          data:
            uniqueSiteIds.map(
              (siteId) => ({
                programId:
                  existing.id,

                siteId,

                isPrimary:
                  siteId ===
                  input.primarySiteId,
              })
            ),
        });
      }

      await transaction.auditProgramDepartment.deleteMany({
        where: {
          programId:
            existing.id,
        },
      });

      const uniqueDepartmentIds = [
        ...new Set(
          input.departmentIds
        ),
      ];

      if (
        uniqueDepartmentIds.length >
        0
      ) {
        await transaction.auditProgramDepartment.createMany({
          data:
            uniqueDepartmentIds.map(
              (departmentId) => ({
                programId:
                  existing.id,

                departmentId,

                isPrimary:
                  departmentId ===
                  input.primaryDepartmentId,
              })
            ),
        });
      }

      return transaction.auditProgram.findUnique({
        where: {
          id: existing.id,
        },

        select:
          auditProgramSummarySelect,
      });
    }
  );
}

export async function archiveTenantAuditProgram(input: {
  organizationId: string;
  programId: string;
}) {
  const program =
    await prisma.auditProgram.findFirst({
      where: {
        id: input.programId,
        organizationId:
          input.organizationId,
      },

      select: {
        id: true,
      },
    });

  if (!program) {
    return null;
  }

  return prisma.auditProgram.update({
    where: {
      id: program.id,
    },

    data: {
      status:
        EnterpriseAuditProgramStatus.ARCHIVED,

      isActive: false,
    },

    select:
      auditProgramSummarySelect,
  });
}

export async function getAuditProgramFormOptions(
  organizationId: string
) {
  const [
    users,
    sites,
    departments,
    protocols,
  ] = await Promise.all([
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

    prisma.auditProtocol.findMany({
      where: {
        organizationId,
        isActive: true,
      },

      select: {
        id: true,
        name: true,
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
    users,
    sites,
    departments,
    protocols,
  };
}