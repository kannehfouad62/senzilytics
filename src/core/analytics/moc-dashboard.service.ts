import { prisma } from "@/lib/prisma";
import {
  MocApprovalStatus,
  MocChangeDuration,
  MocStatus,
  MocTaskStatus,
  RiskLevel,
} from "@prisma/client";

const DAY_IN_MILLISECONDS =
  24 * 60 * 60 * 1000;

const ACTIVE_MOC_STATUSES: MocStatus[] = [
  MocStatus.DRAFT,
  MocStatus.TECHNICAL_REVIEW,
  MocStatus.RISK_REVIEW,
  MocStatus.PENDING_APPROVAL,
  MocStatus.APPROVED,
  MocStatus.IMPLEMENTATION,
  MocStatus.VERIFICATION,
];

const LIFECYCLE_STATUSES: MocStatus[] = [
  MocStatus.DRAFT,
  MocStatus.TECHNICAL_REVIEW,
  MocStatus.RISK_REVIEW,
  MocStatus.PENDING_APPROVAL,
  MocStatus.APPROVED,
  MocStatus.IMPLEMENTATION,
  MocStatus.VERIFICATION,
  MocStatus.CLOSED,
];

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
  months: number
) {
  return new Date(
    value.getFullYear(),
    value.getMonth() + months,
    1
  );
}

function differenceInDays(
  laterDate: Date,
  earlierDate: Date
) {
  return Math.max(
    0,
    Math.round(
      (laterDate.getTime() -
        earlierDate.getTime()) /
        DAY_IN_MILLISECONDS
    )
  );
}

function average(
  values: number[]
) {
  if (values.length === 0) {
    return 0;
  }

  return (
    values.reduce(
      (total, value) =>
        total + value,
      0
    ) / values.length
  );
}

function roundMetric(
  value: number
) {
  return Math.round(
    value * 10
  ) / 10;
}

function formatMonthKey(
  value: Date
) {
  return `${value.getFullYear()}-${String(
    value.getMonth() + 1
  ).padStart(2, "0")}`;
}

function formatMonthLabel(
  value: Date
) {
  return value.toLocaleDateString(
    "en-US",
    {
      month: "short",
      year: "2-digit",
    }
  );
}

