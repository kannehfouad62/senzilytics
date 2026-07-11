import {
  archiveDocumentAction,
  deleteDocumentAction,
} from "@/core/documents/document.actions";
import { DocumentPreview } from "@/core/documents/document-preview";
import { MultiDocumentUpload } from "@/core/documents/multi-document-upload";
import { ReplaceDocumentUpload } from "@/core/documents/replace-document-upload";
import { ConfirmDocumentAction } from "@/core/documents/confirm-document-action";
import { DocumentVersionHistory } from "@/core/documents/document-version-history";
import { decideIncidentWorkflow } from "@/core/workflow/workflow.actions";
import {
  createCorrectiveAction,
  updateCorrectiveActionStatus,
  updateIncidentStatus,
  upsertInvestigation,
} from "@/features/incidents/actions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  DocumentCategory,
  DocumentEntityType,
  DocumentStatus,
  RiskLevel,
  Status,
  WorkflowDecision,
  WorkflowEntityType,
} from "@prisma/client";
import {
  Archive,
  ArrowLeft,
  ClipboardCheck,
  Download,
  FileText,
  SearchCheck,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type IncidentDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function IncidentDetailPage({
  params,
}: IncidentDetailPageProps) {
  const { id } = await params;

  const {
    organizationId,
    user: currentUser,
  } = await getCurrentUserTenant();

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

  const [users, workflowInstance, documents] =
    await Promise.all([
      prisma.user.findMany({
        where: {
          organizationId,
        },
        orderBy: {
          name: "asc",
        },
      }),

      prisma.workflowInstance.findFirst({
        where: {
          entityId: incident.id,
          entityType: WorkflowEntityType.INCIDENT,
          organizationId,
        },
        orderBy: {
          createdAt: "desc",
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
      }),

      prisma.document.findMany({
        where: {
          organizationId,
          entityType: DocumentEntityType.INCIDENT,
          entityId: incident.id,
          isLatest: true,
          status: {
            not: DocumentStatus.DELETED,
          },
        },
        include: {
          uploadedBy: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
    ]);

  const currentWorkflowStep =
    workflowInstance?.steps.find(
      (step) =>
        step.id === workflowInstance.currentStepId ||
        step.templateStepId ===
          workflowInstance.currentStepId
    );

  const canActOnCurrentStep = Boolean(
    currentWorkflowStep &&
      (currentWorkflowStep.assignedUserId ===
        currentUser.id ||
        (!currentWorkflowStep.assignedUserId &&
          (!currentWorkflowStep.assignedRole ||
            currentWorkflowStep.assignedRole ===
              currentUser.role)))
  );

  const now = new Date();

  return (
    <div>
      <Link
        href="/incidents"
        className="mb-6 inline-flex items-center gap-2 text-sm text-cyan-300 transition hover:text-cyan-200"
      >
        <ArrowLeft size={16} />
        Back to incidents
      </Link>

      <section className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
        <p className="text-sm text-cyan-300">
          Incident Record
        </p>

        <h1 className="mt-2 text-4xl font-bold tracking-tight text-white">
          {incident.title}
        </h1>

        <p className="mt-4 max-w-4xl whitespace-pre-wrap text-slate-300">
          {incident.description}
        </p>

        <form
          action={updateIncidentStatus}
          className="mt-6 flex flex-wrap items-end gap-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4"
        >
          <input
            type="hidden"
            name="incidentId"
            value={incident.id}
          />

          <div>
            <label className="mb-2 block text-sm text-slate-300">
              Update Incident Status
            </label>

            <select
              name="status"
              defaultValue={incident.status}
              className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
            >
              {Object.values(Status).map((status) => (
                <option
                  key={status}
                  value={status}
                >
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

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <InfoCard
            label="Type"
            value={incident.type.replaceAll("_", " ")}
          />

          <InfoCard
            label="Risk Level"
            value={incident.riskLevel}
          />

          <InfoCard
            label="Status"
            value={incident.status.replaceAll("_", " ")}
          />

          <InfoCard
            label="Site"
            value={incident.site.name}
          />

          <InfoCard
            label="Reported By"
            value={incident.reportedBy.name}
          />

          <InfoCard
            label="Location"
            value={incident.location || "N/A"}
          />

          <InfoCard
            label="Occurred"
            value={incident.occurredAt.toLocaleString()}
          />

          <InfoCard
            label="Created"
            value={incident.createdAt.toLocaleString()}
          />
        </div>
      </section>

      {workflowInstance && (
        <section className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
          <div className="mb-6">
            <p className="text-sm text-cyan-300">
              Workflow Engine
            </p>

            <h2 className="mt-1 text-2xl font-semibold text-white">
              {workflowInstance.template.name}
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              {workflowInstance.template.description ||
                "No workflow description."}
            </p>
          </div>

          {currentWorkflowStep &&
          canActOnCurrentStep ? (
            <form
              action={decideIncidentWorkflow}
              className="mb-6 space-y-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-5"
            >
              <input
                type="hidden"
                name="incidentId"
                value={incident.id}
              />

              <div>
                <p className="text-sm text-cyan-300">
                  Current Step
                </p>

                <h3 className="mt-1 text-xl font-semibold text-white">
                  {currentWorkflowStep.name}
                </h3>

                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-400">
                  <span>
                    Required role:{" "}
                    <strong className="font-medium text-slate-200">
                      {currentWorkflowStep.assignedRole
                        ? currentWorkflowStep.assignedRole.replaceAll(
                            "_",
                            " "
                          )
                        : "Any authorized user"}
                    </strong>
                  </span>

                  <span>
                    Assigned user:{" "}
                    <strong className="font-medium text-slate-200">
                      {currentWorkflowStep.assignedUser
                        ?.name ||
                        "Role-based assignment"}
                    </strong>
                  </span>

                  <span>
                    Due:{" "}
                    <strong
                      className={
                        currentWorkflowStep.dueAt &&
                        currentWorkflowStep.dueAt < now
                          ? "font-medium text-red-300"
                          : "font-medium text-slate-200"
                      }
                    >
                      {currentWorkflowStep.dueAt
                        ? currentWorkflowStep.dueAt.toLocaleString()
                        : "No SLA"}
                    </strong>
                  </span>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Workflow Comments
                </label>

                <textarea
                  name="comments"
                  rows={3}
                  placeholder="Add approval or rejection comments..."
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
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
              <p className="text-sm text-orange-300">
                Current Step
              </p>

              <h3 className="mt-1 text-xl font-semibold text-white">
                {currentWorkflowStep.name}
              </h3>

              <p className="mt-2 text-sm text-slate-300">
                This step is assigned to{" "}
                {currentWorkflowStep.assignedUser?.name ||
                  (currentWorkflowStep.assignedRole
                    ? currentWorkflowStep.assignedRole.replaceAll(
                        "_",
                        " "
                      )
                    : "another authorized approver")}
                .
              </p>
            </div>
          ) : (
            <div className="mb-6 rounded-2xl border border-green-400/20 bg-green-400/10 p-5">
              <p className="text-sm text-green-300">
                Workflow Complete
              </p>

              <p className="mt-1 text-sm text-slate-300">
                There is no active workflow step requiring
                action.
              </p>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {workflowInstance.steps.map((step) => {
              const isCurrentStep =
                currentWorkflowStep?.id === step.id;

              const isOverdue = Boolean(
                step.status === "IN_PROGRESS" &&
                  step.dueAt &&
                  step.dueAt < now
              );

              return (
                <div
                  key={step.id}
                  className={`rounded-2xl border p-5 ${
                    isCurrentStep
                      ? isOverdue
                        ? "border-red-400/40 bg-red-400/10"
                        : "border-cyan-400/40 bg-cyan-400/10"
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
                          : step.status === "APPROVED" ||
                              step.status === "COMPLETED"
                            ? "border-green-400/20 bg-green-400/10 text-green-300"
                            : step.status === "REJECTED"
                              ? "border-red-400/20 bg-red-400/10 text-red-300"
                              : step.status === "IN_PROGRESS"
                                ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-300"
                                : "border-white/10 bg-white/5 text-slate-300"
                      }`}
                    >
                      {isOverdue
                        ? "OVERDUE"
                        : step.status.replaceAll("_", " ")}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm text-slate-400">
                    <WorkflowDetailRow
                      label="Type"
                      value={step.stepType.replaceAll(
                        "_",
                        " "
                      )}
                    />

                    <WorkflowDetailRow
                      label="Assigned Role"
                      value={
                        step.assignedRole
                          ? step.assignedRole.replaceAll(
                              "_",
                              " "
                            )
                          : "None"
                      }
                    />

                    <WorkflowDetailRow
                      label="Assigned User"
                      value={
                        step.assignedUser?.name || "None"
                      }
                    />

                    <WorkflowDetailRow
                      label="Started"
                      value={
                        step.startedAt
                          ? step.startedAt.toLocaleString()
                          : "Not started"
                      }
                    />

                    <p>
                      Due:{" "}
                      <span
                        className={
                          isOverdue
                            ? "text-red-300"
                            : "text-slate-200"
                        }
                      >
                        {step.dueAt
                          ? step.dueAt.toLocaleString()
                          : "No SLA"}
                      </span>
                    </p>

                    <WorkflowDetailRow
                      label="Completed"
                      value={
                        step.completedAt
                          ? step.completedAt.toLocaleString()
                          : "Not completed"
                      }
                    />

                    <WorkflowDetailRow
                      label="Decision"
                      value={
                        step.decision
                          ? step.decision.replaceAll(
                              "_",
                              " "
                            )
                          : "None"
                      }
                    />

                    <WorkflowDetailRow
                      label="Completed By"
                      value={
                        step.completedBy?.name || "N/A"
                      }
                    />

                    {step.comments && (
                      <div className="mt-3 rounded-xl border border-white/10 bg-black/10 p-3">
                        <p className="text-xs text-slate-500">
                          Comments
                        </p>

                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-200">
                          {step.comments}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
        <div className="mb-6">
          <p className="text-sm text-cyan-300">
            Document Management
          </p>

          <h2 className="mt-1 text-2xl font-semibold text-white">
            Incident Attachments
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            Upload photographs, evidence, reports, videos,
            and supporting records.
          </p>
        </div>

        <MultiDocumentUpload
          entityType={DocumentEntityType.INCIDENT}
          entityId={incident.id}
          organizationId={organizationId}
          userId={currentUser.id}
          defaultCategory={DocumentCategory.EVIDENCE}
        />

        <div className="mt-6 space-y-3">
          {documents.map((document) => (
            <article
              key={document.id}
              className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="rounded-xl bg-cyan-400/10 p-3 text-cyan-300">
                    <FileText size={20} />
                  </div>

                  <div className="min-w-0">
                    <p className="break-words font-medium text-white">
                      {document.name}
                    </p>

                    <p className="mt-1 break-words text-sm text-slate-400">
                      {document.description ||
                        document.originalName}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>
                        Uploaded by{" "}
                        {document.uploadedBy?.name ||
                          "System"}
                      </span>

                      <span>
                        {document.createdAt.toLocaleString()}
                      </span>

                      <span>
                        {formatFileSize(
                          document.sizeBytes
                        )}
                      </span>

                      <span>{document.mimeType}</span>

                      <span>
                        Version {document.version}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs ${
                      document.status ===
                      DocumentStatus.ARCHIVED
                        ? "border-slate-400/20 bg-slate-400/10 text-slate-300"
                        : "border-cyan-400/20 bg-cyan-400/10 text-cyan-300"
                    }`}
                  >
                    {document.status}
                  </span>

                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                    {document.category.replaceAll(
                      "_",
                      " "
                    )}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3 border-t border-white/10 pt-4">
                <DocumentPreview
                  documentId={document.id}
                  documentName={document.name}
                  mimeType={document.mimeType}
                />

<DocumentVersionHistory
  documentId={document.id}
  documentName={document.name}
/>

                <a
                  href={`/api/documents/${document.id}/download`}
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                >
                  <Download size={16} />
                  Download
                </a>

                {document.status ===
                  DocumentStatus.ACTIVE && (
                  <ReplaceDocumentUpload
                    documentId={document.id}
                    documentName={document.name}
                    entityType={document.entityType}
                    entityId={document.entityId}
                    organizationId={organizationId}
                    userId={currentUser.id}
                  />
                )}

                {document.status ===
                  DocumentStatus.ACTIVE && (
                  <form
                    action={archiveDocumentAction}
                  >
                    <input
                      type="hidden"
                      name="documentId"
                      value={document.id}
                    />

                    <input
                      type="hidden"
                      name="returnTo"
                      value={`/incidents/${incident.id}`}
                    />

<ConfirmDocumentAction
  title="Archive document?"
  description="The document will remain available in the Document Center but will be marked as archived."
  confirmLabel="Archive Document"
  buttonLabel="Archive"
  icon={<Archive size={16} />}
  buttonClassName="inline-flex items-center gap-2 rounded-xl border border-orange-400/20 bg-orange-400/10 px-4 py-2 text-sm font-semibold text-orange-300 transition hover:bg-orange-400/20"
/>
                  </form>
                )}

                <form action={deleteDocumentAction}>
                  <input
                    type="hidden"
                    name="documentId"
                    value={document.id}
                  />

                  <input
                    type="hidden"
                    name="returnTo"
                    value={`/incidents/${incident.id}`}
                  />

<ConfirmDocumentAction
  title="Delete document permanently?"
  description="The file will be removed from private Blob storage and the document record will be marked as deleted. This action cannot be undone."
  confirmLabel="Delete Permanently"
  buttonLabel="Delete"
  icon={<Trash2 size={16} />}
  buttonClassName="inline-flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-400/20"
/>
                </form>
              </div>
            </article>
          ))}

          {documents.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-6 text-center text-slate-400">
              No incident documents have been uploaded.
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-300">
              <SearchCheck size={22} />
            </div>

            <div>
              <h2 className="text-xl font-semibold text-white">
                Investigation
              </h2>

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
                value={
                  incident.investigation.rootCause
                }
              />

              <DetailBlock
                label="Immediate Cause"
                value={
                  incident.investigation
                    .immediateCause
                }
              />

              <DetailBlock
                label="Contributing Factors"
                value={
                  incident.investigation
                    .contributingFactors
                }
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
            <input
              type="hidden"
              name="incidentId"
              value={incident.id}
            />

            <FormTextarea
              label="Summary"
              name="summary"
              rows={3}
              defaultValue={
                incident.investigation?.summary || ""
              }
              placeholder="Summarize the investigation..."
            />

            <FormTextarea
              label="Root Cause"
              name="rootCause"
              rows={3}
              defaultValue={
                incident.investigation?.rootCause ||
                ""
              }
              placeholder="Example: Inadequate traffic separation"
            />

            <FormTextarea
              label="Immediate Cause"
              name="immediateCause"
              rows={3}
              defaultValue={
                incident.investigation
                  ?.immediateCause || ""
              }
              placeholder="Example: Forklift entered pedestrian pathway"
            />

            <FormTextarea
              label="Contributing Factors"
              name="contributingFactors"
              rows={3}
              defaultValue={
                incident.investigation
                  ?.contributingFactors || ""
              }
              placeholder="Example: Poor lighting, congestion, unclear signage"
            />

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
              <h2 className="text-xl font-semibold text-white">
                Corrective Actions
              </h2>

              <p className="text-sm text-slate-400">
                Actions assigned to prevent recurrence
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {incident.actions.map((action) => {
              const isActionOverdue =
                action.dueDate < now &&
                action.status !==
                  Status.COMPLETED &&
                action.status !== Status.CLOSED;

              return (
                <article
                  key={action.id}
                  className={`rounded-2xl border p-4 ${
                    isActionOverdue
                      ? "border-red-400/30 bg-red-400/10"
                      : "border-white/10 bg-slate-950/50"
                  }`}
                >
                  <div className="mb-2 flex items-start justify-between gap-4">
                    <h3 className="font-semibold text-white">
                      {action.title}
                    </h3>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs ${
                        isActionOverdue
                          ? "border-red-400/20 bg-red-400/10 text-red-300"
                          : "border-cyan-400/20 bg-cyan-400/10 text-cyan-300"
                      }`}
                    >
                      {isActionOverdue
                        ? "OVERDUE"
                        : action.status.replaceAll(
                            "_",
                            " "
                          )}
                    </span>
                  </div>

                  <p className="whitespace-pre-wrap text-sm text-slate-400">
                    {action.description ||
                      "No description provided."}
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
                      <span className="text-slate-200">
                        {action.riskLevel}
                      </span>
                    </span>

                    <span className="text-slate-400">
                      Due:{" "}
                      <span
                        className={
                          isActionOverdue
                            ? "text-red-300"
                            : "text-slate-200"
                        }
                      >
                        {action.dueDate.toLocaleDateString()}
                      </span>
                    </span>
                  </div>

                  <form
                    action={
                      updateCorrectiveActionStatus
                    }
                    className="mt-4 flex flex-wrap items-end gap-3"
                  >
                    <input
                      type="hidden"
                      name="actionId"
                      value={action.id}
                    />

                    <input
                      type="hidden"
                      name="incidentId"
                      value={incident.id}
                    />

                    <div>
                      <label className="mb-2 block text-xs text-slate-400">
                        Action Status
                      </label>

                      <select
                        name="status"
                        defaultValue={action.status}
                        className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400"
                      >
                        {Object.values(Status).map(
                          (status) => (
                            <option
                              key={status}
                              value={status}
                            >
                              {status.replaceAll(
                                "_",
                                " "
                              )}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <button
                      type="submit"
                      className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                    >
                      Update
                    </button>
                  </form>
                </article>
              );
            })}

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
            <input
              type="hidden"
              name="incidentId"
              value={incident.id}
            />

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Action Title
              </label>

              <input
                name="title"
                required
                placeholder="Example: Install additional warning signs"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
              />
            </div>

            <FormTextarea
              label="Description"
              name="description"
              rows={3}
              placeholder="Describe what needs to be done..."
            />

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Risk Level
                </label>

                <select
                  name="riskLevel"
                  required
                  defaultValue={RiskLevel.LOW}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
                >
                  {Object.values(RiskLevel).map(
                    (risk) => (
                      <option
                        key={risk}
                        value={risk}
                      >
                        {risk}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Assigned To
                </label>

                <select
                  name="assignedToId"
                  required
                  defaultValue=""
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
                >
                  <option
                    value=""
                    disabled
                  >
                    Select a user
                  </option>

                  {users.map((user) => (
                    <option
                      key={user.id}
                      value={user.id}
                    >
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
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
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

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
      <p className="text-xs text-slate-500">
        {label}
      </p>

      <p className="mt-1 break-words font-medium text-slate-100">
        {value}
      </p>
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
      <p className="mb-1 text-xs text-slate-500">
        {label}
      </p>

      <p className="whitespace-pre-wrap rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
        {value || "Not provided."}
      </p>
    </div>
  );
}

function FormTextarea({
  label,
  name,
  rows,
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  rows: number;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm text-slate-300">
        {label}
      </label>

      <textarea
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
      />
    </div>
  );
}

function WorkflowDetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <p>
      {label}:{" "}
      <span className="text-slate-200">
        {value}
      </span>
    </p>
  );
}

function formatFileSize(
  sizeBytes: number
) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  const kilobytes =
    sizeBytes / 1024;

  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(
      1
    )} KB`;
  }

  const megabytes =
    kilobytes / 1024;

  return `${megabytes.toFixed(
    1
  )} MB`;
}