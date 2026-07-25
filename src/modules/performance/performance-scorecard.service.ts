import { prisma } from "@/lib/prisma";
import {
  ActivityAction,
  EnterpriseAuditStatus,
  PerformanceIndicatorDirection,
  PerformanceIndicatorFrequency,
  PerformanceIndicatorSource,
  PerformanceIndicatorType,
  PerformanceMeasurementStatus,
  PerformanceSystemMetric,
  RiskLevel,
  RiskStatus,
  Status,
} from "@prisma/client";

const allowedRanges = new Set([30, 90, 180, 365]);
const idPattern = /^[A-Za-z0-9_-]{1,100}$/;
const completeStatuses: Status[] = [Status.COMPLETED, Status.CLOSED];
const closedRiskStatuses: RiskStatus[] = [
  RiskStatus.CLOSED,
  RiskStatus.ARCHIVED,
];
const completedAuditStatuses: EnterpriseAuditStatus[] = [
  EnterpriseAuditStatus.COMPLETED,
  EnterpriseAuditStatus.CLOSED,
];

export type PerformanceRating =
  | "ON_TARGET"
  | "WATCH"
  | "OFF_TARGET"
  | "CRITICAL"
  | "NO_TARGET"
  | "NO_DATA";

export type PerformanceScope = {
  scopeKey: string;
  siteId: string | null;
  departmentId: string | null;
  label: string;
};

export type PerformanceFilters = {
  days: number;
  siteId: string | null;
  departmentId: string | null;
  indicatorId: string | null;
  from: Date;
  to: Date;
};

export const performanceSystemMetricLabels: Record<
  PerformanceSystemMetric,
  string
> = {
  INCIDENT_COUNT: "Incidents reported",
  HIGH_RISK_INCIDENT_COUNT: "High and critical incidents",
  OVERDUE_CORRECTIVE_ACTION_COUNT: "Overdue corrective actions",
  AUDIT_COMPLETION_RATE: "Audit completion rate",
  INSPECTION_COMPLETION_RATE: "Inspection completion rate",
  TRAINING_COMPLETION_RATE: "Training completion rate",
  OPEN_HIGH_RISK_COUNT: "Open high and critical risks",
  SAFE_BEHAVIOR_RATE: "Safe behavior rate",
};

export const performanceSystemMetricUnits: Record<
  PerformanceSystemMetric,
  string
> = {
  INCIDENT_COUNT: "count",
  HIGH_RISK_INCIDENT_COUNT: "count",
  OVERDUE_CORRECTIVE_ACTION_COUNT: "count",
  AUDIT_COMPLETION_RATE: "%",
  INSPECTION_COMPLETION_RATE: "%",
  TRAINING_COMPLETION_RATE: "%",
  OPEN_HIGH_RISK_COUNT: "count",
  SAFE_BEHAVIOR_RATE: "%",
};

const noDepartmentMetrics = new Set<PerformanceSystemMetric>([
  PerformanceSystemMetric.INCIDENT_COUNT,
  PerformanceSystemMetric.HIGH_RISK_INCIDENT_COUNT,
  PerformanceSystemMetric.INSPECTION_COMPLETION_RATE,
]);

export function parsePerformanceFilters(
  input: {
    days?: string;
    siteId?: string;
    departmentId?: string;
    indicatorId?: string;
  },
  now = new Date(),
): PerformanceFilters {
  const requestedDays = Number(input.days);
  const days = allowedRanges.has(requestedDays) ? requestedDays : 90;
  const to = new Date(now);
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - days);
  const safeId = (value?: string) => {
    const normalized = value?.trim() ?? "";
    return idPattern.test(normalized) ? normalized : null;
  };

  return {
    days,
    siteId: safeId(input.siteId),
    departmentId: safeId(input.departmentId),
    indicatorId: safeId(input.indicatorId),
    from,
    to,
  };
}

export function performanceScopeKey(input: {
  siteId?: string | null;
  departmentId?: string | null;
}) {
  if (input.departmentId) return `DEPARTMENT:${input.departmentId}`;
  if (input.siteId) return `SITE:${input.siteId}`;
  return "ORGANIZATION";
}

export function evaluatePerformance(input: {
  value: number | null;
  direction: PerformanceIndicatorDirection;
  targetValue: number | null;
  warningThreshold: number | null;
  criticalThreshold: number | null;
}): PerformanceRating {
  if (input.value === null) return "NO_DATA";
  if (
    input.targetValue === null ||
    input.warningThreshold === null ||
    input.criticalThreshold === null
  ) {
    return "NO_TARGET";
  }

  if (input.direction === PerformanceIndicatorDirection.HIGHER_IS_BETTER) {
    if (input.value >= input.targetValue) return "ON_TARGET";
    if (input.value >= input.warningThreshold) return "WATCH";
    if (input.value >= input.criticalThreshold) return "OFF_TARGET";
    return "CRITICAL";
  }

  if (input.value <= input.targetValue) return "ON_TARGET";
  if (input.value <= input.warningThreshold) return "WATCH";
  if (input.value <= input.criticalThreshold) return "OFF_TARGET";
  return "CRITICAL";
}

