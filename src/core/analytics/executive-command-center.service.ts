import { prisma } from "@/lib/prisma";
import {
  getPerformanceWorkspace,
  parsePerformanceFilters,
} from "@/modules/performance/performance-scorecard.service";
import { getOperationalAssuranceOverview } from "@/modules/assurance/operational-assurance.service";
import {
  getWorkflowProcessIntelligence,
  parseWorkflowProcessFilters,
} from "@/core/workflow/workflow-process-intelligence.service";
import {
  getGlobalExecutivePortfolio,
} from "@/core/analytics/global-executive-dashboard.service";
import {
  AiIntelligenceStatus,
  AiIntelligenceUseCase,
  EnterpriseAuditStatus,
  PermissionKey,
  Prisma,
  RiskLevel,
  RiskStatus,
  Status,
} from "@prisma/client";

const allowedRanges = new Set([30, 90, 180, 365]);
const idPattern = /^[A-Za-z0-9_-]{1,100}$/;
const completedStatuses = new Set<string>([Status.COMPLETED, Status.CLOSED]);
const completedAuditStatuses = new Set<string>([
  EnterpriseAuditStatus.COMPLETED,
  EnterpriseAuditStatus.CLOSED,
]);
const elevatedRiskLevels: RiskLevel[] = [RiskLevel.HIGH, RiskLevel.CRITICAL];
const openRiskStatuses = [
  RiskStatus.DRAFT,
  RiskStatus.ACTIVE,
  RiskStatus.UNDER_REVIEW,
  RiskStatus.TREATMENT_REQUIRED,
  RiskStatus.ACCEPTED,
];
const capaPermissions = [
  PermissionKey.CREATE_CAPA,
  PermissionKey.UPDATE_CAPA,
  PermissionKey.CLOSE_CAPA,
  PermissionKey.VIEW_REPORTS,
] as const;

export type ExecutiveDashboardFilters = {
  days: number;
  siteId: string | null;
  departmentId: string | null;
  from: Date;
  to: Date;
};

export function parseExecutiveDashboardFilters(
  input: {
    days?: string;
    siteId?: string;
    departmentId?: string;
  },
  now = new Date(),
): ExecutiveDashboardFilters {
  const requestedDays = Number(input.days);
  const days = allowedRanges.has(requestedDays) ? requestedDays : 90;
  const safeId = (value?: string) => {
    const normalized = value?.trim() ?? "";
    return idPattern.test(normalized) ? normalized : null;
  };
  const to = new Date(now);
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - days);

  return {
    days,
    siteId: safeId(input.siteId),
    departmentId: safeId(input.departmentId),
    from,
    to,
  };
}

function percentage(numerator: number, denominator: number) {
  return denominator ? Math.round((numerator / denominator) * 100) : null;
}

