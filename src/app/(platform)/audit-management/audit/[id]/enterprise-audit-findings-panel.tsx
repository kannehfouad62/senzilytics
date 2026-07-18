"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ClipboardPlus,
  Loader2,
  RefreshCw,
  Save,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { EnterpriseAuditFindingRecommendations } from "../../audit/[id]/enterprise-audit-finding-recommendations";
import { EnterpriseAuditFindingVerification } from "../../audit/[id]/enterprise-audit-finding-verification";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type UserOption = {
  id: string;
  name: string | null;
  email: string;
  jobTitle: string | null;
};

type Finding = {
  id: string;
  reference: string;
  title: string;
  findingType: string;
  category: string;
  severity: string;
  status: string;
  description: string | null;
  objectiveEvidence: string | null;
  immediateCorrection: string | null;
  containmentAction: string | null;
  rootCause: string | null;
  rootCauseCategory: string | null;
  ownerId: string | null;
  dueDate: string | null;
  requiresCapa: boolean;
  requiresRiskReview: boolean;
  closureSummary: string | null;
  createdAt: string;
  owner: UserOption | null;
  question: {
    id: string;
    questionText: string;
    section: {
      id: string;
      title: string;
    };
  } | null;
  _count: {
    evidence: number;
    evidenceLinks: number;
    verifications: number;
    correctiveActionLinks: number;
    riskLinks: number;
    history: number;
  };
};

const severityOptions = [
  "OBSERVATION",
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
];

const statusOptions = [
  "OPEN",
  "UNDER_REVIEW",
  "ACTION_REQUIRED",
  "IN_PROGRESS",
  "PENDING_VERIFICATION",
  "VERIFIED",
  "CLOSED",
  "REJECTED",
  "CANCELLED",
];

function label(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1)
    )
    .join(" ");
}

function dueDateInput(
  value: string | null
) {
  return value
    ? value.slice(0, 10)
    : "";
}