export function calculatePerformanceAttainment(input: {
  value: number | null;
  targetValue: number | null;
  direction: PerformanceIndicatorDirection;
}) {
  if (
    input.value === null ||
    input.targetValue === null ||
    !Number.isFinite(input.value) ||
    !Number.isFinite(input.targetValue)
  ) {
    return null;
  }

  if (input.direction === PerformanceIndicatorDirection.HIGHER_IS_BETTER) {
    if (input.targetValue === 0) return input.value >= 0 ? 100 : 0;
    return round(Math.max(0, Math.min(200, (input.value / input.targetValue) * 100)));
  }

  if (input.value <= input.targetValue) return 100;
  if (input.value === 0) return 100;
  return round(Math.max(0, Math.min(100, (input.targetValue / input.value) * 100)));
}

export async function createPerformanceIndicatorService(input: {
  organizationId: string;
  userId: string;
  code: string;
  name: string;
  description?: string | null;
  category: string;
  type: PerformanceIndicatorType;
  direction: PerformanceIndicatorDirection;
  unit: string;
  reportingFrequency: PerformanceIndicatorFrequency;
  source: PerformanceIndicatorSource;
  systemMetric?: PerformanceSystemMetric | null;
  methodology?: string | null;
  ownerId?: string | null;
}) {
  const code = input.code.trim().toUpperCase();
  const name = boundedText(input.name, "Indicator name", 160);
  const category = boundedText(input.category, "Category", 100);
  if (!/^[A-Z0-9][A-Z0-9._-]{1,39}$/.test(code)) {
    throw new Error(
      "Indicator code must contain 2–40 letters, numbers, dots, underscores, or hyphens.",
    );
  }
  boundedOptionalText(input.description, "Description", 2_000);
  boundedOptionalText(input.methodology, "Methodology", 3_000);
  if (input.source === PerformanceIndicatorSource.MANUAL) {
    boundedText(input.unit, "Reporting unit", 40);
  }
  if (
    input.source === PerformanceIndicatorSource.SYSTEM &&
    !input.systemMetric
  ) {
    throw new Error("Select the system metric used to calculate this indicator.");
  }
  if (
    input.source === PerformanceIndicatorSource.MANUAL &&
    input.systemMetric
  ) {
    throw new Error("Manual indicators cannot reference a system metric.");
  }

  const [actor, owner, existing] = await Promise.all([
    prisma.user.findFirst({
      where: {
        id: input.userId,
        organizationId: input.organizationId,
        isActive: true,
      },
      select: { id: true },
    }),
    input.ownerId
      ? prisma.user.findFirst({
          where: {
            id: input.ownerId,
            organizationId: input.organizationId,
            isActive: true,
          },
          select: { id: true },
        })
      : Promise.resolve(null),
    prisma.performanceIndicatorDefinition.findFirst({
      where: { organizationId: input.organizationId, code },
      select: { id: true },
    }),
  ]);
  if (!actor || (input.ownerId && !owner)) {
    throw new Error("Select a valid indicator owner in this organization.");
  }
  if (existing) {
    throw new Error(`An indicator with code ${code} already exists.`);
  }

  return prisma.$transaction(async (tx) => {
    const indicator = await tx.performanceIndicatorDefinition.create({
      data: {
        organizationId: input.organizationId,
        code,
        name,
        description: input.description,
        category,
        type: input.type,
        direction: input.direction,
        unit:
          input.source === PerformanceIndicatorSource.SYSTEM &&
          input.systemMetric
            ? performanceSystemMetricUnits[input.systemMetric]
            : input.unit.trim(),
        reportingFrequency: input.reportingFrequency,
        source: input.source,
        systemMetric: input.systemMetric,
        methodology: input.methodology,
        ownerId: owner?.id,
      },
    });
    await tx.activityLog.create({
      data: {
        organizationId: input.organizationId,
        userId: actor.id,
        action: ActivityAction.CREATE,
        entityType: "PerformanceIndicatorDefinition",
        entityId: indicator.id,
        title: "Performance indicator created",
        description: `${indicator.code} — ${indicator.name}`,
        metadata: {
          type: indicator.type,
          source: indicator.source,
          systemMetric: indicator.systemMetric,
          ownerId: indicator.ownerId,
        },
      },
    });
    return indicator;
  });
}

export async function createPerformanceTargetService(input: {
  organizationId: string;
  userId: string;
  indicatorId: string;
  siteId?: string | null;
  departmentId?: string | null;
  targetValue: number;
  warningThreshold: number;
  criticalThreshold: number;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  rationale?: string | null;
}) {
  boundedOptionalText(input.rationale, "Target rationale", 2_000);
  const [indicator, actor, scope] = await Promise.all([
    prisma.performanceIndicatorDefinition.findFirst({
      where: {
        id: input.indicatorId,
        organizationId: input.organizationId,
        isActive: true,
      },
    }),
    prisma.user.findFirst({
      where: {
        id: input.userId,
        organizationId: input.organizationId,
        isActive: true,
      },
      select: { id: true },
    }),
    resolvePerformanceScope({
      organizationId: input.organizationId,
      siteId: input.siteId,
      departmentId: input.departmentId,
    }),
  ]);
  if (!indicator || !actor) {
    throw new Error("Select a valid active indicator.");
  }
  validateThresholds({
    direction: indicator.direction,
    targetValue: input.targetValue,
    warningThreshold: input.warningThreshold,
    criticalThreshold: input.criticalThreshold,
  });
  if (
    input.effectiveTo &&
    input.effectiveTo.getTime() < input.effectiveFrom.getTime()
  ) {
    throw new Error("The target end date cannot precede its start date.");
  }
  if (
    scope.departmentId &&
    indicator.systemMetric &&
    noDepartmentMetrics.has(indicator.systemMetric)
  ) {
    throw new Error(
      `${performanceSystemMetricLabels[indicator.systemMetric]} can be targeted at organization or site level because its source records do not capture departments.`,
    );
  }

  return prisma.$transaction(async (tx) => {
    const target = await tx.performanceIndicatorTarget.create({
      data: {
        indicatorId: indicator.id,
        scopeKey: scope.scopeKey,
        siteId: scope.siteId,
        departmentId: scope.departmentId,
        targetValue: input.targetValue,
        warningThreshold: input.warningThreshold,
        criticalThreshold: input.criticalThreshold,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
        rationale: input.rationale,
        createdById: actor.id,
      },
    });
    await tx.activityLog.create({
      data: {
        organizationId: input.organizationId,
        userId: actor.id,
        action: ActivityAction.CREATE,
        entityType: "PerformanceIndicatorTarget",
        entityId: target.id,
        title: "Performance target created",
        description: `${indicator.code} — ${scope.label}`,
        metadata: {
          indicatorId: indicator.id,
          scopeKey: scope.scopeKey,
          targetValue: target.targetValue,
          warningThreshold: target.warningThreshold,
          criticalThreshold: target.criticalThreshold,
          effectiveFrom: target.effectiveFrom,
          effectiveTo: target.effectiveTo,
        },
      },
    });
    return target;
  });
}

