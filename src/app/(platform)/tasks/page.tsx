import { updateWorkflowGeneratedTask } from "@/core/workflow/workflow-outcome.actions";
import {
  getCurrentUserPermissions,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  PermissionKey,
  WorkflowGeneratedTaskStatus,
} from "@prisma/client";
import { ClipboardList, Sparkles } from "lucide-react";
import Link from "next/link";

export default async function TasksPage() {
  const [{ organizationId, user }, permissions] = await Promise.all([
    getCurrentUserTenant(),
    getCurrentUserPermissions(),
  ]);
  const canManageWorkflows = permissions.includes(
    PermissionKey.MANAGE_WORKFLOWS,
  );
  const [tasks, generatedTasks] = await Promise.all([
    prisma.workflowInstanceStep.findMany({
      where: {
        status: "IN_PROGRESS",
        instance: {
          organizationId,
          status: "ACTIVE",
        },
        OR: [
          {
            assignedUserId: user.id,
          },
          {
            assignedRole: user.role,
          },
          {
            assignedUserId: null,
            assignedRole: null,
          },
        ],
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        instance: {
          include: {
            template: true,
          },
        },
        assignedUser: true,
      },
    }),
    prisma.workflowGeneratedTask.findMany({
      where: {
        organizationId,
        status: {
          in: [
            WorkflowGeneratedTaskStatus.OPEN,
            WorkflowGeneratedTaskStatus.IN_PROGRESS,
          ],
        },
        ...(canManageWorkflows
          ? {}
          : {
              OR: [
                { assignedUserId: user.id },
                {
                  assignedUserId: null,
                  assignedRole: user.role,
                },
              ],
            }),
      },
      include: {
        assignedUser: {
          select: {
            name: true,
          },
        },
        outcomeExecution: {
          include: {
            definition: {
              select: {
                name: true,
              },
            },
            workflowInstance: {
              include: {
                template: {
                  select: {
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
          dueAt: "asc",
        },
        {
          createdAt: "desc",
        },
      ],
    }),
  ]);

  return (
    <div>
      <div className="mb-8">
        <p className="flex items-center gap-2 text-sm text-cyan-300">
          <ClipboardList size={16} />
          Workflow Inbox
        </p>

        <h1 className="mt-2 text-4xl font-bold tracking-tight">My Tasks</h1>

        <p className="mt-2 max-w-2xl text-slate-400">
          Review approval steps and cross-module actions assigned to you or
          your role.
        </p>
      </div>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Sparkles size={18} className="text-cyan-300" />
          <h2 className="text-xl font-semibold">Generated Action Tasks</h2>
        </div>
        <div className="space-y-4">
          {generatedTasks.map((task) => {
            const link = getEntityLink(
              task.sourceEntityType,
              task.sourceEntityId,
            );
            const isOverdue = Boolean(
              task.dueAt && task.dueAt < new Date(),
            );

            return (
              <article
                key={task.id}
                className={`rounded-3xl border p-6 shadow-2xl backdrop-blur-xl ${
                  isOverdue
                    ? "border-red-400/30 bg-red-400/10"
                    : "border-cyan-400/20 bg-cyan-400/[0.04]"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-cyan-300">
                      {
                        task.outcomeExecution.workflowInstance.template
                          .name
                      }{" "}
                      · {task.outcomeExecution.definition.name}
                    </p>
                    <Link
                      href={link}
                      className="mt-1 block text-xl font-semibold text-white hover:text-cyan-200"
                    >
                      {task.title}
                    </Link>
                    <p className="mt-2 max-w-3xl text-sm text-slate-400">
                      {task.description ||
                        `${task.sourceEntityType.replaceAll("_", " ")} follow-up`}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs ${
                      isOverdue
                        ? "border-red-400/20 bg-red-400/10 text-red-300"
                        : "border-cyan-400/20 bg-cyan-400/10 text-cyan-300"
                    }`}
                  >
                    {isOverdue
                      ? "OVERDUE"
                      : task.status.replaceAll("_", " ")}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                  <Detail
                    label="Owner"
                    value={
                      task.assignedUser?.name ||
                      task.assignedRole?.replaceAll("_", " ") ||
                      "Unassigned"
                    }
                  />
                  <Detail
                    label="Source"
                    value={task.sourceEntityType.replaceAll("_", " ")}
                  />
                  <Detail
                    label="Due"
                    value={
                      task.dueAt ? task.dueAt.toLocaleString() : "No due date"
                    }
                    danger={isOverdue}
                  />
                </div>

                <form
                  action={updateWorkflowGeneratedTask}
                  className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]"
                >
                  <input type="hidden" name="taskId" value={task.id} />
                  <input
                    name="completionNotes"
                    maxLength={1000}
                    placeholder="Completion notes"
                    className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                  />
                  {task.status === WorkflowGeneratedTaskStatus.OPEN && (
                    <button
                      type="submit"
                      name="status"
                      value={WorkflowGeneratedTaskStatus.IN_PROGRESS}
                      className="rounded-xl border border-cyan-400/20 px-4 py-2 text-sm text-cyan-300 hover:bg-cyan-400/10"
                    >
                      Start
                    </button>
                  )}
                  <button
                    type="submit"
                    name="status"
                    value={WorkflowGeneratedTaskStatus.COMPLETED}
                    className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-300"
                  >
                    Complete
                  </button>
                  {canManageWorkflows && (
                    <button
                      type="submit"
                      name="status"
                      value={WorkflowGeneratedTaskStatus.CANCELLED}
                      className="rounded-xl border border-red-400/20 px-4 py-2 text-sm text-red-300 hover:bg-red-400/10"
                    >
                      Cancel
                    </button>
                  )}
                </form>
              </article>
            );
          })}

          {generatedTasks.length === 0 && (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-slate-400">
              No generated action tasks currently require attention.
            </div>
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-semibold">Approval Steps</h2>
        <div className="space-y-4">
          {tasks.map((task) => {
            const link = getEntityLink(
              task.instance.entityType,
              task.instance.entityId,
            );
            const isOverdue = Boolean(
              task.dueAt && task.dueAt < new Date(),
            );

            return (
              <Link
                key={task.id}
                href={link}
                className={`block rounded-3xl border p-6 shadow-2xl backdrop-blur-xl transition ${
                  isOverdue
                    ? "border-red-400/30 bg-red-400/10 hover:bg-red-400/15"
                    : "border-white/10 bg-white/5 hover:border-cyan-400/30 hover:bg-cyan-400/5"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-cyan-300">
                      {task.instance.template.name}
                    </p>
                    <h3 className="mt-1 text-xl font-semibold">{task.name}</h3>
                    <p className="mt-2 text-sm text-slate-400">
                      Entity: {task.instance.entityType.replaceAll("_", " ")}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs ${
                      isOverdue
                        ? "border-red-400/20 bg-red-400/10 text-red-300"
                        : "border-cyan-400/20 bg-cyan-400/10 text-cyan-300"
                    }`}
                  >
                    {isOverdue
                      ? "OVERDUE"
                      : task.status.replaceAll("_", " ")}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 text-sm md:grid-cols-4">
                  <Detail
                    label="Required role"
                    value={
                      task.assignedRole?.replaceAll("_", " ") ||
                      "Any authorized user"
                    }
                  />
                  <Detail
                    label="Assigned user"
                    value={task.assignedUser?.name || "None"}
                  />
                  <Detail
                    label="Started"
                    value={
                      task.startedAt
                        ? task.startedAt.toLocaleString()
                        : "Not started"
                    }
                  />
                  <Detail
                    label="Due"
                    value={
                      task.dueAt ? task.dueAt.toLocaleString() : "No SLA"
                    }
                    danger={isOverdue}
                  />
                </div>
              </Link>
            );
          })}

          {tasks.length === 0 && (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-slate-400">
              No workflow approval steps currently require your action.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Detail({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <p className="text-slate-400">
      {label}:{" "}
      <span className={danger ? "text-red-300" : "text-slate-200"}>
        {value}
      </span>
    </p>
  );
}

function getEntityLink(entityType: string, entityId: string) {
  switch (entityType) {
    case "INCIDENT":
      return `/incidents/${entityId}`;
    case "CORRECTIVE_ACTION":
      return `/actions/${entityId}`;
    case "AUDIT":
      return `/audits/${entityId}`;
    case "INSPECTION":
      return `/inspections/${entityId}`;
    case "COMPLIANCE":
      return `/compliance/${entityId}`;
    case "TRAINING":
      return `/training/${entityId}`;
    case "PERMIT":
      return `/permits-to-work/${entityId}`;
    case "CHEMICAL":
      return `/chemicals/${entityId}`;
    case "ENVIRONMENTAL":
      return `/environmental/${entityId}`;
    case "MOC":
      return `/moc/${entityId}`;
    case "OBSERVATION":
      return `/observations/${entityId}`;
    case "RISK":
      return `/risks/${entityId}`;
    default:
      return "/tasks";
  }
}
