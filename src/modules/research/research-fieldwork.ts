import {
  ResearchSampleUnitStatus,
  ResearchSamplingExecutionStatus,
} from "@prisma/client";

export const FIELDWORK_ACTIVE_STATUSES = [
  ResearchSampleUnitStatus.ASSIGNED,
  ResearchSampleUnitStatus.CONTACTED,
  ResearchSampleUnitStatus.PARTIAL,
] as const;

export const FIELDWORK_TERMINAL_STATUSES = [
  ResearchSampleUnitStatus.INELIGIBLE,
  ResearchSampleUnitStatus.REFUSED,
  ResearchSampleUnitStatus.COMPLETED,
  ResearchSampleUnitStatus.REPLACED,
  ResearchSampleUnitStatus.WITHDRAWN,
] as const;

const transitions: Partial<
  Record<ResearchSampleUnitStatus, ResearchSampleUnitStatus[]>
> = {
  SELECTED: [ResearchSampleUnitStatus.ASSIGNED],
  RESERVE: [ResearchSampleUnitStatus.ASSIGNED],
  ASSIGNED: [
    ResearchSampleUnitStatus.CONTACTED,
    ResearchSampleUnitStatus.INELIGIBLE,
    ResearchSampleUnitStatus.REFUSED,
    ResearchSampleUnitStatus.PARTIAL,
    ResearchSampleUnitStatus.COMPLETED,
    ResearchSampleUnitStatus.WITHDRAWN,
  ],
  CONTACTED: [
    ResearchSampleUnitStatus.CONTACTED,
    ResearchSampleUnitStatus.INELIGIBLE,
    ResearchSampleUnitStatus.REFUSED,
    ResearchSampleUnitStatus.PARTIAL,
    ResearchSampleUnitStatus.COMPLETED,
    ResearchSampleUnitStatus.WITHDRAWN,
  ],
  PARTIAL: [
    ResearchSampleUnitStatus.CONTACTED,
    ResearchSampleUnitStatus.COMPLETED,
    ResearchSampleUnitStatus.REFUSED,
    ResearchSampleUnitStatus.WITHDRAWN,
  ],
};

export function assertFieldworkTransition(
  current: ResearchSampleUnitStatus,
  target: ResearchSampleUnitStatus,
) {
  if (!(transitions[current] ?? []).includes(target))
    throw new Error(`Fieldwork unit cannot move from ${current} to ${target}.`);
}

export function assertActiveExecution(status: ResearchSamplingExecutionStatus) {
  if (status !== ResearchSamplingExecutionStatus.ACTIVE)
    throw new Error("Fieldwork updates require an active sampling execution.");
}

export function summarizeFieldwork(
  units: Array<{ status: ResearchSampleUnitStatus; isReserve: boolean }>,
) {
  const counts = new Map<string, number>();
  for (const unit of units) {
    const key = `${unit.isReserve}:${unit.status}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return summarizeFieldworkCounts(
    [...counts].map(([key, count]) => {
      const [reserve, status] = key.split(":");
      return {
        isReserve: reserve === "true",
        status: status as ResearchSampleUnitStatus,
        count,
      };
    }),
  );
}

export function summarizeFieldworkCounts(
  groups: Array<{
    status: ResearchSampleUnitStatus;
    isReserve: boolean;
    count: number;
  }>,
) {
  const primaryGroups = groups.filter((group) => !group.isReserve);
  const countWhere = (statuses: Set<ResearchSampleUnitStatus>) =>
    primaryGroups.reduce(
      (total, group) => total + (statuses.has(group.status) ? group.count : 0),
      0,
    );
  const assignedStatuses = new Set<ResearchSampleUnitStatus>([
    ResearchSampleUnitStatus.ASSIGNED,
    ResearchSampleUnitStatus.CONTACTED,
    ResearchSampleUnitStatus.PARTIAL,
    ResearchSampleUnitStatus.COMPLETED,
  ]);
  const primary = primaryGroups.reduce(
    (total, group) => total + group.count,
    0,
  );
  const assigned = countWhere(assignedStatuses);
  const completed = countWhere(
    new Set<ResearchSampleUnitStatus>([ResearchSampleUnitStatus.COMPLETED]),
  );
  const resolvedStatuses = new Set<ResearchSampleUnitStatus>([
    ResearchSampleUnitStatus.COMPLETED,
    ResearchSampleUnitStatus.REFUSED,
    ResearchSampleUnitStatus.WITHDRAWN,
  ]);
  const eligibleResolved = countWhere(resolvedStatuses);
  return {
    primary,
    assigned,
    completed,
    assignmentRate: primary ? (assigned / primary) * 100 : 0,
    responseRate: eligibleResolved ? (completed / eligibleResolved) * 100 : 0,
  };
}