export async function recordPerformanceMeasurementService(input: {
  organizationId: string;
  userId: string;
  indicatorId: string;
  siteId?: string | null;
  departmentId?: string | null;
  periodStart: Date;
  periodEnd: Date;
  value: number;
  evidenceSummary?: string | null;
  notes?: string | null;
}) {
  boundedOptionalText(input.evidenceSummary, "Evidence summary", 2_000);
  boundedOptionalText(input.notes, "Measurement notes", 2_000);
  const [indicator, actor, scope] = await Promise.all([
    prisma.performanceIndicatorDefinition.findFirst({
      where: {
        id: input.indicatorId,
        organizationId: input.organizationId,
        isActive: true,
      },
    }),
    prisma.user.findFirst({
      where: {
        id: input.userId,
        organizationId: input.organizationId,
        isActive: true,
      },
      select: { id: true },
    }),
    resolvePerformanceScope({
      organizationId: input.organizationId,
      siteId: input.siteId,
      departmentId: input.departmentId,
    }),
  ]);
  if (!indicator || !actor) throw new Error("Select a valid active indicator.");
  if (indicator.source !== PerformanceIndicatorSource.MANUAL) {
    throw new Error("System indicators are calculated automatically and do not accept manual measurements.");
  }
  if (
    !Number.isFinite(input.value) ||
    input.periodEnd.getTime() < input.periodStart.getTime()
  ) {
    throw new Error("Enter a valid value and reporting period.");
  }

  const existing = await prisma.performanceIndicatorMeasurement.findFirst({
    where: {
      indicatorId: indicator.id,
      scopeKey: scope.scopeKey,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
    },
    select: { id: true, status: true },
  });
  if (existing?.status === PerformanceMeasurementStatus.APPROVED) {
    throw new Error("Approved measurements are immutable. Record a new reporting period instead.");
  }

  return prisma.$transaction(async (tx) => {
    const measurement = await tx.performanceIndicatorMeasurement.upsert({
      where: existing
        ? { id: existing.id }
        : {
            indicatorId_scopeKey_periodStart_periodEnd: {
              indicatorId: indicator.id,
              scopeKey: scope.scopeKey,
              periodStart: input.periodStart,
              periodEnd: input.periodEnd,
            },
          },
      update: {
        value: input.value,
        evidenceSummary: input.evidenceSummary,
        notes: input.notes,
        enteredById: actor.id,
        status: PerformanceMeasurementStatus.DRAFT,
        reviewedById: null,
        reviewedAt: null,
        reviewNotes: null,
      },
      create: {
        organizationId: input.organizationId,
        indicatorId: indicator.id,
        scopeKey: scope.scopeKey,
        siteId: scope.siteId,
        departmentId: scope.departmentId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        value: input.value,
        evidenceSummary: input.evidenceSummary,
        notes: input.notes,
        enteredById: actor.id,
      },
    });
    await tx.activityLog.create({
      data: {
        organizationId: input.organizationId,
        userId: actor.id,
        action: existing ? ActivityAction.UPDATE : ActivityAction.CREATE,
        entityType: "PerformanceIndicatorMeasurement",
        entityId: measurement.id,
        title: existing
          ? "Performance measurement updated"
          : "Performance measurement recorded",
        description: `${indicator.code} — ${scope.label}`,
        metadata: {
          indicatorId: indicator.id,
          scopeKey: scope.scopeKey,
          periodStart: measurement.periodStart,
          periodEnd: measurement.periodEnd,
          value: measurement.value,
        },
      },
    });
    return measurement;
  });
}