export async function getMocExecutiveDashboard(
  organizationId: string
) {
  const now = new Date();

  const currentMonthStart =
    startOfMonth(now);

  const nextMonthStart =
    addMonths(
      currentMonthStart,
      1
    );

  const trendStart =
    addMonths(
      currentMonthStart,
      -11
    );

  const thirtyDayWindowEnd =
    new Date(
      now.getTime() +
        30 *
          DAY_IN_MILLISECONDS
    );

  const sevenDayWindowEnd =
    new Date(
      now.getTime() +
        7 *
          DAY_IN_MILLISECONDS
    );

  const mocs =
    await prisma.managementOfChange.findMany({
      where: {
        organizationId,
      },

      select: {
        id: true,
        reference: true,
        title: true,

        status: true,
        priority: true,
        changeType: true,
        changeDuration: true,

        residualScore: true,
        residualRiskLevel: true,

        createdAt: true,
        updatedAt: true,
        closedAt: true,

        plannedCompletionDate: true,
        temporaryExpirationDate: true,

        site: {
          select: {
            id: true,
            name: true,
          },
        },

        owner: {
          select: {
            id: true,
            name: true,
          },
        },

        requestor: {
          select: {
            id: true,
            name: true,
          },
        },

        approvals: {
          select: {
            id: true,
            role: true,
            status: true,
            sequence: true,
            requestedAt: true,
            decidedAt: true,

            approver: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },

        tasks: {
          select: {
            id: true,
            title: true,
            taskType: true,
            status: true,
            isRequired: true,
            dueDate: true,
            completedAt: true,

            assignedTo: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });

  const activeMocs =
    mocs.filter(
      (moc) =>
        ACTIVE_MOC_STATUSES.includes(
          moc.status
        )
    );

  const closedThisMonth =
    mocs.filter(
      (moc) =>
        moc.status ===
          MocStatus.CLOSED &&
        moc.closedAt &&
        moc.closedAt >=
          currentMonthStart &&
        moc.closedAt <
          nextMonthStart
    );

  const overdueMocs =
    activeMocs.filter(
      (moc) =>
        Boolean(
          moc.plannedCompletionDate &&
            moc.plannedCompletionDate <
              now
        )
    );

  const highRiskMocs =
    activeMocs.filter(
      (moc) =>
        moc.residualRiskLevel ===
          RiskLevel.HIGH ||
        moc.residualRiskLevel ===
          RiskLevel.CRITICAL
    );

  const pendingApprovals =
    mocs.flatMap(
      (moc) =>
        moc.approvals
          .filter(
            (approval) =>
              approval.status ===
              MocApprovalStatus.PENDING
          )
          .map(
            (approval) => ({
              id:
                approval.id,

              mocId:
                moc.id,

              mocReference:
                moc.reference,

              mocTitle:
                moc.title,

              role:
                approval.role,

              sequence:
                approval.sequence,

              requestedAt:
                approval.requestedAt,

              waitingDays:
                differenceInDays(
                  now,
                  approval.requestedAt
                ),

              approver:
                approval.approver
                  ?.name ??
                "Unassigned",

              site:
                moc.site.name,

              priority:
                moc.priority,

              residualRiskLevel:
                moc.residualRiskLevel,
            })
          )
    )
    .sort(
      (first, second) =>
        second.waitingDays -
        first.waitingDays
    );

  const overdueTasks =
    mocs.flatMap(
      (moc) =>
        moc.tasks
          .filter(
            (task) =>
              task.dueDate &&
              task.dueDate < now &&
              task.status !==
                MocTaskStatus.COMPLETED &&
              task.status !==
                MocTaskStatus.CANCELLED
          )
          .map(
            (task) => ({
              id:
                task.id,

              mocId:
                moc.id,

              mocReference:
                moc.reference,

              mocTitle:
                moc.title,

              taskTitle:
                task.title,

              taskType:
                task.taskType,

              taskStatus:
                task.status,

              dueDate:
                task.dueDate as Date,

              daysOverdue:
                differenceInDays(
                  now,
                  task.dueDate as Date
                ),

              assignedTo:
                task.assignedTo
                  ?.name ??
                "Unassigned",

              site:
                moc.site.name,

              priority:
                moc.priority,

              residualRiskLevel:
                moc.residualRiskLevel,
            })
          )
    )
    .sort(
      (first, second) =>
        second.daysOverdue -
        first.daysOverdue
    );

  const temporaryChanges =
    activeMocs
      .filter(
        (moc) =>
          moc.changeDuration ===
            MocChangeDuration.TEMPORARY &&
          moc.temporaryExpirationDate
      )
      .map(
        (moc) => {
          const expirationDate =
            moc.temporaryExpirationDate as Date;

          const daysUntilExpiration =
            Math.ceil(
              (expirationDate.getTime() -
                now.getTime()) /
                DAY_IN_MILLISECONDS
            );

          const expirationCategory =
            daysUntilExpiration < 0
              ? "EXPIRED"
              : daysUntilExpiration <= 7
                ? "WITHIN_7_DAYS"
                : daysUntilExpiration <= 30
                  ? "WITHIN_30_DAYS"
                  : "BEYOND_30_DAYS";

          return {
            id:
              moc.id,

            reference:
              moc.reference,

            title:
              moc.title,

            status:
              moc.status,

            priority:
              moc.priority,

            site:
              moc.site.name,

            owner:
              moc.owner?.name ??
              "Unassigned",

            expirationDate,

            daysUntilExpiration,

            expirationCategory,

            residualRiskLevel:
              moc.residualRiskLevel,
          };
        }
      )
      .sort(
        (first, second) =>
          first.expirationDate.getTime() -
          second.expirationDate.getTime()
      );

  const temporaryExpired =
    temporaryChanges.filter(
      (moc) =>
        moc.expirationCategory ===
        "EXPIRED"
    );

  const temporaryWithinSevenDays =
    temporaryChanges.filter(
      (moc) =>
        moc.expirationCategory ===
        "WITHIN_7_DAYS"
    );

  const temporaryWithinThirtyDays =
    temporaryChanges.filter(
      (moc) =>
        moc.expirationDate >=
          now &&
        moc.expirationDate <=
          thirtyDayWindowEnd
    );

  const approvalCycleDurations =
    mocs.flatMap(
      (moc) =>
        moc.approvals.flatMap(
          (approval) =>
            approval.decidedAt
              ? [
                  differenceInDays(
                    approval.decidedAt,
                    approval.requestedAt
                  ),
                ]
              : []
        )
    );

  const completionDurations =
    mocs.flatMap(
      (moc) =>
        moc.closedAt
          ? [
              differenceInDays(
                moc.closedAt,
                moc.createdAt
              ),
            ]
          : []
    );

  const lifecycleDistribution =
    LIFECYCLE_STATUSES.map(
      (status) => ({
        status,

        count:
          mocs.filter(
            (moc) =>
              moc.status ===
              status
          ).length,
      })
    );

  const approvalRoleMap =
    new Map<
      string,
      {
        role: string;
        pending: number;
        averageWaitingDays: number;
        waitingDays: number[];
      }
    >();

  for (
    const approval
    of pendingApprovals
  ) {
    const current =
      approvalRoleMap.get(
        approval.role
      ) ?? {
        role:
          approval.role,

        pending: 0,

        averageWaitingDays: 0,

        waitingDays: [],
      };

    current.pending += 1;

    current.waitingDays.push(
      approval.waitingDays
    );

    approvalRoleMap.set(
      approval.role,
      current
    );
  }

  const approvalsByRole =
    Array.from(
      approvalRoleMap.values()
    )
      .map(
        (item) => ({
          role:
            item.role,

          pending:
            item.pending,

          averageWaitingDays:
            roundMetric(
              average(
                item.waitingDays
              )
            ),
        })
      )
      .sort(
        (first, second) =>
          second.pending -
          first.pending
      );

  const siteMap =
    new Map<
      string,
      {
        siteId: string;
        siteName: string;
        total: number;
        active: number;
        overdue: number;
        highRisk: number;
      }
    >();

  for (const moc of mocs) {
    const current =
      siteMap.get(
        moc.site.id
      ) ?? {
        siteId:
          moc.site.id,

        siteName:
          moc.site.name,

        total: 0,
        active: 0,
        overdue: 0,
        highRisk: 0,
      };

    current.total += 1;

    if (
      ACTIVE_MOC_STATUSES.includes(
        moc.status
      )
    ) {
      current.active += 1;
    }

    if (
      ACTIVE_MOC_STATUSES.includes(
        moc.status
      ) &&
      moc.plannedCompletionDate &&
      moc.plannedCompletionDate <
        now
    ) {
      current.overdue += 1;
    }

    if (
      ACTIVE_MOC_STATUSES.includes(
        moc.status
      ) &&
      (moc.residualRiskLevel ===
        RiskLevel.HIGH ||
        moc.residualRiskLevel ===
          RiskLevel.CRITICAL)
    ) {
      current.highRisk += 1;
    }

    siteMap.set(
      moc.site.id,
      current
    );
  }

  const siteExposure =
    Array.from(
      siteMap.values()
    ).sort(
      (first, second) =>
        second.highRisk -
          first.highRisk ||
        second.overdue -
          first.overdue ||
        second.active -
          first.active
    );

  const ownerMap =
    new Map<
      string,
      {
        ownerId: string | null;
        ownerName: string;
        activeChanges: number;
        overdueChanges: number;
        pendingTasks: number;
        overdueTasks: number;
      }
    >();

  for (
    const moc
    of activeMocs
  ) {
    const ownerKey =
      moc.owner?.id ??
      "UNASSIGNED";

    const current =
      ownerMap.get(
        ownerKey
      ) ?? {
        ownerId:
          moc.owner?.id ??
          null,

        ownerName:
          moc.owner?.name ??
          "Unassigned",

        activeChanges: 0,
        overdueChanges: 0,
        pendingTasks: 0,
        overdueTasks: 0,
      };

    current.activeChanges += 1;

    if (
      moc.plannedCompletionDate &&
      moc.plannedCompletionDate <
        now
    ) {
      current.overdueChanges +=
        1;
    }

    current.pendingTasks +=
      moc.tasks.filter(
        (task) =>
          task.status !==
            MocTaskStatus.COMPLETED &&
          task.status !==
            MocTaskStatus.CANCELLED
      ).length;

    current.overdueTasks +=
      moc.tasks.filter(
        (task) =>
          task.dueDate &&
          task.dueDate < now &&
          task.status !==
            MocTaskStatus.COMPLETED &&
          task.status !==
            MocTaskStatus.CANCELLED
      ).length;

    ownerMap.set(
      ownerKey,
      current
    );
  }

  const workloadByOwner =
    Array.from(
      ownerMap.values()
    ).sort(
      (first, second) =>
        second.activeChanges +
          second.pendingTasks -
        (first.activeChanges +
          first.pendingTasks)
    );

  const trendMonths =
    Array.from(
      {
        length: 12,
      },
      (_, index) =>
        addMonths(
          trendStart,
          index
        )
    );

  const monthlyTrends =
    trendMonths.map(
      (month) => {
        const monthStart =
          startOfMonth(month);

        const monthEnd =
          addMonths(
            monthStart,
            1
          );

        return {
          month:
            formatMonthKey(
              monthStart
            ),

          label:
            formatMonthLabel(
              monthStart
            ),

          opened:
            mocs.filter(
              (moc) =>
                moc.createdAt >=
                  monthStart &&
                moc.createdAt <
                  monthEnd
            ).length,

          closed:
            mocs.filter(
              (moc) =>
                moc.closedAt &&
                moc.closedAt >=
                  monthStart &&
                moc.closedAt <
                  monthEnd
            ).length,
        };
      }
    );

  const changeTypeMap =
    new Map<
      string,
      number
    >();

  const riskLevelMap =
    new Map<
      string,
      number
    >();

  for (const moc of mocs) {
    changeTypeMap.set(
      moc.changeType,
      (changeTypeMap.get(
        moc.changeType
      ) ?? 0) + 1
    );

    riskLevelMap.set(
      moc.residualRiskLevel,
      (riskLevelMap.get(
        moc.residualRiskLevel
      ) ?? 0) + 1
    );
  }

  const changesByType =
    Array.from(
      changeTypeMap.entries()
    )
      .map(
        ([
          changeType,
          count,
        ]) => ({
          changeType,
          count,
        })
      )
      .sort(
        (first, second) =>
          second.count -
          first.count
      );

  const residualRiskDistribution =
    Object.values(
      RiskLevel
    ).map(
      (riskLevel) => ({
        riskLevel,

        count:
          riskLevelMap.get(
            riskLevel
          ) ?? 0,
      })
    );

  const recentChanges =
    mocs
      .slice(0, 10)
      .map(
        (moc) => ({
          id:
            moc.id,

          reference:
            moc.reference,

          title:
            moc.title,

          status:
            moc.status,

          priority:
            moc.priority,

          site:
            moc.site.name,

          owner:
            moc.owner?.name ??
            "Unassigned",

          residualScore:
            moc.residualScore,

          residualRiskLevel:
            moc.residualRiskLevel,

          createdAt:
            moc.createdAt,

          plannedCompletionDate:
            moc.plannedCompletionDate,
        })
      );

  return {
    generatedAt:
      now.toISOString(),

    summary: {
      totalChanges:
        mocs.length,

      activeChanges:
        activeMocs.length,

      pendingApprovals:
        pendingApprovals.length,

      overdueTasks:
        overdueTasks.length,

      overdueChanges:
        overdueMocs.length,

      highRiskChanges:
        highRiskMocs.length,

      temporaryChanges:
        temporaryChanges.length,

      temporaryExpiringWithin30Days:
        temporaryWithinThirtyDays.length,

      temporaryExpiringWithin7Days:
        temporaryWithinSevenDays.length,

      expiredTemporaryChanges:
        temporaryExpired.length,

      inVerification:
        activeMocs.filter(
          (moc) =>
            moc.status ===
            MocStatus.VERIFICATION
        ).length,

      closedThisMonth:
        closedThisMonth.length,

      averageApprovalDays:
        roundMetric(
          average(
            approvalCycleDurations
          )
        ),

      averageCompletionDays:
        roundMetric(
          average(
            completionDurations
          )
        ),
    },

    lifecycleDistribution,
    approvalsByRole,
    pendingApprovals:
      pendingApprovals.slice(
        0,
        20
      ),

    overdueTasks:
      overdueTasks.slice(
        0,
        20
      ),

    temporaryChanges:
      temporaryChanges.filter(
        (moc) =>
          moc.expirationDate <=
          thirtyDayWindowEnd
      ),

    siteExposure,
    workloadByOwner,
    monthlyTrends,
    changesByType,
    residualRiskDistribution,
    recentChanges,

    thresholds: {
      sevenDayWindowEnd:
        sevenDayWindowEnd.toISOString(),

      thirtyDayWindowEnd:
        thirtyDayWindowEnd.toISOString(),
    },
  };
}

export type MocExecutiveDashboardData =
  Awaited<
    ReturnType<
      typeof getMocExecutiveDashboard
    >
  >;