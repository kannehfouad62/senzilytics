import { prisma } from "@/lib/prisma";
import {
  MocChangeDuration,
  MocChangeType,
  MocPriority,
  MocStatus,
} from "@prisma/client";

export async function findTenantMocs(input: {
  organizationId: string;
  siteId?: string | null;
  status?: MocStatus | null;
  changeType?: MocChangeType | null;
  changeDuration?: MocChangeDuration | null;
  priority?: MocPriority | null;
  search?: string | null;
}) {
  return prisma.managementOfChange.findMany({
    where: {
      organizationId: input.organizationId,

      ...(input.siteId
        ? {
            siteId: input.siteId,
          }
        : {}),

      ...(input.status
        ? {
            status: input.status,
          }
        : {}),

      ...(input.changeType
        ? {
            changeType: input.changeType,
          }
        : {}),

      ...(input.changeDuration
        ? {
            changeDuration:
              input.changeDuration,
          }
        : {}),

      ...(input.priority
        ? {
            priority: input.priority,
          }
        : {}),

      ...(input.search
        ? {
            OR: [
              {
                reference: {
                  contains: input.search,
                  mode: "insensitive",
                },
              },
              {
                title: {
                  contains: input.search,
                  mode: "insensitive",
                },
              },
              {
                description: {
                  contains: input.search,
                  mode: "insensitive",
                },
              },
              {
                businessJustification: {
                  contains: input.search,
                  mode: "insensitive",
                },
              },
              {
                affectedProcess: {
                  contains: input.search,
                  mode: "insensitive",
                },
              },
              {
                affectedEquipment: {
                  contains: input.search,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    },

    include: {
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

      requestor: {
        select: {
          id: true,
          name: true,
          email: true,
          jobTitle: true,
        },
      },

      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          jobTitle: true,
        },
      },

      approvals: {
        select: {
          id: true,
          role: true,
          status: true,
          sequence: true,
        },

        orderBy: {
          sequence: "asc",
        },
      },

      tasks: {
        select: {
          id: true,
          taskType: true,
          status: true,
          dueDate: true,
          isRequired: true,
        },
      },

      riskLinks: {
        select: {
          id: true,
          riskId: true,
        },
      },
    },

    orderBy: [
      {
        residualScore: "desc",
      },
      {
        priority: "desc",
      },
      {
        plannedCompletionDate: "asc",
      },
      {
        createdAt: "desc",
      },
    ],
  });
}

export async function findTenantMocById(input: {
  organizationId: string;
  mocId: string;
}) {
  return prisma.managementOfChange.findFirst({
    where: {
      id: input.mocId,
      organizationId:
        input.organizationId,
    },

    include: {
      organization: {
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

      department: {
        select: {
          id: true,
          name: true,
          siteId: true,
        },
      },

      requestor: {
        select: {
          id: true,
          name: true,
          email: true,
          jobTitle: true,
          role: true,
        },
      },

      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          jobTitle: true,
          role: true,
        },
      },

      approvals: {
        include: {
          approver: {
            select: {
              id: true,
              name: true,
              email: true,
              jobTitle: true,
            },
          },
        },

        orderBy: {
          sequence: "asc",
        },
      },

      tasks: {
        include: {
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
              jobTitle: true,
            },
          },

          verifiedBy: {
            select: {
              id: true,
              name: true,
              email: true,
              jobTitle: true,
            },
          },
        },

        orderBy: [
          {
            sequence: "asc",
          },
          {
            dueDate: "asc",
          },
          {
            createdAt: "asc",
          },
        ],
      },

      riskLinks: {
        include: {
          risk: {
            select: {
              id: true,
              reference: true,
              title: true,
              status: true,
              currentScore: true,
              currentRiskLevel: true,
              residualScore: true,
              residualRiskLevel: true,
            },
          },
        },

        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });
}

export async function getNextMocReference(
  organizationId: string
) {
  const currentYear =
    new Date().getFullYear();

  const prefix =
    `MOC-${currentYear}-`;

  const latestMoc =
    await prisma.managementOfChange.findFirst({
      where: {
        organizationId,

        reference: {
          startsWith: prefix,
        },
      },

      select: {
        reference: true,
      },

      orderBy: {
        reference: "desc",
      },
    });

  const latestNumber =
    latestMoc
      ? Number(
          latestMoc.reference
            .split("-")
            .at(-1)
        )
      : 0;

  const nextNumber =
    Number.isFinite(latestNumber)
      ? latestNumber + 1
      : 1;

  return `${prefix}${String(
    nextNumber
  ).padStart(4, "0")}`;
}