export async function reviewPerformanceMeasurementService(input: {
  organizationId: string;
  userId: string;
  measurementId: string;
  status:
    | typeof PerformanceMeasurementStatus.APPROVED
    | typeof PerformanceMeasurementStatus.REJECTED;
  reviewNotes?: string | null;
}) {
  boundedOptionalText(input.reviewNotes, "Review notes", 2_000);
  const [measurement, reviewer] = await Promise.all([
    prisma.performanceIndicatorMeasurement.findFirst({
      where: {
        id: input.measurementId,
        organizationId: input.organizationId,
      },
      include: {
        indicator: { select: { code: true, name: true } },
      },
    }),
    prisma.user.findFirst({
      where: {
        id: input.userId,
        organizationId: input.organizationId,
        isActive: true,
      },
      select: { id: true },
    }),
  ]);
  if (!measurement || !reviewer) {
    throw new Error("Performance measurement not found in this organization.");
  }
  if (measurement.status !== PerformanceMeasurementStatus.DRAFT) {
    throw new Error("Only draft measurements can be approved or rejected.");
  }
  if (
    input.status === PerformanceMeasurementStatus.REJECTED &&
    !input.reviewNotes
  ) {
    throw new Error("Explain why this measurement is being rejected.");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.performanceIndicatorMeasurement.update({
      where: { id: measurement.id },
      data: {
        status: input.status,
        reviewedById: reviewer.id,
        reviewedAt: new Date(),
        reviewNotes: input.reviewNotes,
      },
    });
    await tx.activityLog.create({
      data: {
        organizationId: input.organizationId,
        userId: reviewer.id,
        action: ActivityAction.STATUS_CHANGE,
        entityType: "PerformanceIndicatorMeasurement",
        entityId: measurement.id,
        title: `Performance measurement ${input.status.toLowerCase()}`,
        description: `${measurement.indicator.code} — ${measurement.indicator.name}`,
        metadata: {
          previousStatus: measurement.status,
          status: input.status,
          reviewNotes: input.reviewNotes,
        },
      },
    });
    return updated;
  });
}

export async function setPerformanceIndicatorActiveService(input: {
  organizationId: string;
  userId: string;
  indicatorId: string;
  isActive: boolean;
}) {
  const [indicator, actor] = await Promise.all([
    prisma.performanceIndicatorDefinition.findFirst({
      where: {
        id: input.indicatorId,
        organizationId: input.organizationId,
      },
    }),
    prisma.user.findFirst({
      where: {
        id: input.userId,
        organizationId: input.organizationId,
        isActive: true,
      },
      select: { id: true },
    }),
  ]);
  if (!indicator || !actor) {
    throw new Error("Performance indicator not found in this organization.");
  }
  if (indicator.isActive === input.isActive) return indicator;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.performanceIndicatorDefinition.update({
      where: { id: indicator.id },
      data: { isActive: input.isActive },
    });
    await tx.activityLog.create({
      data: {
        organizationId: input.organizationId,
        userId: actor.id,
        action: ActivityAction.STATUS_CHANGE,
        entityType: "PerformanceIndicatorDefinition",
        entityId: indicator.id,
        title: `Performance indicator ${input.isActive ? "activated" : "retired"}`,
        description: `${indicator.code} — ${indicator.name}`,
        metadata: {
          previousIsActive: indicator.isActive,
          isActive: input.isActive,
        },
      },
    });
    return updated;
  });
}

