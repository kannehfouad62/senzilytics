import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { requirePermission } from "@/lib/permissions";
import { WorkflowStepSorter } from "@/core/workflow/workflow-step-sorter";
import { PermissionKey } from "@prisma/client";
import { ArrowLeft, GitBranch } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { WorkflowBranchPreview } from "@/core/workflow/workflow-branch-preview";

export default async function WorkflowBuilderPage({
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
        },
      },
    },
  });

  if (!workflow) {
    notFound();
  }

  return (
    <div>
      <Link
        href={`/workflows/${workflow.id}`}
        className="mb-6 inline-flex items-center gap-2 text-sm text-cyan-300 hover:text-cyan-200"
      >
        <ArrowLeft size={16} />
        Back to workflow details
      </Link>

      <div className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
        <p className="flex items-center gap-2 text-sm text-cyan-300">
          <GitBranch size={16} />
          Visual Workflow Builder
        </p>

        <h1 className="mt-2 text-4xl font-bold tracking-tight">
          {workflow.name}
        </h1>

        <p className="mt-3 max-w-3xl text-slate-400">
          Drag steps to reorder this workflow. Later, this builder will support
          branching, parallel approvals, escalations, and automated actions.
        </p>
      </div>

      <section className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
  <div className="mb-6">
    <p className="text-sm text-cyan-300">Decision Routing</p>

    <h2 className="mt-1 text-2xl font-semibold">
      Workflow Branches
    </h2>

    <p className="mt-2 text-sm text-slate-400">
      Review where each approval and rejection decision routes the workflow.
    </p>
  </div>

  <WorkflowBranchPreview steps={workflow.steps} />
</section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold">Step Order</h2>
          <p className="mt-2 text-sm text-slate-400">
            Drag and drop steps to change the workflow sequence.
          </p>
        </div>

        <div className="mb-8 overflow-x-auto rounded-3xl border border-cyan-400/20 bg-cyan-400/5 p-5">
  <div className="flex min-w-max items-center gap-3">
    {workflow.steps.map((step, index) => (
      <div key={step.id} className="flex items-center gap-3">
        <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3">
          <p className="text-xs text-slate-500">Step {step.sequence}</p>
          <p className="mt-1 whitespace-nowrap font-medium text-white">
            {step.name}
          </p>
          <p className="mt-1 text-xs text-cyan-300">
            {step.stepType.replaceAll("_", " ")}
          </p>
        </div>

        {index < workflow.steps.length - 1 && (
          <span className="text-slate-500">→</span>
        )}
      </div>
    ))}
  </div>
</div>

        <WorkflowStepSorter workflowId={workflow.id} steps={workflow.steps} />
      </section>
    </div>
  );
}