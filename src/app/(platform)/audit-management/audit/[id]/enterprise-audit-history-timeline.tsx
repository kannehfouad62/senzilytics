"use client";

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  FilePlus2,
  History,
  Loader2,
  RefreshCw,
  RotateCcw,
  Send,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type HistoryRecord = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  title: string;
  description: string | null;
  previousValue: unknown;
  newValue: unknown;
  metadata: unknown;
  createdAt: string;
  actor: {
    id: string;
    name: string | null;
    email: string;
    jobTitle: string | null;
  } | null;
};

function eventIcon(
  action: string
): ReactNode {
  switch (action) {
    case "SUBMITTED_FOR_REVIEW":
      return <Send size={16} />;
    case "COMPLETED":
    case "CLOSED":
    case "VERIFIED":
      return (
        <CheckCircle2 size={16} />
      );
    case "REOPENED":
      return <RotateCcw size={16} />;
    case "FINDING_CREATED":
    case "FINDING_UPDATED":
      return (
        <AlertTriangle size={16} />
      );
    case "EVIDENCE_ADDED":
      return <FilePlus2 size={16} />;
    case "RESPONSE_RECORDED":
      return (
        <ClipboardCheck size={16} />
      );
    default:
      return <Activity size={16} />;
  }
}

function formatAction(
  value: string
) {
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

function formatTimestamp(
  value: string
) {
  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  ).format(new Date(value));
}

function hasDetails(
  record: HistoryRecord
) {
  return Boolean(
    record.previousValue ||
      record.newValue ||
      record.metadata
  );
}

function JsonDetails({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-slate-950 p-3 text-xs text-slate-300">
        {JSON.stringify(
          value,
          null,
          2
        )}
      </pre>
    </div>
  );
}

export function EnterpriseAuditHistoryTimeline({
  auditId,
  refreshKey,
}: {
  auditId: string;
  refreshKey: string;
}) {
  const [records, setRecords] =
    useState<HistoryRecord[]>([]);
  const [nextCursor, setNextCursor] =
    useState<string | null>(null);
  const [loading, setLoading] =
    useState(true);
  const [loadingMore, setLoadingMore] =
    useState(false);
  const [error, setError] =
    useState<string | null>(null);

  const endpoint = `/api/audit-management/audit/${auditId}/history`;

  const loadHistory =
    useCallback(async () => {
      setLoading(true);
      setError(null);

      try {
        const response =
          await fetch(
            `${endpoint}?take=30`,
            {
              cache: "no-store",
            }
          );
        const payload =
          await response.json();

        if (!response.ok) {
          throw new Error(
            payload.message ||
              "Audit history could not be loaded."
          );
        }

        setRecords(
          payload.history
        );
        setNextCursor(
          payload.nextCursor
        );
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Audit history could not be loaded."
        );
      } finally {
        setLoading(false);
      }
    }, [endpoint]);

  useEffect(() => {
    void loadHistory();
  }, [
    loadHistory,
    refreshKey,
  ]);

  async function loadMore() {
    if (!nextCursor) {
      return;
    }

    setLoadingMore(true);
    setError(null);

    try {
      const response =
        await fetch(
          `${endpoint}?take=30&cursor=${encodeURIComponent(
            nextCursor
          )}`,
          {
            cache: "no-store",
          }
        );
      const payload =
        await response.json();

      if (!response.ok) {
        throw new Error(
          payload.message ||
            "More audit history could not be loaded."
        );
      }

      setRecords((current) => [
        ...current,
        ...payload.history,
      ]);
      setNextCursor(
        payload.nextCursor
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "More audit history could not be loaded."
      );
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm text-cyan-300">
            <History size={16} />
            Audit trail
          </p>
          <h2 className="mt-1 text-xl font-semibold text-white">
            Governance history
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Chronological record of audit
            execution, review, evidence,
            findings, and status changes.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            void loadHistory()
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
      </div>

      {loading && (
        <p className="mt-5 flex items-center gap-2 text-sm text-slate-400">
          <Loader2
            size={16}
            className="animate-spin"
          />
          Loading audit history
        </p>
      )}

      {!loading &&
        records.length === 0 &&
        !error && (
          <p className="mt-5 rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-400">
            No audit history records are
            available yet.
          </p>
        )}

      {!loading &&
        records.length > 0 && (
          <div className="mt-6 space-y-4">
            {records.map(
              (record, index) => (
                <article
                  key={record.id}
                  className="relative pl-10"
                >
                  {index <
                    records.length -
                      1 && (
                    <span className="absolute bottom-[-1rem] left-[15px] top-8 w-px bg-white/10" />
                  )}

                  <span className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-400/10 text-cyan-200">
                    {eventIcon(
                      record.action
                    )}
                  </span>

                  <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-white">
                          {record.title}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {formatAction(
                            record.action
                          )}
                          {" · "}
                          {record.actor
                            ?.name ||
                            record.actor
                              ?.email ||
                            "System"}
                          {" · "}
                          {formatTimestamp(
                            record.createdAt
                          )}
                        </p>
                      </div>

                      <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-slate-400">
                        {
                          record.entityType
                        }
                      </span>
                    </div>

                    {record.description && (
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                        {
                          record.description
                        }
                      </p>
                    )}

                    {hasDetails(
                      record
                    ) && (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-xs text-cyan-300">
                          View recorded details
                        </summary>

                        <div className="mt-3 space-y-3">
                          <JsonDetails
                            label="Previous value"
                            value={
                              record.previousValue
                            }
                          />
                          <JsonDetails
                            label="New value"
                            value={
                              record.newValue
                            }
                          />
                          <JsonDetails
                            label="Metadata"
                            value={
                              record.metadata
                            }
                          />
                        </div>
                      </details>
                    )}
                  </div>
                </article>
              )
            )}
          </div>
        )}

      {nextCursor && (
        <button
          type="button"
          onClick={() =>
            void loadMore()
          }
          disabled={loadingMore}
          className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5 disabled:opacity-60"
        >
          {loadingMore ? (
            <Loader2
              size={15}
              className="animate-spin"
            />
          ) : (
            <ChevronDown size={15} />
          )}
          Load older events
        </button>
      )}

      {error && (
        <p className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">
          {error}
        </p>
      )}
    </section>
  );
}