export async function getPerformanceWorkspace(input: {
  organizationId: string;
  filters: PerformanceFilters;
}) {
  const [scope, sites, departments, users, indicators, recentMeasurements] =
    await Promise.all([
      resolvePerformanceScope({
        organizationId: input.organizationId,
        siteId: input.filters.siteId,
        departmentId: input.filters.departmentId,
        strict: false,
      }),
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
      prisma.user.findMany({
        where: {
          organizationId: input.organizationId,
          isActive: true,
        },
        select: { id: true, name: true, jobTitle: true },
        orderBy: { name: "asc" },
      }),
      prisma.performanceIndicatorDefinition.findMany({
        where: { organizationId: input.organizationId },
        include: {
          owner: { select: { name: true } },
          _count: { select: { targets: true, measurements: true } },
        },
        orderBy: [{ isActive: "desc" }, { type: "asc" }, { name: "asc" }],
      }),
      prisma.performanceIndicatorMeasurement.findMany({
        where: { organizationId: input.organizationId },
        include: {
          indicator: { select: { code: true, name: true, unit: true } },
          site: { select: { name: true } },
          department: { select: { name: true } },
          enteredBy: { select: { name: true } },
          reviewedBy: { select: { name: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 30,
      }),
    ]);
  const activeIndicators = indicators.filter((indicator) => indicator.isActive);
  const selectedIndicator =
    activeIndicators.find(
      (indicator) => indicator.id === input.filters.indicatorId,
    ) ?? activeIndicators[0] ?? null;
  const scorecard = await buildScorecard({
    organizationId: input.organizationId,
    filters: input.filters,
    scope,
    indicators: activeIndicators,
    sites,
    selectedIndicator,
  });

  return {
    filters: input.filters,
    scope,
    sites,
    departments,
    users,
    indicators,
    recentMeasurements,
    ...scorecard,
  };
}

async function buildScorecard(input: {
  organizationId: string;
  filters: PerformanceFilters;
  scope: PerformanceScope;
  indicators: Array<{
    id: string;
    code: string;
    name: string;
    description: string | null;
    category: string;
    type: PerformanceIndicatorType;
    direction: PerformanceIndicatorDirection;
    unit: string;
    source: PerformanceIndicatorSource;
    systemMetric: PerformanceSystemMetric | null;
    reportingFrequency: PerformanceIndicatorFrequency;
    methodology: string | null;
    ownerId: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    organizationId: string;
  }>;
  sites: Array<{ id: string; name: string }>;
  selectedIndicator: {
    id: string;
    code: string;
    name: string;
    direction: PerformanceIndicatorDirection;
    unit: string;
    source: PerformanceIndicatorSource;
    systemMetric: PerformanceSystemMetric | null;
  } | null;
}) {
  const indicatorIds = input.indicators.map((indicator) => indicator.id);
  const fallbackScopeKeys = targetScopeKeys(input.scope);
  const [targets, measurements] = await Promise.all([
    indicatorIds.length
      ? prisma.performanceIndicatorTarget.findMany({
          where: {
            indicatorId: { in: indicatorIds },
            scopeKey: { in: fallbackScopeKeys },
            effectiveFrom: { lte: input.filters.to },
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gte: input.filters.to } },
            ],
          },
          orderBy: { effectiveFrom: "desc" },
        })
      : Promise.resolve([]),
    indicatorIds.length
      ? prisma.performanceIndicatorMeasurement.findMany({
          where: {
            organizationId: input.organizationId,
            indicatorId: { in: indicatorIds },
            scopeKey: input.scope.scopeKey,
            status: PerformanceMeasurementStatus.APPROVED,
            periodEnd: { gte: input.filters.from },
            periodStart: { lte: input.filters.to },
          },
          orderBy: [{ periodEnd: "desc" }, { updatedAt: "desc" }],
        })
      : Promise.resolve([]),
  ]);

  const rows = await Promise.all(
    input.indicators.map(async (indicator) => {
      const target = selectTarget(targets, indicator.id, fallbackScopeKeys);
      const manualMeasurement = measurements.find(
        (measurement) => measurement.indicatorId === indicator.id,
      );
      const computed =
        indicator.source === PerformanceIndicatorSource.SYSTEM &&
        indicator.systemMetric
          ? await calculateSystemMetric({
              organizationId: input.organizationId,
              metric: indicator.systemMetric,
              scope: input.scope,
              from: input.filters.from,
              to: input.filters.to,
            })
          : null;
      const value =
        indicator.source === PerformanceIndicatorSource.SYSTEM
          ? computed?.value ?? null
          : manualMeasurement?.value ?? null;
      const rating = evaluatePerformance({
        value,
        direction: indicator.direction,
        targetValue: target?.targetValue ?? null,
        warningThreshold: target?.warningThreshold ?? null,
        criticalThreshold: target?.criticalThreshold ?? null,
      });

      return {
        id: indicator.id,
        code: indicator.code,
        name: indicator.name,
        category: indicator.category,
        type: indicator.type,
        direction: indicator.direction,
        unit: indicator.unit,
        source: indicator.source,
        reportingFrequency: indicator.reportingFrequency,
        value,
        targetValue: target?.targetValue ?? null,
        targetScopeKey: target?.scopeKey ?? null,
        rating,
        attainment: calculatePerformanceAttainment({
          value,
          targetValue: target?.targetValue ?? null,
          direction: indicator.direction,
        }),
        provenance:
          indicator.source === PerformanceIndicatorSource.SYSTEM
            ? computed?.provenance ?? "Source data is not available for this scope."
            : manualMeasurement
              ? `Approved manual measurement ending ${manualMeasurement.periodEnd.toLocaleDateString("en-US")}.`
              : "No approved manual measurement in this reporting window.",
      };
    }),
  );
  const measuredRows = rows.filter((row) => row.value !== null);
  const targetRows = rows.filter((row) => row.targetValue !== null);
  const attainmentRows = rows.filter((row) => row.attainment !== null);
  const ratingCounts = ratingOrder.map((rating) => ({
    rating,
    count: rows.filter((row) => row.rating === rating).length,
  }));
  const benchmark = input.selectedIndicator
    ? await buildSiteBenchmark({
        organizationId: input.organizationId,
        indicator: input.selectedIndicator,
        sites: input.sites,
        filters: input.filters,
      })
    : [];
  const trend = input.selectedIndicator
    ? await buildIndicatorTrend({
        organizationId: input.organizationId,
        indicator: input.selectedIndicator,
        to: input.filters.to,
      })
    : [];

  return {
    rows,
    summary: {
      activeIndicators: rows.length,
      measuredIndicators: measuredRows.length,
      onTarget: rows.filter((row) => row.rating === "ON_TARGET").length,
      attentionRequired: rows.filter((row) =>
        ["OFF_TARGET", "CRITICAL"].includes(row.rating),
      ).length,
      coverageRate: rows.length
        ? round((measuredRows.length / rows.length) * 100)
        : null,
      targetCoverageRate: rows.length
        ? round((targetRows.length / rows.length) * 100)
        : null,
      averageAttainment: attainmentRows.length
        ? round(
            attainmentRows.reduce(
              (total, row) => total + (row.attainment ?? 0),
              0,
            ) / attainmentRows.length,
          )
        : null,
    },
    ratingCounts,
    selectedIndicator: input.selectedIndicator,
    benchmark,
    trend,
  };
}

