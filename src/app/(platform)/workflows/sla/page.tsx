import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { requirePermission } from "@/lib/permissions";
import { runWorkflowSlaProcessor } from "@/core/workflow/workflow-sla.actions";
import {
  PermissionKey,
  WorkflowInstanceStatus,
  WorkflowStepStatus,
} from "@prisma/client";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Play,
} from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function WorkflowSlaPage() {
  await requirePermission(PermissionKey.MANAGE_WORKFLOWS);

  const { organizationId } = await getCurrentUserTenant();

  const now = new Date();
  const reminderThreshold = new Date(
    now.getTime() + 4 * 60 * 60 * 1000
  );

  const [
    activeTaskCount,
    overdueTaskCount,
    dueSoonTaskCount,
    reminderSentCount,
    tasks,
  ] = await Promise.all([
    prisma.workflowInstanceStep.count({
      where: {
        status: WorkflowStepStatus.IN_PROGRESS,
        instance: {
          organizationId,
          status: WorkflowInstanceStatus.ACTIVE,
        },
      },
    }),

    prisma.workflowInstanceStep.count({
      where: {
        status: WorkflowStepStatus.IN_PROGRESS,
        dueAt: {
          lt: now,
        },
        instance: {
          organizationId,
          status: WorkflowInstanceStatus.ACTIVE,
        },
      },
    }),

    prisma.workflowInstanceStep.count({
      where: {
        status: WorkflowStepStatus.IN_PROGRESS,
        dueAt: {
          gte: now,
          lte: reminderThreshold,
        },
        instance: {
          organizationId,
          status: WorkflowInstanceStatus.ACTIVE,
        },
      },
    }),

    prisma.workflowInstanceStep.count({
      where: {
        status: WorkflowStepStatus.IN_PROGRESS,
        OR: [
          {
            reminderSentAt: {
              not: null,
            },
          },
          {
            escalationSentAt: {
              not: null,
            },
          },
        ],
        instance: {
          organizationId,
          status: WorkflowInstanceStatus.ACTIVE,
        },
      },
    }),

    prisma.workflowInstanceStep.findMany({
      where: {
        status: WorkflowStepStatus.IN_PROGRESS,
        instance: {
          organizationId,
          status: WorkflowInstanceStatus.ACTIVE,
        },
      },
      orderBy: [
        {
          dueAt: "asc",
        },
        {
          createdAt: "desc",
        },
      ],
      include: {
        assignedUser: true,
        instance: {
          include: {
            template: true,
          },
        },
      },
    }),
  ]);

  const stats = [
    {
      title: "Active Tasks",
      value: activeTaskCount,
      note: "Currently in progress",
      icon: Clock3,
    },
    {
      title: "Due Soon",
      value: dueSoonTaskCount,
      note: "Due within four hours",
      icon: CalendarClock,
    },
    {
      title: "Overdue",
      value: overdueTaskCount,
      note: "Requires escalation",
      icon: AlertTriangle,
    },
    {
      title: "Alerts Sent",
      value: reminderSentCount,
      note: "Reminder or escalation sent",
      icon: CheckCircle2,
    },
  ];

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm text-cyan-300">
            <CalendarClock size={16} />
            Workflow SLA Administration
          </p>

          <h1 className="mt-2 text-4xl font-bold tracking-tight">
            SLA Monitoring
          </h1>

          <p className="mt-2 max-w-2xl text-slate-400">
            Monitor due dates, reminders, escalations, and workflow task
            performance across your organization.
          </p>
        </div>

        <form action={runWorkflowSlaProcessor}>
          <button
            type="submit"
            className="flex items-center gap-2 rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            <Play size={17} />
            Process SLA Alerts
          </button>
        </form>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.title}
              className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl"
            >
              <div className="mb-5 flex items-center justify-between">
                <div className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-300">
                  <Icon size={22} />
                </div>

                <span className="text-xs text-slate-500">{stat.note}</span>
              </div>

              <p className="text-sm text-slate-400">{stat.title}</p>
              <p className="mt-2 text-3xl font-bold text-white">
                {stat.value}
              </p>
            </div>
          );
        })}
      </div>

      <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl">
        <div className="border-b border-white/10 p-6">
          <h2 className="text-2xl font-semibold">Active Workflow Tasks</h2>
          <p className="mt-2 text-sm text-slate-400">
            Review SLA status and notification activity for every active task.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] border-collapse text-left text-sm">
            <thead className="border-b border-white/10 bg-white/5 text-slate-300">
              <tr>
                <th className="px-6 py-4 font-medium">Task</th>
                <th className="px-6 py-4 font-medium">Workflow</th>
                <th className="px-6 py-4 font-medium">Owner</th>
                <th className="px-6 py-4 font-medium">Due</th>
                <th className="px-6 py-4 font-medium">SLA Status</th>
                <th className="px-6 py-4 font-medium">Reminder</th>
                <th className="px-6 py-4 font-medium">Escalation</th>
              </tr>
            </thead>

            <tbody>
              {tasks.map((task) => {
                const isOverdue = Boolean(
                  task.dueAt && task.dueAt < now
                );

                const isDueSoon = Boolean(
                  task.dueAt &&
                    task.dueAt >= now &&
                    task.dueAt <= reminderThreshold
                );

                const entityLink = getEntityLink(
                  task.instance.entityType,
                  task.instance.entityId
                );

                return (
                  <tr
                    key={task.id}
                    className="border-b border-white/5 transition hover:bg-white/[0.03]"
                  >
                    <td className="px-6 py-5">
                      <Link
                        href={entityLink}
                        className="font-medium text-white hover:text-cyan-300"
                      >
                        {task.name}
                      </Link>

                      <p className="mt-1 text-xs text-slate-500">
                        {task.instance.entityType.replaceAll("_", " ")}
                      </p>
                    </td>

                    <td className="px-6 py-5 text-slate-300">
                      {task.instance.template.name}
                    </td>

                    <td className="px-6 py-5 text-slate-300">
                      {task.assignedUser?.name ||
                        (task.assignedRole
                          ? task.assignedRole.replaceAll("_", " ")
                          : "Unassigned")}
                    </td>

                    <td className="px-6 py-5">
                      <span
                        className={
                          isOverdue ? "text-red-300" : "text-slate-300"
                        }
                      >
                        {task.dueAt
                          ? task.dueAt.toLocaleString()
                          : "No SLA"}
                      </span>
                    </td>

                    <td className="px-6 py-5">
                      <SlaBadge
                        isOverdue={isOverdue}
                        isDueSoon={isDueSoon}
                        hasDueDate={Boolean(task.dueAt)}
                      />
                    </td>

                    <td className="px-6 py-5 text-slate-400">
                      {task.reminderSentAt
                        ? task.reminderSentAt.toLocaleString()
                        : "Not sent"}
                    </td>

                    <td className="px-6 py-5 text-slate-400">
                      {task.escalationSentAt
                        ? task.escalationSentAt.toLocaleString()
                        : "Not sent"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {tasks.length === 0 && (
          <div className="p-10 text-center text-slate-400">
            No active workflow tasks found.
          </div>
        )}
      </section>
    </div>
  );
}

function SlaBadge({
  isOverdue,
  isDueSoon,
  hasDueDate,
}: {
  isOverdue: boolean;
  isDueSoon: boolean;
  hasDueDate: boolean;
}) {
  if (isOverdue) {
    return (
      <span className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1 text-xs text-red-300">
        OVERDUE
      </span>
    );
  }

  if (isDueSoon) {
    return (
      <span className="rounded-full border border-orange-400/20 bg-orange-400/10 px-3 py-1 text-xs text-orange-300">
        DUE SOON
      </span>
    );
  }

  if (!hasDueDate) {
    return (
      <span className="rounded-full border border-slate-400/20 bg-slate-400/10 px-3 py-1 text-xs text-slate-300">
        NO SLA
      </span>
    );
  }

  return (
    <span className="rounded-full border border-green-400/20 bg-green-400/10 px-3 py-1 text-xs text-green-300">
      ON TRACK
    </span>
  );
}

function getEntityLink(entityType: string, entityId: string) {
  switch (entityType) {
    case "INCIDENT":
      return `/incidents/${entityId}`;

    case "CORRECTIVE_ACTION":
      return "/actions";

    case "AUDIT":
      return "/audits";

    case "INSPECTION":
      return "/inspections";

    case "COMPLIANCE":
      return "/compliance";

    case "TRAINING":
      return "/training";

    default:
      return "/tasks";
  }
}