export function EnterpriseAuditFindingsPanel({
  auditId,
  locked,
  onChanged,
}: {
  auditId: string;
  locked: boolean;
  onChanged: () => void;
}) {
  const [findings, setFindings] =
    useState<Finding[]>([]);
  const [users, setUsers] =
    useState<UserOption[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [workingId, setWorkingId] =
    useState<string | null>(null);
  const [message, setMessage] =
    useState<{
      success: boolean;
      text: string;
    } | null>(null);
  const [showCreate, setShowCreate] =
    useState(false);
  const [draft, setDraft] =
    useState({
      title: "",
      description: "",
      objectiveEvidence: "",
      severity: "MEDIUM",
      category: "OTHER",
      findingType:
        "NONCONFORMITY",
      ownerId: "",
      dueDate: "",
      requiresCapa: false,
      requiresRiskReview: false,
    });

  const endpoint = `/api/audit-management/audit/${auditId}/findings`;

  const loadFindings =
    useCallback(async () => {
      setLoading(true);
      setMessage(null);

      try {
        const response =
          await fetch(endpoint, {
            cache: "no-store",
          });

        const payload =
          await response.json();

        if (!response.ok) {
          throw new Error(
            payload.message ||
              "Audit findings could not be loaded."
          );
        }

        setFindings(
          payload.findings
        );
        setUsers(payload.users);
      } catch (error) {
        setMessage({
          success: false,
          text:
            error instanceof Error
              ? error.message
              : "Audit findings could not be loaded.",
        });
      } finally {
        setLoading(false);
      }
    }, [endpoint]);

  useEffect(() => {
    void loadFindings();
  }, [loadFindings]);

  const openCount = useMemo(
    () =>
      findings.filter(
        (finding) =>
          ![
            "CLOSED",
            "REJECTED",
            "CANCELLED",
          ].includes(
            finding.status
          )
      ).length,
    [findings]
  );

  async function createFinding() {
    setWorkingId("create");
    setMessage(null);

    try {
      const response =
        await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(
            draft
          ),
        });

      const payload =
        await response.json();

      if (!response.ok) {
        throw new Error(
          payload.message ||
            "The finding could not be created."
        );
      }

      setDraft({
        title: "",
        description: "",
        objectiveEvidence: "",
        severity: "MEDIUM",
        category: "OTHER",
        findingType:
          "NONCONFORMITY",
        ownerId: "",
        dueDate: "",
        requiresCapa: false,
        requiresRiskReview: false,
      });
      setShowCreate(false);
      setMessage({
        success: true,
        text: payload.message,
      });
      await loadFindings();
      onChanged();
    } catch (error) {
      setMessage({
        success: false,
        text:
          error instanceof Error
            ? error.message
            : "The finding could not be created.",
      });
    } finally {
      setWorkingId(null);
    }
  }

  async function updateFinding(
    finding: Finding,
    update: Record<
      string,
      unknown
    >
  ) {
    setWorkingId(
      finding.id
    );
    setMessage(null);

    try {
      const response =
        await fetch(
          `${endpoint}/${finding.id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify(
              update
            ),
          }
        );

      const payload =
        await response.json();

      if (!response.ok) {
        throw new Error(
          payload.message ||
            "The finding could not be updated."
        );
      }

      setMessage({
        success: true,
        text: payload.message,
      });
      await loadFindings();
      onChanged();
    } catch (error) {
      setMessage({
        success: false,
        text:
          error instanceof Error
            ? error.message
            : "The finding could not be updated.",
      });
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm text-cyan-300">
            <ShieldAlert size={16} />
            Audit findings
          </p>

          <h2 className="mt-1 text-xl font-semibold text-white">
            Findings and follow-up
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            {findings.length} total
            {" · "}
            {openCount} open
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              void loadFindings()
            }
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 disabled:opacity-60"
          >
            <RefreshCw
              size={15}
              className={
                loading
                  ? "animate-spin"
                  : ""
              }
            />
            Refresh
          </button>

          {!locked && (
            <button
              type="button"
              onClick={() =>
                setShowCreate(
                  (current) =>
                    !current
                )
              }
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-3 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-300"
            >
              <ClipboardPlus
                size={15}
              />
              Add finding
            </button>
          )}
        </div>
      </div>

      {showCreate && !locked && (
        <div className="mt-5 grid gap-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="text-sm text-slate-300">
              Finding title *
            </span>
            <input
              value={draft.title}
              onChange={(event) =>
                setDraft(
                  (current) => ({
                    ...current,
                    title:
                      event.target
                        .value,
                  })
                )
              }
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50"
            />
          </label>

          <label className="md:col-span-2">
            <span className="text-sm text-slate-300">
              Description
            </span>
            <textarea
              rows={3}
              value={
                draft.description
              }
              onChange={(event) =>
                setDraft(
                  (current) => ({
                    ...current,
                    description:
                      event.target
                        .value,
                  })
                )
              }
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50"
            />
          </label>

          <label>
            <span className="text-sm text-slate-300">
              Severity
            </span>
            <select
              value={draft.severity}
              onChange={(event) =>
                setDraft(
                  (current) => ({
                    ...current,
                    severity:
                      event.target
                        .value,
                  })
                )
              }
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              {severityOptions.map(
                (option) => (
                  <option
                    key={option}
                    value={option}
                  >
                    {label(option)}
                  </option>
                )
              )}
            </select>
          </label>

          <label>
            <span className="text-sm text-slate-300">
              Owner
            </span>
            <select
              value={draft.ownerId}
              onChange={(event) =>
                setDraft(
                  (current) => ({
                    ...current,
                    ownerId:
                      event.target
                        .value,
                  })
                )
              }
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              <option value="">
                Unassigned
              </option>
              {users.map((user) => (
                <option
                  key={user.id}
                  value={user.id}
                >
                  {user.name ||
                    user.email}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="text-sm text-slate-300">
              Due date
            </span>
            <input
              type="date"
              value={draft.dueDate}
              onChange={(event) =>
                setDraft(
                  (current) => ({
                    ...current,
                    dueDate:
                      event.target
                        .value,
                  })
                )
              }
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
            />
          </label>

          <div className="flex flex-wrap items-end gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={
                  draft.requiresCapa
                }
                onChange={(event) =>
                  setDraft(
                    (current) => ({
                      ...current,
                      requiresCapa:
                        event.target
                          .checked,
                    })
                  )
                }
              />
              Recommend CAPA
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={
                  draft.requiresRiskReview
                }
                onChange={(event) =>
                  setDraft(
                    (current) => ({
                      ...current,
                      requiresRiskReview:
                        event.target
                          .checked,
                    })
                  )
                }
              />
              Recommend risk review
            </label>
          </div>

          <div className="md:col-span-2">
            <button
              type="button"
              onClick={() =>
                void createFinding()
              }
              disabled={
                workingId ===
                  "create" ||
                !draft.title.trim()
              }
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:opacity-60"
            >
              {workingId ===
              "create" ? (
                <Loader2
                  size={16}
                  className="animate-spin"
                />
              ) : (
                <Save size={16} />
              )}
              Create finding
            </button>
          </div>
        </div>
      )}

      {loading && (
        <p className="mt-5 flex items-center gap-2 text-sm text-slate-400">
          <Loader2
            size={16}
            className="animate-spin"
          />
          Loading findings
        </p>
      )}

      {!loading &&
        findings.length === 0 && (
          <p className="mt-5 rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-400">
            No enterprise audit findings
            have been recorded.
          </p>
        )}

      {!loading &&
        findings.length > 0 && (
          <div className="mt-5 space-y-3">
            {findings.map(
              (finding) => (
                <details
                  key={finding.id}
                  className="group rounded-2xl border border-white/10 bg-slate-950/50 p-4"
                >
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="flex items-center gap-2 text-sm font-medium text-white">
                          <AlertTriangle
                            size={16}
                            className={
                              finding.severity ===
                                "CRITICAL" ||
                              finding.severity ===
                                "HIGH"
                                ? "text-red-300"
                                : "text-amber-300"
                            }
                          />
                          {
                            finding.reference
                          }
                          {" · "}
                          {finding.title}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {label(
                            finding.severity
                          )}
                          {" · "}
                          {label(
                            finding.status
                          )}
                          {" · "}
                          {finding.owner
                            ?.name ||
                            "Unassigned"}
                        </p>
                      </div>

                      <ChevronDown
                        size={17}
                        className="text-slate-500 transition group-open:rotate-180"
                      />
                    </div>
                  </summary>

                  <div className="mt-4 grid gap-4 border-t border-white/10 pt-4 md:grid-cols-2">
                    <label>
                      <span className="text-xs uppercase tracking-wide text-slate-500">
                        Status
                      </span>
                      <select
                        defaultValue={
                          finding.status
                        }
                        disabled={
                          locked ||
                          workingId ===
                            finding.id
                        }
                        onChange={(event) =>
                          void updateFinding(
                            finding,
                            {
                              status:
                                event
                                  .target
                                  .value,
                            }
                          )
                        }
                        className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
                      >
                        {statusOptions.map(
                          (option) => (
                            <option
                              key={
                                option
                              }
                              value={
                                option
                              }
                            >
                              {label(
                                option
                              )}
                            </option>
                          )
                        )}
                      </select>
                    </label>

                    <label>
                      <span className="text-xs uppercase tracking-wide text-slate-500">
                        Owner
                      </span>
                      <select
                        defaultValue={
                          finding.ownerId ??
                          ""
                        }
                        disabled={
                          locked ||
                          workingId ===
                            finding.id
                        }
                        onChange={(event) =>
                          void updateFinding(
                            finding,
                            {
                              ownerId:
                                event
                                  .target
                                  .value ||
                                null,
                            }
                          )
                        }
                        className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
                      >
                        <option value="">
                          Unassigned
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
                              {user.name ||
                                user.email}
                            </option>
                          )
                        )}
                      </select>
                    </label>

                    <label>
                      <span className="text-xs uppercase tracking-wide text-slate-500">
                        Severity
                      </span>
                      <select
                        defaultValue={
                          finding.severity
                        }
                        disabled={
                          locked ||
                          workingId ===
                            finding.id
                        }
                        onChange={(event) =>
                          void updateFinding(
                            finding,
                            {
                              severity:
                                event
                                  .target
                                  .value,
                            }
                          )
                        }
                        className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
                      >
                        {severityOptions.map(
                          (option) => (
                            <option
                              key={
                                option
                              }
                              value={
                                option
                              }
                            >
                              {label(
                                option
                              )}
                            </option>
                          )
                        )}
                      </select>
                    </label>

                    <label>
                      <span className="text-xs uppercase tracking-wide text-slate-500">
                        Due date
                      </span>
                      <input
                        type="date"
                        defaultValue={dueDateInput(
                          finding.dueDate
                        )}
                        disabled={
                          locked ||
                          workingId ===
                            finding.id
                        }
                        onBlur={(event) =>
                          void updateFinding(
                            finding,
                            {
                              dueDate:
                                event
                                  .target
                                  .value ||
                                null,
                            }
                          )
                        }
                        className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
                      />
                    </label>

                    <div className="md:col-span-2">
                      <p className="text-sm leading-6 text-slate-300">
                        {finding.description ||
                          "No finding description was recorded."}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs md:col-span-2">
                      {finding.requiresCapa && (
                        <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-2.5 py-1 text-violet-200">
                          CAPA recommended
                        </span>
                      )}

                      {finding.requiresRiskReview && (
                        <span className="rounded-full border border-orange-400/20 bg-orange-400/10 px-2.5 py-1 text-orange-200">
                          Risk review recommended
                        </span>
                      )}

                      <span className="rounded-full border border-white/10 px-2.5 py-1 text-slate-400">
                        {
                          finding._count
                            .verifications
                        }{" "}
                        verification
                        {finding._count
                          .verifications ===
                        1
                          ? ""
                          : "s"}
                      </span>

                      <span className="rounded-full border border-white/10 px-2.5 py-1 text-slate-400">
                        {
                          finding._count
                            .correctiveActionLinks
                        }{" "}
                        CAPA link
                        {finding._count
                          .correctiveActionLinks ===
                        1
                          ? ""
                          : "s"}
                      </span>

                      <span className="rounded-full border border-white/10 px-2.5 py-1 text-slate-400">
                        {
                          finding._count
                            .riskLinks
                        }{" "}
                        risk link
                        {finding._count
                          .riskLinks ===
                        1
                          ? ""
                          : "s"}
                      </span>
                    </div>

                    <div className="md:col-span-2">
                      <EnterpriseAuditFindingRecommendations
                        auditId={auditId}
                        findingId={finding.id}
                        locked={locked}
                        ownerId={finding.ownerId}
                        dueDate={finding.dueDate}
                        onChanged={() => {
                          void loadFindings();
                          onChanged();
                        }}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <EnterpriseAuditFindingVerification
                        auditId={auditId}
                        findingId={finding.id}
                        locked={locked}
                        onChanged={() => {
                          void loadFindings();
                          onChanged();
                        }}
                      />
                    </div>

                    {workingId ===
                      finding.id && (
                      <p className="flex items-center gap-2 text-sm text-cyan-300 md:col-span-2">
                        <Loader2
                          size={15}
                          className="animate-spin"
                        />
                        Saving finding
                      </p>
                    )}
                  </div>
                </details>
              )
            )}
          </div>
        )}

      {message && (
        <p
          className={`mt-4 rounded-xl border p-3 text-sm ${
            message.success
              ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
              : "border-red-400/20 bg-red-400/10 text-red-200"
          }`}
        >
          {message.text}
        </p>
      )}
    </section>
  );
}
