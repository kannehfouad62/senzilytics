import {
    createAuditFinding,
    updateAuditFindingStatus,
    updateAuditStatus,
  } from "@/features/audits/actions";
  import { requirePermission } from "@/lib/permissions";
  import { getCurrentUserTenant } from "@/lib/tenant";
  import { findTenantAuditById } from "@/modules/audit/audit.repository";
  import {
    PermissionKey,
    RiskLevel,
    Status,
  } from "@prisma/client";
  import {
    ArrowLeft,
    CalendarDays,
    CircleAlert,
    MapPin,
    SearchCheck,
  } from "lucide-react";
  import Link from "next/link";
  import { notFound } from "next/navigation";
  
  function riskClass(
    value: RiskLevel
  ) {
    switch (value) {
      case RiskLevel.LOW:
        return "border-green-400/20 bg-green-400/10 text-green-300";
  
      case RiskLevel.MEDIUM:
        return "border-orange-400/20 bg-orange-400/10 text-orange-300";
  
      case RiskLevel.HIGH:
        return "border-red-400/20 bg-red-400/10 text-red-300";
  
      case RiskLevel.CRITICAL:
        return "border-purple-400/20 bg-purple-400/10 text-purple-300";
  
      default:
        return "border-slate-400/20 bg-slate-400/10 text-slate-300";
    }
  }
  
  function statusClass(
    value: Status
  ) {
    switch (value) {
      case Status.OPEN:
        return "border-cyan-400/20 bg-cyan-400/10 text-cyan-300";
  
      case Status.IN_PROGRESS:
        return "border-blue-400/20 bg-blue-400/10 text-blue-300";
  
      case Status.COMPLETED:
        return "border-green-400/20 bg-green-400/10 text-green-300";
  
      case Status.CLOSED:
        return "border-slate-400/20 bg-slate-400/10 text-slate-300";
  
      case Status.OVERDUE:
        return "border-red-400/20 bg-red-400/10 text-red-300";
  
      default:
        return "border-white/10 bg-white/5 text-slate-300";
    }
  }
  
  function formatDate(
    value: Date | null
  ) {
    if (!value) {
      return "Not set";
    }
  
    return value.toLocaleString(
      "en-US",
      {
        dateStyle: "medium",
        timeStyle: "short",
      }
    );
  }
  
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
  
    const audit =
      await findTenantAuditById(
        id,
        organizationId
      );
  
    if (!audit) {
      notFound();
    }
  
    const isLocked =
      audit.status ===
        Status.COMPLETED ||
      audit.status === Status.CLOSED;
  
    return (
      <div>
        <Link
          href="/audits"
          className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
        >
          <ArrowLeft size={16} />
          Back to audits
        </Link>
  
        <div className="mt-6 flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="flex items-center gap-2 text-sm text-cyan-300">
              <SearchCheck size={16} />
              Audit Record
            </p>
  
            <h1 className="mt-2 text-4xl font-bold tracking-tight">
              {audit.title}
            </h1>
  
            <p className="mt-3 max-w-3xl text-slate-400">
              {audit.scope ||
                "No audit scope was provided."}
            </p>
          </div>
  
          <span
            className={`rounded-full border px-4 py-2 text-xs font-medium ${statusClass(
              audit.status
            )}`}
          >
            {audit.status.replaceAll(
              "_",
              " "
            )}
          </span>
        </div>
  
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <InfoCard
            label="Site"
            value={audit.site.name}
            icon={<MapPin size={17} />}
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
            label="Completed"
            value={formatDate(
              audit.completedAt
            )}
            icon={
              <SearchCheck size={17} />
            }
          />
        </div>
  
        <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_360px]">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  Audit Findings
                </h2>
  
                <p className="mt-1 text-sm text-slate-400">
                  Document nonconformities,
                  observations, and areas
                  requiring corrective action.
                </p>
              </div>
  
              <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-xs text-slate-300">
                {audit.findings.length}{" "}
                findings
              </span>
            </div>
  
            <div className="mt-6 space-y-4">
              {audit.findings.map(
                (finding) => (
                  <article
                    key={finding.id}
                    className="rounded-2xl border border-white/10 bg-slate-950/50 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-white">
                          {finding.title}
                        </h3>
  
                        <p className="mt-2 text-sm leading-6 text-slate-400">
                          {finding.description ||
                            "No description provided."}
                        </p>
                      </div>
  
                      <span
                        className={`rounded-full border px-3 py-1 text-xs ${riskClass(
                          finding.riskLevel
                        )}`}
                      >
                        {
                          finding.riskLevel
                        }
                      </span>
                    </div>
  
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-4">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs ${statusClass(
                          finding.status
                        )}`}
                      >
                        {finding.status.replaceAll(
                          "_",
                          " "
                        )}
                      </span>
  
                      <form
                        action={
                          updateAuditFindingStatus
                        }
                        className="flex flex-wrap items-center gap-2"
                      >
                        <input
                          type="hidden"
                          name="auditId"
                          value={audit.id}
                        />
  
                        <input
                          type="hidden"
                          name="findingId"
                          value={
                            finding.id
                          }
                        />
  
                        <select
                          name="status"
                          defaultValue={
                            finding.status
                          }
                          className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white"
                        >
                          {Object.values(
                            Status
                          ).map(
                            (status) => (
                              <option
                                key={
                                  status
                                }
                                value={
                                  status
                                }
                              >
                                {status.replaceAll(
                                  "_",
                                  " "
                                )}
                              </option>
                            )
                          )}
                        </select>
  
                        <button
                          type="submit"
                          className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-medium text-cyan-300"
                        >
                          Update
                        </button>
                      </form>
                    </div>
                  </article>
                )
              )}
  
              {audit.findings.length ===
                0 && (
                <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center">
                  <CircleAlert
                    size={30}
                    className="mx-auto text-slate-500"
                  />
  
                  <p className="mt-3 text-sm text-slate-400">
                    No findings have been
                    recorded for this audit.
                  </p>
                </div>
              )}
            </div>
          </section>
  
          <aside className="space-y-6">
            <form
              action={updateAuditStatus}
              className="rounded-3xl border border-white/10 bg-white/5 p-6"
            >
              <h2 className="text-lg font-semibold text-white">
                Audit Status
              </h2>
  
              <p className="mt-1 text-sm text-slate-400">
                Advance the audit through
                execution and closure.
              </p>
  
              <input
                type="hidden"
                name="auditId"
                value={audit.id}
              />
  
              <select
                name="status"
                defaultValue={audit.status}
                className="mt-5 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white"
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
  
              <button
                type="submit"
                className="mt-4 w-full rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
              >
                Update Audit Status
              </button>
            </form>
  
            <form
              action={createAuditFinding}
              className="rounded-3xl border border-white/10 bg-white/5 p-6"
            >
              <h2 className="text-lg font-semibold text-white">
                Record Finding
              </h2>
  
              <p className="mt-1 text-sm text-slate-400">
                Add a finding identified
                during audit execution.
              </p>
  
              <input
                type="hidden"
                name="auditId"
                value={audit.id}
              />
  
              <div className="mt-5 space-y-4">
                <div>
                  <label
                    htmlFor="title"
                    className="text-sm text-slate-300"
                  >
                    Finding title
                  </label>
  
                  <input
                    id="title"
                    name="title"
                    required
                    disabled={isLocked}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white disabled:opacity-50"
                  />
                </div>
  
                <div>
                  <label
                    htmlFor="description"
                    className="text-sm text-slate-300"
                  >
                    Description
                  </label>
  
                  <textarea
                    id="description"
                    name="description"
                    rows={4}
                    disabled={isLocked}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white disabled:opacity-50"
                  />
                </div>
  
                <div>
                  <label
                    htmlFor="riskLevel"
                    className="text-sm text-slate-300"
                  >
                    Risk level
                  </label>
  
                  <select
                    id="riskLevel"
                    name="riskLevel"
                    defaultValue={
                      RiskLevel.LOW
                    }
                    disabled={isLocked}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white disabled:opacity-50"
                  >
                    {Object.values(
                      RiskLevel
                    ).map(
                      (riskLevel) => (
                        <option
                          key={
                            riskLevel
                          }
                          value={
                            riskLevel
                          }
                        >
                          {riskLevel}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>
  
              <button
                type="submit"
                disabled={isLocked}
                className="mt-5 w-full rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add Finding
              </button>
  
              {isLocked && (
                <p className="mt-3 text-xs text-orange-300">
                  Findings cannot be added
                  after an audit is completed
                  or closed.
                </p>
              )}
            </form>
          </aside>
        </div>
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
  
        <p className="mt-2 font-medium text-white">
          {value}
        </p>
      </div>
    );
  }