import { prisma } from "@/lib/prisma";
import {
  WorkflowAutomationEventStatus,
  WorkflowDecision,
  WorkflowInstanceStatus,
  WorkflowOutcomeExecutionStatus,
  WorkflowOutcomeType,
  WorkflowStepStatus,
} from "@prisma/client";

const allowedRanges = new Set([30, 90, 180, 365]);
const templateIdPattern = /^[A-Za-z0-9_-]{1,100}$/;
const terminalOutcomeStatuses =
  new Set<WorkflowOutcomeExecutionStatus>([
    WorkflowOutcomeExecutionStatus.COMPLETED,
    WorkflowOutcomeExecutionStatus.FAILED,
  ]);
const terminalAutomationStatuses =
  new Set<WorkflowAutomationEventStatus>([
    WorkflowAutomationEventStatus.PROCESSED,
    WorkflowAutomationEventStatus.FAILED,
  ]);
const pendingAutomationStatuses =
  new Set<WorkflowAutomationEventStatus>([
    WorkflowAutomationEventStatus.PENDING,
    WorkflowAutomationEventStatus.PROCESSING,
  ]);

export type WorkflowProcessFilters = {
  days: number;
  templateId: string | null;
  from: Date;
  to: Date;
};

export type WorkflowTrendPoint = {
  month: string;
  started: number;
  completed: number;
  slaBreaches: number;
};

export type WorkflowTemplatePerformance = {
  templateId: string;
  templateName: string;
  entityType: string;
  started: number;
  completed: number;
  active: number;
  completionRate: number | null;
  averageCycleHours: number | null;
  slaAdherenceRate: number | null;
  rejectionRate: number | null;
};

export type WorkflowBottleneck = {
  templateId: string;
  templateName: string;
  templateStepId: string;
  stepName: string;
  completedCount: number;
  averageCycleHours: number | null;
  p90CycleHours: number | null;
  activeCount: number;
  overdueActiveCount: number;
  rejectionCount: number;
};

export type WorkflowOutcomeReliability = {
  outcomeType: WorkflowOutcomeType;
  queued: number;
  completed: number;
  failed: number;
  rejected: number;
  awaitingApproval: number;
  successRate: number | null;
  averageAttempts: number;
};

export type WorkflowOwnerWorkload = {
  owner: string;
  active: number;
  overdue: number;
};

export type WorkflowProcessIntelligence = {
  filters: WorkflowProcessFilters;
  summary: {
    started: number;
    completed: number;
    active: number;
    completionRate: number | null;
    averageCycleHours: number | null;
    medianCycleHours: number | null;
    p90CycleHours: number | null;
    slaMeasuredSteps: number;
    slaBreaches: number;
    slaAdherenceRate: number | null;
    rejectionRate: number | null;
    overdueActiveSteps: number;
    automationSuccessRate: number | null;
    outcomeSuccessRate: number | null;
    outcomesAwaitingApproval: number;
    outcomesFailed: number;
    activeTemplates: number;
    automatedTemplates: number;
    automationCoverageRate: number | null;
  };
  trend: WorkflowTrendPoint[];
  templatePerformance: WorkflowTemplatePerformance[];
  bottlenecks: WorkflowBottleneck[];
  outcomeReliability: WorkflowOutcomeReliability[];
  ownerWorkload: WorkflowOwnerWorkload[];
  automation: {
    isTemplateScoped: boolean;
    received: number;
    processed: number;
    failed: number;
    pending: number;
    workflowsStarted: number;
    averageAttempts: number;
  };
  templates: Array<{
    id: string;
    name: string;
    entityType: string;
    isActive: boolean;
  }>;
};

export function parseWorkflowProcessFilters(
  input: {
    days?: string;
    templateId?: string;
  },
  now = new Date(),
): WorkflowProcessFilters {
  const requestedDays = Number(input.days);
  const days = allowedRanges.has(requestedDays) ? requestedDays : 90;
  const rawTemplateId = input.templateId?.trim() ?? "";
  const templateId = templateIdPattern.test(rawTemplateId)
    ? rawTemplateId
    : null;
  const to = new Date(now);
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - days);

  return {
    days,
    templateId,
    from,
    to,
  };
}

