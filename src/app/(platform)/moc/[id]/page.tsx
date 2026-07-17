import {
    createMocApproval,
    createMocTask,
    decideMocApproval,
    linkRiskToMoc,
    transitionMocStatus,
    unlinkRiskFromMoc,
    updateMoc,
    updateMocTask,
  } from "@/features/moc/actions";
  import { RiskMatrix } from "@/features/risks/risk-matrix";
  import { requirePermission } from "@/lib/permissions";
  import { prisma } from "@/lib/prisma";
  import { getCurrentUserTenant } from "@/lib/tenant";
  import { MocAiAssistant } from "@/features/moc/moc-ai-assistant";
  import { findTenantMocById } from "@/modules/moc/moc.repository";
  import {
    MocStatusTransitionForm,
  } from "@/features/moc/moc-status-transition-form";
  import {
    MocApprovalRole,
    MocApprovalStatus,
    MocChangeDuration,
    MocChangeType,
    MocPriority,
    MocStatus,
    MocTaskStatus,
    MocTaskType,
    PermissionKey,
    RiskImpact,
    RiskLevel,
    RiskLikelihood,
  } from "@prisma/client";
  import {
    AlertTriangle,
    ArrowLeft,
    CalendarClock,
    CheckCircle2,
    ClipboardCheck,
    Factory,
    Gauge,
    Link2,
    ListChecks,
    Plus,
    ShieldAlert,
    Trash2,
    UserRoundCheck,
    Workflow,
  } from "lucide-react";
  import Link from "next/link";
  import { notFound } from "next/navigation";
  
  export const dynamic = "force-dynamic";
  
  type MocDetailPageProps = {
    params: Promise<{
      id: string;
    }>;
  };
  
  export default async function MocDetailPage({
    params,
  }: MocDetailPageProps) {
    await requirePermission(
      PermissionKey.VIEW_MOC
    );
  
    const { id } = await params;
  
    const {
      organizationId,
      user,
    } = await getCurrentUserTenant();
  
    const [
      moc,
      sites,
      departments,
      users,
      risks,
    ] = await Promise.all([
      findTenantMocById({
        organizationId,
        mocId: id,
      }),
  
      prisma.site.findMany({
        where: {
          organizationId,
        },
  
        select: {
          id: true,
          name: true,
        },
  
        orderBy: {
          name: "asc",
        },
      }),
  
      prisma.department.findMany({
        where: {
          site: {
            organizationId,
          },
        },
  
        select: {
          id: true,
          name: true,
          siteId: true,
  
          site: {
            select: {
              name: true,
            },
          },
        },
  
        orderBy: [
          {
            site: {
              name: "asc",
            },
          },
          {
            name: "asc",
          },
        ],
      }),
  
      prisma.user.findMany({
        where: {
          organizationId,
        },
  
        select: {
          id: true,
          name: true,
          email: true,
          jobTitle: true,
          role: true,
        },
  
        orderBy: {
          name: "asc",
        },
      }),
  
      prisma.risk.findMany({
        where: {
          organizationId,
        },
  
        select: {
          id: true,
          reference: true,
          title: true,
          status: true,
          currentScore: true,
          currentRiskLevel: true,
          residualScore: true,
          residualRiskLevel: true,
        },
  
        orderBy: [
          {
            residualScore: "desc",
          },
          {
            reference: "asc",
          },
        ],
      }),
    ]);
  
    if (!moc) {
      notFound();
    }
  
    const now = new Date();
  
    const overdue =
      Boolean(
        moc.plannedCompletionDate &&
          moc.plannedCompletionDate <
            now &&
          moc.status !==
            MocStatus.CLOSED &&
          moc.status !==
            MocStatus.CANCELLED
      );
  
    const pendingApprovals =
      moc.approvals.filter(
        (approval) =>
          approval.status ===
          MocApprovalStatus.PENDING
      );
  
    const rejectedApprovals =
      moc.approvals.filter(
        (approval) =>
          approval.status ===
          MocApprovalStatus.REJECTED
      );
  
    const requiredTasks =
      moc.tasks.filter(
        (task) =>
          task.isRequired
      );
  
    const completedRequiredTasks =
      requiredTasks.filter(
        (task) =>
          task.status ===
          MocTaskStatus.COMPLETED
      );
  
    const overdueTasks =
      moc.tasks.filter(
        (task) =>
          task.dueDate &&
          task.dueDate < now &&
          task.status !==
            MocTaskStatus.COMPLETED &&
          task.status !==
            MocTaskStatus.CANCELLED
      );
  
    const taskProgress =
      requiredTasks.length > 0
        ? Math.round(
            (completedRequiredTasks.length /
              requiredTasks.length) *
              100
          )
        : 0;
  
    const nextStatuses =
      getNextMocStatuses(
        moc.status
      );
  
    return (
      <div>
        <Link
          href="/moc"
          className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
        >
          <ArrowLeft size={16} />
          Back to MOC register
        </Link>
  
        <div className="mt-6 flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="flex items-center gap-2 text-sm text-cyan-300">
              <Workflow size={16} />
              {moc.reference}
            </p>
  
            <h1 className="mt-2 text-4xl font-bold tracking-tight">
              {moc.title}
            </h1>
  
            <p className="mt-3 max-w-4xl text-slate-400">
              {moc.description}
            </p>
  
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusBadge
                status={moc.status}
              />
  
              <PriorityBadge
                priority={moc.priority}
              />
  
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                {formatEnum(
                  moc.changeType
                )}
              </span>
  
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                {formatEnum(
                  moc.changeDuration
                )}
              </span>
  
              {overdue && (
                <span className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1 text-xs text-red-300">
                  OVERDUE
                </span>
              )}
            </div>
          </div>
  
          <RiskBadge
            label="Residual Risk"
            score={moc.residualScore}
            riskLevel={
              moc.residualRiskLevel
            }
          />
        </div>
  
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <InfoCard
            label="Site"
            value={moc.site.name}
          />
  
          <InfoCard
            label="Department"
            value={
              moc.department?.name ||
              "Not assigned"
            }
          />
  
          <InfoCard
            label="Requestor"
            value={moc.requestor.name}
          />
  
          <InfoCard
            label="Change Owner"
            value={
              moc.owner?.name ||
              "Not assigned"
            }
          />
  
          <InfoCard
            label="Planned Completion"
            value={formatDate(
              moc.plannedCompletionDate
            )}
            critical={overdue}
          />
  
          <InfoCard
            label="Required Tasks"
            value={`${completedRequiredTasks.length}/${requiredTasks.length}`}
            detail={`${taskProgress}% complete`}
            critical={
              overdueTasks.length > 0
            }
          />
        </div>
  
        <div className="mt-8 grid gap-6 xl:grid-cols-2">
  <RiskAssessmentCard
    title="Initial Change Risk"
    score={moc.initialScore}
    riskLevel={
      moc.initialRiskLevel
    }
    likelihood={
      moc.initialLikelihood
    }
    impact={moc.initialImpact}
  />

  <RiskAssessmentCard
    title="Expected Residual Risk"
    score={moc.residualScore}
    riskLevel={
      moc.residualRiskLevel
    }
    likelihood={
      moc.residualLikelihood
    }
    impact={
      moc.residualImpact
    }
  />
</div>

<div className="mt-8">
  <MocAiAssistant
    mocId={moc.id}
  />
</div>
  
        <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
          <SectionHeading
            title="Lifecycle Progress"
            description="Move the change through technical review, risk review, approval, implementation, verification, and closure."
            icon={<Workflow size={21} />}
          />
  
          <div className="mt-6 grid gap-3 md:grid-cols-4 xl:grid-cols-8">
            {getLifecycleSteps().map(
              (status) => (
                <LifecycleStep
                  key={status}
                  status={status}
                  currentStatus={
                    moc.status
                  }
                />
              )
            )}
          </div>

          {moc.status === MocStatus.REJECTED && (
  <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
    This change request has been rejected.
    It may be returned to Draft for revision.
  </div>
)}

{moc.status === MocStatus.CANCELLED && (
  <div className="mt-5 rounded-2xl border border-slate-400/20 bg-slate-400/10 p-4 text-sm text-slate-300">
    This change request has been cancelled.
    No further lifecycle transitions are available.
  </div>
)}
  
  {nextStatuses.length > 0 ? (
  <MocStatusTransitionForm
    mocId={moc.id}
    nextStatuses={
      nextStatuses
    }
  />
) : (
  <p className="mt-6 rounded-2xl border border-white/10 bg-slate-950/40 p-5 text-sm text-slate-400">
    This change has no further
    lifecycle transitions available.
  </p>
)}
        </section>
  
        <div className="mt-8 grid gap-7 xl:grid-cols-[1fr_420px]">
          <main className="space-y-7">
            <section className={sectionClass}>
              <SectionHeading
                title="Change Profile"
                description="Update the scope, business justification, ownership, impacts, residual assessment, and schedule."
                icon={<Factory size={21} />}
              />
  
              <form
                action={updateMoc}
                className="mt-6 space-y-5"
              >
                <input
                  type="hidden"
                  name="mocId"
                  value={moc.id}
                />
  
                <div className="grid gap-5 md:grid-cols-2">
                  <Field
                    label="Change title"
                    required
                  >
                    <input
                      name="title"
                      required
                      defaultValue={
                        moc.title
                      }
                      className={inputClass}
                    />
                  </Field>
  
                  <Field
                    label="Change type"
                    required
                  >
                    <select
                      name="changeType"
                      required
                      defaultValue={
                        moc.changeType
                      }
                      className={inputClass}
                    >
                      {Object.values(
                        MocChangeType
                      ).map((value) => (
                        <option
                          key={value}
                          value={value}
                        >
                          {formatEnum(
                            value
                          )}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
  
                <Field
                  label="Description"
                  required
                >
                  <textarea
                    name="description"
                    required
                    rows={5}
                    defaultValue={
                      moc.description
                    }
                    className={inputClass}
                  />
                </Field>
  
                <Field
                  label="Business justification"
                  required
                >
                  <textarea
                    name="businessJustification"
                    required
                    rows={4}
                    defaultValue={
                      moc.businessJustification
                    }
                    className={inputClass}
                  />
                </Field>
  
                <div className="grid gap-5 md:grid-cols-3">
                  <Field
                    label="Duration"
                    required
                  >
                    <select
                      name="changeDuration"
                      required
                      defaultValue={
                        moc.changeDuration
                      }
                      className={inputClass}
                    >
                      {Object.values(
                        MocChangeDuration
                      ).map((value) => (
                        <option
                          key={value}
                          value={value}
                        >
                          {formatEnum(
                            value
                          )}
                        </option>
                      ))}
                    </select>
                  </Field>
  
                  <Field
                    label="Priority"
                    required
                  >
                    <select
                      name="priority"
                      required
                      defaultValue={
                        moc.priority
                      }
                      className={inputClass}
                    >
                      {Object.values(
                        MocPriority
                      ).map((value) => (
                        <option
                          key={value}
                          value={value}
                        >
                          {formatEnum(
                            value
                          )}
                        </option>
                      ))}
                    </select>
                  </Field>
  
                  <Field label="Temporary expiration">
                    <input
                      name="temporaryExpirationDate"
                      type="datetime-local"
                      defaultValue={formatDateInput(
                        moc.temporaryExpirationDate
                      )}
                      className={inputClass}
                    />
                  </Field>
                </div>
  
                <Field label="Emergency justification">
                  <textarea
                    name="emergencyJustification"
                    rows={3}
                    defaultValue={
                      moc.emergencyJustification ||
                      ""
                    }
                    className={inputClass}
                  />
                </Field>
  
                <div className="grid gap-5 md:grid-cols-2">
                  <Field
                    label="Site"
                    required
                  >
                    <select
                      name="siteId"
                      required
                      defaultValue={
                        moc.siteId
                      }
                      className={inputClass}
                    >
                      {sites.map((site) => (
                        <option
                          key={site.id}
                          value={site.id}
                        >
                          {site.name}
                        </option>
                      ))}
                    </select>
                  </Field>
  
                  <Field label="Department">
                    <select
                      name="departmentId"
                      defaultValue={
                        moc.departmentId ||
                        ""
                      }
                      className={inputClass}
                    >
                      <option value="">
                        Not assigned
                      </option>
  
                      {departments.map(
                        (department) => (
                          <option
                            key={
                              department.id
                            }
                            value={
                              department.id
                            }
                          >
                            {
                              department.site
                                .name
                            }{" "}
                            —{" "}
                            {
                              department.name
                            }
                          </option>
                        )
                      )}
                    </select>
                  </Field>
  
                  <Field label="Change owner">
                    <select
                      name="ownerId"
                      defaultValue={
                        moc.ownerId || ""
                      }
                      className={inputClass}
                    >
                      <option value="">
                        Not assigned
                      </option>
  
                      {users.map((person) => (
                        <option
                          key={person.id}
                          value={person.id}
                        >
                          {person.name} —{" "}
                          {person.jobTitle ||
                            formatEnum(
                              person.role
                            )}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
  
                <div className="grid gap-5 md:grid-cols-2">
                  <TextField
                    label="Affected process"
                    name="affectedProcess"
                    value={
                      moc.affectedProcess
                    }
                  />
  
                  <TextField
                    label="Affected equipment"
                    name="affectedEquipment"
                    value={
                      moc.affectedEquipment
                    }
                  />
  
                  <TextField
                    label="Affected systems"
                    name="affectedSystems"
                    value={
                      moc.affectedSystems
                    }
                  />
  
                  <TextField
                    label="Affected materials"
                    name="affectedMaterials"
                    value={
                      moc.affectedMaterials
                    }
                  />
                </div>
  
                <div className="grid gap-5 md:grid-cols-2">
                  <TextareaField
                    label="Operational impact"
                    name="operationalImpact"
                    value={
                      moc.operationalImpact
                    }
                  />
  
                  <TextareaField
                    label="Regulatory impact"
                    name="regulatoryImpact"
                    value={
                      moc.regulatoryImpact
                    }
                  />
  
                  <TextareaField
                    label="Environmental impact"
                    name="environmentalImpact"
                    value={
                      moc.environmentalImpact
                    }
                  />
  
                  <TextareaField
                    label="Safety impact"
                    name="safetyImpact"
                    value={
                      moc.safetyImpact
                    }
                  />
  
                  <TextareaField
                    label="Quality impact"
                    name="qualityImpact"
                    value={
                      moc.qualityImpact
                    }
                  />
                </div>
  
                <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
                  <h3 className="font-semibold text-white">
                    Residual Risk Assessment
                  </h3>
  
                  <div className="mt-4 grid gap-5 md:grid-cols-2">
                    <Field
                      label="Residual likelihood"
                      required
                    >
                      <select
                        name="residualLikelihood"
                        required
                        defaultValue={
                          moc.residualLikelihood
                        }
                        className={inputClass}
                      >
                        {Object.values(
                          RiskLikelihood
                        ).map((value) => (
                          <option
                            key={value}
                            value={value}
                          >
                            {formatEnum(
                              value
                            )}
                          </option>
                        ))}
                      </select>
                    </Field>
  
                    <Field
                      label="Residual impact"
                      required
                    >
                      <select
                        name="residualImpact"
                        required
                        defaultValue={
                          moc.residualImpact
                        }
                        className={inputClass}
                      >
                        {Object.values(
                          RiskImpact
                        ).map((value) => (
                          <option
                            key={value}
                            value={value}
                          >
                            {formatEnum(
                              value
                            )}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
  
                  <div className="mt-5">
                    <RiskMatrix
                      selectedLikelihood={
                        moc.residualLikelihood
                      }
                      selectedImpact={
                        moc.residualImpact
                      }
                      compact
                    />
                  </div>
                </div>
  
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Proposed start">
                    <input
                      name="proposedStartDate"
                      type="datetime-local"
                      defaultValue={formatDateInput(
                        moc.proposedStartDate
                      )}
                      className={inputClass}
                    />
                  </Field>
  
                  <Field label="Planned completion">
                    <input
                      name="plannedCompletionDate"
                      type="datetime-local"
                      defaultValue={formatDateInput(
                        moc.plannedCompletionDate
                      )}
                      className={inputClass}
                    />
                  </Field>
                </div>
  
                <button
                  type="submit"
                  className="rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
                >
                  Save Change Profile
                </button>
              </form>
            </section>
  
            <section className={sectionClass}>
              <SectionHeading
                title="Approval Requirements"
                description="Track required functional approvals and formal decisions."
                icon={
                  <CheckCircle2
                    size={21}
                  />
                }
              />
  
              <div className="mt-6 space-y-4">
                {moc.approvals.map(
                  (approval) => {
                    const canDecide =
                      approval.status ===
                        MocApprovalStatus.PENDING &&
                      (!approval.approverId ||
                        approval.approverId ===
                          user.id);
  
                    return (
                      <article
                        key={approval.id}
                        className="rounded-2xl border border-white/10 bg-slate-950/50 p-5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <div className="flex flex-wrap gap-2">
                              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300">
                                Sequence{" "}
                                {
                                  approval.sequence
                                }
                              </span>
  
                              <ApprovalStatusBadge
                                status={
                                  approval.status
                                }
                              />
                            </div>
  
                            <h3 className="mt-3 font-semibold text-white">
                              {formatEnum(
                                approval.role
                              )}
                            </h3>
  
                            <p className="mt-2 text-sm text-slate-400">
                              Approver:{" "}
                              {approval.approver
                                ?.name ||
                                "Not assigned"}
                            </p>
  
                            {approval.comments && (
                              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                                {
                                  approval.comments
                                }
                              </p>
                            )}
  
                            <p className="mt-3 text-xs text-slate-500">
                              Requested{" "}
                              {approval.requestedAt.toLocaleString(
                                "en-US"
                              )}
                            </p>
                          </div>
                        </div>
  
                        {canDecide && (
                          <form
                            action={
                              decideMocApproval
                            }
                            className="mt-5 grid gap-4 border-t border-white/10 pt-5 md:grid-cols-[1fr_auto_auto]"
                          >
                            <input
                              type="hidden"
                              name="mocId"
                              value={moc.id}
                            />
  
                            <input
                              type="hidden"
                              name="approvalId"
                              value={
                                approval.id
                              }
                            />
  
                            <Field label="Decision comments">
                              <input
                                name="comments"
                                placeholder="Add approval or rejection comments."
                                className={inputClass}
                              />
                            </Field>
  
                            <button
                              type="submit"
                              name="status"
                              value={
                                MocApprovalStatus.APPROVED
                              }
                              className="self-end rounded-xl border border-green-400/20 bg-green-400/10 px-4 py-3 text-sm text-green-300"
                            >
                              Approve
                            </button>
  
                            <button
                              type="submit"
                              name="status"
                              value={
                                MocApprovalStatus.REJECTED
                              }
                              className="self-end rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300"
                            >
                              Reject
                            </button>
                          </form>
                        )}
                      </article>
                    );
                  }
                )}
  
                {moc.approvals.length ===
                  0 && (
                  <EmptyState message="No approval requirements have been added." />
                )}
              </div>
            </section>
  
            <section className={sectionClass}>
              <SectionHeading
                title="Implementation and Verification Tasks"
                description="Track documentation, training, inspections, compliance, implementation, and verification requirements."
                icon={
                  <ListChecks size={21} />
                }
              />
  
              <div className="mt-6 space-y-4">
                {moc.tasks.map(
                  (task) => {
                    const taskOverdue =
                      Boolean(
                        task.dueDate &&
                          task.dueDate <
                            now &&
                          task.status !==
                            MocTaskStatus.COMPLETED &&
                          task.status !==
                            MocTaskStatus.CANCELLED
                      );
  
                    return (
                      <article
                        key={task.id}
                        className="rounded-2xl border border-white/10 bg-slate-950/50 p-5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <div className="flex flex-wrap gap-2">
                              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300">
                                {formatEnum(
                                  task.taskType
                                )}
                              </span>
  
                              <TaskStatusBadge
                                status={
                                  task.status
                                }
                              />
  
                              {task.isRequired && (
                                <span className="rounded-full border border-orange-400/20 bg-orange-400/10 px-3 py-1 text-xs text-orange-300">
                                  REQUIRED
                                </span>
                              )}
  
                              {taskOverdue && (
                                <span className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1 text-xs text-red-300">
                                  OVERDUE
                                </span>
                              )}
                            </div>
  
                            <h3 className="mt-3 font-semibold text-white">
                              {task.title}
                            </h3>
  
                            <p className="mt-2 text-sm leading-6 text-slate-400">
                              {task.description ||
                                "No description provided."}
                            </p>
                          </div>
                        </div>
  
                        <div className="mt-4 grid gap-3 md:grid-cols-4">
                          <InfoBlock
                            label="Assignee"
                            value={
                              task.assignedTo
                                ?.name ||
                              "Not assigned"
                            }
                          />
  
                          <InfoBlock
                            label="Due"
                            value={formatDate(
                              task.dueDate
                            )}
                          />
  
                          <InfoBlock
                            label="Completed"
                            value={formatDate(
                              task.completedAt
                            )}
                          />
  
                          <InfoBlock
                            label="Verified By"
                            value={
                              task.verifiedBy
                                ?.name ||
                              "Not verified"
                            }
                          />
                        </div>
  
                        <form
                          action={
                            updateMocTask
                          }
                          className="mt-5 grid gap-4 border-t border-white/10 pt-5 md:grid-cols-2"
                        >
                          <input
                            type="hidden"
                            name="mocId"
                            value={moc.id}
                          />
  
                          <input
                            type="hidden"
                            name="taskId"
                            value={task.id}
                          />
  
                          <Field label="Status">
                            <select
                              name="status"
                              defaultValue={
                                task.status
                              }
                              className={inputClass}
                            >
                              {Object.values(
                                MocTaskStatus
                              ).map((value) => (
                                <option
                                  key={value}
                                  value={value}
                                >
                                  {formatEnum(
                                    value
                                  )}
                                </option>
                              ))}
                            </select>
                          </Field>
  
                          <Field label="Evidence note">
                            <input
                              name="evidenceNote"
                              defaultValue={
                                task.evidenceNote ||
                                ""
                              }
                              placeholder="Describe evidence, completion, or verification."
                              className={inputClass}
                            />
                          </Field>
  
                          <div className="md:col-span-2">
                            <button
                              type="submit"
                              className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-300"
                            >
                              Update Task
                            </button>
                          </div>
                        </form>
                      </article>
                    );
                  }
                )}
  
                {moc.tasks.length ===
                  0 && (
                  <EmptyState message="No implementation or verification tasks have been added." />
                )}
              </div>
            </section>
  
            <section className={sectionClass}>
              <SectionHeading
                title="Linked Enterprise Risks"
                description="Connect existing risk-register records affected, introduced, or reduced by this change."
                icon={<Link2 size={21} />}
              />
  
              <div className="mt-6 space-y-4">
                {moc.riskLinks.map(
                  (link) => (
                    <article
                      key={link.id}
                      className="rounded-2xl border border-white/10 bg-slate-950/50 p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300">
                              {
                                link.risk
                                  .reference
                              }
                            </span>
  
                            <RiskLevelPill
                              riskLevel={
                                link.risk
                                  .residualRiskLevel
                              }
                            />
                          </div>
  
                          <Link
                            href={`/risks/${link.risk.id}`}
                            className="mt-3 block font-semibold text-white transition hover:text-cyan-200"
                          >
                            {
                              link.risk
                                .title
                            }
                          </Link>
  
                          {link.relationshipNote && (
                            <p className="mt-2 text-sm leading-6 text-slate-400">
                              {
                                link.relationshipNote
                              }
                            </p>
                          )}
  
                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <InfoBlock
                              label="Current Risk"
                              value={`${link.risk.currentScore} · ${link.risk.currentRiskLevel}`}
                            />
  
                            <InfoBlock
                              label="Residual Risk"
                              value={`${link.risk.residualScore} · ${link.risk.residualRiskLevel}`}
                            />
                          </div>
                        </div>
  
                        <form
                          action={
                            unlinkRiskFromMoc
                          }
                        >
                          <input
                            type="hidden"
                            name="mocId"
                            value={moc.id}
                          />
  
                          <input
                            type="hidden"
                            name="linkId"
                            value={link.id}
                          />
  
                          <button
                            type="submit"
                            className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-red-300"
                            aria-label="Remove linked risk"
                          >
                            <Trash2 size={16} />
                          </button>
                        </form>
                      </div>
                    </article>
                  )
                )}
  
                {moc.riskLinks.length ===
                  0 && (
                  <EmptyState message="No enterprise risks are linked to this change." />
                )}
              </div>
            </section>
          </main>
  
          <aside className="space-y-6">
            <section className={sectionClass}>
              <SectionHeading
                title="MOC Readiness"
                description="Current approval, task, ownership, and risk readiness."
                icon={
                  <ClipboardCheck
                    size={20}
                  />
                }
              />
  
              <div className="mt-5 space-y-3">
                <ReadinessItem
                  label="Change owner assigned"
                  complete={Boolean(
                    moc.ownerId
                  )}
                />
  
                <ReadinessItem
                  label="No rejected approvals"
                  complete={
                    rejectedApprovals.length ===
                    0
                  }
                />
  
                <ReadinessItem
                  label="All approvals completed"
                  complete={
                    moc.approvals.length >
                      0 &&
                    pendingApprovals.length ===
                      0 &&
                    rejectedApprovals.length ===
                      0
                  }
                />
  
                <ReadinessItem
                  label="Required tasks complete"
                  complete={
                    requiredTasks.length >
                      0 &&
                    completedRequiredTasks.length ===
                      requiredTasks.length
                  }
                />
  
                <ReadinessItem
                  label="Residual risk assessed"
                  complete={
                    moc.residualScore >
                    0
                  }
                />
  
                <ReadinessItem
                  label="Planned completion scheduled"
                  complete={Boolean(
                    moc.plannedCompletionDate
                  )}
                />
              </div>
            </section>
  
            <form
              action={createMocApproval}
              className={sectionClass}
            >
              <SectionHeading
                title="Add Approval"
                description="Add a required functional approval."
                icon={
                  <CheckCircle2
                    size={20}
                  />
                }
              />
  
              <input
                type="hidden"
                name="mocId"
                value={moc.id}
              />
  
              <div className="mt-5 space-y-4">
                <Field
                  label="Approval role"
                  required
                >
                  <select
                    name="role"
                    required
                    defaultValue={
                      MocApprovalRole.EHS
                    }
                    className={inputClass}
                  >
                    {Object.values(
                      MocApprovalRole
                    ).map((value) => (
                      <option
                        key={value}
                        value={value}
                      >
                        {formatEnum(
                          value
                        )}
                      </option>
                    ))}
                  </select>
                </Field>
  
                <Field
                  label="Sequence"
                  required
                >
                  <input
                    name="sequence"
                    type="number"
                    min={1}
                    required
                    defaultValue={
                      moc.approvals.length +
                      1
                    }
                    className={inputClass}
                  />
                </Field>
  
                <Field label="Assigned approver">
                  <select
                    name="approverId"
                    defaultValue=""
                    className={inputClass}
                  >
                    <option value="">
                      Unassigned
                    </option>
  
                    {users.map((person) => (
                      <option
                        key={person.id}
                        value={person.id}
                      >
                        {person.name} —{" "}
                        {person.jobTitle ||
                          formatEnum(
                            person.role
                          )}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
  
              <button
                type="submit"
                className="mt-5 w-full rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950"
              >
                Add Approval
              </button>
            </form>
  
            <form
              action={createMocTask}
              className={sectionClass}
            >
              <SectionHeading
                title="Add Task"
                description="Add an implementation or verification requirement."
                icon={<Plus size={20} />}
              />
  
              <input
                type="hidden"
                name="mocId"
                value={moc.id}
              />
  
              <div className="mt-5 space-y-4">
                <Field
                  label="Task title"
                  required
                >
                  <input
                    name="title"
                    required
                    className={inputClass}
                  />
                </Field>
  
                <Field label="Description">
                  <textarea
                    name="description"
                    rows={3}
                    className={inputClass}
                  />
                </Field>
  
                <Field
                  label="Task type"
                  required
                >
                  <select
                    name="taskType"
                    required
                    defaultValue={
                      MocTaskType.IMPLEMENTATION
                    }
                    className={inputClass}
                  >
                    {Object.values(
                      MocTaskType
                    ).map((value) => (
                      <option
                        key={value}
                        value={value}
                      >
                        {formatEnum(
                          value
                        )}
                      </option>
                    ))}
                  </select>
                </Field>
  
                <Field label="Sequence">
                  <input
                    name="sequence"
                    type="number"
                    min={1}
                    className={inputClass}
                  />
                </Field>
  
                <Field label="Assignee">
                  <select
                    name="assignedToId"
                    defaultValue=""
                    className={inputClass}
                  >
                    <option value="">
                      Not assigned
                    </option>
  
                    {users.map((person) => (
                      <option
                        key={person.id}
                        value={person.id}
                      >
                        {person.name}
                      </option>
                    ))}
                  </select>
                </Field>
  
                <Field label="Due date">
                  <input
                    name="dueDate"
                    type="datetime-local"
                    className={inputClass}
                  />
                </Field>
  
                <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    name="isRequired"
                    defaultChecked
                    className="h-4 w-4"
                  />
  
                  Required before verification
                </label>
              </div>
  
              <button
                type="submit"
                className="mt-5 w-full rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950"
              >
                Add Task
              </button>
            </form>
  
            <form
              action={linkRiskToMoc}
              className={sectionClass}
            >
              <SectionHeading
                title="Link Risk"
                description="Associate an existing enterprise risk."
                icon={<Link2 size={20} />}
              />
  
              <input
                type="hidden"
                name="mocId"
                value={moc.id}
              />
  
              <div className="mt-5 space-y-4">
                <Field
                  label="Risk"
                  required
                >
                  <select
                    name="riskId"
                    required
                    defaultValue=""
                    className={inputClass}
                  >
                    <option
                      value=""
                      disabled
                    >
                      Select risk
                    </option>
  
                    {risks.map((risk) => (
                      <option
                        key={risk.id}
                        value={risk.id}
                      >
                        {risk.reference} —{" "}
                        {risk.title}
                      </option>
                    ))}
                  </select>
                </Field>
  
                <Field label="Relationship note">
                  <textarea
                    name="relationshipNote"
                    rows={3}
                    placeholder="Explain whether the change introduces, modifies, or reduces this risk."
                    className={inputClass}
                  />
                </Field>
              </div>
  
              <button
                type="submit"
                className="mt-5 w-full rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-300"
              >
                Link Risk
              </button>
            </form>
          </aside>
        </div>
      </div>
    );
  }
  
  function getLifecycleSteps(): MocStatus[] {
    return [
      MocStatus.DRAFT,
      MocStatus.TECHNICAL_REVIEW,
      MocStatus.RISK_REVIEW,
      MocStatus.PENDING_APPROVAL,
      MocStatus.APPROVED,
      MocStatus.IMPLEMENTATION,
      MocStatus.VERIFICATION,
      MocStatus.CLOSED,
    ];
  }
  
  
  function getNextMocStatuses(
    status: MocStatus
  ): MocStatus[] {
    const transitions: Record<
      MocStatus,
      MocStatus[]
    > = {
      [MocStatus.DRAFT]: [
        MocStatus.TECHNICAL_REVIEW,
        MocStatus.CANCELLED,
      ],
  
      [MocStatus.TECHNICAL_REVIEW]:
        [
          MocStatus.RISK_REVIEW,
          MocStatus.REJECTED,
          MocStatus.CANCELLED,
        ],
  
      [MocStatus.RISK_REVIEW]: [
        MocStatus.PENDING_APPROVAL,
        MocStatus.TECHNICAL_REVIEW,
        MocStatus.REJECTED,
        MocStatus.CANCELLED,
      ],
  
      [MocStatus.PENDING_APPROVAL]:
        [
          MocStatus.APPROVED,
          MocStatus.RISK_REVIEW,
          MocStatus.REJECTED,
          MocStatus.CANCELLED,
        ],
  
      [MocStatus.APPROVED]: [
        MocStatus.IMPLEMENTATION,
        MocStatus.CANCELLED,
      ],
  
      [MocStatus.IMPLEMENTATION]:
        [
          MocStatus.VERIFICATION,
          MocStatus.CANCELLED,
        ],
  
      [MocStatus.VERIFICATION]: [
        MocStatus.CLOSED,
        MocStatus.IMPLEMENTATION,
        MocStatus.CANCELLED,
      ],
  
      [MocStatus.REJECTED]: [
        MocStatus.DRAFT,
        MocStatus.CANCELLED,
      ],
  
      [MocStatus.CLOSED]: [],
      [MocStatus.CANCELLED]: [],
    };
  
    return transitions[status];
  }
  
  function LifecycleStep({
    status,
    currentStatus,
  }: {
    status: MocStatus;
    currentStatus: MocStatus;
  }) {
    const lifecycle: MocStatus[] =
      getLifecycleSteps();
  
    const currentIndex =
      lifecycle.indexOf(
        currentStatus
      );
  
    const stepIndex =
      lifecycle.indexOf(status);
  
    const isTerminalStatus =
      currentStatus ===
        MocStatus.REJECTED ||
      currentStatus ===
        MocStatus.CANCELLED;
  
    const complete =
      !isTerminalStatus &&
      currentIndex >= 0 &&
      stepIndex < currentIndex;
  
    const current =
      status === currentStatus;
  
    return (
      <div
        className={`rounded-2xl border p-4 text-center ${
          current
            ? "border-cyan-400/40 bg-cyan-400/15 text-cyan-200"
            : complete
              ? "border-green-400/20 bg-green-400/10 text-green-300"
              : "border-white/10 bg-slate-950/40 text-slate-500"
        }`}
      >
        <p className="text-xs font-semibold">
          {formatEnum(status)}
        </p>
      </div>
    );
    
  }
  
  function SectionHeading({
    title,
    description,
    icon,
  }: {
    title: string;
    description: string;
    icon: React.ReactNode;
  }) {
    return (
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-300">
          {icon}
        </div>
  
        <div>
          <h2 className="text-xl font-semibold text-white">
            {title}
          </h2>
  
          <p className="mt-1 text-sm leading-6 text-slate-400">
            {description}
          </p>
        </div>
      </div>
    );
  }
  
  function Field({
    label,
    required = false,
    children,
  }: {
    label: string;
    required?: boolean;
    children: React.ReactNode;
  }) {
    return (
      <label className="block text-sm text-slate-300">
        {label}
  
        {required && (
          <span className="ml-1 text-red-300">
            *
          </span>
        )}
  
        {children}
      </label>
    );
  }
  
  function TextField({
    label,
    name,
    value,
  }: {
    label: string;
    name: string;
    value: string | null;
  }) {
    return (
      <Field label={label}>
        <input
          name={name}
          defaultValue={value || ""}
          className={inputClass}
        />
      </Field>
    );
  }
  
  function TextareaField({
    label,
    name,
    value,
  }: {
    label: string;
    name: string;
    value: string | null;
  }) {
    return (
      <Field label={label}>
        <textarea
          name={name}
          rows={4}
          defaultValue={value || ""}
          className={inputClass}
        />
      </Field>
    );
  }
  
  function InfoCard({
    label,
    value,
    detail,
    critical = false,
  }: {
    label: string;
    value: string;
    detail?: string;
    critical?: boolean;
  }) {
    return (
      <div
        className={`rounded-2xl border p-4 ${
          critical
            ? "border-red-400/20 bg-red-400/10"
            : "border-white/10 bg-white/5"
        }`}
      >
        <p className="text-xs text-slate-500">
          {label}
        </p>
  
        <p className="mt-2 text-sm font-semibold text-white">
          {value}
        </p>
  
        {detail && (
          <p className="mt-1 text-xs text-slate-500">
            {detail}
          </p>
        )}
      </div>
    );
  }
  
  function InfoBlock({
    label,
    value,
  }: {
    label: string;
    value: string;
  }) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
        <p className="text-xs text-slate-500">
          {label}
        </p>
  
        <p className="mt-1 text-sm text-slate-200">
          {value}
        </p>
      </div>
    );
  }
  
  function RiskAssessmentCard({
    title,
    score,
    riskLevel,
    likelihood,
    impact,
  }: {
    title: string;
    score: number;
    riskLevel: RiskLevel;
    likelihood: RiskLikelihood;
    impact: RiskImpact;
  }) {
    return (
      <div
        className={`rounded-3xl border p-6 ${getRiskClassName(
          riskLevel
        )}`}
      >
        <p className="text-sm font-medium opacity-80">
          {title}
        </p>
  
        <p className="mt-3 text-4xl font-bold">
          {score}
        </p>
  
        <p className="mt-1 font-semibold">
          {riskLevel}
        </p>
  
        <div className="mt-4 border-t border-current/10 pt-4 text-xs leading-6 opacity-80">
          <p>
            Likelihood:{" "}
            {formatEnum(likelihood)}
          </p>
  
          <p>
            Impact: {formatEnum(impact)}
          </p>
        </div>
      </div>
    );
  }
  
  function RiskBadge({
    label,
    score,
    riskLevel,
  }: {
    label: string;
    score: number;
    riskLevel: RiskLevel;
  }) {
    return (
      <div
        className={`min-w-40 rounded-2xl border p-4 text-center ${getRiskClassName(
          riskLevel
        )}`}
      >
        <p className="text-xs opacity-80">
          {label}
        </p>
  
        <p className="mt-2 text-3xl font-bold">
          {score}
        </p>
  
        <p className="mt-1 text-xs font-semibold">
          {riskLevel}
        </p>
      </div>
    );
  }
  
  function RiskLevelPill({
    riskLevel,
  }: {
    riskLevel: RiskLevel;
  }) {
    return (
      <span
        className={`rounded-full border px-3 py-1 text-xs ${getRiskClassName(
          riskLevel
        )}`}
      >
        {riskLevel}
      </span>
    );
  }
  
  function StatusBadge({
    status,
  }: {
    status: MocStatus;
  }) {
    return (
      <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300">
        {formatEnum(status)}
      </span>
    );
  }
  
  function PriorityBadge({
    priority,
  }: {
    priority: MocPriority;
  }) {
    const className =
      priority ===
      MocPriority.CRITICAL
        ? "border-purple-400/20 bg-purple-400/10 text-purple-300"
        : priority ===
            MocPriority.HIGH
          ? "border-red-400/20 bg-red-400/10 text-red-300"
          : priority ===
              MocPriority.MEDIUM
            ? "border-orange-400/20 bg-orange-400/10 text-orange-300"
            : "border-green-400/20 bg-green-400/10 text-green-300";
  
    return (
      <span
        className={`rounded-full border px-3 py-1 text-xs ${className}`}
      >
        {priority}
      </span>
    );
  }
  
  function ApprovalStatusBadge({
    status,
  }: {
    status: MocApprovalStatus;
  }) {
    const className =
      status ===
      MocApprovalStatus.APPROVED
        ? "border-green-400/20 bg-green-400/10 text-green-300"
        : status ===
            MocApprovalStatus.REJECTED
          ? "border-red-400/20 bg-red-400/10 text-red-300"
          : status ===
              MocApprovalStatus.NOT_REQUIRED
            ? "border-slate-400/20 bg-slate-400/10 text-slate-300"
            : "border-orange-400/20 bg-orange-400/10 text-orange-300";
  
    return (
      <span
        className={`rounded-full border px-3 py-1 text-xs ${className}`}
      >
        {formatEnum(status)}
      </span>
    );
  }
  
  function TaskStatusBadge({
    status,
  }: {
    status: MocTaskStatus;
  }) {
    const className =
      status ===
      MocTaskStatus.COMPLETED
        ? "border-green-400/20 bg-green-400/10 text-green-300"
        : status ===
            MocTaskStatus.BLOCKED
          ? "border-red-400/20 bg-red-400/10 text-red-300"
          : status ===
              MocTaskStatus.IN_PROGRESS
            ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-300"
            : "border-slate-400/20 bg-slate-400/10 text-slate-300";
  
    return (
      <span
        className={`rounded-full border px-3 py-1 text-xs ${className}`}
      >
        {formatEnum(status)}
      </span>
    );
  }
  
  function ReadinessItem({
    label,
    complete,
  }: {
    label: string;
    complete: boolean;
  }) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/50 p-4">
        <p className="text-sm text-slate-300">
          {label}
        </p>
  
        {complete ? (
          <CheckCircle2
            size={18}
            className="shrink-0 text-green-300"
          />
        ) : (
          <AlertTriangle
            size={18}
            className="shrink-0 text-orange-300"
          />
        )}
      </div>
    );
  }
  
  function EmptyState({
    message,
  }: {
    message: string;
  }) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-slate-500">
        {message}
      </div>
    );
  }
  
  function getRiskClassName(
    riskLevel: RiskLevel
  ) {
    switch (riskLevel) {
      case RiskLevel.CRITICAL:
        return "border-purple-400/20 bg-purple-400/10 text-purple-200";
  
      case RiskLevel.HIGH:
        return "border-red-400/20 bg-red-400/10 text-red-200";
  
      case RiskLevel.MEDIUM:
        return "border-orange-400/20 bg-orange-400/10 text-orange-200";
  
      case RiskLevel.LOW:
      default:
        return "border-green-400/20 bg-green-400/10 text-green-200";
    }
  }
  
  function formatEnum(
    value: string
  ) {
    return value
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(
        /\b\w/g,
        (character) =>
          character.toUpperCase()
      );
  }
  
  function formatDate(
    value: Date | null
  ) {
    if (!value) {
      return "Not recorded";
    }
  
    return value.toLocaleString(
      "en-US",
      {
        dateStyle: "medium",
        timeStyle: "short",
      }
    );
  }
  
  function formatDateInput(
    value: Date | null
  ) {
    if (!value) {
      return "";
    }
  
    const timezoneOffset =
      value.getTimezoneOffset();
  
    return new Date(
      value.getTime() -
        timezoneOffset *
          60 *
          1000
    )
      .toISOString()
      .slice(0, 16);
  }
  
  const sectionClass =
    "rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl";
  
  const inputClass =
    "mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50";