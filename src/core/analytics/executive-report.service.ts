import { logActivity } from "@/core/activity-log/activity-log.service";
import { prisma } from "@/lib/prisma";
import {
  ActivityAction,
  RiskLevel,
  Status,
  WorkflowEntityType,
  WorkflowInstanceStatus,
  WorkflowStepStatus,
} from "@prisma/client";

export type ExecutiveReportFilters = {
  organizationId: string;
  userId: string;
  from: Date;
  to: Date;
  siteId?: string | null;
};

export type ExecutiveReportDistributionItem = {
  label: string;
  value: number;
};

export type ExecutiveReportMonthlyTrendItem = {
  month: string;
  incidents: number;
  audits: number;
  inspections: number;
  correctiveActions: number;
};

export type ExecutiveReportSitePerformanceItem = {
  siteId: string;
  siteName: string;
  incidents: number;
  openIncidents: number;
  highRiskIncidents: number;
  audits: number;
  inspections: number;
  openCorrectiveActions: number;
  overdueCorrectiveActions: number;
  exposureScore: number;
};

export type ExecutiveReportAttentionItem = {
  id: string;
  type:
    | "INCIDENT"
    | "CORRECTIVE_ACTION"
    | "AUDIT"
    | "AUDIT_FINDING"
    | "INSPECTION"
    | "INSPECTION_FINDING"
    | "INVESTIGATION"
    | "WORKFLOW"
    | "COMPLIANCE";
  title: string;
  description: string;
  riskLevel: RiskLevel | null;
  status: string;
  dueDate: Date | null;
  siteName: string | null;
  ownerName: string | null;
  link: string;
};

export type ExecutiveReportData = {
  generatedAt: Date;

  filters: {
    from: Date;
    to: Date;
    siteId: string | null;
    siteName: string | null;
  };

  summary: {
    totalIncidents: number;
    openIncidents: number;
    highRiskIncidents: number;

    totalInvestigations: number;
    openInvestigations: number;
    overdueInvestigations: number;

    totalCorrectiveActions: number;
    openCorrectiveActions: number;
    overdueCorrectiveActions: number;
    highRiskCorrectiveActions: number;
    correctiveActionClosureRate: number;

    totalAudits: number;
    completedAudits: number;
    overdueAudits: number;
    auditCompletionRate: number;
    openAuditFindings: number;

    totalInspections: number;
    completedInspections: number;
    overdueInspections: number;
    inspectionCompletionRate: number;
    openInspectionFindings: number;

    activeWorkflows: number;
    overdueWorkflowSteps: number;

    totalComplianceItems: number;
    overdueComplianceItems: number;

    totalTrainingRecords: number;
    completedTrainingRecords: number;
    trainingCompletionRate: number;

    totalOverdueExposure: number;
  };

  monthlyTrend: ExecutiveReportMonthlyTrendItem[];

  incidentRiskDistribution:
    ExecutiveReportDistributionItem[];

  incidentStatusDistribution:
    ExecutiveReportDistributionItem[];

  correctiveActionStatusDistribution:
    ExecutiveReportDistributionItem[];

  correctiveActionRiskDistribution:
    ExecutiveReportDistributionItem[];

  correctiveActionSourceDistribution:
    ExecutiveReportDistributionItem[];

  auditStatusDistribution:
    ExecutiveReportDistributionItem[];

  inspectionStatusDistribution:
    ExecutiveReportDistributionItem[];

  sitePerformance:
    ExecutiveReportSitePerformanceItem[];

  managementAttention:
    ExecutiveReportAttentionItem[];
};

const CLOSED_STATUSES: Status[] = [
  Status.COMPLETED,
  Status.CLOSED,
];

function isClosedStatus(
  status: Status
) {
  return CLOSED_STATUSES.includes(
    status
  );
}

function calculatePercentage(
  numerator: number,
  denominator: number
) {
  if (denominator === 0) {
    return 0;
  }

  return Math.round(
    (numerator / denominator) *
      100
  );
}

function startOfMonth(
  value: Date
) {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    1
  );
}

function addMonths(
  value: Date,
  amount: number
) {
  return new Date(
    value.getFullYear(),
    value.getMonth() +
      amount,
    1
  );
}