function monthKey(value: Date) {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(value: Date) {
  return value.toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

function latestDate(values: Date[]) {
  return values.length
    ? new Date(Math.max(...values.map((value) => value.getTime())))
    : null;
}

function csvCell(value: string | number | null) {
  const normalized = value === null ? "" : String(value);
  return `"${normalized.replaceAll('"', '""').replace(/^[=+\-@]/, "'$&")}"`;
}

export async function getExecutiveCommandCenter(input: {
  organizationId: string;
  userId: string;
  permissions: PermissionKey[];
  filters: ExecutiveDashboardFilters;
}) {
  const allowed = new Set(input.permissions);
  const canViewCapa = capaPermissions.some((permission) => allowed.has(permission));
  const now = new Date();
  const [sites, departments] = await Promise.all([
    prisma.site.findMany({
      where: { organizationId: input.organizationId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.department.findMany({
      where: { site: { organizationId: input.organizationId } },
      select: {
        id: true,
        name: true,
        siteId: true,
        site: { select: { name: true } },
      },
      orderBy: [{ site: { name: "asc" } }, { name: "asc" }],
    }),
  ]);
  const selectedDepartment =
    departments.find((department) => department.id === input.filters.departmentId) ??
    null;
  const requestedSiteId = selectedDepartment?.siteId ?? input.filters.siteId;
  const selectedSite = sites.find((site) => site.id === requestedSiteId) ?? null;
  const scope = {
    siteId: selectedSite?.id ?? null,
    departmentId: selectedDepartment?.id ?? null,
    label: selectedDepartment
      ? `${selectedDepartment.site.name} · ${selectedDepartment.name}`
      : selectedSite?.name ?? "Enterprise",
  };
  const filters = {
    ...input.filters,
    siteId: scope.siteId,
    departmentId: scope.departmentId,
  };
  const incidentWhere: Prisma.IncidentWhereInput = {
    site: { organizationId: input.organizationId },
    ...(scope.siteId ? { siteId: scope.siteId } : {}),
    occurredAt: { gte: filters.from, lte: filters.to },
  };
  const observationWhere: Prisma.SafetyObservationWhereInput = {
    organizationId: input.organizationId,
    ...(scope.siteId ? { siteId: scope.siteId } : {}),
    ...(scope.departmentId ? { departmentId: scope.departmentId } : {}),
    observedAt: { gte: filters.from, lte: filters.to },
  };
  const auditWhere: Prisma.EnterpriseAuditWhereInput = {
    organizationId: input.organizationId,
    ...(scope.siteId ? { siteId: scope.siteId } : {}),
    ...(scope.departmentId ? { departmentId: scope.departmentId } : {}),
    createdAt: { gte: filters.from, lte: filters.to },
  };
  const inspectionWhere: Prisma.InspectionWhereInput = {
    site: { organizationId: input.organizationId },
    ...(scope.siteId ? { siteId: scope.siteId } : {}),
    createdAt: { gte: filters.from, lte: filters.to },
  };
  const trainingWhere: Prisma.TrainingRecordWhereInput = {
    user: {
      organizationId: input.organizationId,
      ...(scope.departmentId
        ? { departmentId: scope.departmentId }
        : scope.siteId
          ? { department: { siteId: scope.siteId } }
          : {}),
    },
    assignedAt: { gte: filters.from, lte: filters.to },
  };
  const riskWhere: Prisma.RiskWhereInput = {
    organizationId: input.organizationId,
    status: { in: openRiskStatuses },
    ...(scope.siteId ? { siteId: scope.siteId } : {}),
    ...(scope.departmentId ? { departmentId: scope.departmentId } : {}),
  };
  const organizationActionScope: Prisma.CorrectiveActionWhereInput = {
    OR: [
      { assignedTo: { organizationId: input.organizationId } },
      { incident: { site: { organizationId: input.organizationId } } },
      { auditFinding: { audit: { site: { organizationId: input.organizationId } } } },
      { inspectionFinding: { inspection: { site: { organizationId: input.organizationId } } } },
      {
        enterpriseAuditFindingLinks: {
          some: { finding: { organizationId: input.organizationId } },
        },
      },
    ],
  };
  const siteActionScope: Prisma.CorrectiveActionWhereInput | null = scope.siteId
    ? {
        OR: [
          { assignedTo: { department: { siteId: scope.siteId } } },
          { incident: { siteId: scope.siteId } },
          { auditFinding: { audit: { siteId: scope.siteId } } },
          { inspectionFinding: { inspection: { siteId: scope.siteId } } },
          {
            enterpriseAuditFindingLinks: {
              some: { finding: { audit: { siteId: scope.siteId } } },
            },
          },
        ],
      }
    : null;
  const departmentActionScope: Prisma.CorrectiveActionWhereInput | null =
    scope.departmentId
      ? {
          OR: [
            { assignedTo: { departmentId: scope.departmentId } },
            {
              enterpriseAuditFindingLinks: {
                some: { finding: { audit: { departmentId: scope.departmentId } } },
              },
            },
          ],
        }
      : null;
  const actionWhere: Prisma.CorrectiveActionWhereInput = {
    AND: [
      organizationActionScope,
      departmentActionScope ?? siteActionScope ?? {},
    ],
  };

  const [
    portfolio,
    assurance,
    incidents,
    observations,
    actions,
    audits,
    inspections,
    trainingRecords,
    risks,
    complianceItems,
    performance,
    workflow,
    latestAiBriefing,
    predictiveSignals,
    executiveReviews,
  ] = await Promise.all([
    getGlobalExecutivePortfolio(input.organizationId, input.permissions),
    getOperationalAssuranceOverview({
      organizationId: input.organizationId,
      permissions: input.permissions,
      limit: 12,
    }),
    allowed.has(PermissionKey.VIEW_INCIDENT)
      ? prisma.incident.findMany({
          where: incidentWhere,
          select: {
            id: true,
            title: true,
            status: true,
            riskLevel: true,
            occurredAt: true,
            updatedAt: true,
            site: { select: { name: true } },
          },
          orderBy: { occurredAt: "desc" },
        })
      : [],
    allowed.has(PermissionKey.VIEW_OBSERVATIONS)
      ? prisma.safetyObservation.findMany({
          where: observationWhere,
          select: {
            id: true,
            status: true,
            riskLevel: true,
            observedAt: true,
            updatedAt: true,
          },
          orderBy: { observedAt: "desc" },
        })
      : [],
    canViewCapa
      ? prisma.correctiveAction.findMany({
          where: actionWhere,
          select: {
            id: true,
            title: true,
            status: true,
            riskLevel: true,
            dueDate: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { dueDate: "asc" },
        })
      : [],
    allowed.has(PermissionKey.VIEW_AUDITS)
      ? prisma.enterpriseAudit.findMany({
          where: auditWhere,
          select: {
            id: true,
            status: true,
            dueDate: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { createdAt: "desc" },
        })
      : [],
    allowed.has(PermissionKey.VIEW_INSPECTIONS) && !scope.departmentId
      ? prisma.inspection.findMany({
          where: inspectionWhere,
          select: {
            id: true,
            status: true,
            dueDate: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { createdAt: "desc" },
        })
      : [],
    allowed.has(PermissionKey.VIEW_TRAINING)
      ? prisma.trainingRecord.findMany({
          where: trainingWhere,
          select: {
            id: true,
            status: true,
            dueDate: true,
            assignedAt: true,
            updatedAt: true,
          },
          orderBy: { assignedAt: "desc" },
        })
      : [],
    allowed.has(PermissionKey.VIEW_RISKS)
      ? prisma.risk.findMany({
          where: riskWhere,
          select: {
            id: true,
            currentRiskLevel: true,
            nextReviewDate: true,
            updatedAt: true,
          },
          orderBy: { currentScore: "desc" },
        })
      : [],
    allowed.has(PermissionKey.VIEW_COMPLIANCE) && !scope.departmentId
      ? prisma.complianceItem.findMany({
          where: {
            site: { organizationId: input.organizationId },
            ...(scope.siteId ? { siteId: scope.siteId } : {}),
            createdAt: { gte: filters.from, lte: filters.to },
          },
          select: {
            id: true,
            status: true,
            dueDate: true,
            updatedAt: true,
          },
        })
      : [],
    allowed.has(PermissionKey.VIEW_PERFORMANCE_SCORECARDS)
      ? getPerformanceWorkspace({
          organizationId: input.organizationId,
          filters: parsePerformanceFilters({
            days: String(filters.days),
            siteId: scope.siteId ?? undefined,
            departmentId: scope.departmentId ?? undefined,
          }, filters.to),
        })
      : null,
    allowed.has(PermissionKey.MANAGE_WORKFLOWS)
      ? getWorkflowProcessIntelligence({
          organizationId: input.organizationId,
          filters: parseWorkflowProcessFilters(
            { days: String(filters.days) },
            filters.to,
          ),
        })
      : null,
    allowed.has(PermissionKey.USE_AI)
      ? prisma.aiIntelligenceAnalysis.findFirst({
          where: {
            organizationId: input.organizationId,
            useCase: {
              in: [
                AiIntelligenceUseCase.DAILY_BRIEFING,
                AiIntelligenceUseCase.EXECUTIVE_RISK,
              ],
            },
            status: {
              in: [
                AiIntelligenceStatus.APPROVED,
                AiIntelligenceStatus.PENDING_REVIEW,
              ],
            },
          },
          select: {
            id: true,
            title: true,
            status: true,
            executiveSummary: true,
            confidence: true,
            createdAt: true,
            reviewedAt: true,
            _count: { select: { sources: true } },
          },
          orderBy: { createdAt: "desc" },
        })
      : null,
    allowed.has(PermissionKey.VIEW_PREDICTIVE_INTELLIGENCE)
      ? prisma.predictiveSignal.findMany({
          where: {
            organizationId: input.organizationId,
            conditionActive: true,
            ...(scope.siteId ? { siteId: scope.siteId } : {}),
            ...(scope.departmentId ? { departmentId: scope.departmentId } : {}),
          },
          select: {
            id: true,
            severity: true,
            attentionScore: true,
            updatedAt: true,
          },
          orderBy: { attentionScore: "desc" },
        })
      : [],
    allowed.has(PermissionKey.VIEW_EXECUTIVE_REVIEWS) && !scope.departmentId
      ? prisma.executiveManagementReview.findMany({
          where: {
            organizationId: input.organizationId,
            status: {
              in: ["DRAFT", "SCHEDULED", "IN_PROGRESS", "COMPLETED"],
            },
            ...(scope.siteId
              ? { OR: [{ siteId: scope.siteId }, { siteId: null }] }
              : {}),
          },
          select: {
            id: true,
            status: true,
            scheduledAt: true,
            updatedAt: true,
          },
        })
      : [],
  ]);

  const openActions = actions.filter((action) => !completedStatuses.has(action.status));
  const overdueActions = openActions.filter(
    (action) => action.status === Status.OVERDUE || action.dueDate < now,
  );
  const completedAudits = audits.filter((audit) =>
    completedAuditStatuses.has(audit.status),
  );
  const completedInspections = inspections.filter((inspection) =>
    completedStatuses.has(inspection.status),
  );
  const completedTraining = trainingRecords.filter((record) =>
    completedStatuses.has(record.status),
  );
  const highRisks = risks.filter((risk) =>
    elevatedRiskLevels.includes(risk.currentRiskLevel),
  );
  const overdueRiskReviews = risks.filter(
    (risk) => risk.nextReviewDate && risk.nextReviewDate < now,
  );
  const overdueCompliance = complianceItems.filter(
    (item) => !completedStatuses.has(item.status) && item.dueDate < now,
  );

  const headline = [
    allowed.has(PermissionKey.VIEW_INCIDENT)
      ? {
          key: "incidents",
          label: "High-risk incidents",
          value: incidents.filter((incident) =>
            elevatedRiskLevels.includes(incident.riskLevel),
          ).length,
          note: `${incidents.length} reported in ${filters.days} days`,
          href: "/incidents",
          tone: "danger" as const,
        }
      : null,
    canViewCapa
      ? {
          key: "actions",
          label: "Overdue actions",
          value: overdueActions.length,
          note: `${openActions.length} open across connected sources`,
          href: "/actions",
          tone: "danger" as const,
        }
      : null,
    allowed.has(PermissionKey.VIEW_AUDITS)
      ? {
          key: "audits",
          label: "Audit completion",
          value: percentage(completedAudits.length, audits.length),
          suffix: "%",
          note: `${completedAudits.length} of ${audits.length} completed`,
          href: "/audits/dashboard",
          tone: "performance" as const,
        }
      : null,
    allowed.has(PermissionKey.VIEW_INSPECTIONS) && !scope.departmentId
      ? {
          key: "inspections",
          label: "Inspection completion",
          value: percentage(completedInspections.length, inspections.length),
          suffix: "%",
          note: `${completedInspections.length} of ${inspections.length} completed`,
          href: "/inspections",
          tone: "performance" as const,
        }
      : null,
    allowed.has(PermissionKey.VIEW_TRAINING)
      ? {
          key: "training",
          label: "Training completion",
          value: percentage(completedTraining.length, trainingRecords.length),
          suffix: "%",
          note: `${completedTraining.length} of ${trainingRecords.length} assignments`,
          href: "/training/dashboard",
          tone: "performance" as const,
        }
      : null,
    allowed.has(PermissionKey.VIEW_RISKS)
      ? {
          key: "risk",
          label: "High-risk exposure",
          value: highRisks.length,
          note: `${overdueRiskReviews.length} reviews overdue`,
          href: "/risks/dashboard",
          tone: "danger" as const,
        }
      : null,
    performance
      ? {
          key: "scorecards",
          label: "Scorecard attainment",
          value: performance.summary.averageAttainment,
          suffix: "%",
          note: `${performance.summary.attentionRequired} indicators need attention`,
          href: "/performance",
          tone: "performance" as const,
        }
      : null,
    workflow
      ? {
          key: "workflow",
          label: "Workflow SLA adherence",
          value: workflow.summary.slaAdherenceRate,
          suffix: "%",
          note: `${workflow.summary.overdueActiveSteps} active steps overdue`,
          href: "/workflows/analytics",
          tone: "performance" as const,
        }
      : null,
    allowed.has(PermissionKey.VIEW_PREDICTIVE_INTELLIGENCE)
      ? {
          key: "predictive",
          label: "Predictive signals",
          value: predictiveSignals.length,
          note: `${predictiveSignals.filter((signal) => elevatedRiskLevels.includes(signal.severity)).length} high or critical`,
          href: "/intelligence/predictive",
          tone: "danger" as const,
        }
      : null,
    allowed.has(PermissionKey.VIEW_EXECUTIVE_REVIEWS) && !scope.departmentId
      ? {
          key: "managementReviews",
          label: "Review governance",
          value: executiveReviews.filter(
            (review) =>
              review.status === "COMPLETED" ||
              ((review.status === "DRAFT" || review.status === "SCHEDULED") &&
                review.scheduledAt < now),
          ).length,
          note: `${executiveReviews.filter((review) => review.status === "COMPLETED").length} awaiting approval · ${executiveReviews.length} active`,
          href: "/management-reviews",
          tone: "danger" as const,
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  const firstMonth = new Date(
    Date.UTC(filters.from.getUTCFullYear(), filters.from.getUTCMonth(), 1),
  );
  const lastMonth = new Date(
    Date.UTC(filters.to.getUTCFullYear(), filters.to.getUTCMonth(), 1),
  );
  const monthly = new Map<
    string,
    {
      month: string;
      incidents: number;
      observations: number;
      audits: number;
      inspections: number;
      actions: number;
    }
  >();
  for (
    let cursor = firstMonth;
    cursor <= lastMonth;
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
  ) {
    monthly.set(monthKey(cursor), {
      month: monthLabel(cursor),
      incidents: 0,
      observations: 0,
      audits: 0,
      inspections: 0,
      actions: 0,
    });
  }
  for (const incident of incidents) {
    const point = monthly.get(monthKey(incident.occurredAt));
    if (point) point.incidents += 1;
  }
  for (const observation of observations) {
    const point = monthly.get(monthKey(observation.observedAt));
    if (point) point.observations += 1;
  }
  for (const audit of audits) {
    const point = monthly.get(monthKey(audit.createdAt));
    if (point) point.audits += 1;
  }
  for (const inspection of inspections) {
    const point = monthly.get(monthKey(inspection.createdAt));
    if (point) point.inspections += 1;
  }
  for (const action of actions) {
    if (action.createdAt < filters.from || action.createdAt > filters.to) continue;
    const point = monthly.get(monthKey(action.createdAt));
    if (point) point.actions += 1;
  }

  const freshness = [
    allowed.has(PermissionKey.VIEW_INCIDENT)
      ? {
          domain: "Incidents",
          recordCount: incidents.length,
          latestAt: latestDate(incidents.map((row) => row.updatedAt)),
          provenance: "Incident records in the selected site and reporting window.",
        }
      : null,
    allowed.has(PermissionKey.VIEW_OBSERVATIONS)
      ? {
          domain: "Observations",
          recordCount: observations.length,
          latestAt: latestDate(observations.map((row) => row.updatedAt)),
          provenance: "Observation records support site and department scope.",
        }
      : null,
    canViewCapa
      ? {
          domain: "Corrective actions",
          recordCount: actions.length,
          latestAt: latestDate(actions.map((row) => row.updatedAt)),
          provenance: "Connected action sources plus tenant-authorized assignee scope.",
        }
      : null,
    allowed.has(PermissionKey.VIEW_AUDITS)
      ? {
          domain: "Audits",
          recordCount: audits.length,
          latestAt: latestDate(audits.map((row) => row.updatedAt)),
          provenance: "Enterprise Audit 2.0 records in the selected scope and window.",
        }
      : null,
    allowed.has(PermissionKey.VIEW_INSPECTIONS) && !scope.departmentId
      ? {
          domain: "Inspections",
          recordCount: inspections.length,
          latestAt: latestDate(inspections.map((row) => row.updatedAt)),
          provenance: "Inspection data is governed at site level.",
        }
      : null,
    allowed.has(PermissionKey.VIEW_TRAINING)
      ? {
          domain: "Training",
          recordCount: trainingRecords.length,
          latestAt: latestDate(trainingRecords.map((row) => row.updatedAt)),
          provenance: "Training assignments follow the learner's department.",
        }
      : null,
    allowed.has(PermissionKey.VIEW_RISKS)
      ? {
          domain: "Risk register",
          recordCount: risks.length,
          latestAt: latestDate(risks.map((row) => row.updatedAt)),
          provenance: "Current open risks for the selected organizational scope.",
        }
      : null,
    allowed.has(PermissionKey.VIEW_COMPLIANCE) && !scope.departmentId
      ? {
          domain: "Compliance",
          recordCount: complianceItems.length,
          latestAt: latestDate(complianceItems.map((row) => row.updatedAt)),
          provenance: `${overdueCompliance.length} selected-scope obligations are overdue.`,
        }
      : null,
    allowed.has(PermissionKey.VIEW_PREDICTIVE_INTELLIGENCE)
      ? {
          domain: "Predictive intelligence",
          recordCount: predictiveSignals.length,
          latestAt: latestDate(predictiveSignals.map((row) => row.updatedAt)),
          provenance:
            "Active, explainable indicators derived from governed tenant source records.",
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  return {
    generatedAt: now,
    filters,
    scope,
    sites,
    departments,
    portfolio,
    headline,
    trend: Array.from(monthly.values()),
    enabledTrendSeries: [
      ...(allowed.has(PermissionKey.VIEW_INCIDENT) ? ["incidents"] : []),
      ...(allowed.has(PermissionKey.VIEW_OBSERVATIONS) ? ["observations"] : []),
      ...(allowed.has(PermissionKey.VIEW_AUDITS) ? ["audits"] : []),
      ...(allowed.has(PermissionKey.VIEW_INSPECTIONS) && !scope.departmentId
        ? ["inspections"]
        : []),
      ...(canViewCapa ? ["actions"] : []),
    ],
    performance: performance
      ? {
          scope: performance.scope,
          summary: performance.summary,
          ratingCounts: performance.ratingCounts,
          selectedIndicator: performance.selectedIndicator,
          benchmark: performance.benchmark,
          attentionRows: performance.rows
            .filter((row) => ["OFF_TARGET", "CRITICAL"].includes(row.rating))
            .slice(0, 6),
        }
      : null,
    workflow: workflow
      ? {
          summary: workflow.summary,
          bottlenecks: workflow.bottlenecks.slice(0, 5),
          templatePerformance: workflow.templatePerformance.slice(0, 5),
        }
      : null,
    priorities: assurance.signals.slice(0, 8),
    assuranceSummary: {
      signalCount: assurance.signalCount,
      criticalCount: assurance.criticalCount,
      connectionCount: assurance.connectionCount,
    },
    freshness,
    latestAiBriefing,
    scopeNotes: [
      ...(scope.departmentId && allowed.has(PermissionKey.VIEW_INSPECTIONS)
        ? ["Inspection metrics are excluded because inspections are governed at site level."]
        : []),
      ...(scope.departmentId && allowed.has(PermissionKey.VIEW_COMPLIANCE)
        ? ["Compliance obligation metrics are excluded because obligations are governed at site level."]
        : []),
      ...(workflow
        ? ["Workflow intelligence is enterprise-wide because workflow instances do not carry a site or department field."]
        : []),
      "Portfolio health and AI briefing remain enterprise-wide; operational trend and scorecard metrics follow the selected scope where source records support it.",
    ],
  };
}

export type ExecutiveCommandCenterData = Awaited<
  ReturnType<typeof getExecutiveCommandCenter>
>;

export function buildExecutiveDashboardCsv(
  data: ExecutiveCommandCenterData,
) {
  const lines = [
    ["Senzilytics Global Executive Dashboard 2.0"],
    ["Generated", data.generatedAt.toISOString()],
    ["Scope", data.scope.label],
    ["Reporting window", `${data.filters.from.toISOString()} to ${data.filters.to.toISOString()}`],
    [],
    ["EXECUTIVE KPI", "VALUE", "NOTE"],
    ...data.headline.map((item) => [
      item.label,
      item.value === null ? "No data" : `${item.value}${item.suffix ?? ""}`,
      item.note,
    ]),
    [],
    ["PORTFOLIO HEALTH", "VALUE", "NOTE", "CLASSIFICATION"],
    ...data.portfolio.modules.map((item) => [
      item.label,
      item.value,
      item.note,
      item.tone,
    ]),
    [],
    ["MANAGEMENT PRIORITIES", "SEVERITY", "SOURCE", "SITE", "DETAIL"],
    ...data.priorities.map((item) => [
      item.title,
      item.severity,
      item.source,
      item.site,
      item.detail,
    ]),
    [],
    ["DATA PROVENANCE", "RECORDS", "LATEST UPDATE", "BASIS"],
    ...data.freshness.map((item) => [
      item.domain,
      item.recordCount,
      item.latestAt?.toISOString() ?? "No source records",
      item.provenance,
    ]),
  ];

  return lines.map((row) => row.map(csvCell).join(",")).join("\n");
}
