import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { requirePermission } from "@/lib/permissions";
import { toggleWorkflowTemplateStatus } from "@/core/workflow/workflow.admin.actions";
import { PermissionKey } from "@prisma/client";
import { CalendarClock, GitBranch, Plus } from "lucide-react";
import Link from "next/link";


export default async function WorkflowsPage() {
  await requirePermission(PermissionKey.MANAGE_WORKFLOWS);

  const { organizationId } = await getCurrentUserTenant();

  const workflows = await prisma.workflowTemplate.findMany({
    where: {
      organizationId,
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      steps: {
        orderBy: {
          sequence: "asc",
        },
      },
    },
  });

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm text-cyan-300">
            <GitBranch size={16} />
            Workflow Administration
          </p>

          <h1 className="mt-2 text-4xl font-bold tracking-tight">Workflows</h1>

          <p className="mt-2 max-w-2xl text-slate-400">
            View workflow templates, approval steps, assigned roles, and SLA
            targets for each process.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
        <Link
          href="/workflows/new"
          className="flex items-center gap-2 rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
        >
          <Plus size={18} />
          New Workflow
        </Link>

        <Link
  href="/workflows/sla"
  className="flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-400/20"
>
  <CalendarClock size={18} />
  SLA Monitoring
</Link>
</div>
      </div>

      <div className="grid gap-6">
        {workflows.map((workflow) => (
          <div
            key={workflow.id}
            className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl"
          >
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm text-cyan-300">
                  {workflow.entityType.replaceAll("_", " ")}
                </p>
                <Link
  href={`/workflows/${workflow.id}`}
  className="mt-1 block text-2xl font-semibold hover:text-cyan-300"
>
  {workflow.name}
</Link>
                <p className="mt-2 max-w-3xl text-sm text-slate-400">
                  {workflow.description || "No description provided."}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full border px-3 py-1 text-xs ${
                    workflow.isActive
                      ? "border-green-400/20 bg-green-400/10 text-green-300"
                      : "border-slate-400/20 bg-slate-400/10 text-slate-300"
                  }`}
                >
                  {workflow.isActive ? "ACTIVE" : "INACTIVE"}
                </span>

                <form action={toggleWorkflowTemplateStatus}>
                  <input type="hidden" name="workflowId" value={workflow.id} />
                  <input
                    type="hidden"
                    name="isActive"
                    value={String(workflow.isActive)}
                  />

                  <button
                    type="submit"
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 hover:bg-white/10"
                  >
                    {workflow.isActive ? "Deactivate" : "Activate"}
                  </button>
                </form>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/10">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="border-b border-white/10 bg-white/5 text-slate-300">
                  <tr>
                    <th className="px-5 py-3 font-medium">Seq</th>
                    <th className="px-5 py-3 font-medium">Step</th>
                    <th className="px-5 py-3 font-medium">Type</th>
                    <th className="px-5 py-3 font-medium">Required Role</th>
                    <th className="px-5 py-3 font-medium">SLA</th>
                  </tr>
                </thead>

                <tbody>
                  {workflow.steps.map((step) => (
                    <tr
                      key={step.id}
                      className="border-b border-white/5 hover:bg-white/[0.03]"
                    >
                      <td className="px-5 py-4 text-slate-400">
                        {step.sequence}
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-medium text-white">{step.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {step.description || "No description."}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-slate-300">
                        {step.stepType.replaceAll("_", " ")}
                      </td>

                      <td className="px-5 py-4 text-slate-300">
                        {step.requiredRole
                          ? step.requiredRole.replaceAll("_", " ")
                          : "None"}
                      </td>

                      <td className="px-5 py-4 text-slate-300">
                        {step.slaHours ? `${step.slaHours} hours` : "No SLA"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {workflows.length === 0 && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-slate-400">
            No workflow templates found.
          </div>
        )}
      </div>
    </div>
  );
}