async function buildSiteBenchmark(input: {
  organizationId: string;
  indicator: {
    id: string;
    code: string;
    name: string;
    direction: PerformanceIndicatorDirection;
    unit: string;
    source: PerformanceIndicatorSource;
    systemMetric: PerformanceSystemMetric | null;
  };
  sites: Array<{ id: string; name: string }>;
  filters: PerformanceFilters;
}) {
  const organizationTarget = await prisma.performanceIndicatorTarget.findFirst({
    where: {
      indicatorId: input.indicator.id,
      scopeKey: "ORGANIZATION",
      effectiveFrom: { lte: input.filters.to },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gte: input.filters.to } },
      ],
    },
    orderBy: { effectiveFrom: "desc" },
  });
  const siteTargets = await prisma.performanceIndicatorTarget.findMany({
    where: {
      indicatorId: input.indicator.id,
      siteId: { in: input.sites.map((site) => site.id) },
      departmentId: null,
      effectiveFrom: { lte: input.filters.to },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gte: input.filters.to } },
      ],
    },
    orderBy: { effectiveFrom: "desc" },
  });
  const manualMeasurements =
    input.indicator.source === PerformanceIndicatorSource.MANUAL
      ? await prisma.performanceIndicatorMeasurement.findMany({
          where: {
            organizationId: input.organizationId,
            indicatorId: input.indicator.id,
            siteId: { in: input.sites.map((site) => site.id) },
            departmentId: null,
            status: PerformanceMeasurementStatus.APPROVED,
            periodEnd: { gte: input.filters.from },
            periodStart: { lte: input.filters.to },
          },
          orderBy: [{ periodEnd: "desc" }, { updatedAt: "desc" }],
        })
      : [];

  const rows = await Promise.all(
    input.sites.map(async (site) => {
      const scope = {
        scopeKey: performanceScopeKey({ siteId: site.id }),
        siteId: site.id,
        departmentId: null,
        label: site.name,
      };
      const target =
        siteTargets.find((candidate) => candidate.siteId === site.id) ??
        organizationTarget;
      const computed =
        input.indicator.source === PerformanceIndicatorSource.SYSTEM &&
        input.indicator.systemMetric
          ? await calculateSystemMetric({
              organizationId: input.organizationId,
              metric: input.indicator.systemMetric,
              scope,
              from: input.filters.from,
              to: input.filters.to,
            })
          : null;
      const measurement = manualMeasurements.find(
        (candidate) => candidate.siteId === site.id,
      );
      const value =
        input.indicator.source === PerformanceIndicatorSource.SYSTEM
          ? computed?.value ?? null
          : measurement?.value ?? null;
      return {
        siteId: site.id,
        siteName: site.name,
        value,
        targetValue: target?.targetValue ?? null,
        rating: evaluatePerformance({
          value,
          direction: input.indicator.direction,
          targetValue: target?.targetValue ?? null,
          warningThreshold: target?.warningThreshold ?? null,
          criticalThreshold: target?.criticalThreshold ?? null,
        }),
        attainment: calculatePerformanceAttainment({
          value,
          targetValue: target?.targetValue ?? null,
          direction: input.indicator.direction,
        }),
      };
    }),
  );

  return rows.sort((left, right) => {
    if (left.value === null) return 1;
    if (right.value === null) return -1;
    return input.indicator.direction ===
      PerformanceIndicatorDirection.HIGHER_IS_BETTER
      ? right.value - left.value
      : left.value - right.value;
  });
}

async function buildIndicatorTrend(input: {
  organizationId: string;
  indicator: {
    id: string;
    source: PerformanceIndicatorSource;
    systemMetric: PerformanceSystemMetric | null;
  };
  to: Date;
}) {
  const periods = Array.from({ length: 6 }, (_, index) => {
    const offset = 5 - index;
    const from = new Date(
      Date.UTC(input.to.getUTCFullYear(), input.to.getUTCMonth() - offset, 1),
    );
    const to = new Date(
      Date.UTC(
        input.to.getUTCFullYear(),
        input.to.getUTCMonth() - offset + 1,
        0,
        23,
        59,
        59,
        999,
      ),
    );
    return {
      label: from.toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
        timeZone: "UTC",
      }),
      from,
      to,
    };
  });
  const manualMeasurements =
    input.indicator.source === PerformanceIndicatorSource.MANUAL
      ? await prisma.performanceIndicatorMeasurement.findMany({
          where: {
            organizationId: input.organizationId,
            indicatorId: input.indicator.id,
            scopeKey: "ORGANIZATION",
            status: PerformanceMeasurementStatus.APPROVED,
            periodEnd: { gte: periods[0].from, lte: periods.at(-1)!.to },
          },
          orderBy: { periodEnd: "desc" },
        })
      : [];

  return Promise.all(
    periods.map(async (period) => {
      const computed =
        input.indicator.source === PerformanceIndicatorSource.SYSTEM &&
        input.indicator.systemMetric
          ? await calculateSystemMetric({
              organizationId: input.organizationId,
              metric: input.indicator.systemMetric,
              scope: {
                scopeKey: "ORGANIZATION",
                siteId: null,
                departmentId: null,
                label: "Organization",
              },
              from: period.from,
              to: period.to,
            })
          : null;
      const measurement = manualMeasurements.find(
        (candidate) =>
          candidate.periodEnd >= period.from &&
          candidate.periodEnd <= period.to,
      );
      return {
        period: period.label,
        value:
          input.indicator.source === PerformanceIndicatorSource.SYSTEM
            ? computed?.value ?? null
            : measurement?.value ?? null,
      };
    }),
  );
}

