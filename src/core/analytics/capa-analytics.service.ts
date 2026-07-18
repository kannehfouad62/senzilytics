import { prisma } from "@/lib/prisma";
import {
  RiskLevel,
  Status,
} from "@prisma/client";

export type CapaSourceType =
  | "INCIDENT"
  | "AUDIT"
  | "INSPECTION"
  | "OTHER";

export type CapaDashboardAction = {
  id: string;
  title: string;
  description: string | null;
  status: Status;
  riskLevel: RiskLevel;
  dueDate: Date;
  createdAt: Date;
  updatedAt: Date;
  reminderSentAt: Date | null;
  overdueNotifiedAt: Date | null;
  assignedTo: {
    id: string;
    name: string;
    email: string;
    jobTitle: string | null;
  };
  sourceType: CapaSourceType;
  sourceTitle: string;
  sourceLink: string;
};

export type CapaChartItem = {
  label: string;
  value: number;
};

export type CapaAssigneeWorkload = {
  userId: string;
  name: string;
  total: number;
  open: number;
  overdue: number;
  highRisk: number;
};

export type CapaDashboardData = {
  generatedAt: Date;

  summary: {
    total: number;
    open: number;
    inProgress: number;
    completed: number;
    closed: number;
    overdue: number;
    highRiskOpen: number;
    dueWithinSevenDays: number;
    closureRate: number;
    averageAgeDays: number;
  };

  statusDistribution: CapaChartItem[];
  riskDistribution: CapaChartItem[];
  sourceDistribution: CapaChartItem[];
  agingDistribution: CapaChartItem[];

  assigneeWorkload: CapaAssigneeWorkload[];

  priorityActions: CapaDashboardAction[];
  recentActions: CapaDashboardAction[];
};

function getDaysBetween(
  startDate: Date,
  endDate: Date
) {
  const milliseconds =
    endDate.getTime() -
    startDate.getTime();

  return Math.max(
    0,
    Math.floor(
      milliseconds /
        (1000 * 60 * 60 * 24)
    )
  );
}

function getActionSource(input: {
  incident:
    | {
        id: string;
        title: string;
      }
    | null;

  auditFinding:
    | {
        id: string;
        title: string;
        audit: {
          id: string;
          title: string;
        };
      }
    | null;

  inspectionFinding:
    | {
        id: string;
        title: string;
        inspection: {
          id: string;
          title: string;
        };
      }
    | null;

  enterpriseAuditFindingLink:
    | {
        finding: {
          id: string;
          title: string;
          audit: {
            id: string;
            title: string;
          };
        };
      }
    | null;
}): {
  sourceType: CapaSourceType;
  sourceTitle: string;
  sourceLink: string;
} {
  if (input.incident) {
    return {
      sourceType: "INCIDENT",
      sourceTitle:
        input.incident.title,
      sourceLink:
        `/incidents/${input.incident.id}`,
    };
  }

  if (input.auditFinding) {
    return {
      sourceType: "AUDIT",
      sourceTitle:
        input.auditFinding.audit.title,
      sourceLink:
        `/audits/${input.auditFinding.audit.id}`,
    };
  }

  if (input.inspectionFinding) {
    return {
      sourceType: "INSPECTION",
      sourceTitle:
        input.inspectionFinding
          .inspection.title,
      sourceLink:
        `/inspections/${input.inspectionFinding.inspection.id}`,
    };
  }

  if (input.enterpriseAuditFindingLink) {
    return {
      sourceType: "AUDIT",
      sourceTitle:
        input.enterpriseAuditFindingLink.finding.audit.title,
      sourceLink:
        `/audits/${input.enterpriseAuditFindingLink.finding.audit.id}`,
    };
  }

  return {
    sourceType: "OTHER",
    sourceTitle:
      "Standalone corrective action",
    sourceLink: "/actions",
  };
}

function createDistribution(
  values: string[],
  preferredOrder: string[]
): CapaChartItem[] {
  const counts =
    new Map<string, number>();

  for (const value of values) {
    counts.set(
      value,
      (counts.get(value) ?? 0) + 1
    );
  }

  const orderedValues = [
    ...preferredOrder.filter(
      (value) => counts.has(value)
    ),

    ...Array.from(counts.keys()).filter(
      (value) =>
        !preferredOrder.includes(value)
    ),
  ];

  return orderedValues.map(
    (value) => ({
      label:
        value.replaceAll("_", " "),
      value: counts.get(value) ?? 0,
    })
  );
}

