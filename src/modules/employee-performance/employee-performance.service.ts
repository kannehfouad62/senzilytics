import { prisma } from "@/lib/prisma";

export const employeePerformanceWindows = [30, 90, 180, 365] as const;
export type EmployeePerformanceWindow = (typeof employeePerformanceWindows)[number];

export type EmployeeWorkSource =
  | "WORKFLOW_TASK"
  | "CAPA_ACTION"
  | "COMPLIANCE_OCCURRENCE"
  | "MOC_TASK"
  | "TRAINING_ASSIGNMENT";

export const employeeWorkSourceLabels: Record<EmployeeWorkSource, string> = {
  WORKFLOW_TASK: "Workflow task",
  CAPA_ACTION: "Corrective action",
  COMPLIANCE_OCCURRENCE: "Compliance occurrence",
  MOC_TASK: "MOC task",
  TRAINING_ASSIGNMENT: "Training assignment",
};

export type EmployeeWorkRecord = {
  id: string;
  userId: string;
  source: EmployeeWorkSource;
  title: string;
  href: string;
  status: string;
  assignedAt: Date;
  dueAt: Date | null;
  completedAt: Date | null;
  completed: boolean;
  cancelled: boolean;
};

export type EmployeePerformanceSummary = {
  assigned: number;
  completed: number;
  open: number;
  overdue: number;
  completedWithDueDate: number;
  completedOnTime: number;
  onTimeRate: number | null;
  completionRate: number | null;
  averageCompletionDays: number | null;
};

export function parseEmployeePerformanceWindow(value: string | undefined): EmployeePerformanceWindow {
  const parsed = Number(value);
  return employeePerformanceWindows.includes(parsed as EmployeePerformanceWindow)
    ? (parsed as EmployeePerformanceWindow)
    : 90;
}

export function summarizeEmployeeWork(
  records: readonly EmployeeWorkRecord[],
  now = new Date(),
): EmployeePerformanceSummary {
  const governed = records.filter((record) => !record.cancelled);
  const completed = governed.filter((record) => record.completed && record.completedAt);
  const completedWithDueDate = completed.filter((record) => record.dueAt);
  const completedOnTime = completedWithDueDate.filter(
    (record) => record.completedAt && record.dueAt && record.completedAt <= record.dueAt,
  );
  const cycleDurations = completed
    .map((record) =>
      record.completedAt
        ? Math.max(0, record.completedAt.getTime() - record.assignedAt.getTime())
        : null,
    )
    .filter((value): value is number => value !== null);

  return {
    assigned: governed.length,
    completed: completed.length,
    open: governed.length - completed.length,
    overdue: governed.filter(
      (record) => !record.completed && record.dueAt && record.dueAt < now,
    ).length,
    completedWithDueDate: completedWithDueDate.length,
    completedOnTime: completedOnTime.length,
    onTimeRate: completedWithDueDate.length
      ? roundPercent(completedOnTime.length / completedWithDueDate.length)
      : null,
    completionRate: governed.length
      ? roundPercent(completed.length / governed.length)
      : null,
    averageCompletionDays: cycleDurations.length
      ? Math.round(
          (cycleDurations.reduce((total, value) => total + value, 0) /
            cycleDurations.length /
            86_400_000) *
            10,
        ) / 10
      : null,
  };
}

