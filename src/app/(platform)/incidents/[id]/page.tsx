import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardCheck, SearchCheck } from "lucide-react";
import {
  createCorrectiveAction,
  upsertInvestigation,
  updateIncidentStatus,
  updateCorrectiveActionStatus,
} from "@/features/incidents/actions";
import { decideIncidentWorkflow } from "@/core/workflow/workflow.actions";
import { RiskLevel, Status, WorkflowDecision } from "@prisma/client";

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { organizationId, user: currentUser } = await getCurrentUserTenant();

  const incident = await prisma.incident.findFirst({
    where: {
      id,
      site: {
        organizationId,
      },
    },
    include: {
      site: true,
      reportedBy: true,
      investigation: true,
      actions: {
        include: {
          assignedTo: true,
        },
        orderBy: {
          dueDate: "asc",
        },
      },
    },
  });

  if (!incident) {
    notFound();
  }

  const users = await prisma.user.findMany({
    where: {
      organizationId,
    },
    orderBy: {
      name: "asc",
    },
  });

  const workflowInstance = await prisma.workflowInstance.findFirst({
    where: {
      entityId: incident.id,
      entityType: "INCIDENT",
      organizationId,
    },
    include: {
      template: true,
      steps: {
        orderBy: {
          sequence: "asc",
        },
        include: {
          assignedUser: true,
          completedBy: true,
        },
      },
    },
  });

  const currentWorkflowStep = workflowInstance?.steps.find(
    (step) =>
      step.id === workflowInstance.currentStepId ||
      step.templateStepId === workflowInstance.currentStepId
  );

  const canActOnCurrentStep =
    currentWorkflowStep &&
    (currentWorkflowStep.assignedUserId === currentUser.id ||
      !currentWorkflowStep.assignedRole ||
      currentWorkflowStep.assignedRole === currentUser.role);

  return (
    <div>
      <Link
        href="/incidents"
        className="mb-6 inline-flex items-center gap-2 text-sm text-cyan-300 hover:text-cyan-200"
      >
        <ArrowLeft size={16} />
        Back to incidents
      </Link>

      <div className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
        <p className="text-sm text-cyan-300">Incident Record</p>

        <h1 className="mt-2 text-4xl font-bold tracking-tight">
          {incident.title}
        </h1>

        <p className="mt-4 max-w-4xl text-slate-300">
          {incident.description}
        </p>

        <form
          action={updateIncidentStatus}
          className="mt-6 flex flex-wrap items-end gap-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4"
        >
          <input type="hidden" name="incidentId" value={incident.id} />

          <div>
            <label className="mb-2 block text-sm text-slate-300">
              Update Incident Status
            </label>
            <select
              name="status"
              defaultValue={incident.status}
              className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-cyan-400"
            >
              {Object.values(Status).map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="rounded-2xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            Save Status
          </button>
        </form>

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <InfoCard label="Type" value={incident.type.replaceAll("_", " ")} />
          <InfoCard label="Risk Level" value={incident.riskLevel} />
          <InfoCard
            label="Status"
            value={incident.status.replaceAll("_", " ")}
          />
          <InfoCard label="Site" value={incident.site.name} />
          <InfoCard label="Reported By" value={incident.reportedBy.name} />
          <InfoCard label="Location" value={incident.location || "N/A"} />
          <InfoCard
            label="Occurred"
            value={incident.occurredAt.toLocaleDateString()}
          />
          <InfoCard
            label="Created"
            value={incident.createdAt.toLocaleDateString()}
          />
        </div>
      </div>

      {workflowInstance && (
        <section className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
          <div className="mb-6">
            <p className="text-sm text-cyan-300">Workflow Engine</p>
            <h2 className="mt-1 text-2xl font-semibold">
              {workflowInstance.template.name}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              {workflowInstance.template.description ||
                "No workflow description."}
            </p>
          </div>

          {currentWorkflowStep && canActOnCurrentStep ? (
            <form
              action={decideIncidentWorkflow}
              className="mb-6 space-y-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-5"
            >
              <input type="hidden" name="incidentId" value={incident.id} />

              <div>
                <p className="text-sm text-cyan-300">Current Step</p>
                <h3 className="mt-1 text-xl font-semibold">
                  {currentWorkflowStep.name}
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  Required Role:{" "}
                  {currentWorkflowStep.assignedRole
                    ? currentWorkflowStep.assignedRole.replaceAll("_", " ")
                    : "Any authorized user"}
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Workflow Comments
                </label>
                <textarea
                  name="comments"
                  rows={3}
                  placeholder="Add approval or rejection comments..."
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  name="decision"
                  value={WorkflowDecision.APPROVE}
                  className="rounded-2xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300"
                >
                  Approve Step
                </button>

                <button
                  type="submit"
                  name="decision"
                  value={WorkflowDecision.REJECT}
                  className="rounded-2xl border border-red-400/20 bg-red-400/10 px-5 py-3 font-semibold text-red-300 transition hover:bg-red-400/20"
                >
                  Reject Step
                </button>
              </div>
            </form>
          ) : currentWorkflowStep ? (
            <div className="mb-6 rounded-2xl border border-orange-400/20 bg-orange-400/10 p-5">
              <p className="text-sm text-orange-300">Current Step</p>
              <h3 className="mt-1 text-xl font-semibold text-white">
                {currentWorkflowStep.name}
              </h3>
              <p className="mt-2 text-sm text-slate-300">
                This step requires{" "}
                {currentWorkflowStep.assignedRole
                  ? currentWorkflowStep.assignedRole.replaceAll("_", " ")
                  : "an assigned approver"}
                .
              </p>
            </div>
          ) : (
            <div className="mb-6 rounded-2xl border border-green-400/20 bg-green-400/10 p-5">
              <p className="text-sm text-green-300">Workflow Complete</p>
              <p className="mt-1 text-sm text-slate-300">
                There is no active workflow step requiring action.
              </p>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {workflowInstance.steps.map((step) => {
              const isCurrentStep = currentWorkflowStep?.id === step.id;
              const isOverdue = step.dueAt && step.dueAt < new Date();

              return (
                <div
                  key={step.id}
                  className={`rounded-2xl border p-5 ${
                    isCurrentStep
                      ? "border-cyan-400/40 bg-cyan-400/10"
                      : isOverdue
                        ? "border-red-400/30 bg-red-400/10"
                        : "border-white/10 bg-slate-950/50"
                  }`}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-slate-500">
                        Step {step.sequence}
                      </p>
                      <h3 className="mt-1 font-semibold text-white">
                        {step.name}
                      </h3>
                    </div>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs ${
                        isOverdue
                          ? "border-red-400/20 bg-red-400/10 text-red-300"
                          : "border-cyan-400/20 bg-cyan-400/10 text-cyan-300"
                      }`}
                    >
                      {isOverdue ? "OVERDUE" : step.status.replaceAll("_", " ")}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm text-slate-400">
                    <p>
                      Type:{" "}
                      <span className="text-slate-200">
                        {step.stepType.replaceAll("_", " ")}
                      </span>
                    </p>

                    <p>
                      Assigned Role:{" "}
                      <span className="text-slate-200">
                        {step.assignedRole
                          ? step.assignedRole.replaceAll("_", " ")
                          : "None"}
                      </span>
                    </p>

                    <p>
                      Assigned User:{" "}
                      <span className="text-slate-200">
                        {step.assignedUser?.name || "None"}
                      </span>
                    </p>

                    <p>
                      Started:{" "}
                      <span className="text-slate-200">
                        {step.startedAt
                          ? step.startedAt.toLocaleString()
                          : "Not started"}
                      </span>
                    </p>

                    <p>
                      Due:{" "}
                      <span
                        className={
                          isOverdue ? "text-red-300" : "text-slate-200"
                        }
                      >
                        {step.dueAt ? step.dueAt.toLocaleString() : "No SLA"}
                      </span>
                    </p>

                    <p>
                      Completed:{" "}
                      <span className="text-slate-200">
                        {step.completedAt
                          ? step.completedAt.toLocaleString()
                          : "Not completed"}
                      </span>
                    </p>

                    <p>
                      Decision:{" "}
                      <span className="text-slate-200">
                        {step.decision
                          ? step.decision.replaceAll("_", " ")
                          : "None"}
                      </span>
                    </p>

                    <p>
                      Completed By:{" "}
                      <span className="text-slate-200">
                        {step.completedBy?.name || "N/A"}
                      </span>
                    </p>

                    {step.comments && (
                      <p>
                        Comments:{" "}
                        <span className="text-slate-200">
                          {step.comments}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-300">
              <SearchCheck size={22} />
            </div>

            <div>
              <h2 className="text-xl font-semibold">Investigation</h2>
              <p className="text-sm text-slate-400">
                Root cause and contributing factors
              </p>
            </div>
          </div>

          {incident.investigation ? (
            <div className="space-y-4">
              <DetailBlock
                label="Summary"
                value={incident.investigation.summary}
              />
              <DetailBlock
                label="Root Cause"
                value={incident.investigation.rootCause}
              />
              <DetailBlock
                label="Immediate Cause"
                value={incident.investigation.immediateCause}
              />
              <DetailBlock
                label="Contributing Factors"
                value={incident.investigation.contributingFactors}
              />
            </div>
          ) : (
            <p className="text-slate-400">
              No investigation has been added yet.
            </p>
          )}

          <form
            action={upsertInvestigation}
            className="mt-6 space-y-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-5"
          >
            <input type="hidden" name="incidentId" value={incident.id} />

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Summary
              </label>
              <textarea
                name="summary"
                rows={3}
                defaultValue={incident.investigation?.summary || ""}
                placeholder="Summarize the investigation..."
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Root Cause
              </label>
              <textarea
                name="rootCause"
                rows={3}
                defaultValue={incident.investigation?.rootCause || ""}
                placeholder="Example: Inadequate traffic separation"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Immediate Cause
              </label>
              <textarea
                name="immediateCause"
                rows={3}
                defaultValue={incident.investigation?.immediateCause || ""}
                placeholder="Example: Forklift entered pedestrian pathway"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Contributing Factors
              </label>
              <textarea
                name="contributingFactors"
                rows={3}
                defaultValue={incident.investigation?.contributingFactors || ""}
                placeholder="Example: Poor lighting, congestion, unclear signage"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-cyan-400"
              />
            </div>

            <button
              type="submit"
              className="rounded-2xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              Save Investigation
            </button>
          </form>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-300">
              <ClipboardCheck size={22} />
            </div>

            <div>
              <h2 className="text-xl font-semibold">Corrective Actions</h2>
              <p className="text-sm text-slate-400">
                Actions assigned to prevent recurrence
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {incident.actions.map((action) => (
              <div
                key={action.id}
                className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"
              >
                <div className="mb-2 flex items-start justify-between gap-4">
                  <h3 className="font-semibold">{action.title}</h3>
                  <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300">
                    {action.status.replaceAll("_", " ")}
                  </span>
                </div>

                <p className="text-sm text-slate-400">
                  {action.description || "No description provided."}
                </p>

                <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                  <span className="text-slate-400">
                    Owner:{" "}
                    <span className="text-slate-200">
                      {action.assignedTo.name}
                    </span>
                  </span>

                  <span className="text-slate-400">
                    Risk:{" "}
                    <span className="text-slate-200">{action.riskLevel}</span>
                  </span>

                  <span className="text-slate-400">
                    Due:{" "}
                    <span className="text-slate-200">
                      {action.dueDate.toLocaleDateString()}
                    </span>
                  </span>
                </div>

                <form
                  action={updateCorrectiveActionStatus}
                  className="mt-4 flex flex-wrap items-end gap-3"
                >
                  <input type="hidden" name="actionId" value={action.id} />
                  <input type="hidden" name="incidentId" value={incident.id} />

                  <div>
                    <label className="mb-2 block text-xs text-slate-400">
                      Action Status
                    </label>
                    <select
                      name="status"
                      defaultValue={action.status}
                      className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                    >
                      {Object.values(Status).map((status) => (
                        <option key={status} value={status}>
                          {status.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                  >
                    Update
                  </button>
                </form>
              </div>
            ))}

            {incident.actions.length === 0 && (
              <p className="text-slate-400">
                No corrective actions created yet.
              </p>
            )}
          </div>

          <form
            action={createCorrectiveAction}
            className="mt-6 space-y-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-5"
          >
            <input type="hidden" name="incidentId" value={incident.id} />

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Action Title
              </label>
              <input
                name="title"
                required
                placeholder="Example: Install additional warning signs"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Description
              </label>
              <textarea
                name="description"
                rows={3}
                placeholder="Describe what needs to be done..."
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-cyan-400"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Risk Level
                </label>
                <select
                  name="riskLevel"
                  required
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-cyan-400"
                >
                  {Object.values(RiskLevel).map((risk) => (
                    <option key={risk} value={risk}>
                      {risk}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Assigned To
                </label>
                <select
                  name="assignedToId"
                  required
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-cyan-400"
                >
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Due Date
                </label>
                <input
                  type="date"
                  name="dueDate"
                  required
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <button
              type="submit"
              className="rounded-2xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              Add Corrective Action
            </button>
          </form>
        </section>
      </div>
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

function DetailBlock({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div>
      <p className="mb-1 text-xs text-slate-500">{label}</p>
      <p className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
        {value || "Not provided."}
      </p>
    </div>
  );
}