function getMonthKey(
  value: Date
) {
  return `${value.getFullYear()}-${String(
    value.getMonth() + 1
  ).padStart(2, "0")}`;
}

function getMonthLabel(
  value: Date
) {
  return value.toLocaleDateString(
    "en-US",
    {
      month: "short",
      year: "numeric",
    }
  );
}

function createDistribution(
  values: string[],
  preferredOrder: string[] = []
): ExecutiveReportDistributionItem[] {
  const counts =
    new Map<string, number>();

  for (const value of values) {
    counts.set(
      value,
      (counts.get(value) ??
        0) + 1
    );
  }

  const labels = [
    ...preferredOrder.filter(
      (label) =>
        counts.has(label)
    ),

    ...Array.from(
      counts.keys()
    ).filter(
      (label) =>
        !preferredOrder.includes(
          label
        )
    ),
  ];

  return labels.map(
    (label) => ({
      label:
        label.replaceAll(
          "_",
          " "
        ),
      value:
        counts.get(label) ??
        0,
    })
  );
}

function getCorrectiveActionSource(
  input: {
    incidentId: string | null;
    auditFindingId: string | null;
    inspectionFindingId:
      string | null;
  }
) {
  if (input.incidentId) {
    return "INCIDENT";
  }

  if (
    input.auditFindingId
  ) {
    return "AUDIT";
  }

  if (
    input.inspectionFindingId
  ) {
    return "INSPECTION";
  }

  return "OTHER";
}

function getCorrectiveActionSite(
  action: {
    incident:
      | {
          site: {
            id: string;
            name: string;
          };
        }
      | null;

    auditFinding:
      | {
          audit: {
            site: {
              id: string;
              name: string;
            };
          };
        }
      | null;

    inspectionFinding:
      | {
          inspection: {
            site: {
              id: string;
              name: string;
            };
          };
        }
      | null;
  }
) {
  return (
    action.incident?.site ??
    action.auditFinding?.audit
      .site ??
    action.inspectionFinding
      ?.inspection.site ??
    null
  );
}

function getCorrectiveActionLink(
  action: {
    incident:
      | {
          id: string;
        }
      | null;

    auditFinding:
      | {
          audit: {
            id: string;
          };
        }
      | null;

    inspectionFinding:
      | {
          inspection: {
            id: string;
          };
        }
      | null;
  }
) {
  if (action.incident) {
    return `/incidents/${action.incident.id}`;
  }

  if (
    action.auditFinding
  ) {
    return `/audits/${action.auditFinding.audit.id}`;
  }

  if (
    action.inspectionFinding
  ) {
    return `/inspections/${action.inspectionFinding.inspection.id}`;
  }

  return "/actions";
}

function getWorkflowLink(
  entityType: WorkflowEntityType,
  entityId: string
) {
  switch (entityType) {
    case WorkflowEntityType.INCIDENT:
      return `/incidents/${entityId}`;

    case WorkflowEntityType.AUDIT:
      return `/audits/${entityId}`;

    case WorkflowEntityType.INSPECTION:
      return `/inspections/${entityId}`;

    case WorkflowEntityType.CORRECTIVE_ACTION:
      return "/actions";

    case WorkflowEntityType.COMPLIANCE:
      return "/compliance";

    case WorkflowEntityType.TRAINING:
      return "/training";

    default:
      return "/tasks";
  }
}

