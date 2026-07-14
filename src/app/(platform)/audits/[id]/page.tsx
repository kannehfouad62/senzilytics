import {
  addAuditTeamMember,
  createAuditFinding,
  removeAuditTeamMember,
  saveAuditResponse,
  updateAuditFindingStatus,
  updateAuditStatus, convertAuditFindingToCorrectiveAction,
} from "@/features/audits/actions";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { findTenantAuditById } from "@/modules/audit/audit.repository";
import {
  AuditResponseResult,
  AuditTeamRole,
  PermissionKey,
  RiskLevel,
  Status,
} from "@prisma/client";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  MapPin,
  SearchCheck,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function AuditDetailPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  await requirePermission(
    PermissionKey.VIEW_AUDITS
  );

  const { id } = await params;

  const { organizationId } =
    await getCurrentUserTenant();

  const [audit, users] =
    await Promise.all([
      findTenantAuditById(
        id,
        organizationId
      ),

      prisma.user.findMany({
        where: {
          organizationId,
        },
        select: {
          id: true,
          name: true,
          role: true,
          jobTitle: true,
        },
        orderBy: {
          name: "asc",
        },
      }),
    ]);

  if (!audit) {
    notFound();
  }

  const locked =
    audit.status ===
      Status.COMPLETED ||
    audit.status === Status.CLOSED;

  const answeredItems =
    audit.checklistItems.filter(
      (item) =>
        item.response &&
        item.response.result !==
          AuditResponseResult.NOT_ASSESSED
    ).length;

  const nonCompliantItems =
    audit.responses.filter(
      (response) =>
        response.result ===
        AuditResponseResult.NON_COMPLIANT
    ).length;

  const progress =
    audit.checklistItems.length > 0
      ? Math.round(
          (answeredItems /
            audit.checklistItems
              .length) *
            100
        )
      : 0;

  const scoredResponses =
    audit.responses.filter(
      (response) =>
        response.score !== null
    );

  const averageScore =
    scoredResponses.length > 0
      ? scoredResponses.reduce(
          (total, response) =>
            total +
            Number(response.score),
          0
        ) / scoredResponses.length
      : null;

  const checklistSections =
    audit.checklistItems.reduce(
      (
        sections,
        item
      ) => {
        const existing =
          sections.get(
            item.sectionName
          ) ?? [];

        existing.push(item);

        sections.set(
          item.sectionName,
          existing
        );

        return sections;
      },
      new Map<
        string,
        typeof audit.checklistItems
      >()
    );

  return (
    <div>
      <Link
        href="/audits"
        className="inline-flex items-center gap-2 text-sm text-slate-400"
      >
        <ArrowLeft size={16} />
        Back to audits
      </Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="flex items-center gap-2 text-sm text-cyan-300">
            <SearchCheck size={16} />
            {audit.reference ||
              "Audit Record"}
          </p>

          <h1 className="mt-2 text-4xl font-bold tracking-tight">
            {audit.title}
          </h1>

          <p className="mt-3 max-w-3xl text-slate-400">
            {audit.scope ||
              "No audit scope provided."}
          </p>
        </div>

        <StatusBadge
          status={audit.status}
        />
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <InfoCard
          label="Site"
          value={audit.site.name}
          icon={<MapPin size={17} />}
        />

        <InfoCard
          label="Lead auditor"
          value={
            audit.leadAuditor
              ?.name ||
            "Not assigned"
          }
          icon={<Users size={17} />}
        />

        <InfoCard
          label="Scheduled"
          value={formatDate(
            audit.scheduledAt
          )}
          icon={
            <CalendarDays size={17} />
          }
        />

        <InfoCard
          label="Due"
          value={formatDate(
            audit.dueDate
          )}
          icon={
            <CalendarDays size={17} />
          }
        />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <Metric
          label="Checklist progress"
          value={`${progress}%`}
        />

        <Metric
          label="Answered"
          value={`${answeredItems}/${audit.checklistItems.length}`}
        />

        <Metric
          label="Noncompliant"
          value={String(
            nonCompliantItems
          )}
        />

        <Metric
          label="Average score"
          value={
            averageScore === null
              ? "Not scored"
              : averageScore.toFixed(
                  1
                )
          }
        />
      </div>

      {audit.checklistItems.length >
        0 && (
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-900">
          <div
            className="h-full rounded-full bg-cyan-300"
            style={{
              width: `${progress}%`,
            }}
          />
        </div>
      )}

      <div className="mt-8 grid gap-7 xl:grid-cols-[1fr_380px]">
        <main className="space-y-7">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div>
              <h2 className="text-xl font-semibold text-white">
                Audit Checklist
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Record evidence,
                compliance results,
                comments, and findings.
              </p>
            </div>

            <div className="mt-6 space-y-6">
              {Array.from(
                checklistSections.entries()
              ).map(
                ([
                  sectionName,
                  items,
                ]) => (
                  <div
                    key={
                      sectionName
                    }
                  >
                    <h3 className="border-b border-white/10 pb-3 font-semibold text-cyan-300">
                      {sectionName}
                    </h3>

                    <div className="mt-4 space-y-4">
                      {items.map(
                        (item) => (
                          <form
                            key={
                              item.id
                            }
                            action={
                              saveAuditResponse
                            }
                            className="rounded-2xl border border-white/10 bg-slate-950/50 p-5"
                          >
                            <input
                              type="hidden"
                              name="auditId"
                              value={
                                audit.id
                              }
                            />

                            <input
                              type="hidden"
                              name="checklistItemId"
                              value={
                                item.id
                              }
                            />

                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div>
                                <p className="text-sm font-medium text-white">
                                  {
                                    item.questionText
                                  }
                                </p>

                                {item.guidance && (
                                  <p className="mt-2 text-xs text-slate-400">
                                    {
                                      item.guidance
                                    }
                                  </p>
                                )}
                              </div>

                              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                                Weight:{" "}
                                {
                                  item.weight
                                }
                              </span>
                            </div>

                            <div className="mt-5 grid gap-4 md:grid-cols-2">
                              <Field label="Result">
                                <select
                                  name="result"
                                  defaultValue={
                                    item
                                      .response
                                      ?.result ??
                                    AuditResponseResult.NOT_ASSESSED
                                  }
                                  disabled={
                                    locked
                                  }
                                  className={
                                    inputClass
                                  }
                                >
                                  {Object.values(
                                    AuditResponseResult
                                  ).map(
                                    (
                                      result
                                    ) => (
                                      <option
                                        key={
                                          result
                                        }
                                        value={
                                          result
                                        }
                                      >
                                        {result.replaceAll(
                                          "_",
                                          " "
                                        )}
                                      </option>
                                    )
                                  )}
                                </select>
                              </Field>

                              <Field label="Score">
                                <input
                                  name="score"
                                  type="number"
                                  step="0.01"
                                  defaultValue={
                                    item
                                      .response
                                      ?.score !==
                                    null
                                      ? String(
                                          item
                                            .response
                                            ?.score ??
                                            ""
                                        )
                                      : ""
                                  }
                                  disabled={
                                    locked
                                  }
                                  className={
                                    inputClass
                                  }
                                />
                              </Field>
                            </div>

                            <Field label="Response or evidence summary">
                              <textarea
                                name="responseText"
                                rows={3}
                                defaultValue={
                                  item
                                    .response
                                    ?.responseText ??
                                  ""
                                }
                                disabled={
                                  locked
                                }
                                className={
                                  inputClass
                                }
                              />
                            </Field>

                            <Field label="Comments">
                              <textarea
                                name="comments"
                                rows={2}
                                defaultValue={
                                  item
                                    .response
                                    ?.comments ??
                                  ""
                                }
                                disabled={
                                  locked
                                }
                                className={
                                  inputClass
                                }
                              />
                            </Field>

                            <div className="mt-5 rounded-2xl border border-orange-400/20 bg-orange-400/5 p-4">
                              <label className="flex items-center gap-3 text-sm text-orange-200">
                                <input
                                  type="checkbox"
                                  name="createFinding"
                                  defaultChecked={
                                    Boolean(
                                      item
                                        .response
                                        ?.finding
                                    )
                                  }
                                  disabled={
                                    locked
                                  }
                                />
                                Create or update a
                                finding when this
                                response is
                                noncompliant
                              </label>

                              <div className="mt-4 grid gap-4 md:grid-cols-2">
                                <Field label="Finding title">
                                  <input
                                    name="findingTitle"
                                    defaultValue={
                                      item
                                        .response
                                        ?.finding
                                        ?.title ??
                                      ""
                                    }
                                    disabled={
                                      locked
                                    }
                                    className={
                                      inputClass
                                    }
                                  />
                                </Field>

                                <Field label="Finding risk">
                                  <select
                                    name="findingRiskLevel"
                                    defaultValue={
                                      item
                                        .response
                                        ?.finding
                                        ?.riskLevel ??
                                      RiskLevel.MEDIUM
                                    }
                                    disabled={
                                      locked
                                    }
                                    className={
                                      inputClass
                                    }
                                  >
                                    {Object.values(
                                      RiskLevel
                                    ).map(
                                      (
                                        risk
                                      ) => (
                                        <option
                                          key={
                                            risk
                                          }
                                          value={
                                            risk
                                          }
                                        >
                                          {
                                            risk
                                          }
                                        </option>
                                      )
                                    )}
                                  </select>
                                </Field>
                              </div>

                              <Field label="Finding description">
                                <textarea
                                  name="findingDescription"
                                  rows={2}
                                  defaultValue={
                                    item
                                      .response
                                      ?.finding
                                      ?.title
                                      ? `Generated from checklist item: ${item.questionText}`
                                      : ""
                                  }
                                  disabled={
                                    locked
                                  }
                                  className={
                                    inputClass
                                  }
                                />
                              </Field>

                              <Field label="Finding due date">
                                <input
                                  name="findingDueDate"
                                  type="datetime-local"
                                  disabled={
                                    locked
                                  }
                                  className={
                                    inputClass
                                  }
                                />
                              </Field>
                            </div>

                            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                              <div className="text-xs text-slate-500">
                                {item.response
                                  ?.answeredBy
                                  ? `Last answered by ${item.response.answeredBy.name}`
                                  : "Not yet assessed"}
                              </div>

                              <button
                                type="submit"
                                disabled={
                                  locked
                                }
                                className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
                              >
                                Save Response
                              </button>
                            </div>
                          </form>
                        )
                      )}
                    </div>
                  </div>
                )
              )}

              {audit.checklistItems
                .length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-slate-400">
                  This audit has no
                  checklist snapshot.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
  <h2 className="text-xl font-semibold text-white">
    Audit Findings
  </h2>

  <p className="mt-1 text-sm text-slate-400">
    Review findings, update their status, and convert unresolved findings into
    assigned corrective actions.
  </p>

  <div className="mt-5 space-y-4">
    {audit.findings.map((finding) => (
      <div
        key={finding.id}
        className="rounded-2xl border border-white/10 bg-slate-950/50 p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-white">
              {finding.title}
            </h3>

            <p className="mt-2 text-sm text-slate-400">
              {finding.description || "No description provided."}
            </p>

            {finding.dueDate && (
              <p className="mt-3 text-xs text-slate-500">
                Due: {formatDate(finding.dueDate)}
              </p>
            )}
          </div>

          <RiskBadge riskLevel={finding.riskLevel} />
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-4">
          <StatusBadge status={finding.status} />

          <form
            action={updateAuditFindingStatus}
            className="flex flex-wrap gap-2"
          >
            <input
              type="hidden"
              name="auditId"
              value={audit.id}
            />

            <input
              type="hidden"
              name="findingId"
              value={finding.id}
            />

            <select
              name="status"
              defaultValue={finding.status}
              className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white"
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

            <button
              type="submit"
              className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-300"
            >
              Update
            </button>
          </form>
        </div>

        {finding.correctiveAction ? (
          <div className="mt-5 rounded-2xl border border-green-400/20 bg-green-400/10 p-4">
            <p className="text-xs font-medium text-green-300">
              CORRECTIVE ACTION CREATED
            </p>

            <p className="mt-2 text-sm font-semibold text-white">
              {finding.correctiveAction.title}
            </p>

            <p className="mt-2 text-xs text-slate-300">
              Assigned to{" "}
              {finding.correctiveAction.assignedTo.name}
              {" · "}
              {finding.correctiveAction.status.replaceAll("_", " ")}
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Due: {formatDate(finding.correctiveAction.dueDate)}
            </p>
          </div>
        ) : finding.status !== Status.COMPLETED &&
          finding.status !== Status.CLOSED ? (
          <form
            action={convertAuditFindingToCorrectiveAction}
            className="mt-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4"
          >
            <input
              type="hidden"
              name="auditId"
              value={audit.id}
            />

            <input
              type="hidden"
              name="findingId"
              value={finding.id}
            />

            <h4 className="text-sm font-semibold text-cyan-200">
              Convert to Corrective Action
            </h4>

            <p className="mt-1 text-xs text-slate-400">
              Assign ownership and a completion deadline for this finding.
            </p>

            <div className="mt-4 space-y-4">
              <Field label="Action title">
                <input
                  name="title"
                  required
                  defaultValue={`Corrective action: ${finding.title}`}
                  className={inputClass}
                />
              </Field>

              <Field label="Description">
                <textarea
                  name="description"
                  rows={3}
                  defaultValue={finding.description || ""}
                  className={inputClass}
                />
              </Field>

              <Field label="Assign to">
                <select
                  name="assignedToId"
                  required
                  defaultValue=""
                  className={inputClass}
                >
                  <option
                    value=""
                    disabled
                  >
                    Select assignee
                  </option>

                  {users.map((user) => (
                    <option
                      key={user.id}
                      value={user.id}
                    >
                      {user.name} —{" "}
                      {user.jobTitle ||
                        user.role.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Risk level">
                  <select
                    name="riskLevel"
                    defaultValue={finding.riskLevel}
                    className={inputClass}
                  >
                    {Object.values(RiskLevel).map((riskLevel) => (
                      <option
                        key={riskLevel}
                        value={riskLevel}
                      >
                        {riskLevel}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Due date">
                  <input
                    name="dueDate"
                    type="datetime-local"
                    required
                    className={inputClass}
                  />
                </Field>
              </div>
            </div>

            <button
              type="submit"
              className="mt-4 rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
            >
              Create Corrective Action
            </button>
          </form>
        ) : (
          <div className="mt-5 rounded-2xl border border-slate-400/20 bg-slate-400/5 p-4">
            <p className="text-xs text-slate-400">
              This finding is {finding.status.toLowerCase()} and cannot be
              converted into a corrective action.
            </p>
          </div>
        )}
      </div>
    ))}

    {audit.findings.length === 0 && (
      <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center">
        <CircleAlert
          size={30}
          className="mx-auto text-slate-500"
        />

        <p className="mt-3 text-sm text-slate-500">
          No findings recorded.
        </p>
      </div>
    )}
  </div>
</section>
        </main>

        <aside className="space-y-6">
          <form
            action={updateAuditStatus}
            className="rounded-3xl border border-white/10 bg-white/5 p-6"
          >
            <h2 className="text-lg font-semibold text-white">
              Audit Status
            </h2>

            <input
              type="hidden"
              name="auditId"
              value={audit.id}
            />

            <select
              name="status"
              defaultValue={
                audit.status
              }
              className={`${inputClass} mt-5`}
            >
              {Object.values(
                Status
              ).map((status) => (
                <option
                  key={status}
                  value={status}
                >
                  {status.replaceAll(
                    "_",
                    " "
                  )}
                </option>
              ))}
            </select>

            <button
              type="submit"
              className="mt-4 w-full rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950"
            >
              Update Status
            </button>
          </form>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center gap-2">
              <Users
                size={18}
                className="text-cyan-300"
              />

              <h2 className="text-lg font-semibold text-white">
                Audit Team
              </h2>
            </div>

            <div className="mt-5 space-y-3">
              {audit.teamMembers.map(
                (member) => (
                  <div
                    key={
                      member.id
                    }
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/50 p-4"
                  >
                    <div>
                      <p className="text-sm font-medium text-white">
                        {
                          member.user
                            .name
                        }
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {member.role.replaceAll(
                          "_",
                          " "
                        )}
                      </p>
                    </div>

                    {member.role !==
                      AuditTeamRole.LEAD_AUDITOR && (
                      <form
                        action={
                          removeAuditTeamMember
                        }
                      >
                        <input
                          type="hidden"
                          name="auditId"
                          value={
                            audit.id
                          }
                        />

                        <input
                          type="hidden"
                          name="teamMemberId"
                          value={
                            member.userId
                          }
                        />

                        <button
                          type="submit"
                          className="rounded-xl border border-red-400/20 bg-red-400/10 p-2 text-red-300"
                        >
                          <Trash2
                            size={15}
                          />
                        </button>
                      </form>
                    )}
                  </div>
                )
              )}
            </div>

            <form
              action={
                addAuditTeamMember
              }
              className="mt-5 space-y-4 border-t border-white/10 pt-5"
            >
              <input
                type="hidden"
                name="auditId"
                value={audit.id}
              />

              <Field label="Team member">
                <select
                  name="teamMemberId"
                  required
                  defaultValue=""
                  className={
                    inputClass
                  }
                >
                  <option
                    value=""
                    disabled
                  >
                    Select user
                  </option>

                  {users.map(
                    (user) => (
                      <option
                        key={
                          user.id
                        }
                        value={
                          user.id
                        }
                      >
                        {user.name} —{" "}
                        {user.jobTitle ||
                          user.role.replaceAll(
                            "_",
                            " "
                          )}
                      </option>
                    )
                  )}
                </select>
              </Field>

              <Field label="Team role">
                <select
                  name="teamRole"
                  defaultValue={
                    AuditTeamRole.AUDITOR
                  }
                  className={
                    inputClass
                  }
                >
                  {Object.values(
                    AuditTeamRole
                  ).map(
                    (role) => (
                      <option
                        key={
                          role
                        }
                        value={
                          role
                        }
                      >
                        {role.replaceAll(
                          "_",
                          " "
                        )}
                      </option>
                    )
                  )}
                </select>
              </Field>

              <button
                type="submit"
                className="w-full rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm font-medium text-cyan-300"
              >
                Add Team Member
              </button>
            </form>
          </section>

          <form
            action={createAuditFinding}
            className="rounded-3xl border border-white/10 bg-white/5 p-6"
          >
            <h2 className="text-lg font-semibold text-white">
              Manual Finding
            </h2>

            <input
              type="hidden"
              name="auditId"
              value={audit.id}
            />

            <div className="mt-5 space-y-4">
              <Field label="Title">
                <input
                  name="title"
                  required
                  disabled={locked}
                  className={
                    inputClass
                  }
                />
              </Field>

              <Field label="Description">
                <textarea
                  name="description"
                  rows={3}
                  disabled={locked}
                  className={
                    inputClass
                  }
                />
              </Field>

              <Field label="Risk level">
                <select
                  name="riskLevel"
                  defaultValue={
                    RiskLevel.LOW
                  }
                  disabled={locked}
                  className={
                    inputClass
                  }
                >
                  {Object.values(
                    RiskLevel
                  ).map(
                    (risk) => (
                      <option
                        key={
                          risk
                        }
                        value={
                          risk
                        }
                      >
                        {risk}
                      </option>
                    )
                  )}
                </select>
              </Field>

              <Field label="Due date">
                <input
                  name="dueDate"
                  type="datetime-local"
                  disabled={locked}
                  className={
                    inputClass
                  }
                />
              </Field>
            </div>

            <button
              type="submit"
              disabled={locked}
              className="mt-5 w-full rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50"
            >
              Add Finding
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}

const inputClass =
  "mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white";

function formatDate(
  value: Date | null
) {
  return value
    ? value.toLocaleString(
        "en-US",
        {
          dateStyle: "medium",
          timeStyle: "short",
        }
      )
    : "Not set";
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="mt-4 block text-sm text-slate-300">
      {label}
      {children}
    </label>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-xl font-semibold text-white">
        {value}
      </p>
    </div>
  );
}

function InfoCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <p className="flex items-center gap-2 text-xs text-slate-500">
        <span className="text-cyan-300">
          {icon}
        </span>
        {label}
      </p>

      <p className="mt-2 text-sm font-medium text-white">
        {value}
      </p>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: Status;
}) {
  return (
    <span className="h-fit rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300">
      {status.replaceAll("_", " ")}
    </span>
  );
}

function RiskBadge({
  riskLevel,
}: {
  riskLevel: RiskLevel;
}) {
  const className =
    riskLevel ===
    RiskLevel.CRITICAL
      ? "border-purple-400/20 bg-purple-400/10 text-purple-300"
      : riskLevel ===
          RiskLevel.HIGH
        ? "border-red-400/20 bg-red-400/10 text-red-300"
        : riskLevel ===
            RiskLevel.MEDIUM
          ? "border-orange-400/20 bg-orange-400/10 text-orange-300"
          : "border-green-400/20 bg-green-400/10 text-green-300";

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs ${className}`}
    >
      {riskLevel}
    </span>
  );
}