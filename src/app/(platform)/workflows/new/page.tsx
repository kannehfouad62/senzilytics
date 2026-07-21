import { createWorkflowTemplate } from "@/core/workflow/workflow.admin.actions";
import {
  UserRole,
  WorkflowEntityType,
  WorkflowStepType,
} from "@prisma/client";
import Link from "next/link";

export default function NewWorkflowPage() {
  const defaultSteps = [
    "Start",
    "Review",
    "Approval",
    "Verification",
    "Closure",
  ];

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <p className="text-sm text-cyan-300">Workflow Builder</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">
          New Workflow Template
        </h1>
        <p className="mt-2 max-w-2xl text-slate-400">
          Create a configurable approval workflow for incidents, audits,
          inspections, compliance, training, documents, or future modules.
        </p>
      </div>

      <form
        action={createWorkflowTemplate}
        className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl"
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm text-slate-300">
              Workflow Name
            </label>
            <input
              name="name"
              required
              placeholder="Example: Audit Finding Approval"
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">
              Entity Type
            </label>
            <select
              name="entityType"
              required
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

        <div>
          <label className="mb-2 block text-sm text-slate-300">
            Description
          </label>
          <textarea
            name="description"
            rows={3}
            placeholder="Describe what this workflow controls..."
            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-cyan-400"
          />
        </div>

        <div>
          <h2 className="mb-4 text-xl font-semibold">Workflow Steps</h2>

          <div className="space-y-4">
            {defaultSteps.map((step, index) => (
              <div
                key={index}
                className="grid gap-4 rounded-2xl border border-white/10 bg-slate-950/50 p-4 md:grid-cols-4"
              >
                <div>
                  <label className="mb-2 block text-xs text-slate-400">
                    Step Name
                  </label>
                  <input
                    name="stepName"
                    defaultValue={step}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-white outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs text-slate-400">
                    Step Type
                  </label>
                  <select
                    name="stepType"
                    defaultValue={
                      index === 0
                        ? WorkflowStepType.START
                        : index === defaultSteps.length - 1
                          ? WorkflowStepType.CLOSE
                          : WorkflowStepType.REVIEW
                    }
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-white outline-none focus:border-cyan-400"
                  >
                    {Object.values(WorkflowStepType).map((type) => (
                      <option key={type} value={type}>
                        {type.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs text-slate-400">
                    Required Role
                  </label>
                  <select
                    name="requiredRole"
                    defaultValue="NONE"
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-white outline-none focus:border-cyan-400"
                  >
                    <option value="NONE">None</option>
                    {Object.values(UserRole).map((role) => (
                      <option key={role} value={role}>
                        {role.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs text-slate-400">
                    SLA Hours
                  </label>
                  <input
                    name="slaHours"
                    type="number"
                    min="0"
                    placeholder="24"
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-white outline-none focus:border-cyan-400"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            className="rounded-2xl bg-cyan-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            Create Workflow
          </button>

          <Link
            href="/workflows"
            className="rounded-2xl border border-white/10 px-6 py-3 text-slate-300 transition hover:bg-white/5"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