async function calculateSystemMetric(input: {
  organizationId: string;
  metric: PerformanceSystemMetric;
  scope: PerformanceScope;
  from: Date;
  to: Date;
}): Promise<{ value: number | null; provenance: string } | null> {
  if (input.scope.departmentId && noDepartmentMetrics.has(input.metric)) {
    return null;
  }
  const dateLabel = `${input.from.toLocaleDateString("en-US")}–${input.to.toLocaleDateString("en-US")}`;

  switch (input.metric) {
    case PerformanceSystemMetric.INCIDENT_COUNT:
    case PerformanceSystemMetric.HIGH_RISK_INCIDENT_COUNT: {
      const value = await prisma.incident.count({
        where: {
          site: { organizationId: input.organizationId },
          ...(input.scope.siteId ? { siteId: input.scope.siteId } : {}),
          occurredAt: { gte: input.from, lte: input.to },
          ...(input.metric ===
          PerformanceSystemMetric.HIGH_RISK_INCIDENT_COUNT
            ? { riskLevel: { in: [RiskLevel.HIGH, RiskLevel.CRITICAL] } }
            : {}),
        },
      });
      return {
        value,
        provenance: `${performanceSystemMetricLabels[input.metric]} calculated from tenant incident records for ${dateLabel}.`,
      };
    }
    case PerformanceSystemMetric.OVERDUE_CORRECTIVE_ACTION_COUNT: {
      const value = await prisma.correctiveAction.count({
        where: {
          assignedTo: {
            organizationId: input.organizationId,
            ...(input.scope.departmentId
              ? { departmentId: input.scope.departmentId }
              : input.scope.siteId
                ? { department: { siteId: input.scope.siteId } }
                : {}),
          },
          dueDate: { lte: input.to },
          status: { notIn: completeStatuses },
        },
      });
      return {
        value,
        provenance: `Open corrective actions overdue as of ${input.to.toLocaleDateString("en-US")}.`,
      };
    }
    case PerformanceSystemMetric.AUDIT_COMPLETION_RATE: {
      const audits = await prisma.enterpriseAudit.findMany({
        where: {
          organizationId: input.organizationId,
          ...(input.scope.siteId ? { siteId: input.scope.siteId } : {}),
          ...(input.scope.departmentId
            ? { departmentId: input.scope.departmentId }
            : {}),
          OR: [
            { scheduledAt: { gte: input.from, lte: input.to } },
            {
              scheduledAt: null,
              createdAt: { gte: input.from, lte: input.to },
            },
          ],
          status: { not: EnterpriseAuditStatus.CANCELLED },
        },
        select: { status: true },
      });
      const completed = audits.filter((audit) =>
        completedAuditStatuses.includes(audit.status),
      ).length;
      return {
        value: audits.length ? round((completed / audits.length) * 100) : null,
        provenance: `${completed} of ${audits.length} enterprise audits in the reporting cohort were completed or closed.`,
      };
    }
    case PerformanceSystemMetric.INSPECTION_COMPLETION_RATE: {
      const inspections = await prisma.inspection.findMany({
        where: {
          site: { organizationId: input.organizationId },
          ...(input.scope.siteId ? { siteId: input.scope.siteId } : {}),
          OR: [
            { scheduledAt: { gte: input.from, lte: input.to } },
            {
              scheduledAt: null,
              createdAt: { gte: input.from, lte: input.to },
            },
          ],
        },
        select: { status: true },
      });
      const completed = inspections.filter((inspection) =>
        completeStatuses.includes(inspection.status),
      ).length;
      return {
        value: inspections.length
          ? round((completed / inspections.length) * 100)
          : null,
        provenance: `${completed} of ${inspections.length} inspections in the reporting cohort were completed or closed.`,
      };
    }
    case PerformanceSystemMetric.TRAINING_COMPLETION_RATE: {
      const records = await prisma.trainingRecord.findMany({
        where: {
          user: {
            organizationId: input.organizationId,
            ...(input.scope.departmentId
              ? { departmentId: input.scope.departmentId }
              : input.scope.siteId
                ? { department: { siteId: input.scope.siteId } }
                : {}),
          },
          assignedAt: { gte: input.from, lte: input.to },
        },
        select: { status: true },
      });
      const completed = records.filter((record) =>
        completeStatuses.includes(record.status),
      ).length;
      return {
        value: records.length ? round((completed / records.length) * 100) : null,
        provenance: `${completed} of ${records.length} training assignments created in the reporting cohort were completed.`,
      };
    }
    case PerformanceSystemMetric.OPEN_HIGH_RISK_COUNT: {
      const value = await prisma.risk.count({
        where: {
          organizationId: input.organizationId,
          ...(input.scope.siteId ? { siteId: input.scope.siteId } : {}),
          ...(input.scope.departmentId
            ? { departmentId: input.scope.departmentId }
            : {}),
          currentRiskLevel: { in: [RiskLevel.HIGH, RiskLevel.CRITICAL] },
          status: { notIn: closedRiskStatuses },
        },
      });
      return {
        value,
        provenance: `Current open high and critical risks as of ${input.to.toLocaleDateString("en-US")}.`,
      };
    }
    case PerformanceSystemMetric.SAFE_BEHAVIOR_RATE: {
      const aggregate = await prisma.behaviorCoachingSession.aggregate({
        where: {
          organizationId: input.organizationId,
          ...(input.scope.siteId ? { siteId: input.scope.siteId } : {}),
          ...(input.scope.departmentId
            ? { departmentId: input.scope.departmentId }
            : {}),
          observedAt: { gte: input.from, lte: input.to },
        },
        _sum: { safeCount: true, atRiskCount: true },
      });
      const safe = aggregate._sum.safeCount ?? 0;
      const atRisk = aggregate._sum.atRiskCount ?? 0;
      return {
        value: safe + atRisk ? round((safe / (safe + atRisk)) * 100) : null,
        provenance: `${safe} safe and ${atRisk} at-risk behavior results recorded for ${dateLabel}.`,
      };
    }
  }
}

