import { prisma } from "@/lib/prisma";
import {
  RiskCategory,
  RiskStatus,
} from "@prisma/client";

export async function findTenantRisks(input: {
  organizationId: string;
  siteId?: string | null;
  category?: RiskCategory | null;
  status?: RiskStatus | null;
  search?: string | null;
}) {
  return prisma.risk.findMany({
    where: {
      organizationId:
        input.organizationId,

      ...(input.siteId
        ? {
            siteId: input.siteId,
          }
        : {}),

      ...(input.category
        ? {
            category:
              input.category,
          }
        : {}),

      ...(input.status
        ? {
            status: input.status,
          }
        : {}),

      ...(input.search
        ? {
            OR: [
              {
                reference: {
                  contains:
                    input.search,
                  mode: "insensitive",
                },
              },
              {
                title: {
                  contains:
                    input.search,
                  mode: "insensitive",
                },
              },
              {
                description: {
                  contains:
                    input.search,
                  mode: "insensitive",
                },
              },
              {
                hazardType: {
                  contains:
                    input.search,
                  mode: "insensitive",
                },
              },
              {
                process: {
                  contains:
                    input.search,
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

      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          jobTitle: true,
        },
      },

      controls: {
        select: {
          id: true,
          status: true,
          controlType: true,
          effectiveness: true,
          dueDate: true,
        },
      },

      reviews: {
        select: {
          id: true,
          reviewDate: true,
          riskLevel: true,
          score: true,
        },

        orderBy: {
          reviewDate: "desc",
        },

        take: 1,
      },
    },

    orderBy: [
      {
        residualScore: "desc",
      },
      {
        currentScore: "desc",
      },
      {
        nextReviewDate: "asc",
      },
      {
        createdAt: "desc",
      },
    ],
  });
}

export async function findTenantRiskById(input: {
  organizationId: string;
  riskId: string;
}) {
  return prisma.risk.findFirst({
    where: {
      id: input.riskId,
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

      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          jobTitle: true,
          role: true,
        },
      },

      controls: {
        include: {
          owner: {
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
            controlType: "asc",
          },
          {
            dueDate: "asc",
          },
          {
            createdAt: "asc",
          },
        ],
      },

      reviews: {
        include: {
          completedBy: {
            select: {
              id: true,
              name: true,
              jobTitle: true,
            },
          },
        },

        orderBy: {
          reviewDate: "desc",
        },
      },

      links: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });
}

export async function getNextRiskReference(
  organizationId: string
) {
  const currentYear =
    new Date().getFullYear();

  const prefix =
    `RSK-${currentYear}-`;

  const latestRisk =
    await prisma.risk.findFirst({
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
    latestRisk
      ? Number(
          latestRisk.reference
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