export async function getCapaDashboardData(
  organizationId: string
): Promise<CapaDashboardData> {
  const now = new Date();

  const sevenDaysFromNow =
    new Date(
      now.getTime() +
        7 *
          24 *
          60 *
          60 *
          1000
    );

  const correctiveActions =
    await prisma.correctiveAction.findMany({
      where: {
        OR: [
          {
            incident: {
              site: {
                organizationId,
              },
            },
          },

          {
            auditFinding: {
              audit: {
                site: {
                  organizationId,
                },
              },
            },
          },

          {
            inspectionFinding: {
              inspection: {
                site: {
                  organizationId,
                },
              },
            },
          },

          {
            enterpriseAuditFindingLinks: {
              some: {
                finding: {
                  organizationId,
                },
              },
            },
          },

          {
            assignedTo: {
              organizationId,
            },
            incidentId: null,
            auditFindingId: null,
            inspectionFindingId: null,
          },
        ],
      },

      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            jobTitle: true,
          },
        },

        incident: {
          select: {
            id: true,
            title: true,
          },
        },

        auditFinding: {
          select: {
            id: true,
            title: true,

            audit: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },

        inspectionFinding: {
          select: {
            id: true,
            title: true,

            inspection: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },

        enterpriseAuditFindingLinks: {
          select: {
            finding: {
              select: {
                id: true,
                title: true,
                audit: {
                  select: {
                    id: true,
                    title: true,
                  },
                },
              },
            },
          },
          take: 1,
        },
      },

      orderBy: [
        {
          dueDate: "asc",
        },

        {
          createdAt: "desc",
        },
      ],
    });

  const actions: CapaDashboardAction[] =
    correctiveActions.map(
      (action) => {
        const source =
          getActionSource({
            incident:
              action.incident,

            auditFinding:
              action.auditFinding,

            inspectionFinding:
              action.inspectionFinding,

            enterpriseAuditFindingLink:
              action.enterpriseAuditFindingLinks[0] ?? null,
          });

        return {
          id: action.id,
          title: action.title,
          description:
            action.description,
          status: action.status,
          riskLevel:
            action.riskLevel,
          dueDate: action.dueDate,
          createdAt:
            action.createdAt,
          updatedAt:
            action.updatedAt,
          reminderSentAt:
            action.reminderSentAt,
          overdueNotifiedAt:
            action.overdueNotifiedAt,
          assignedTo:
            action.assignedTo,
          ...source,
        };
      }
    );

  const activeActions =
    actions.filter(
      (action) =>
        action.status !==
          Status.COMPLETED &&
        action.status !== Status.CLOSED
    );

  const overdueActions =
    activeActions.filter(
      (action) =>
        action.status ===
          Status.OVERDUE ||
        action.dueDate < now
    );

  const completedActions =
    actions.filter(
      (action) =>
        action.status ===
          Status.COMPLETED ||
        action.status === Status.CLOSED
    );

  const highRiskOpenActions =
    activeActions.filter(
      (action) =>
        action.riskLevel ===
          RiskLevel.HIGH ||
        action.riskLevel ===
          RiskLevel.CRITICAL
    );

  const dueWithinSevenDays =
    activeActions.filter(
      (action) =>
        action.dueDate >= now &&
        action.dueDate <=
          sevenDaysFromNow
    );

  const totalAgeDays =
    actions.reduce(
      (total, action) =>
        total +
        getDaysBetween(
          action.createdAt,
          now
        ),
      0
    );

  const closureRate =
    actions.length > 0
      ? Math.round(
          (completedActions.length /
            actions.length) *
            100
        )
      : 0;

  const averageAgeDays =
    actions.length > 0
      ? Math.round(
          totalAgeDays /
            actions.length
        )
      : 0;

  const assigneeMap =
    new Map<
      string,
      CapaAssigneeWorkload
    >();

  for (const action of actions) {
    const existing =
      assigneeMap.get(
        action.assignedTo.id
      ) ?? {
        userId:
          action.assignedTo.id,
        name:
          action.assignedTo.name,
        total: 0,
        open: 0,
        overdue: 0,
        highRisk: 0,
      };

    existing.total += 1;

    if (
      action.status !==
        Status.COMPLETED &&
      action.status !== Status.CLOSED
    ) {
      existing.open += 1;
    }

    if (
      action.status ===
        Status.OVERDUE ||
      (action.dueDate < now &&
        action.status !==
          Status.COMPLETED &&
        action.status !==
          Status.CLOSED)
    ) {
      existing.overdue += 1;
    }

    if (
      action.riskLevel ===
        RiskLevel.HIGH ||
      action.riskLevel ===
        RiskLevel.CRITICAL
    ) {
      existing.highRisk += 1;
    }

    assigneeMap.set(
      action.assignedTo.id,
      existing
    );
  }

  const agingBuckets = {
    "0–7 DAYS": 0,
    "8–30 DAYS": 0,
    "31–60 DAYS": 0,
    "61–90 DAYS": 0,
    "90+ DAYS": 0,
  };

  for (const action of activeActions) {
    const age =
      getDaysBetween(
        action.createdAt,
        now
      );

    if (age <= 7) {
      agingBuckets["0–7 DAYS"] += 1;
    } else if (age <= 30) {
      agingBuckets["8–30 DAYS"] += 1;
    } else if (age <= 60) {
      agingBuckets["31–60 DAYS"] += 1;
    } else if (age <= 90) {
      agingBuckets["61–90 DAYS"] += 1;
    } else {
      agingBuckets["90+ DAYS"] += 1;
    }
  }

  const priorityActions = [
    ...overdueActions,
    ...highRiskOpenActions.filter(
      (action) =>
        !overdueActions.some(
          (overdueAction) =>
            overdueAction.id ===
            action.id
        )
    ),
  ]
    .sort(
      (firstAction, secondAction) => {
        const firstCritical =
          firstAction.riskLevel ===
          RiskLevel.CRITICAL
            ? 1
            : 0;

        const secondCritical =
          secondAction.riskLevel ===
          RiskLevel.CRITICAL
            ? 1
            : 0;

        if (
          firstCritical !==
          secondCritical
        ) {
          return (
            secondCritical -
            firstCritical
          );
        }

        return (
          firstAction.dueDate.getTime() -
          secondAction.dueDate.getTime()
        );
      }
    )
    .slice(0, 20);

  const recentActions = [
    ...actions,
  ]
    .sort(
      (firstAction, secondAction) =>
        secondAction.createdAt.getTime() -
        firstAction.createdAt.getTime()
    )
    .slice(0, 10);

  return {
    generatedAt: now,

    summary: {
      total: actions.length,

      open: actions.filter(
        (action) =>
          action.status === Status.OPEN
      ).length,

      inProgress: actions.filter(
        (action) =>
          action.status ===
          Status.IN_PROGRESS
      ).length,

      completed: actions.filter(
        (action) =>
          action.status ===
          Status.COMPLETED
      ).length,

      closed: actions.filter(
        (action) =>
          action.status === Status.CLOSED
      ).length,

      overdue:
        overdueActions.length,

      highRiskOpen:
        highRiskOpenActions.length,

      dueWithinSevenDays:
        dueWithinSevenDays.length,

      closureRate,

      averageAgeDays,
    },

    statusDistribution:
      createDistribution(
        actions.map(
          (action) => action.status
        ),
        [
          Status.OPEN,
          Status.IN_PROGRESS,
          Status.OVERDUE,
          Status.COMPLETED,
          Status.CLOSED,
        ]
      ),

    riskDistribution:
      createDistribution(
        actions.map(
          (action) =>
            action.riskLevel
        ),
        [
          RiskLevel.CRITICAL,
          RiskLevel.HIGH,
          RiskLevel.MEDIUM,
          RiskLevel.LOW,
        ]
      ),

    sourceDistribution:
      createDistribution(
        actions.map(
          (action) =>
            action.sourceType
        ),
        [
          "INCIDENT",
          "AUDIT",
          "INSPECTION",
          "OTHER",
        ]
      ),

    agingDistribution:
      Object.entries(
        agingBuckets
      ).map(([label, value]) => ({
        label,
        value,
      })),

    assigneeWorkload:
      Array.from(
        assigneeMap.values()
      )
        .sort(
          (
            firstAssignee,
            secondAssignee
          ) =>
            secondAssignee.open -
            firstAssignee.open
        )
        .slice(0, 15),

    priorityActions,

    recentActions,
  };
}
