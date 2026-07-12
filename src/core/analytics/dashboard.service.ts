import { prisma } from "@/lib/prisma";
import {
  DocumentStatus,
  RiskLevel,
  Status,
  WorkflowInstanceStatus,
  WorkflowStepStatus,
} from "@prisma/client";

type MonthlyTrendPoint = {
  month: string;
  incidents: number;
  documents: number;
};

type RiskDistributionPoint = {
  riskLevel: RiskLevel;
  count: number;
};

type SitePerformancePoint = {
  siteId: string;
  siteName: string;
  incidents: number;
  openIncidents: number;
  highRiskIncidents: number;
};

type ActionAgingPoint = {
  bucket: string;
  count: number;
};

type IncidentTypePoint = {
  incidentType: string;
  count: number;
};

type ActionStatusPoint = {
  status: string;
  count: number;
};

function startOfMonth(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    1
  );
}

function addMonths(
  date: Date,
  amount: number
) {
  return new Date(
    date.getFullYear(),
    date.getMonth() + amount,
    1
  );
}

function formatMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;
}

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

function isClosedStatus(status: Status) {
  return (
    status === Status.COMPLETED ||
    status === Status.CLOSED
  );
}

export async function getExecutiveDashboardData(input: {
  organizationId: string;
}) {
  const now = new Date();

  const currentMonthStart =
    startOfMonth(now);

  const nextMonthStart = addMonths(
    currentMonthStart,
    1
  );

  const trendStart = addMonths(
    currentMonthStart,
    -11
  );

  const [
    totalIncidents,
    openIncidents,
    highRiskIncidents,
    openInvestigations,
    openCorrectiveActions,
    overdueCorrectiveActions,
    activeWorkflows,
    overdueWorkflowSteps,
    activeDocuments,
    archivedDocuments,
    recentIncidents,
    recentOverdueActions,
    incidentTrendRows,
    documentTrendRows,
    riskRows,
    siteIncidentRows,
    openActionRows,
    incidentTypeRows,
    actionStatusRows,
    completedCorrectiveActions,
  ] = await Promise.all([
    prisma.incident.count({
      where: {
        site: {
          organizationId:
            input.organizationId,
        },
      },
    }),

    prisma.incident.count({
      where: {
        site: {
          organizationId:
            input.organizationId,
        },
        status: {
          notIn: [
            Status.COMPLETED,
            Status.CLOSED,
          ],
        },
      },
    }),

    prisma.incident.count({
      where: {
        site: {
          organizationId:
            input.organizationId,
        },
        riskLevel: {
          in: [
            RiskLevel.HIGH,
            RiskLevel.CRITICAL,
          ],
        },
        status: {
          notIn: [
            Status.COMPLETED,
            Status.CLOSED,
          ],
        },
      },
    }),

    prisma.investigation.count({
      where: {
        incident: {
          site: {
            organizationId:
              input.organizationId,
          },
        },
        OR: [
          {
            summary: null,
          },
          {
            rootCause: null,
          },
        ],
      },
    }),

    prisma.correctiveAction.count({
      where: {
        incident: {
          site: {
            organizationId:
              input.organizationId,
          },
        },
        status: {
          notIn: [
            Status.COMPLETED,
            Status.CLOSED,
          ],
        },
      },
    }),

    prisma.correctiveAction.count({
      where: {
        incident: {
          site: {
            organizationId:
              input.organizationId,
          },
        },
        dueDate: {
          lt: now,
        },
        status: {
          notIn: [
            Status.COMPLETED,
            Status.CLOSED,
          ],
        },
      },
    }),

    prisma.workflowInstance.count({
      where: {
        organizationId:
          input.organizationId,
        status:
          WorkflowInstanceStatus.ACTIVE,
      },
    }),

    prisma.workflowInstanceStep.count({
      where: {
        status:
          WorkflowStepStatus.IN_PROGRESS,
        dueAt: {
          lt: now,
        },
        instance: {
          organizationId:
            input.organizationId,
          status:
            WorkflowInstanceStatus.ACTIVE,
        },
      },
    }),

    prisma.document.count({
      where: {
        organizationId:
          input.organizationId,
        isLatest: true,
        status: DocumentStatus.ACTIVE,
      },
    }),

    prisma.document.count({
      where: {
        organizationId:
          input.organizationId,
        isLatest: true,
        status: DocumentStatus.ARCHIVED,
      },
    }),

    prisma.incident.findMany({
      where: {
        site: {
          organizationId:
            input.organizationId,
        },
      },
      include: {
        site: {
          select: {
            name: true,
          },
        },
        reportedBy: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
    }),

    prisma.correctiveAction.findMany({
      where: {
        incident: {
          site: {
            organizationId:
              input.organizationId,
          },
        },
        dueDate: {
          lt: now,
        },
        status: {
          notIn: [
            Status.COMPLETED,
            Status.CLOSED,
          ],
        },
      },
      include: {
        assignedTo: {
          select: {
            name: true,
          },
        },
        incident: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: {
        dueDate: "asc",
      },
      take: 5,
    }),

    prisma.incident.findMany({
      where: {
        site: {
          organizationId:
            input.organizationId,
        },
        occurredAt: {
          gte: trendStart,
          lt: nextMonthStart,
        },
      },
      select: {
        occurredAt: true,
      },
    }),

    prisma.document.findMany({
      where: {
        organizationId:
          input.organizationId,
        createdAt: {
          gte: trendStart,
          lt: nextMonthStart,
        },
        status: {
          not: DocumentStatus.DELETED,
        },
      },
      select: {
        createdAt: true,
      },
    }),

    prisma.incident.groupBy({
      by: ["riskLevel"],
      where: {
        site: {
          organizationId:
            input.organizationId,
        },
      },
      _count: {
        _all: true,
      },
    }),

    prisma.incident.findMany({
      where: {
        site: {
          organizationId:
            input.organizationId,
        },
      },
      select: {
        status: true,
        riskLevel: true,
        site: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),

    prisma.correctiveAction.findMany({
      where: {
        incident: {
          site: {
            organizationId:
              input.organizationId,
          },
        },
        status: {
          notIn: [
            Status.COMPLETED,
            Status.CLOSED,
          ],
        },
      },
      select: {
        id: true,
        createdAt: true,
        dueDate: true,
        status: true,
      },
    }),

    prisma.incident.groupBy({
      by: ["type"],
      where: {
        site: {
          organizationId: input.organizationId,
        },
      },
      _count: {
        _all: true,
      },
    }),
    
    prisma.correctiveAction.groupBy({
      by: ["status"],
      where: {
        incident: {
          site: {
            organizationId: input.organizationId,
          },
        },
      },
      _count: {
        _all: true,
      },
    }),
    
    prisma.correctiveAction.count({
      where: {
        incident: {
          site: {
            organizationId: input.organizationId,
          },
        },
        status: {
          in: [
            Status.COMPLETED,
            Status.CLOSED,
          ],
        },
      },
    }),
  ]);

  const monthlyTrendMap = new Map<
    string,
    MonthlyTrendPoint
  >();

  for (
    let index = 0;
    index < 12;
    index++
  ) {
    const monthDate = addMonths(
      trendStart,
      index
    );

    const key =
      formatMonthKey(monthDate);

    monthlyTrendMap.set(key, {
      month:
        formatMonthLabel(monthDate),
      incidents: 0,
      documents: 0,
    });
  }

  for (
    const incident of incidentTrendRows
  ) {
    const key = formatMonthKey(
      startOfMonth(
        incident.occurredAt
      )
    );

    const point =
      monthlyTrendMap.get(key);

    if (point) {
      point.incidents += 1;
    }
  }

  for (
    const document of documentTrendRows
  ) {
    const key = formatMonthKey(
      startOfMonth(
        document.createdAt
      )
    );

    const point =
      monthlyTrendMap.get(key);

    if (point) {
      point.documents += 1;
    }
  }

  const monthlyTrend =
    Array.from(
      monthlyTrendMap.values()
    );

  const riskDistribution: RiskDistributionPoint[] =
    Object.values(RiskLevel).map(
      (riskLevel) => ({
        riskLevel,
        count:
          riskRows.find(
            (row) =>
              row.riskLevel ===
              riskLevel
          )?._count._all ?? 0,
      })
    );

  const incidentsThisMonth =
    incidentTrendRows.filter(
      (incident) =>
        incident.occurredAt >=
          currentMonthStart &&
        incident.occurredAt <
          nextMonthStart
    ).length;

  const documentsThisMonth =
    documentTrendRows.filter(
      (document) =>
        document.createdAt >=
          currentMonthStart &&
        document.createdAt <
          nextMonthStart
    ).length;

  const sitePerformanceMap =
    new Map<
      string,
      SitePerformancePoint
    >();

  for (
    const incident of siteIncidentRows
  ) {
    const existing =
      sitePerformanceMap.get(
        incident.site.id
      ) ?? {
        siteId: incident.site.id,
        siteName:
          incident.site.name,
        incidents: 0,
        openIncidents: 0,
        highRiskIncidents: 0,
      };

    existing.incidents += 1;

    if (
      !isClosedStatus(
        incident.status
      )
    ) {
      existing.openIncidents += 1;
    }

    if (
      incident.riskLevel ===
        RiskLevel.HIGH ||
      incident.riskLevel ===
        RiskLevel.CRITICAL
    ) {
      existing.highRiskIncidents += 1;
    }

    sitePerformanceMap.set(
      incident.site.id,
      existing
    );
  }

  const sitePerformance =
    Array.from(
      sitePerformanceMap.values()
    ).sort((first, second) => {
      if (
        second.incidents !==
        first.incidents
      ) {
        return (
          second.incidents -
          first.incidents
        );
      }

      return first.siteName.localeCompare(
        second.siteName
      );
    });

  const actionAging: ActionAgingPoint[] =
    [
      {
        bucket: "0–7 days",
        count: 0,
      },
      {
        bucket: "8–30 days",
        count: 0,
      },
      {
        bucket: "31–60 days",
        count: 0,
      },
      {
        bucket: "61–90 days",
        count: 0,
      },
      {
        bucket: "90+ days",
        count: 0,
      },
    ];

    const incidentTypeDistribution: IncidentTypePoint[] =
  incidentTypeRows
    .map((row) => ({
      incidentType: row.type,
      count: row._count._all,
    }))
    .sort(
      (first, second) =>
        second.count - first.count
    );

const actionStatusDistribution: ActionStatusPoint[] =
  Object.values(Status)
    .map((status) => ({
      status,
      count:
        actionStatusRows.find(
          (row) => row.status === status
        )?._count._all ?? 0,
    }))
    .filter((item) => item.count > 0);

const totalCorrectiveActions =
  openCorrectiveActions +
  completedCorrectiveActions;

const correctiveActionCompletionRate =
  totalCorrectiveActions > 0
    ? Math.round(
        (completedCorrectiveActions /
          totalCorrectiveActions) *
          100
      )
    : 0;

  const millisecondsPerDay =
    1000 * 60 * 60 * 24;

  for (
    const action of openActionRows
  ) {
    const ageMilliseconds =
      now.getTime() -
      action.createdAt.getTime();

    const ageDays = Math.max(
      0,
      Math.floor(
        ageMilliseconds /
          millisecondsPerDay
      )
    );

    if (ageDays <= 7) {
      actionAging[0].count += 1;
    } else if (ageDays <= 30) {
      actionAging[1].count += 1;
    } else if (ageDays <= 60) {
      actionAging[2].count += 1;
    } else if (ageDays <= 90) {
      actionAging[3].count += 1;
    } else {
      actionAging[4].count += 1;
    }
  }

  return {
    generatedAt: now,

    kpis: {
      totalIncidents,
      openIncidents,
      highRiskIncidents,
      openInvestigations,
      openCorrectiveActions,
      overdueCorrectiveActions,
      activeWorkflows,
      overdueWorkflowSteps,
      activeDocuments,
      archivedDocuments,
      incidentsThisMonth,
      documentsThisMonth,
      completedCorrectiveActions,
      totalCorrectiveActions,
      correctiveActionCompletionRate,
    },

    charts: {
      monthlyTrend,
      riskDistribution,
      sitePerformance,
      actionAging,
      incidentTypeDistribution,
      actionStatusDistribution,
    },

    recentIncidents,
    recentOverdueActions,
  };
}