export function buildPerformanceCsv(input: {
  scopeLabel: string;
  from: Date;
  to: Date;
  rows: Array<{
    code: string;
    name: string;
    category: string;
    type: string;
    source: string;
    value: number | null;
    unit: string;
    targetValue: number | null;
    rating: string;
    attainment: number | null;
    provenance: string;
  }>;
}) {
  const header = [
    "Scope",
    "Period Start",
    "Period End",
    "Code",
    "Indicator",
    "Category",
    "Type",
    "Source",
    "Actual",
    "Unit",
    "Target",
    "Rating",
    "Attainment %",
    "Provenance",
  ];
  const records = input.rows.map((row) => [
    input.scopeLabel,
    isoDate(input.from),
    isoDate(input.to),
    row.code,
    row.name,
    row.category,
    row.type,
    row.source,
    row.value ?? "",
    row.unit,
    row.targetValue ?? "",
    row.rating,
    row.attainment ?? "",
    row.provenance,
  ]);
  return [header, ...records]
    .map((record) => record.map(csvCell).join(","))
    .join("\n");
}

async function resolvePerformanceScope(input: {
  organizationId: string;
  siteId?: string | null;
  departmentId?: string | null;
  strict?: boolean;
}): Promise<PerformanceScope> {
  if (input.departmentId) {
    const department = await prisma.department.findFirst({
      where: {
        id: input.departmentId,
        site: { organizationId: input.organizationId },
      },
      select: {
        id: true,
        name: true,
        siteId: true,
        site: { select: { name: true } },
      },
    });
    if (!department) {
      if (input.strict !== false) {
        throw new Error("Select a valid department in this organization.");
      }
      return resolvePerformanceScope({
        organizationId: input.organizationId,
        siteId: input.siteId,
        strict: false,
      });
    }
    if (input.siteId && department.siteId !== input.siteId) {
      throw new Error("The selected department does not belong to this site.");
    }
    return {
      scopeKey: performanceScopeKey({ departmentId: department.id }),
      siteId: department.siteId,
      departmentId: department.id,
      label: `${department.site.name} — ${department.name}`,
    };
  }
  if (input.siteId) {
    const site = await prisma.site.findFirst({
      where: { id: input.siteId, organizationId: input.organizationId },
      select: { id: true, name: true },
    });
    if (!site) {
      if (input.strict !== false) {
        throw new Error("Select a valid site in this organization.");
      }
      return {
        scopeKey: "ORGANIZATION",
        siteId: null,
        departmentId: null,
        label: "Organization",
      };
    }
    return {
      scopeKey: performanceScopeKey({ siteId: site.id }),
      siteId: site.id,
      departmentId: null,
      label: site.name,
    };
  }
  return {
    scopeKey: "ORGANIZATION",
    siteId: null,
    departmentId: null,
    label: "Organization",
  };
}

function validateThresholds(input: {
  direction: PerformanceIndicatorDirection;
  targetValue: number;
  warningThreshold: number;
  criticalThreshold: number;
}) {
  if (
    !Number.isFinite(input.targetValue) ||
    !Number.isFinite(input.warningThreshold) ||
    !Number.isFinite(input.criticalThreshold)
  ) {
    throw new Error("Enter finite target, warning, and critical values.");
  }
  if (
    input.direction === PerformanceIndicatorDirection.HIGHER_IS_BETTER &&
    !(
      input.targetValue > input.warningThreshold &&
      input.warningThreshold > input.criticalThreshold
    )
  ) {
    throw new Error(
      "For a higher-is-better indicator, target must be greater than warning, and warning greater than critical.",
    );
  }
  if (
    input.direction === PerformanceIndicatorDirection.LOWER_IS_BETTER &&
    !(
      input.targetValue < input.warningThreshold &&
      input.warningThreshold < input.criticalThreshold
    )
  ) {
    throw new Error(
      "For a lower-is-better indicator, target must be less than warning, and warning less than critical.",
    );
  }
}

function targetScopeKeys(scope: PerformanceScope) {
  if (scope.departmentId && scope.siteId) {
    return [
      performanceScopeKey({ departmentId: scope.departmentId }),
      performanceScopeKey({ siteId: scope.siteId }),
      "ORGANIZATION",
    ];
  }
  if (scope.siteId) {
    return [performanceScopeKey({ siteId: scope.siteId }), "ORGANIZATION"];
  }
  return ["ORGANIZATION"];
}

function selectTarget<
  T extends {
    indicatorId: string;
    scopeKey: string;
  },
>(targets: T[], indicatorId: string, scopeKeys: string[]) {
  for (const scopeKey of scopeKeys) {
    const target = targets.find(
      (candidate) =>
        candidate.indicatorId === indicatorId &&
        candidate.scopeKey === scopeKey,
    );
    if (target) return target;
  }
  return null;
}

const ratingOrder: PerformanceRating[] = [
  "ON_TARGET",
  "WATCH",
  "OFF_TARGET",
  "CRITICAL",
  "NO_TARGET",
  "NO_DATA",
];

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function csvCell(value: string | number) {
  const raw = String(value);
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

function boundedText(value: string, label: string, maximum: number) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  if (normalized.length > maximum) {
    throw new Error(`${label} must be ${maximum} characters or fewer.`);
  }
  return normalized;
}

function boundedOptionalText(
  value: string | null | undefined,
  label: string,
  maximum: number,
) {
  if (value && value.length > maximum) {
    throw new Error(`${label} must be ${maximum} characters or fewer.`);
  }
}
