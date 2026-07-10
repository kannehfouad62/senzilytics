import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { ClipboardList } from "lucide-react";
import Link from "next/link";

export default async function TasksPage() {
  const { organizationId, user } = await getCurrentUserTenant();

  const tasks = await prisma.workflowInstanceStep.findMany({
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
  });

  return (
    <div>
      <div className="mb-8">
        <p className="flex items-center gap-2 text-sm text-cyan-300">
          <ClipboardList size={16} />
          Workflow Inbox
        </p>

        <h1 className="mt-2 text-4xl font-bold tracking-tight">My Tasks</h1>

        <p className="mt-2 max-w-2xl text-slate-400">
          Review workflow steps currently assigned to you or your role.
        </p>
      </div>

      <div className="space-y-4">
        {tasks.map((task) => {
          const link =
            task.instance.entityType === "INCIDENT"
              ? `/incidents/${task.instance.entityId}`
              : "#";

          const isOverdue = task.dueAt && task.dueAt < new Date();

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

                  <h2 className="mt-1 text-xl font-semibold">{task.name}</h2>

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
                  {isOverdue ? "OVERDUE" : task.status.replaceAll("_", " ")}
                </span>
              </div>

              <div className="mt-4 grid gap-3 text-sm md:grid-cols-4">
                <p className="text-slate-400">
                  Required Role:{" "}
                  <span className="text-slate-200">
                    {task.assignedRole
                      ? task.assignedRole.replaceAll("_", " ")
                      : "Any authorized user"}
                  </span>
                </p>

                <p className="text-slate-400">
                  Assigned User:{" "}
                  <span className="text-slate-200">
                    {task.assignedUser?.name || "None"}
                  </span>
                </p>

                <p className="text-slate-400">
                  Started:{" "}
                  <span className="text-slate-200">
                    {task.startedAt
                      ? task.startedAt.toLocaleString()
                      : "Not started"}
                  </span>
                </p>

                <p className="text-slate-400">
                  Due:{" "}
                  <span className={isOverdue ? "text-red-300" : "text-slate-200"}>
                    {task.dueAt ? task.dueAt.toLocaleString() : "No SLA"}
                  </span>
                </p>
              </div>
            </Link>
          );
        })}

        {tasks.length === 0 && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-slate-400">
            No workflow tasks currently require your action.
          </div>
        )}
      </div>
    </div>
  );
}