export async function getExecutiveReportData(
  input: ExecutiveReportFilters
): Promise<ExecutiveReportData> {
  if (
    input.from.getTime() >
    input.to.getTime()
  ) {
    throw new Error(
      "The report start date cannot be later than the report end date."
    );
  }

  const now = new Date();

  const selectedSite =
    input.siteId
      ? await prisma.site.findFirst({
          where: {
            id: input.siteId,
            organizationId:
              input.organizationId,
          },

          select: {
            id: true,
            name: true,
          },
        })
      : null;

  if (
    input.siteId &&
    !selectedSite
  ) {
    throw new Error(
      "The selected reporting site was not found in this organization."
    );
  }

  const siteWhere = {
    organizationId:
      input.organizationId,

    ...(selectedSite
      ? {
          id: selectedSite.id,
        }
      : {}),
  };

  const sites =
    await prisma.site.findMany({
      where: siteWhere,

      select: {
        id: true,
        name: true,
      },

      orderBy: {
        name: "asc",
      },
    });

  const siteIds =
    sites.map(
      (site) => site.id
    );

  const [
    incidents,
    investigations,
    correctiveActions,
    audits,
    inspections,
    workflowInstances,
    overdueWorkflowSteps,
    complianceItems,
    trainingRecords,
  ] = await Promise.all([
    prisma.incident.findMany({
      where: {
        siteId: {
          in: siteIds,
        },

        occurredAt: {
          gte: input.from,
          lte: input.to,
        },
      },

      select: {
        id: true,
        title: true,
        status: true,
        riskLevel: true,
        occurredAt: true,

        site: {
          select: {
            id: true,
            name: true,
          },
        },
      },

      orderBy: {
        occurredAt: "desc",
      },
    }),

    prisma.investigation.findMany({
      where: {
        incident: {
          siteId: {
            in: siteIds,
          },

          occurredAt: {
            gte: input.from,
            lte: input.to,
          },
        },
      },

      select: {
        id: true,
        status: true,
        dueDate: true,

        assignedTo: {
          select: {
            name: true,
          },
        },

        incident: {
          select: {
            id: true,
            title: true,

            site: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    }),

    prisma.correctiveAction.findMany({
      where: {
        createdAt: {
          gte: input.from,
          lte: input.to,
        },

        OR: [
          {
            incident: {
              siteId: {
                in: siteIds,
              },
            },
          },

          {
            auditFinding: {
              audit: {
                siteId: {
                  in: siteIds,
                },
              },
            },
          },

          {
            inspectionFinding: {
              inspection: {
                siteId: {
                  in: siteIds,
                },
              },
            },
          },

          ...(!selectedSite
            ? [
                {
                  incidentId:
                    null,
                  auditFindingId:
                    null,
                  inspectionFindingId:
                    null,

                  assignedTo: {
                    organizationId:
                      input.organizationId,
                  },
                },
              ]
            : []),
        ],
      },

      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        riskLevel: true,
        dueDate: true,
        createdAt: true,

        incidentId: true,
        auditFindingId: true,
        inspectionFindingId:
          true,

        assignedTo: {
          select: {
            name: true,
          },
        },

        incident: {
          select: {
            id: true,
            title: true,

            site: {
              select: {
                id: true,
                name: true,
              },
            },
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

                site: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
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

                site: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
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
    }),

    prisma.audit.findMany({
      where: {
        siteId: {
          in: siteIds,
        },

        createdAt: {
          gte: input.from,
          lte: input.to,
        },
      },

      select: {
        id: true,
        title: true,
        status: true,
        scheduledAt: true,
        completedAt: true,
        createdAt: true,

        site: {
          select: {
            id: true,
            name: true,
          },
        },

        leadAuditor: {
          select: {
            name: true,
          },
        },

        findings: {
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            riskLevel: true,
            dueDate: true,
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    }),

    prisma.inspection.findMany({
      where: {
        siteId: {
          in: siteIds,
        },

        createdAt: {
          gte: input.from,
          lte: input.to,
        },
      },

      select: {
        id: true,
        title: true,
        status: true,
        scheduledAt: true,
        dueDate: true,
        completedAt: true,
        createdAt: true,

        site: {
          select: {
            id: true,
            name: true,
          },
        },

        leadInspector: {
          select: {
            name: true,
          },
        },

        findings: {
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            riskLevel: true,
            dueDate: true,
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    }),

    prisma.workflowInstance.findMany({
      where: {
        organizationId:
          input.organizationId,

        createdAt: {
          gte: input.from,
          lte: input.to,
        },
      },

      select: {
        id: true,
        status: true,
        entityType: true,
        entityId: true,
      },
    }),

    prisma.workflowInstanceStep.findMany({
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

          createdAt: {
            gte: input.from,
            lte: input.to,
          },
        },
      },

      select: {
        id: true,
        name: true,
        dueAt: true,

        assignedUser: {
          select: {
            name: true,
          },
        },

        instance: {
          select: {
            entityType: true,
            entityId: true,
          },
        },
      },

      orderBy: {
        dueAt: "asc",
      },
    }),

    prisma.complianceItem.findMany({
        where: {
          siteId: {
            in: siteIds,
          },
      
          OR: [
            {
              createdAt: {
                gte: input.from,
                lte: input.to,
              },
            },
      
            {
              dueDate: {
                gte: input.from,
                lte: input.to,
              },
            },
          ],
        },
      
        select: {
          id: true,
          title: true,
          status: true,
          dueDate: true,
      
          site: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      
      prisma.trainingRecord.findMany({
        where: {
          user: {
            organizationId:
              input.organizationId,
          },
      
          createdAt: {
            gte: input.from,
            lte: input.to,
          },
        },
      
        select: {
          id: true,
          status: true,
        },
      }),
      ]);

  const activeIncidents =
    incidents.filter(
      (incident) =>
        !isClosedStatus(
          incident.status
        )
    );

  const highRiskIncidents =
    incidents.filter(
      (incident) =>
        incident.riskLevel ===
          RiskLevel.HIGH ||
        incident.riskLevel ===
          RiskLevel.CRITICAL
    );

  const activeInvestigations =
    investigations.filter(
      (investigation) =>
        !isClosedStatus(
          investigation.status
        )
    );

  const overdueInvestigations =
    activeInvestigations.filter(
      (investigation) =>
        Boolean(
          investigation.dueDate &&
            investigation.dueDate <
              now
        )
    );

  const openCorrectiveActions =
    correctiveActions.filter(
      (action) =>
        !isClosedStatus(
          action.status
        )
    );

  const completedCorrectiveActions =
    correctiveActions.filter(
      (action) =>
        isClosedStatus(
          action.status
        )
    );

  const overdueCorrectiveActions =
    openCorrectiveActions.filter(
      (action) =>
        action.status ===
          Status.OVERDUE ||
        action.dueDate < now
    );

  const highRiskCorrectiveActions =
    openCorrectiveActions.filter(
      (action) =>
        action.riskLevel ===
          RiskLevel.HIGH ||
        action.riskLevel ===
          RiskLevel.CRITICAL
    );

  const completedAudits =
    audits.filter(
      (audit) =>
        isClosedStatus(
          audit.status
        )
    );

  const overdueAudits =
    audits.filter(
      (audit) =>
        !isClosedStatus(
          audit.status
        ) &&
        Boolean(
          audit.scheduledAt &&
            audit.scheduledAt <
              now
        )
    );

  const openAuditFindings =
    audits.flatMap(
      (audit) =>
        audit.findings.filter(
          (finding) =>
            !isClosedStatus(
              finding.status
            )
        )
    );

  const completedInspections =
    inspections.filter(
      (inspection) =>
        isClosedStatus(
          inspection.status
        )
    );

  const overdueInspections =
    inspections.filter(
      (inspection) =>
        !isClosedStatus(
          inspection.status
        ) &&
        Boolean(
          inspection.dueDate &&
            inspection.dueDate <
              now
        )
    );

  const openInspectionFindings =
    inspections.flatMap(
      (inspection) =>
        inspection.findings.filter(
          (finding) =>
            !isClosedStatus(
              finding.status
            )
        )
    );

  const activeWorkflows =
    workflowInstances.filter(
      (workflow) =>
        workflow.status ===
        WorkflowInstanceStatus.ACTIVE
    );

  const overdueComplianceItems =
    complianceItems.filter(
      (item) =>
        !isClosedStatus(
          item.status
        ) &&
        item.dueDate < now
    );

  const completedTrainingRecords =
    trainingRecords.filter(
      (record) =>
        isClosedStatus(
          record.status
        )
    );

  const monthlyTrendMap =
    new Map<
      string,
      ExecutiveReportMonthlyTrendItem
    >();

  const firstMonth =
    startOfMonth(
      input.from
    );

  const lastMonth =
    startOfMonth(
      input.to
    );

  for (
    let currentMonth =
      firstMonth;
    currentMonth <=
    lastMonth;
    currentMonth = addMonths(
      currentMonth,
      1
    )
  ) {
    monthlyTrendMap.set(
      getMonthKey(
        currentMonth
      ),
      {
        month:
          getMonthLabel(
            currentMonth
          ),
        incidents: 0,
        audits: 0,
        inspections: 0,
        correctiveActions: 0,
      }
    );
  }

  for (
    const incident
    of incidents
  ) {
    const point =
      monthlyTrendMap.get(
        getMonthKey(
          incident.occurredAt
        )
      );

    if (point) {
      point.incidents += 1;
    }
  }

  for (const audit of audits) {
    const point =
      monthlyTrendMap.get(
        getMonthKey(
          audit.createdAt
        )
      );

    if (point) {
      point.audits += 1;
    }
  }

  for (
    const inspection
    of inspections
  ) {
    const point =
      monthlyTrendMap.get(
        getMonthKey(
          inspection.createdAt
        )
      );

    if (point) {
      point.inspections += 1;
    }
  }

  for (
    const action
    of correctiveActions
  ) {
    const point =
      monthlyTrendMap.get(
        getMonthKey(
          action.createdAt
        )
      );

    if (point) {
      point.correctiveActions +=
        1;
    }
  }

  const sitePerformanceMap =
    new Map<
      string,
      ExecutiveReportSitePerformanceItem
    >();

  for (const site of sites) {
    sitePerformanceMap.set(
      site.id,
      {
        siteId: site.id,
        siteName: site.name,
        incidents: 0,
        openIncidents: 0,
        highRiskIncidents: 0,
        audits: 0,
        inspections: 0,
        openCorrectiveActions: 0,
        overdueCorrectiveActions: 0,
        exposureScore: 0,
      }
    );
  }

  for (
    const incident
    of incidents
  ) {
    const site =
      sitePerformanceMap.get(
        incident.site.id
      );

    if (!site) {
      continue;
    }

    site.incidents += 1;

    if (
      !isClosedStatus(
        incident.status
      )
    ) {
      site.openIncidents += 1;
    }

    if (
      incident.riskLevel ===
        RiskLevel.HIGH ||
      incident.riskLevel ===
        RiskLevel.CRITICAL
    ) {
      site.highRiskIncidents +=
        1;
    }
  }

  for (const audit of audits) {
    const site =
      sitePerformanceMap.get(
        audit.site.id
      );

    if (site) {
      site.audits += 1;
    }
  }

  for (
    const inspection
    of inspections
  ) {
    const site =
      sitePerformanceMap.get(
        inspection.site.id
      );

    if (site) {
      site.inspections += 1;
    }
  }

  for (
    const action
    of correctiveActions
  ) {
    const sourceSite =
      getCorrectiveActionSite(
        action
      );

    if (!sourceSite) {
      continue;
    }

    const site =
      sitePerformanceMap.get(
        sourceSite.id
      );

    if (!site) {
      continue;
    }

    if (
      !isClosedStatus(
        action.status
      )
    ) {
      site.openCorrectiveActions +=
        1;
    }

    if (
      !isClosedStatus(
        action.status
      ) &&
      (action.status ===
        Status.OVERDUE ||
        action.dueDate < now)
    ) {
      site.overdueCorrectiveActions +=
        1;
    }
  }

  for (
    const site
    of sitePerformanceMap.values()
  ) {
    site.exposureScore =
      site.highRiskIncidents *
        5 +
      site.overdueCorrectiveActions *
        4 +
      site.openCorrectiveActions *
        2 +
      site.openIncidents *
        2 +
      site.incidents;
  }

  const managementAttention:
    ExecutiveReportAttentionItem[] =
    [];

  for (
    const incident
    of activeIncidents
  ) {
    if (
      incident.riskLevel !==
        RiskLevel.HIGH &&
      incident.riskLevel !==
        RiskLevel.CRITICAL
    ) {
      continue;
    }

    managementAttention.push({
      id: incident.id,
      type: "INCIDENT",
      title: incident.title,
      description:
        `${incident.riskLevel} incident remains ` +
        `${incident.status
          .replaceAll(
            "_",
            " "
          )
          .toLowerCase()}.`,
      riskLevel:
        incident.riskLevel,
      status: incident.status,
      dueDate: null,
      siteName:
        incident.site.name,
      ownerName: null,
      link:
        `/incidents/${incident.id}`,
    });
  }

  for (
    const investigation
    of overdueInvestigations
  ) {
    managementAttention.push({
      id: investigation.id,
      type: "INVESTIGATION",
      title:
        investigation.incident
          .title,
      description:
        "Incident investigation is overdue.",
      riskLevel: null,
      status:
        investigation.status,
      dueDate:
        investigation.dueDate,
      siteName:
        investigation.incident
          .site.name,
      ownerName:
        investigation.assignedTo
          ?.name ?? null,
      link:
        `/incidents/${investigation.incident.id}`,
    });
  }

  for (
    const action
    of correctiveActions
  ) {
    const isOverdue =
      !isClosedStatus(
        action.status
      ) &&
      (action.status ===
        Status.OVERDUE ||
        action.dueDate < now);

    const isHighRisk =
      !isClosedStatus(
        action.status
      ) &&
      (action.riskLevel ===
        RiskLevel.HIGH ||
        action.riskLevel ===
          RiskLevel.CRITICAL);

    if (
      !isOverdue &&
      !isHighRisk
    ) {
      continue;
    }

    const sourceSite =
      getCorrectiveActionSite(
        action
      );

    managementAttention.push({
      id: action.id,
      type:
        "CORRECTIVE_ACTION",
      title: action.title,
      description: isOverdue
        ? "Corrective action is overdue."
        : "High-risk corrective action remains unresolved.",
      riskLevel:
        action.riskLevel,
      status: action.status,
      dueDate:
        action.dueDate,
      siteName:
        sourceSite?.name ??
        null,
      ownerName:
        action.assignedTo.name,
      link:
        getCorrectiveActionLink(
          action
        ),
    });
  }

  for (
    const audit
    of overdueAudits
  ) {
    managementAttention.push({
      id: audit.id,
      type: "AUDIT",
      title: audit.title,
      description:
        "Audit remains incomplete after its scheduled date.",
      riskLevel: null,
      status: audit.status,
      dueDate:
        audit.scheduledAt,
      siteName:
        audit.site.name,
      ownerName:
        audit.leadAuditor
          ?.name ?? null,
      link:
        `/audits/${audit.id}`,
    });
  }

  for (const audit of audits) {
    for (
      const finding
      of audit.findings
    ) {
      if (
        isClosedStatus(
          finding.status
        )
      ) {
        continue;
      }

      const isOverdue =
        Boolean(
          finding.dueDate &&
            finding.dueDate <
              now
        );

      const isHighRisk =
        finding.riskLevel ===
          RiskLevel.HIGH ||
        finding.riskLevel ===
          RiskLevel.CRITICAL;

      if (
        !isOverdue &&
        !isHighRisk
      ) {
        continue;
      }

      managementAttention.push({
        id: finding.id,
        type:
          "AUDIT_FINDING",
        title: finding.title,
        description: isOverdue
          ? "Audit finding is overdue."
          : "High-risk audit finding remains unresolved.",
        riskLevel:
          finding.riskLevel,
        status:
          finding.status,
        dueDate:
          finding.dueDate,
        siteName:
          audit.site.name,
        ownerName:
          audit.leadAuditor
            ?.name ?? null,
        link:
          `/audits/${audit.id}`,
      });
    }
  }

  for (
    const inspection
    of overdueInspections
  ) {
    managementAttention.push({
      id: inspection.id,
      type: "INSPECTION",
      title:
        inspection.title,
      description:
        "Inspection remains incomplete after its due date.",
      riskLevel: null,
      status:
        inspection.status,
      dueDate:
        inspection.dueDate,
      siteName:
        inspection.site.name,
      ownerName:
        inspection.leadInspector
          ?.name ?? null,
      link:
        `/inspections/${inspection.id}`,
    });
  }

  for (
    const inspection
    of inspections
  ) {
    for (
      const finding
      of inspection.findings
    ) {
      if (
        isClosedStatus(
          finding.status
        )
      ) {
        continue;
      }

      const isOverdue =
        Boolean(
          finding.dueDate &&
            finding.dueDate <
              now
        );

      const isHighRisk =
        finding.riskLevel ===
          RiskLevel.HIGH ||
        finding.riskLevel ===
          RiskLevel.CRITICAL;

      if (
        !isOverdue &&
        !isHighRisk
      ) {
        continue;
      }

      managementAttention.push({
        id: finding.id,
        type:
          "INSPECTION_FINDING",
        title: finding.title,
        description: isOverdue
          ? "Inspection finding is overdue."
          : "High-risk inspection finding remains unresolved.",
        riskLevel:
          finding.riskLevel,
        status:
          finding.status,
        dueDate:
          finding.dueDate,
        siteName:
          inspection.site.name,
        ownerName:
          inspection.leadInspector
            ?.name ?? null,
        link:
          `/inspections/${inspection.id}`,
      });
    }
  }

  for (
    const workflowStep
    of overdueWorkflowSteps
  ) {
    managementAttention.push({
      id: workflowStep.id,
      type: "WORKFLOW",
      title:
        workflowStep.name,
      description:
        `${workflowStep.instance.entityType
          .replaceAll(
            "_",
            " "
          )} workflow step is overdue.`,
      riskLevel: null,
      status:
        WorkflowStepStatus.IN_PROGRESS,
      dueDate:
        workflowStep.dueAt,
      siteName: null,
      ownerName:
        workflowStep.assignedUser
          ?.name ?? null,
      link:
        getWorkflowLink(
          workflowStep.instance
            .entityType,
          workflowStep.instance
            .entityId
        ),
    });
  }

  for (
    const complianceItem
    of overdueComplianceItems
  ) {
    managementAttention.push({
      id: complianceItem.id,
      type: "COMPLIANCE",
      title:
        complianceItem.title,
      description:
        "Compliance obligation is overdue.",
      riskLevel: null,
      status:
        complianceItem.status,
      dueDate:
        complianceItem.dueDate,
      siteName:
        complianceItem.site.name,
      ownerName: null,
      link: "/compliance",
    });
  }

  managementAttention.sort(
    (
      firstItem,
      secondItem
    ) => {
      const riskWeight = (
        riskLevel:
          | RiskLevel
          | null
      ) => {
        switch (riskLevel) {
          case RiskLevel.CRITICAL:
            return 4;

          case RiskLevel.HIGH:
            return 3;

          case RiskLevel.MEDIUM:
            return 2;

          case RiskLevel.LOW:
            return 1;

          default:
            return 0;
        }
      };

      const riskDifference =
        riskWeight(
          secondItem.riskLevel
        ) -
        riskWeight(
          firstItem.riskLevel
        );

      if (
        riskDifference !== 0
      ) {
        return riskDifference;
      }

      return (
        (firstItem.dueDate
          ?.getTime() ??
          Number.MAX_SAFE_INTEGER) -
        (secondItem.dueDate
          ?.getTime() ??
          Number.MAX_SAFE_INTEGER)
      );
    }
  );

  const report: ExecutiveReportData =
    {
      generatedAt: now,

      filters: {
        from: input.from,
        to: input.to,
        siteId:
          selectedSite?.id ??
          null,
        siteName:
          selectedSite?.name ??
          null,
      },

      summary: {
        totalIncidents:
          incidents.length,

        openIncidents:
          activeIncidents.length,

        highRiskIncidents:
          highRiskIncidents.length,

        totalInvestigations:
          investigations.length,

        openInvestigations:
          activeInvestigations.length,

        overdueInvestigations:
          overdueInvestigations.length,

        totalCorrectiveActions:
          correctiveActions.length,

        openCorrectiveActions:
          openCorrectiveActions.length,

        overdueCorrectiveActions:
          overdueCorrectiveActions.length,

        highRiskCorrectiveActions:
          highRiskCorrectiveActions.length,

        correctiveActionClosureRate:
          calculatePercentage(
            completedCorrectiveActions.length,
            correctiveActions.length
          ),

        totalAudits:
          audits.length,

        completedAudits:
          completedAudits.length,

        overdueAudits:
          overdueAudits.length,

        auditCompletionRate:
          calculatePercentage(
            completedAudits.length,
            audits.length
          ),

        openAuditFindings:
          openAuditFindings.length,

        totalInspections:
          inspections.length,

        completedInspections:
          completedInspections.length,

        overdueInspections:
          overdueInspections.length,

        inspectionCompletionRate:
          calculatePercentage(
            completedInspections.length,
            inspections.length
          ),

        openInspectionFindings:
          openInspectionFindings.length,

        activeWorkflows:
          activeWorkflows.length,

        overdueWorkflowSteps:
          overdueWorkflowSteps.length,

        totalComplianceItems:
          complianceItems.length,

        overdueComplianceItems:
          overdueComplianceItems.length,

        totalTrainingRecords:
          trainingRecords.length,

        completedTrainingRecords:
          completedTrainingRecords.length,

        trainingCompletionRate:
          calculatePercentage(
            completedTrainingRecords.length,
            trainingRecords.length
          ),

        totalOverdueExposure:
          overdueInvestigations.length +
          overdueCorrectiveActions.length +
          overdueAudits.length +
          overdueInspections.length +
          overdueWorkflowSteps.length +
          overdueComplianceItems.length +
          openAuditFindings.filter(
            (finding) =>
              Boolean(
                finding.dueDate &&
                  finding.dueDate <
                    now
              )
          ).length +
          openInspectionFindings.filter(
            (finding) =>
              Boolean(
                finding.dueDate &&
                  finding.dueDate <
                    now
              )
          ).length,
      },

      monthlyTrend:
        Array.from(
          monthlyTrendMap.values()
        ),

      incidentRiskDistribution:
        createDistribution(
          incidents.map(
            (incident) =>
              incident.riskLevel
          ),
          [
            RiskLevel.CRITICAL,
            RiskLevel.HIGH,
            RiskLevel.MEDIUM,
            RiskLevel.LOW,
          ]
        ),

      incidentStatusDistribution:
        createDistribution(
          incidents.map(
            (incident) =>
              incident.status
          ),
          [
            Status.OPEN,
            Status.IN_PROGRESS,
            Status.OVERDUE,
            Status.COMPLETED,
            Status.CLOSED,
          ]
        ),

      correctiveActionStatusDistribution:
        createDistribution(
          correctiveActions.map(
            (action) =>
              action.status
          ),
          [
            Status.OPEN,
            Status.IN_PROGRESS,
            Status.OVERDUE,
            Status.COMPLETED,
            Status.CLOSED,
          ]
        ),

      correctiveActionRiskDistribution:
        createDistribution(
          correctiveActions.map(
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

      correctiveActionSourceDistribution:
        createDistribution(
          correctiveActions.map(
            (action) =>
              getCorrectiveActionSource(
                action
              )
          ),
          [
            "INCIDENT",
            "AUDIT",
            "INSPECTION",
            "OTHER",
          ]
        ),

      auditStatusDistribution:
        createDistribution(
          audits.map(
            (audit) =>
              audit.status
          ),
          [
            Status.OPEN,
            Status.IN_PROGRESS,
            Status.OVERDUE,
            Status.COMPLETED,
            Status.CLOSED,
          ]
        ),

      inspectionStatusDistribution:
        createDistribution(
          inspections.map(
            (inspection) =>
              inspection.status
          ),
          [
            Status.OPEN,
            Status.IN_PROGRESS,
            Status.OVERDUE,
            Status.COMPLETED,
            Status.CLOSED,
          ]
        ),

      sitePerformance:
        Array.from(
          sitePerformanceMap.values()
        ).sort(
          (
            firstSite,
            secondSite
          ) =>
            secondSite.exposureScore -
            firstSite.exposureScore
        ),

      managementAttention:
        managementAttention.slice(
          0,
          40
        ),
    };

  await logActivity({
    organizationId:
      input.organizationId,
    userId: input.userId,
    action:
      ActivityAction.SYSTEM,
    entityType:
      "ExecutiveReport",
    entityId: null,
    title:
      "Executive report generated",
    description:
      "An executive EHS performance report was generated.",
    metadata: {
      from:
        input.from.toISOString(),
      to:
        input.to.toISOString(),
      siteId:
        selectedSite?.id ??
        null,
      siteName:
        selectedSite?.name ??
        null,
      incidentCount:
        report.summary
          .totalIncidents,
      correctiveActionCount:
        report.summary
          .totalCorrectiveActions,
      auditCount:
        report.summary
          .totalAudits,
      inspectionCount:
        report.summary
          .totalInspections,
      managementAttentionCount:
        report
          .managementAttention
          .length,
      generatedAt:
        report.generatedAt.toISOString(),
    },
  });

  return report;
}