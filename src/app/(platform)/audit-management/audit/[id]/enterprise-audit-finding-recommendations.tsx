"use client";

import {
  CheckCircle2,
  ClipboardPlus,
  Loader2,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

type Recommendation = {
  id: string;
  status: string;
  recommendationTitle?: string | null;
  recommendationDescription?: string | null;
  correctiveActionId?: string | null;
  proposedRiskTitle?: string | null;
  proposedRiskDescription?: string | null;
  suggestedOwner?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  suggestedDueDate?: string | null;
  proposedLikelihood?: string | null;
  proposedImpact?: string | null;
  rationale: string | null;
  createdAt: string;
};

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

export function EnterpriseAuditFindingRecommendations({
  auditId,
  findingId,
  locked,
  ownerId,
  dueDate,
  onChanged,
}: {
  auditId: string;
  findingId: string;
  locked: boolean;
  ownerId: string | null;
  dueDate: string | null;
  onChanged: () => void;
}) {
  const endpoint = `/api/audit-management/audit/${auditId}/findings/${findingId}/recommendations`;

  const [capa, setCapa] =
    useState<Recommendation[]>([]);
  const [risks, setRisks] =
    useState<Recommendation[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [working, setWorking] =
    useState<string | null>(null);
  const [message, setMessage] =
    useState<{
      success: boolean;
      text: string;
    } | null>(null);

  const load =
    useCallback(async () => {
      setLoading(true);

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
              "Recommendations could not be loaded."
          );
        }

        setCapa(
          payload.correctiveActionRecommendations
        );
        setRisks(
          payload.riskRecommendations
        );
      } catch (error) {
        setMessage({
          success: false,
          text:
            error instanceof Error
              ? error.message
              : "Recommendations could not be loaded.",
        });
      } finally {
        setLoading(false);
      }
    }, [endpoint]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(
    type:
      | "CORRECTIVE_ACTION"
      | "RISK_REVIEW"
  ) {
    setWorking(type);
    setMessage(null);

    try {
      const response =
        await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            type,
            ownerId:
              type ===
              "CORRECTIVE_ACTION"
                ? ownerId
                : undefined,
            dueDate:
              type ===
              "CORRECTIVE_ACTION"
                ? dueDate
                : undefined,
          }),
        });

      const payload =
        await response.json();

      if (!response.ok) {
        throw new Error(
          payload.message ||
            "The recommendation could not be created."
        );
      }

      setMessage({
        success: true,
        text: payload.message,
      });
      await load();
      onChanged();
    } catch (error) {
      setMessage({
        success: false,
        text:
          error instanceof Error
            ? error.message
            : "The recommendation could not be created.",
      });
    } finally {
      setWorking(null);
    }
  }

  async function review(
    kind: "capa" | "risk",
    recommendationId: string,
    decision: "APPROVE" | "REJECT"
  ) {
    setWorking(
      recommendationId
    );
    setMessage(null);

    try {
      const response =
        await fetch(
          `${endpoint}/${kind}/${recommendationId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              decision,
            }),
          }
        );

      const payload =
        await response.json();

      if (!response.ok) {
        throw new Error(
          payload.message ||
            "The recommendation could not be reviewed."
        );
      }

      setMessage({
        success: true,
        text: payload.message,
      });
      await load();
      onChanged();
    } catch (error) {
      setMessage({
        success: false,
        text:
          error instanceof Error
            ? error.message
            : "The recommendation could not be reviewed.",
      });
    } finally {
      setWorking(null);
    }
  }


  async function materializeCapa(
    recommendationId: string
  ) {
    setWorking(
      recommendationId
    );
    setMessage(null);

    try {
      const response =
        await fetch(
          `${endpoint}/capa/${recommendationId}/materialize`,
          {
            method: "POST",
          }
        );

      const payload =
        await response.json();

      if (!response.ok) {
        throw new Error(
          payload.message ||
            "The corrective action could not be created."
        );
      }

      setMessage({
        success: true,
        text: payload.message,
      });

      await load();
      onChanged();
    } catch (error) {
      setMessage({
        success: false,
        text:
          error instanceof Error
            ? error.message
            : "The corrective action could not be created.",
      });
    } finally {
      setWorking(null);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-white">
            <ShieldAlert size={15} />
            CAPA and risk recommendations
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Reviewable proposals linked to
            this finding.
          </p>
        </div>

        {!locked && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                void create(
                  "CORRECTIVE_ACTION"
                )
              }
              disabled={
                working !== null ||
                !ownerId
              }
              className="inline-flex items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-400/10 px-3 py-2 text-xs text-violet-200 disabled:opacity-50"
            >
              <ClipboardPlus
                size={14}
              />
              Propose CAPA
            </button>

            <button
              type="button"
              onClick={() =>
                void create(
                  "RISK_REVIEW"
                )
              }
              disabled={
                working !== null
              }
              className="inline-flex items-center gap-2 rounded-xl border border-orange-400/20 bg-orange-400/10 px-3 py-2 text-xs text-orange-200 disabled:opacity-50"
            >
              <ShieldAlert
                size={14}
              />
              Propose risk review
            </button>
          </div>
        )}
      </div>

      {loading && (
        <p className="mt-4 flex items-center gap-2 text-xs text-slate-400">
          <Loader2
            size={14}
            className="animate-spin"
          />
          Loading recommendations
        </p>
      )}

      {!loading &&
        [...capa, ...risks].length ===
          0 && (
          <p className="mt-4 text-xs text-slate-500">
            No recommendations have been
            recorded.
          </p>
        )}

      {!loading &&
        capa.map((item) => (
          <article
            key={item.id}
            className="mt-3 rounded-xl border border-violet-400/10 bg-violet-400/5 p-3"
          >
            <p className="text-sm text-white">
              {item.recommendationTitle}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              CAPA · {label(item.status)}
              {item.suggestedOwner
                ? ` · ${item.suggestedOwner.name || item.suggestedOwner.email}`
                : ""}
            </p>

            {item.correctiveActionId && (
              <a
                href={`/actions/${item.correctiveActionId}`}
                className="mt-3 inline-flex items-center gap-1 rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1.5 text-xs text-cyan-200"
              >
                Open corrective action
              </a>
            )}

            {item.status ===
              "APPROVED" &&
              !item.correctiveActionId &&
              !locked && (
                <button
                  type="button"
                  onClick={() =>
                    void materializeCapa(
                      item.id
                    )
                  }
                  disabled={
                    working ===
                    item.id
                  }
                  className="mt-3 inline-flex items-center gap-1 rounded-lg bg-violet-300 px-2.5 py-1.5 text-xs font-medium text-slate-950 disabled:opacity-50"
                >
                  {working ===
                  item.id ? (
                    <Loader2
                      size={13}
                      className="animate-spin"
                    />
                  ) : (
                    <ClipboardPlus
                      size={13}
                    />
                  )}
                  Create corrective action
                </button>
              )}

            {item.status ===
              "PROPOSED" &&
              !locked && (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void review(
                        "capa",
                        item.id,
                        "APPROVE"
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-400 px-2.5 py-1.5 text-xs font-medium text-slate-950"
                  >
                    <CheckCircle2
                      size={13}
                    />
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void review(
                        "capa",
                        item.id,
                        "REJECT"
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-red-400/20 px-2.5 py-1.5 text-xs text-red-200"
                  >
                    <XCircle size={13} />
                    Reject
                  </button>
                </div>
              )}
          </article>
        ))}

      {!loading &&
        risks.map((item) => (
          <article
            key={item.id}
            className="mt-3 rounded-xl border border-orange-400/10 bg-orange-400/5 p-3"
          >
            <p className="text-sm text-white">
              {item.proposedRiskTitle}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Risk review ·{" "}
              {label(item.status)}
              {item.proposedLikelihood
                ? ` · ${label(item.proposedLikelihood)}`
                : ""}
              {item.proposedImpact
                ? ` / ${label(item.proposedImpact)}`
                : ""}
            </p>

            {item.status ===
              "PROPOSED" &&
              !locked && (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void review(
                        "risk",
                        item.id,
                        "APPROVE"
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-400 px-2.5 py-1.5 text-xs font-medium text-slate-950"
                  >
                    <CheckCircle2
                      size={13}
                    />
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void review(
                        "risk",
                        item.id,
                        "REJECT"
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-red-400/20 px-2.5 py-1.5 text-xs text-red-200"
                  >
                    <XCircle size={13} />
                    Reject
                  </button>
                </div>
              )}
          </article>
        ))}

      {message && (
        <p
          className={`mt-3 rounded-xl border p-3 text-xs ${
            message.success
              ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
              : "border-red-400/20 bg-red-400/10 text-red-200"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