export async function getWorkflowProcessIntelligence(input: {
  organizationId: string;
  filters: WorkflowProcessFilters;
}): Promise<WorkflowProcessIntelligence> {
  const { organizationId, filters } = input;
  const templateScope = filters.templateId
    ? { templateId: filters.templateId }
    : {};
  const instancePeriod = {
    organizationId,
    ...templateScope,
    OR: [
      {
        createdAt: {
          gte: filters.from,
          lte: filters.to,
        },
      },
      {
        completedAt: {
          gte: filters.from,
          lte: filters.to,
        },
      },
    ],
  };

  const [
    templates,
    periodInstances,
    periodSteps,
    activeInstances,
    activeSteps,
    outcomes,
    automationEvents,
  ] = await Promise.all([
    prisma.workflowTemplate.findMany({
      where: {
        organizationId,
      },
      select: {
        id: true,
        name: true,
        entityType: true,
        isActive: true,
        steps: {
          select: {
            outcomes: {
              where: {
                isActive: true,
              },
              select: {
                id: true,
              },
            },
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    }),
    prisma.workflowInstance.findMany({
      where: instancePeriod,
      select: {
        id: true,
        templateId: true,
        entityType: true,
        status: true,
        createdAt: true,
        completedAt: true,
        template: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.workflowInstanceStep.findMany({
      where: {
        instance: instancePeriod,
      },
      select: {
        id: true,
        templateStepId: true,
        name: true,
        status: true,
        decision: true,
        startedAt: true,
        dueAt: true,
        completedAt: true,
        instance: {
          select: {
            templateId: true,
            template: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
    prisma.workflowInstance.findMany({
      where: {
        organizationId,
        ...templateScope,
        status: WorkflowInstanceStatus.ACTIVE,
      },
      select: {
        id: true,
        templateId: true,
      },
    }),
    prisma.workflowInstanceStep.findMany({
      where: {
        status: WorkflowStepStatus.IN_PROGRESS,
        instance: {
          organizationId,
          ...templateScope,
          status: WorkflowInstanceStatus.ACTIVE,
        },
      },
      select: {
        id: true,
        templateStepId: true,
        name: true,
        startedAt: true,
        dueAt: true,
        assignedRole: true,
        assignedUser: {
          select: {
            name: true,
          },
        },
        instance: {
          select: {
            templateId: true,
            template: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
    prisma.workflowOutcomeExecution.findMany({
      where: {
        organizationId,
        createdAt: {
          gte: filters.from,
          lte: filters.to,
        },
        ...(filters.templateId
          ? {
              workflowInstance: {
                templateId: filters.templateId,
              },
            }
          : {}),
      },
      select: {
        status: true,
        attempts: true,
        createdAt: true,
        processedAt: true,
        definition: {
          select: {
            outcomeType: true,
          },
        },
      },
    }),
    filters.templateId
      ? Promise.resolve([])
      : prisma.workflowAutomationEvent.findMany({
          where: {
            organizationId,
            createdAt: {
              gte: filters.from,
              lte: filters.to,
            },
          },
          select: {
            status: true,
            attempts: true,
            startedWorkflowCount: true,
          },
        }),
  ]);

  const selectedTemplates = filters.templateId
    ? templates.filter((template) => template.id === filters.templateId)
    : templates;
  const startedInstances = periodInstances.filter(
    (instance) =>
      instance.createdAt >= filters.from &&
      instance.createdAt <= filters.to,
  );
  const completedInstances = periodInstances.filter(
    (instance) =>
      instance.status === WorkflowInstanceStatus.COMPLETED &&
      instance.completedAt &&
      instance.completedAt >= filters.from &&
      instance.completedAt <= filters.to,
  );
  const completedStartedCohort = startedInstances.filter(
    (instance) => instance.status === WorkflowInstanceStatus.COMPLETED,
  );
  const cycleHours = completedInstances.flatMap((instance) =>
    instance.completedAt
      ? [hoursBetween(instance.createdAt, instance.completedAt)]
      : [],
  );
  const duePeriodSteps = periodSteps.filter(
    (step) =>
      step.dueAt &&
      step.dueAt >= filters.from &&
      step.dueAt <= filters.to,
  );
  const resolvedDueSteps = duePeriodSteps.filter(
    (step) => step.completedAt || (step.dueAt && step.dueAt < filters.to),
  );
  const onTimeDueSteps = resolvedDueSteps.filter(
    (step) =>
      step.completedAt &&
      step.dueAt &&
      step.completedAt <= step.dueAt,
  );
  const slaBreaches = resolvedDueSteps.length - onTimeDueSteps.length;
  const decisions = periodSteps.filter(
    (step) =>
      step.completedAt &&
      step.completedAt >= filters.from &&
      step.completedAt <= filters.to &&
      step.decision,
  );
  const rejectedDecisions = decisions.filter(
    (step) => step.decision === WorkflowDecision.REJECT,
  );
  const overdueActiveSteps = activeSteps.filter(
    (step) => step.dueAt && step.dueAt < filters.to,
  );

  const activeTemplates = selectedTemplates.filter(
    (template) => template.isActive,
  );
  const automatedTemplates = activeTemplates.filter((template) =>
    template.steps.some((step) => step.outcomes.length > 0),
  );
  const terminalOutcomes = outcomes.filter((outcome) =>
    terminalOutcomeStatuses.has(outcome.status),
  );
  const completedOutcomes = terminalOutcomes.filter(
    (outcome) =>
      outcome.status === WorkflowOutcomeExecutionStatus.COMPLETED,
  );
  const terminalAutomationEvents = automationEvents.filter((event) =>
    terminalAutomationStatuses.has(event.status),
  );
  const processedAutomationEvents = terminalAutomationEvents.filter(
    (event) => event.status === WorkflowAutomationEventStatus.PROCESSED,
  );

  return {
    filters,
    summary: {
      started: startedInstances.length,
      completed: completedInstances.length,
      active: activeInstances.length,
      completionRate: percentage(
        completedStartedCohort.length,
        startedInstances.length,
      ),
      averageCycleHours: average(cycleHours),
      medianCycleHours: percentile(cycleHours, 0.5),
      p90CycleHours: percentile(cycleHours, 0.9),
      slaMeasuredSteps: resolvedDueSteps.length,
      slaBreaches,
      slaAdherenceRate: percentage(
        onTimeDueSteps.length,
        resolvedDueSteps.length,
      ),
      rejectionRate: percentage(
        rejectedDecisions.length,
        decisions.length,
      ),
      overdueActiveSteps: overdueActiveSteps.length,
      automationSuccessRate: filters.templateId
        ? null
        : percentage(
            processedAutomationEvents.length,
            terminalAutomationEvents.length,
          ),
      outcomeSuccessRate: percentage(
        completedOutcomes.length,
        terminalOutcomes.length,
      ),
      outcomesAwaitingApproval: outcomes.filter(
        (outcome) =>
          outcome.status ===
          WorkflowOutcomeExecutionStatus.AWAITING_APPROVAL,
      ).length,
      outcomesFailed: outcomes.filter(
        (outcome) =>
          outcome.status === WorkflowOutcomeExecutionStatus.FAILED,
      ).length,
      activeTemplates: activeTemplates.length,
      automatedTemplates: automatedTemplates.length,
      automationCoverageRate: percentage(
        automatedTemplates.length,
        activeTemplates.length,
      ),
    },
    trend: buildTrend({
      from: filters.from,
      to: filters.to,
      instances: periodInstances,
      dueSteps: duePeriodSteps,
    }),
    templatePerformance: buildTemplatePerformance({
      templates: selectedTemplates,
      periodInstances,
      periodSteps,
      activeInstances,
      from: filters.from,
      to: filters.to,
    }),
    bottlenecks: buildBottlenecks({
      periodSteps,
      activeSteps,
      from: filters.from,
      to: filters.to,
    }),
    outcomeReliability: buildOutcomeReliability(outcomes),
    ownerWorkload: buildOwnerWorkload(activeSteps, filters.to),
    automation: {
      isTemplateScoped: Boolean(filters.templateId),
      received: automationEvents.length,
      processed: processedAutomationEvents.length,
      failed: automationEvents.filter(
        (event) => event.status === WorkflowAutomationEventStatus.FAILED,
      ).length,
      pending: automationEvents.filter((event) =>
        pendingAutomationStatuses.has(event.status),
      ).length,
      workflowsStarted: automationEvents.reduce(
        (sum, event) => sum + event.startedWorkflowCount,
        0,
      ),
      averageAttempts: round(
        automationEvents.length
          ? automationEvents.reduce(
              (sum, event) => sum + event.attempts,
              0,
            ) / automationEvents.length
          : 0,
      ),
    },
    templates: templates.map((template) => ({
      id: template.id,
      name: template.name,
      entityType: template.entityType,
      isActive: template.isActive,
    })),
  };
}

export function buildWorkflowProcessCsv(
  data: WorkflowProcessIntelligence,
) {
  const rows: unknown[][] = [
    ["Workflow Process Intelligence"],
    ["From", data.filters.from.toISOString()],
    ["To", data.filters.to.toISOString()],
    ["Template", data.filters.templateId ?? "ALL"],
    [],
    ["Summary metric", "Value"],
    ["Started workflows", data.summary.started],
    ["Completed workflows", data.summary.completed],
    ["Active workflows", data.summary.active],
    ["Completion rate (%)", data.summary.completionRate],
    ["Average cycle time (hours)", data.summary.averageCycleHours ?? ""],
    ["Median cycle time (hours)", data.summary.medianCycleHours ?? ""],
    ["P90 cycle time (hours)", data.summary.p90CycleHours ?? ""],
    ["SLA adherence (%)", data.summary.slaAdherenceRate ?? ""],
    ["SLA breaches", data.summary.slaBreaches],
    ["Rejection rate (%)", data.summary.rejectionRate ?? ""],
    ["Outcome success (%)", data.summary.outcomeSuccessRate ?? ""],
    [],
    [
      "Template",
      "Entity",
      "Started",
      "Completed",
      "Active",
      "Completion rate (%)",
      "Average cycle hours",
      "SLA adherence (%)",
      "Rejection rate (%)",
    ],
    ...data.templatePerformance.map((item) => [
      item.templateName,
      item.entityType,
      item.started,
      item.completed,
      item.active,
      item.completionRate,
      item.averageCycleHours ?? "",
      item.slaAdherenceRate ?? "",
      item.rejectionRate ?? "",
    ]),
    [],
    [
      "Bottleneck step",
      "Template",
      "Completed",
      "Average cycle hours",
      "P90 cycle hours",
      "Active",
      "Overdue active",
      "Rejections",
    ],
    ...data.bottlenecks.map((item) => [
      item.stepName,
      item.templateName,
      item.completedCount,
      item.averageCycleHours ?? "",
      item.p90CycleHours ?? "",
      item.activeCount,
      item.overdueActiveCount,
      item.rejectionCount,
    ]),
    [],
    [
      "Outcome type",
      "Queued",
      "Completed",
      "Failed",
      "Rejected",
      "Awaiting approval",
      "Success rate (%)",
      "Average attempts",
    ],
    ...data.outcomeReliability.map((item) => [
      item.outcomeType,
      item.queued,
      item.completed,
      item.failed,
      item.rejected,
      item.awaitingApproval,
      item.successRate ?? "",
      item.averageAttempts,
    ]),
  ];

  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function buildTrend(input: {
  from: Date;
  to: Date;
  instances: Array<{
    createdAt: Date;
    completedAt: Date | null;
  }>;
  dueSteps: Array<{
    dueAt: Date | null;
    completedAt: Date | null;
  }>;
}) {
  const monthKeys = monthsBetween(input.from, input.to);
  const rows = new Map<string, WorkflowTrendPoint>(
    monthKeys.map((month) => [
      month.key,
      {
        month: month.label,
        started: 0,
        completed: 0,
        slaBreaches: 0,
      },
    ]),
  );
  for (const instance of input.instances) {
    const started = rows.get(monthKey(instance.createdAt));
    if (
      started &&
      instance.createdAt >= input.from &&
      instance.createdAt <= input.to
    ) {
      started.started += 1;
    }
    if (instance.completedAt) {
      const completed = rows.get(monthKey(instance.completedAt));
      if (
        completed &&
        instance.completedAt >= input.from &&
        instance.completedAt <= input.to
      ) {
        completed.completed += 1;
      }
    }
  }
  for (const step of input.dueSteps) {
    if (!step.dueAt) continue;
    const row = rows.get(monthKey(step.dueAt));
    if (
      row &&
      (!step.completedAt || step.completedAt > step.dueAt) &&
      step.dueAt <= input.to
    ) {
      row.slaBreaches += 1;
    }
  }
  return Array.from(rows.values());
}

function buildTemplatePerformance(input: {
  templates: Array<{
    id: string;
    name: string;
    entityType: string;
  }>;
  periodInstances: Array<{
    id: string;
    templateId: string;
    status: WorkflowInstanceStatus;
    createdAt: Date;
    completedAt: Date | null;
  }>;
  periodSteps: Array<{
    decision: WorkflowDecision | null;
    dueAt: Date | null;
    completedAt: Date | null;
    instance: {
      templateId: string;
    };
  }>;
  activeInstances: Array<{
    templateId: string;
  }>;
  from: Date;
  to: Date;
}) {
  return input.templates
    .map((template): WorkflowTemplatePerformance => {
      const started = input.periodInstances.filter(
        (instance) =>
          instance.templateId === template.id &&
          instance.createdAt >= input.from &&
          instance.createdAt <= input.to,
      );
      const completed = input.periodInstances.filter(
        (instance) =>
          instance.templateId === template.id &&
          instance.status === WorkflowInstanceStatus.COMPLETED &&
          instance.completedAt &&
          instance.completedAt >= input.from &&
          instance.completedAt <= input.to,
      );
      const cycleHours = completed.flatMap((instance) =>
        instance.completedAt
          ? [hoursBetween(instance.createdAt, instance.completedAt)]
          : [],
      );
      const steps = input.periodSteps.filter(
        (step) => step.instance.templateId === template.id,
      );
      const dueSteps = steps.filter(
        (step) =>
          step.dueAt &&
          step.dueAt >= input.from &&
          step.dueAt <= input.to &&
          (step.completedAt || step.dueAt < input.to),
      );
      const onTime = dueSteps.filter(
        (step) =>
          step.completedAt &&
          step.dueAt &&
          step.completedAt <= step.dueAt,
      );
      const decisions = steps.filter(
        (step) =>
          step.decision &&
          step.completedAt &&
          step.completedAt >= input.from &&
          step.completedAt <= input.to,
      );
      const rejected = decisions.filter(
        (step) => step.decision === WorkflowDecision.REJECT,
      );
      return {
        templateId: template.id,
        templateName: template.name,
        entityType: template.entityType,
        started: started.length,
        completed: completed.length,
        active: input.activeInstances.filter(
          (instance) => instance.templateId === template.id,
        ).length,
        completionRate: percentage(
          started.filter(
            (instance) =>
              instance.status === WorkflowInstanceStatus.COMPLETED,
          ).length,
          started.length,
        ),
        averageCycleHours: average(cycleHours),
        slaAdherenceRate: percentage(onTime.length, dueSteps.length),
        rejectionRate: percentage(rejected.length, decisions.length),
      };
    })
    .filter(
      (template) =>
        template.started > 0 ||
        template.completed > 0 ||
        template.active > 0,
    )
    .sort(
      (left, right) =>
        right.active - left.active ||
        (left.slaAdherenceRate ?? 101) -
          (right.slaAdherenceRate ?? 101) ||
        right.started - left.started,
    );
}

function buildBottlenecks(input: {
  periodSteps: Array<{
    templateStepId: string;
    name: string;
    decision: WorkflowDecision | null;
    startedAt: Date | null;
    completedAt: Date | null;
    instance: {
      templateId: string;
      template: {
        name: string;
      };
    };
  }>;
  activeSteps: Array<{
    templateStepId: string;
    name: string;
    startedAt: Date | null;
    dueAt: Date | null;
    instance: {
      templateId: string;
      template: {
        name: string;
      };
    };
  }>;
  from: Date;
  to: Date;
}) {
  const groups = new Map<
    string,
    {
      templateId: string;
      templateName: string;
      templateStepId: string;
      stepName: string;
      durations: number[];
      activeCount: number;
      overdueActiveCount: number;
      rejectionCount: number;
    }
  >();
  const getGroup = (step: {
    templateStepId: string;
    name: string;
    instance: {
      templateId: string;
      template: {
        name: string;
      };
    };
  }) => {
    const existing = groups.get(step.templateStepId);
    if (existing) return existing;
    const created = {
      templateId: step.instance.templateId,
      templateName: step.instance.template.name,
      templateStepId: step.templateStepId,
      stepName: step.name,
      durations: [],
      activeCount: 0,
      overdueActiveCount: 0,
      rejectionCount: 0,
    };
    groups.set(step.templateStepId, created);
    return created;
  };

  for (const step of input.periodSteps) {
    const group = getGroup(step);
    if (
      step.startedAt &&
      step.completedAt &&
      step.completedAt >= input.from &&
      step.completedAt <= input.to
    ) {
      group.durations.push(hoursBetween(step.startedAt, step.completedAt));
    }
    if (
      step.decision === WorkflowDecision.REJECT &&
      step.completedAt &&
      step.completedAt >= input.from &&
      step.completedAt <= input.to
    ) {
      group.rejectionCount += 1;
    }
  }
  for (const step of input.activeSteps) {
    const group = getGroup(step);
    group.activeCount += 1;
    if (step.dueAt && step.dueAt < input.to) {
      group.overdueActiveCount += 1;
    }
  }

  return Array.from(groups.values())
    .map(
      (group): WorkflowBottleneck => ({
        templateId: group.templateId,
        templateName: group.templateName,
        templateStepId: group.templateStepId,
        stepName: group.stepName,
        completedCount: group.durations.length,
        averageCycleHours: average(group.durations),
        p90CycleHours: percentile(group.durations, 0.9),
        activeCount: group.activeCount,
        overdueActiveCount: group.overdueActiveCount,
        rejectionCount: group.rejectionCount,
      }),
    )
    .filter(
      (group) =>
        group.completedCount > 0 ||
        group.activeCount > 0 ||
        group.rejectionCount > 0,
    )
    .sort(
      (left, right) =>
        right.overdueActiveCount - left.overdueActiveCount ||
        right.rejectionCount - left.rejectionCount ||
        (right.averageCycleHours ?? 0) -
          (left.averageCycleHours ?? 0),
    )
    .slice(0, 12);
}

function buildOutcomeReliability(
  outcomes: Array<{
    status: WorkflowOutcomeExecutionStatus;
    attempts: number;
    definition: {
      outcomeType: WorkflowOutcomeType;
    };
  }>,
) {
  return Object.values(WorkflowOutcomeType)
    .map((outcomeType): WorkflowOutcomeReliability => {
      const items = outcomes.filter(
        (outcome) => outcome.definition.outcomeType === outcomeType,
      );
      const completed = items.filter(
        (outcome) =>
          outcome.status === WorkflowOutcomeExecutionStatus.COMPLETED,
      ).length;
      const failed = items.filter(
        (outcome) =>
          outcome.status === WorkflowOutcomeExecutionStatus.FAILED,
      ).length;
      return {
        outcomeType,
        queued: items.length,
        completed,
        failed,
        rejected: items.filter(
          (outcome) =>
            outcome.status === WorkflowOutcomeExecutionStatus.REJECTED,
        ).length,
        awaitingApproval: items.filter(
          (outcome) =>
            outcome.status ===
            WorkflowOutcomeExecutionStatus.AWAITING_APPROVAL,
        ).length,
        successRate: percentage(completed, completed + failed),
        averageAttempts: round(
          items.length
            ? items.reduce(
                (sum, outcome) => sum + outcome.attempts,
                0,
              ) / items.length
            : 0,
        ),
      };
    })
    .filter((outcome) => outcome.queued > 0);
}

function buildOwnerWorkload(
  steps: Array<{
    dueAt: Date | null;
    assignedRole: string | null;
    assignedUser: {
      name: string;
    } | null;
  }>,
  now: Date,
) {
  const groups = new Map<string, WorkflowOwnerWorkload>();
  for (const step of steps) {
    const owner =
      step.assignedUser?.name ||
      step.assignedRole?.replaceAll("_", " ") ||
      "Unassigned";
    const group = groups.get(owner) ?? {
      owner,
      active: 0,
      overdue: 0,
    };
    group.active += 1;
    if (step.dueAt && step.dueAt < now) group.overdue += 1;
    groups.set(owner, group);
  }
  return Array.from(groups.values())
    .sort(
      (left, right) =>
        right.overdue - left.overdue || right.active - left.active,
    )
    .slice(0, 12);
}

export function percentile(values: number[], quantile: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * quantile;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const value =
    lower === upper
      ? sorted[lower]
      : sorted[lower] +
        (sorted[upper] - sorted[lower]) * (position - lower);
  return round(value);
}

function average(values: number[]) {
  if (!values.length) return null;
  return round(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
}

function percentage(numerator: number, denominator: number) {
  if (!denominator) return null;
  return round((numerator / denominator) * 100);
}

function hoursBetween(start: Date, end: Date) {
  return Math.max(0, (end.getTime() - start.getTime()) / 3_600_000);
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function monthsBetween(from: Date, to: Date) {
  const cursor = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1),
  );
  const end = new Date(
    Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1),
  );
  const months: Array<{ key: string; label: string }> = [];
  while (cursor <= end) {
    months.push({
      key: monthKey(cursor),
      label: cursor.toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
        timeZone: "UTC",
      }),
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

function monthKey(value: Date) {
  return `${value.getUTCFullYear()}-${String(
    value.getUTCMonth() + 1,
  ).padStart(2, "0")}`;
}

function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