export async function getEmployeePerformanceWorkspace(input: {
  organizationId: string;
  viewerId: string;
  canViewTeam: boolean;
  days: EmployeePerformanceWindow;
  employeeId?: string;
}) {
  const to = new Date();
  const from = new Date(to.getTime() - input.days * 86_400_000);
  const requestedEmployeeId = input.canViewTeam ? input.employeeId : input.viewerId;
  const users = await prisma.user.findMany({
    where: {
      organizationId: input.organizationId,
      isActive: true,
      ...(requestedEmployeeId ? { id: requestedEmployeeId } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      jobTitle: true,
      role: true,
      department: { select: { name: true, site: { select: { name: true } } } },
    },
    orderBy: { name: "asc" },
  });

  if (!input.canViewTeam && users[0]?.id !== input.viewerId) {
    throw new Error("You can only view your own employee performance report.");
  }
  if (requestedEmployeeId && users.length === 0) {
    throw new Error("Employee not found in this organization.");
  }

  const records = await loadEmployeeWorkRecords({
    organizationId: input.organizationId,
    userIds: users.map((user) => user.id),
    from,
  });
  const byUser = new Map<string, EmployeeWorkRecord[]>();
  for (const record of records) {
    const rows = byUser.get(record.userId) ?? [];
    rows.push(record);
    byUser.set(record.userId, rows);
  }

  const employees = users.map((user) => {
    const employeeRecords = (byUser.get(user.id) ?? []).sort(compareWorkRecords);
    return {
      ...user,
      departmentName: user.department?.name ?? null,
      siteName: user.department?.site.name ?? null,
      records: employeeRecords,
      summary: summarizeEmployeeWork(employeeRecords, to),
      sources: Object.entries(employeeWorkSourceLabels).map(([source, label]) => {
        const sourceRecords = employeeRecords.filter((record) => record.source === source);
        return {
          source: source as EmployeeWorkSource,
          label,
          summary: summarizeEmployeeWork(sourceRecords, to),
        };
      }),
    };
  });

  return {
    filters: { days: input.days, from, to },
    employees,
    portfolio: summarizeEmployeeWork(records, to),
    provenance:
      "Calculated from tenant-scoped workflow tasks, corrective actions, compliance occurrences, MOC tasks, and training assignments. Cancelled work is excluded. Rates are descriptive evidence for human review, not automated employment decisions.",
  };
}

async function loadEmployeeWorkRecords(input: {
  organizationId: string;
  userIds: string[];
  from: Date;
}): Promise<EmployeeWorkRecord[]> {
  if (input.userIds.length === 0) return [];
  const [workflowTasks, correctiveActions, complianceOccurrences, mocTasks, trainingRecords] =
    await Promise.all([
      prisma.workflowGeneratedTask.findMany({
        where: {
          organizationId: input.organizationId,
          assignedUserId: { in: input.userIds },
          OR: [
            { createdAt: { gte: input.from } },
            { completedAt: { gte: input.from } },
            { status: { in: ["OPEN", "IN_PROGRESS"] } },
          ],
        },
        select: { id: true, assignedUserId: true, title: true, status: true, dueAt: true, completedAt: true, createdAt: true },
        take: 5_000,
      }),
      prisma.correctiveAction.findMany({
        where: {
          assignedToId: { in: input.userIds },
          assignedTo: { organizationId: input.organizationId },
          OR: [
            { createdAt: { gte: input.from } },
            {
              AND: [
                { updatedAt: { gte: input.from } },
                { status: { in: ["COMPLETED", "CLOSED"] } },
              ],
            },
            { status: { in: ["OPEN", "IN_PROGRESS", "OVERDUE"] } },
          ],
        },
        select: { id: true, assignedToId: true, title: true, status: true, dueDate: true, updatedAt: true, createdAt: true },
        take: 5_000,
      }),
      prisma.complianceCalendarOccurrence.findMany({
        where: {
          organizationId: input.organizationId,
          assignedToId: { in: input.userIds },
          OR: [
            { createdAt: { gte: input.from } },
            { completedAt: { gte: input.from } },
            { status: { in: ["UPCOMING", "DUE", "IN_PROGRESS", "SUBMITTED", "REJECTED", "OVERDUE"] } },
          ],
        },
        select: { id: true, assignedToId: true, status: true, dueAt: true, completedAt: true, createdAt: true, task: { select: { title: true } } },
        take: 5_000,
      }),
      prisma.mocTask.findMany({
        where: {
          assignedToId: { in: input.userIds },
          moc: { organizationId: input.organizationId },
          OR: [
            { createdAt: { gte: input.from } },
            { completedAt: { gte: input.from } },
            { status: { in: ["NOT_STARTED", "IN_PROGRESS", "BLOCKED"] } },
          ],
        },
        select: { id: true, assignedToId: true, title: true, status: true, dueDate: true, completedAt: true, createdAt: true, moc: { select: { id: true } } },
        take: 5_000,
      }),
      prisma.trainingRecord.findMany({
        where: {
          userId: { in: input.userIds },
          user: { organizationId: input.organizationId },
          OR: [
            { assignedAt: { gte: input.from } },
            { completedAt: { gte: input.from } },
            { status: { in: ["OPEN", "IN_PROGRESS", "OVERDUE"] } },
          ],
        },
        select: { id: true, userId: true, courseName: true, status: true, dueDate: true, completedAt: true, assignedAt: true },
        take: 5_000,
      }),
    ]);

  return [
    ...workflowTasks.flatMap((task) =>
      task.assignedUserId
        ? [workRecord({ id: task.id, userId: task.assignedUserId, source: "WORKFLOW_TASK", title: task.title, href: "/tasks", status: task.status, assignedAt: task.createdAt, dueAt: task.dueAt, completedAt: task.completedAt })]
        : [],
    ),
    ...correctiveActions.map((action) =>
      workRecord({ id: action.id, userId: action.assignedToId, source: "CAPA_ACTION", title: action.title, href: `/actions/${action.id}`, status: action.status, assignedAt: action.createdAt, dueAt: action.dueDate, completedAt: action.status === "COMPLETED" || action.status === "CLOSED" ? action.updatedAt : null }),
    ),
    ...complianceOccurrences.map((occurrence) =>
      workRecord({ id: occurrence.id, userId: occurrence.assignedToId, source: "COMPLIANCE_OCCURRENCE", title: occurrence.task.title, href: "/compliance/calendar", status: occurrence.status, assignedAt: occurrence.createdAt, dueAt: occurrence.dueAt, completedAt: occurrence.completedAt }),
    ),
    ...mocTasks.flatMap((task) =>
      task.assignedToId
        ? [workRecord({ id: task.id, userId: task.assignedToId, source: "MOC_TASK", title: task.title, href: `/moc/${task.moc.id}`, status: task.status, assignedAt: task.createdAt, dueAt: task.dueDate, completedAt: task.completedAt })]
        : [],
    ),
    ...trainingRecords.map((record) =>
      workRecord({ id: record.id, userId: record.userId, source: "TRAINING_ASSIGNMENT", title: record.courseName, href: "/training", status: record.status, assignedAt: record.assignedAt, dueAt: record.dueDate, completedAt: record.completedAt }),
    ),
  ];
}

function workRecord(input: Omit<EmployeeWorkRecord, "completed" | "cancelled">): EmployeeWorkRecord {
  return {
    ...input,
    completed: input.status === "COMPLETED" || input.status === "CLOSED",
    cancelled: input.status === "CANCELLED",
  };
}

function compareWorkRecords(a: EmployeeWorkRecord, b: EmployeeWorkRecord) {
  const aTime = a.dueAt?.getTime() ?? a.assignedAt.getTime();
  const bTime = b.dueAt?.getTime() ?? b.assignedAt.getTime();
  return bTime - aTime;
}

function roundPercent(value: number) {
  return Math.round(value * 1_000) / 10;
}
