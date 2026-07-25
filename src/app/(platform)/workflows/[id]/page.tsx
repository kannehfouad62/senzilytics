import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { requirePermission } from "@/lib/permissions";
import { addWorkflowTemplateStep,
  deleteWorkflowTemplate,
  deleteWorkflowTemplateStep,
  updateWorkflowTemplate,
  updateWorkflowTemplateStep,} from "@/core/workflow/workflow.admin.actions";
import { WorkflowStepSorter } from "@/core/workflow/workflow-step-sorter";
import { WorkflowTriggerSettingsFields } from "@/core/workflow/workflow-trigger-settings-fields";
import { WorkflowOutcomeDefinitionForm } from "@/core/workflow/workflow-outcome-definition-form";
import {
  deleteWorkflowOutcomeDefinition,
  toggleWorkflowOutcomeDefinition,
} from "@/core/workflow/workflow-outcome.actions";
import { PermissionKey, UserRole, WorkflowEntityType, WorkflowStepType, } from "@prisma/client";
import { ArrowLeft, GitBranch } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function WorkflowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission(PermissionKey.MANAGE_WORKFLOWS);

  const { id } = await params;
  const { organizationId } = await getCurrentUserTenant();

  const workflow = await prisma.workflowTemplate.findFirst({
    where: {
      id,
      organizationId,
    },
    include: {
      steps: {
        orderBy: {
          sequence: "asc",
        },
        include: {
          approveNextStep: true,
          rejectNextStep: true,
          outcomes: {
            orderBy: {
              createdAt: "asc",
            },
            include: {
              _count: {
                select: {
                  executions: true,
                },
              },
            },
          },
        },
      },
      instances: {
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
      },
    },
  });

  if (!workflow) {
    notFound();
  }

  const [users, sites] = await Promise.all([
    prisma.user.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        role: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
    prisma.site.findMany({
      where: {
        organizationId,
      },
      select: {
        id: true,
        name: true,
        departments: {
          select: {
            id: true,
            name: true,
          },
          orderBy: {
            name: "asc",
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    }),
  ]);
  const outcomes = workflow.steps.flatMap((step) =>
    step.outcomes.map((outcome) => ({
      ...outcome,
      stepName: step.name,
      stepSequence: step.sequence,
    })),
  );

  return (
    <div>
      <Link
        href="/workflows"
        className="mb-6 inline-flex items-center gap-2 text-sm text-cyan-300 hover:text-cyan-200"
      >
        <ArrowLeft size={16} />
        Back to workflows
      </Link>

      <div className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
        <p className="flex items-center gap-2 text-sm text-cyan-300">
          <GitBranch size={16} />
          Workflow Template
        </p>

        <h1 className="mt-2 text-4xl font-bold tracking-tight">
          {workflow.name}
        </h1>

        <p className="mt-3 max-w-3xl text-slate-400">
          {workflow.description || "No description provided."}
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <InfoCard
            label="Entity Type"
            value={workflow.entityType.replaceAll("_", " ")}
          />
          <InfoCard
            label="Status"
            value={workflow.isActive ? "ACTIVE" : "INACTIVE"}
          />
          <InfoCard label="Steps" value={workflow.steps.length.toString()} />
          <InfoCard
            label="Instances"
            value={workflow.instances.length.toString()}
          />
          <InfoCard
            label="Automated Outcomes"
            value={outcomes.length.toString()}
          />
        </div>
      </div>

      <section className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
  <h2 className="text-2xl font-semibold">Template Settings</h2>

  <form action={updateWorkflowTemplate} className="mt-5 space-y-5">
    <input type="hidden" name="workflowId" value={workflow.id} />

    <div className="grid gap-5 md:grid-cols-2">
      <div>
        <label className="mb-2 block text-sm text-slate-300">
          Workflow Name
        </label>
        <input
          name="name"
          defaultValue={workflow.name}
          className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-cyan-400"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm text-slate-300">
          Entity Type
        </label>
        <select
          name="entityType"
          defaultValue={workflow.entityType}
          className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-cyan-400"
        >
          {Object.values(WorkflowEntityType).map((type) => (
            <option key={type} value={type}>
              {type.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>
    </div>

    <WorkflowTriggerSettingsFields
      triggerEvent={workflow.triggerEvent}
      triggerConditions={workflow.triggerConditions}
    />

    <div>
      <label className="mb-2 block text-sm text-slate-300">
        Description
      </label>
      <textarea
        name="description"
        rows={3}
        defaultValue={workflow.description || ""}
        className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-cyan-400"
      />
    </div>

    <button
      type="submit"
      className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
    >
      Save Template Settings
    </button>

    
  </form>
  <form action={deleteWorkflowTemplate} className="border-t border-white/10 pt-5">
  <input type="hidden" name="workflowId" value={workflow.id} />

  <button
    type="submit"
    className="rounded-2xl border border-red-400/20 bg-red-400/10 px-5 py-3 text-sm font-semibold text-red-300 hover:bg-red-400/20"
  >
    Delete Workflow Template
  </button>

  <p className="mt-2 text-xs text-slate-500">
    Templates with existing workflow instances cannot be deleted. Deactivate
    them instead.
  </p>
</form>
  
</section>



      <section className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Workflow Steps</h2>
            <p className="mt-2 text-sm text-slate-400">
              Drag steps to reorder them, or edit step names, descriptions,
              required roles, SLA targets, and step types.
            </p>
          </div>

          <form action={addWorkflowTemplateStep}>
            <input type="hidden" name="workflowId" value={workflow.id} />

            <button
              type="submit"
              className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
            >
              Add Step
              
            </button>
            
          </form>
          <Link
  href={`/workflows/${workflow.id}/builder`}
  className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-300 hover:bg-cyan-400/20"
>
  Open Builder
</Link>
        </div>

        <div className="mt-5">
          <WorkflowStepSorter workflowId={workflow.id} steps={workflow.steps} />
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="border-b border-white/10 bg-white/5 text-slate-300">
              <tr>
                <th className="px-5 py-3 font-medium">Seq</th>
                <th className="px-5 py-3 font-medium">Step</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 font-medium">SLA</th>
                <th className="px-5 py-3 font-medium">Approve Goes To</th>
                <th className="px-5 py-3 font-medium">Reject Goes To</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>

            <tbody>
              {workflow.steps.map((step) => (
                <tr key={step.id} className="border-b border-white/5 align-top">
                  <td className="px-5 py-4 text-slate-400">
                    {step.sequence}
                  </td>

                  <td className="px-5 py-4">
                    <form
                      id={`step-form-${step.id}`}
                      action={updateWorkflowTemplateStep}
                      className="space-y-3"
                    >
                      <input
                        type="hidden"
                        name="workflowId"
                        value={workflow.id}
                      />
                      <input type="hidden" name="stepId" value={step.id} />

                      <input
                        name="name"
                        defaultValue={step.name}
                        className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-white outline-none focus:border-cyan-400"
                      />

                      <textarea
                        name="description"
                        rows={2}
                        defaultValue={step.description || ""}
                        className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                      />
                    </form>
                  </td>

                  <td className="px-5 py-4">
                    <select
                      form={`step-form-${step.id}`}
                      name="stepType"
                      defaultValue={step.stepType}
                      className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                    >
                      {Object.values(WorkflowStepType).map((type) => (
                        <option key={type} value={type}>
                          {type.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="px-5 py-4">
                    <select
                      form={`step-form-${step.id}`}
                      name="requiredRole"
                      defaultValue={step.requiredRole || "NONE"}
                      className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                    >
                      <option value="NONE">None</option>
                      {Object.values(UserRole).map((role) => (
                        <option key={role} value={role}>
                          {role.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="px-5 py-4">
                    <input
                      form={`step-form-${step.id}`}
                      name="slaHours"
                      type="number"
                      min="0"
                      defaultValue={step.slaHours || ""}
                      className="w-28 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                    />
                  </td>

                  <td className="px-5 py-4">
  <select
    form={`step-form-${step.id}`}
    name="approveNextStepId"
    defaultValue={step.approveNextStepId || "SEQUENCE"}
    className="w-48 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
  >
    <option value="SEQUENCE">Next in sequence</option>
    <option value="NONE">End workflow</option>

    {workflow.steps
      .filter((targetStep) => targetStep.id !== step.id)
      .map((targetStep) => (
        <option key={targetStep.id} value={targetStep.id}>
          Step {targetStep.sequence}: {targetStep.name}
        </option>
      ))}
  </select>

  <p className="mt-2 text-xs text-slate-500">
    Current:{" "}
    {step.approveNextStep
      ? step.approveNextStep.name
      : "Next in sequence"}
  </p>
</td>

<td className="px-5 py-4">
  <select
    form={`step-form-${step.id}`}
    name="rejectNextStepId"
    defaultValue={step.rejectNextStepId || "NONE"}
    className="w-48 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
  >
    <option value="NONE">Remain rejected</option>
    <option value="SEQUENCE">Next in sequence</option>

    {workflow.steps
      .filter((targetStep) => targetStep.id !== step.id)
      .map((targetStep) => (
        <option key={targetStep.id} value={targetStep.id}>
          Step {targetStep.sequence}: {targetStep.name}
        </option>
      ))}
  </select>

  <p className="mt-2 text-xs text-slate-500">
    Current:{" "}
    {step.rejectNextStep
      ? step.rejectNextStep.name
      : "Remain rejected"}
  </p>
</td>



                  <td className="px-5 py-4">
                    <div className="flex flex-col gap-3">
                      <button
                        form={`step-form-${step.id}`}
                        type="submit"
                        className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
                      >
                        Save Step
                      </button>

                      <form action={deleteWorkflowTemplateStep}>
                        <input
                          type="hidden"
                          name="workflowId"
                          value={workflow.id}
                        />
                        <input type="hidden" name="stepId" value={step.id} />

                        <button
                          type="submit"
                          className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-400/20"
                        >
                          Delete Step
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
        <div>
          <h2 className="text-2xl font-semibold">Automated Outcomes</h2>
          <p className="mt-2 max-w-4xl text-sm text-slate-400">
            Configure governed actions that run after a step is approved,
            rejected, escalated, or completes the workflow. Consequential
            actions remain pending until a workflow administrator approves
            them in SLA Monitoring.
          </p>
        </div>

        <WorkflowOutcomeDefinitionForm
          workflowId={workflow.id}
          steps={workflow.steps.map((step) => ({
            id: step.id,
            name: step.name,
            sequence: step.sequence,
          }))}
          users={users}
          sites={sites}
        />

        <div className="mt-8 overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead className="border-b border-white/10 bg-white/5 text-slate-300">
              <tr>
                <th className="px-5 py-3 font-medium">Outcome</th>
                <th className="px-5 py-3 font-medium">Step / event</th>
                <th className="px-5 py-3 font-medium">Action</th>
                <th className="px-5 py-3 font-medium">Governance</th>
                <th className="px-5 py-3 font-medium">History</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {outcomes.map((outcome) => (
                <tr
                  key={outcome.id}
                  className="border-b border-white/5 align-top"
                >
                  <td className="px-5 py-4">
                    <p className="font-medium text-white">{outcome.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {outcome.isActive ? "Active" : "Inactive"}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-slate-300">
                    <p>
                      {outcome.stepSequence}. {outcome.stepName}
                    </p>
                    <p className="mt-1 text-xs text-cyan-300">
                      {outcome.event.replaceAll("_", " ")}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-slate-300">
                    {outcome.outcomeType.replaceAll("_", " ")}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs ${
                        outcome.requiresApproval
                          ? "border-amber-400/20 bg-amber-400/10 text-amber-300"
                          : "border-cyan-400/20 bg-cyan-400/10 text-cyan-300"
                      }`}
                    >
                      {outcome.requiresApproval
                        ? "APPROVAL REQUIRED"
                        : "AUTOMATIC"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-slate-300">
                    {outcome._count.executions} execution
                    {outcome._count.executions === 1 ? "" : "s"}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      <form action={toggleWorkflowOutcomeDefinition}>
                        <input
                          type="hidden"
                          name="workflowId"
                          value={workflow.id}
                        />
                        <input
                          type="hidden"
                          name="definitionId"
                          value={outcome.id}
                        />
                        <button
                          type="submit"
                          className="rounded-lg border border-cyan-400/20 px-3 py-2 text-xs text-cyan-300 hover:bg-cyan-400/10"
                        >
                          {outcome.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </form>
                      {outcome._count.executions === 0 && (
                        <form action={deleteWorkflowOutcomeDefinition}>
                          <input
                            type="hidden"
                            name="workflowId"
                            value={workflow.id}
                          />
                          <input
                            type="hidden"
                            name="definitionId"
                            value={outcome.id}
                          />
                          <button
                            type="submit"
                            className="rounded-lg border border-red-400/20 px-3 py-2 text-xs text-red-300 hover:bg-red-400/10"
                          >
                            Delete
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {outcomes.length === 0 && (
            <p className="p-8 text-center text-sm text-slate-400">
              No automated outcomes have been configured.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
        <h2 className="text-2xl font-semibold">Recent Workflow Instances</h2>

        <div className="mt-5 space-y-3">
          {workflow.instances.map((instance) => (
            <div
              key={instance.id}
              className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-white">
                    {instance.entityType.replaceAll("_", " ")}
                  </p>
                  {instance.entityType === "INCIDENT" ? (
  <Link
    href={`/incidents/${instance.entityId}`}
    className="text-xs text-cyan-300 hover:text-cyan-200"
  >
    Open related incident
  </Link>
) : (
  <p className="text-xs text-slate-500">{instance.entityId}</p>
)}
                </div>

                <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300">
                  {instance.status.replaceAll("_", " ")}
                </span>
              </div>
            </div>
          ))}

          {workflow.instances.length === 0 && (
            <p className="text-slate-400">No workflow instances found.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-medium text-slate-100">{value}</p>
    </div>
  );
}
