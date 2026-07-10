"use client";

import { GitBranch } from "lucide-react";

type WorkflowStep = {
  id: string;
  name: string;
  sequence: number;
  stepType: string;
  approveNextStepId: string | null;
  rejectNextStepId: string | null;
};

export function WorkflowBranchPreview({
  steps,
}: {
  steps: WorkflowStep[];
}) {
  const orderedSteps = [...steps].sort(
    (firstStep, secondStep) => firstStep.sequence - secondStep.sequence
  );

  function findStep(stepId: string | null) {
    if (!stepId) return null;

    return orderedSteps.find((step) => step.id === stepId) ?? null;
  }

  function getSequentialStep(currentStep: WorkflowStep) {
    return (
      orderedSteps.find(
        (step) => step.sequence === currentStep.sequence + 1
      ) ?? null
    );
  }

  return (
    <div className="space-y-4">
      {orderedSteps.map((step) => {
        const approveTarget =
          findStep(step.approveNextStepId) ?? getSequentialStep(step);

        const rejectTarget = findStep(step.rejectNextStepId);

        return (
          <div
            key={step.id}
            className="rounded-3xl border border-white/10 bg-slate-950/50 p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs text-slate-500">
                  Step {step.sequence}
                </p>

                <h3 className="mt-1 text-lg font-semibold text-white">
                  {step.name}
                </h3>

                <p className="mt-1 text-xs text-cyan-300">
                  {step.stepType.replaceAll("_", " ")}
                </p>
              </div>

              <GitBranch size={20} className="text-cyan-300" />
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-green-400/20 bg-green-400/10 p-4">
                <p className="text-xs font-medium text-green-300">
                  APPROVE
                </p>

                <p className="mt-2 text-sm text-slate-200">
                  {approveTarget
                    ? `Step ${approveTarget.sequence}: ${approveTarget.name}`
                    : "Complete workflow"}
                </p>
              </div>

              <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4">
                <p className="text-xs font-medium text-red-300">
                  REJECT
                </p>

                <p className="mt-2 text-sm text-slate-200">
                  {rejectTarget
                    ? `Step ${rejectTarget.sequence}: ${rejectTarget.name}`
                    : "Remain rejected"}
                </p>
              </div>
            </div>
          </div>
        );
      })}

      {orderedSteps.length === 0 && (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-slate-400">
          This workflow has no steps.
        </div>
      )}
    </div>
  );
}