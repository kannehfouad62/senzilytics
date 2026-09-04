import { ResearchSampleUnitStatus } from "@prisma/client";

export type FieldworkUnit = {
  status: ResearchSampleUnitStatus;
  isReserve: boolean;
  stratum: string | null;
  cluster: string | null;
  dueAt: Date | null;
  completedAt: Date | null;
  contactAttempts: number;
  assignedTo: { name: string } | null;
};

const terminal = new Set<ResearchSampleUnitStatus>([
  ResearchSampleUnitStatus.COMPLETED,
  ResearchSampleUnitStatus.REFUSED,
  ResearchSampleUnitStatus.INELIGIBLE,
  ResearchSampleUnitStatus.WITHDRAWN,
  ResearchSampleUnitStatus.REPLACED,
]);

export function buildFieldworkAnalytics(
  units: FieldworkUnit[],
  now = new Date(),
) {
  const primary = units.filter((unit) => !unit.isReserve);
  const selected = primary.length;
  const completed = primary.filter(
    (unit) => unit.status === ResearchSampleUnitStatus.COMPLETED,
  ).length;
  const refused = primary.filter(
    (unit) => unit.status === ResearchSampleUnitStatus.REFUSED,
  ).length;
  const ineligible = primary.filter(
    (unit) => unit.status === ResearchSampleUnitStatus.INELIGIBLE,
  ).length;
  const assigned = primary.filter((unit) => unit.assignedTo).length;
  const overdue = primary.filter(
    (unit) => unit.dueAt && unit.dueAt < now && !terminal.has(unit.status),
  ).length;
  const eligibleResolved =
    completed +
    refused +
    primary.filter((unit) => unit.status === ResearchSampleUnitStatus.WITHDRAWN)
      .length;
  return {
    selected,
    assigned,
    completed,
    refused,
    ineligible,
    overdue,
    unassigned: primary.filter(
      (unit) => !unit.assignedTo && !terminal.has(unit.status),
    ).length,
    responseRate: eligibleResolved ? (completed / eligibleResolved) * 100 : 0,
    cooperationRate:
      completed + refused ? (completed / (completed + refused)) * 100 : 0,
    averageAttempts: assigned
      ? primary.reduce((sum, unit) => sum + unit.contactAttempts, 0) / assigned
      : 0,
    dispositions: group(
      primary,
      (unit) => unit.status.replaceAll("_", " "),
      false,
      now,
    ),
    researchers: group(
      primary.filter((unit) => unit.assignedTo),
      (unit) => unit.assignedTo!.name,
      true,
      now,
    ),
    strata: group(primary, (unit) => unit.stratum ?? "Unspecified", true, now),
    clusters: group(
      primary,
      (unit) => unit.cluster ?? "Unspecified",
      true,
      now,
    ),
  };
}

function group(
  units: FieldworkUnit[],
  key: (unit: FieldworkUnit) => string,
  rates: boolean,
  now: Date,
) {
  const map = new Map<
    string,
    { total: number; completed: number; overdue: number }
  >();
  for (const unit of units) {
    const name = key(unit),
      current = map.get(name) ?? { total: 0, completed: 0, overdue: 0 };
    current.total += 1;
    if (unit.status === ResearchSampleUnitStatus.COMPLETED)
      current.completed += 1;
    if (unit.dueAt && unit.dueAt < now && !terminal.has(unit.status))
      current.overdue += 1;
    map.set(name, current);
  }
  return [...map]
    .map(([name, item]) => ({
      name,
      value: rates
        ? Number(((item.completed / item.total) * 100).toFixed(1))
        : item.total,
      ...item,
    }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}
