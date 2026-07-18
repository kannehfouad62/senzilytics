"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  RefreshCw,
  RotateCcw,
  Send,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

type CompletionIssue = {
  questionId: string;
  sectionTitle: string;
  questionText: string;
  reason: string;
  message: string;
};

type CompletionReadiness = {
  auditId: string;
  status: string;
  ready: boolean;
  issueCount: number;
  issues: CompletionIssue[];
  completedAt: string | null;
  access: {
    canEdit: boolean;
    canReview: boolean;
  };
  metrics: {
    totalQuestionCount: number;
    answeredQuestionCount: number;
    failedQuestionCount: number;
    achievedScore: string | null;
    maximumPossibleScore: string | null;
    scorePercentage: string | null;
  };
};

export function EnterpriseAuditCompletionPanel({
  auditId,
  locked,
  onCompleted,
}: {
  auditId: string;
  locked: boolean;
  onCompleted: (
    readiness: CompletionReadiness
  ) => void;
}) {
  const [readiness, setReadiness] =
    useState<CompletionReadiness | null>(
      null
    );
  const [comments, setComments] =
    useState("");
  const [loading, setLoading] =
    useState(true);
  const [working, setWorking] =
    useState(false);
  const [message, setMessage] =
    useState<{
      success: boolean;
      text: string;
    } | null>(null);

  const completionEndpoint = `/api/audit-management/audit/${auditId}/completion`;
  const reviewEndpoint = `/api/audit-management/audit/${auditId}/review`;

  const loadReadiness =
    useCallback(async () => {
      setLoading(true);
      setMessage(null);

      try {
        const response =
          await fetch(
            completionEndpoint,
            {
              cache: "no-store",
            }
          );
        const payload =
          await response.json();

        if (!response.ok) {
          throw new Error(
            payload.message ||
              "Audit readiness could not be checked."
          );
        }

        setReadiness(
          payload.readiness
        );
      } catch (error) {
        setMessage({
          success: false,
          text:
            error instanceof Error
              ? error.message
              : "Audit readiness could not be checked.",
        });
      } finally {
        setLoading(false);
      }
    }, [completionEndpoint]);

  useEffect(() => {
    void loadReadiness();
  }, [loadReadiness]);

  async function submitForReview() {
    setWorking(true);
    setMessage(null);

    try {
      const response =
        await fetch(
          completionEndpoint,
          {
            method: "POST",
          }
        );
      const payload =
        await response.json();

      if (payload.readiness) {
        setReadiness(
          payload.readiness
        );
      }

      if (!response.ok) {
        throw new Error(
          payload.message ||
            "The audit could not be submitted."
        );
      }

      setMessage({
        success: true,
        text: payload.message,
      });

      onCompleted(
        payload.readiness
      );
    } catch (error) {
      setMessage({
        success: false,
        text:
          error instanceof Error
            ? error.message
            : "The audit could not be submitted.",
      });
    } finally {
      setWorking(false);
    }
  }

  async function reviewAudit(
    decision: "APPROVE" | "RETURN"
  ) {
    setWorking(true);
    setMessage(null);

    try {
      const response =
        await fetch(reviewEndpoint, {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            decision,
            comments,
          }),
        });

      const payload =
        await response.json();

      if (!response.ok) {
        throw new Error(
          payload.message ||
            "The review decision could not be recorded."
        );
      }

      const nextReadiness = {
        ...readiness!,
        status: payload.status,
        completedAt:
          payload.completedAt,
      };

      setReadiness(
        nextReadiness
      );
      setComments("");
      setMessage({
        success: true,
        text: payload.message,
      });
      onCompleted(
        nextReadiness
      );
    } catch (error) {
      setMessage({
        success: false,
        text:
          error instanceof Error
            ? error.message
            : "The review decision could not be recorded.",
      });
    } finally {
      setWorking(false);
    }
  }

  const pendingReview =
    readiness?.status ===
    "PENDING_REVIEW";
  const completed =
    readiness?.status ===
    "COMPLETED";

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-cyan-300">
            Audit governance
          </p>
          <h2 className="mt-1 text-xl font-semibold text-white">
            Completion and review
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Audits are validated,
            submitted for review, and
            locked only after approval.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            void loadReadiness()
          }
          disabled={loading || working}
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
          Recheck
        </button>
      </div>

      {loading && (
        <p className="mt-5 flex items-center gap-2 text-sm text-slate-400">
          <Loader2
            size={16}
            className="animate-spin"
          />
          Checking audit status
        </p>
      )}

      {!loading && readiness && (
        <div className="mt-5">
          <div
            className={`rounded-2xl border p-4 ${
              completed
                ? "border-emerald-400/20 bg-emerald-400/10"
                : pendingReview
                  ? "border-cyan-400/20 bg-cyan-400/10"
                  : readiness.ready
                    ? "border-emerald-400/20 bg-emerald-400/10"
                    : "border-amber-400/20 bg-amber-400/10"
            }`}
          >
            <p className="flex items-center gap-2 font-medium text-white">
              {completed ? (
                <CheckCircle2
                  size={18}
                />
              ) : pendingReview ? (
                <ClipboardCheck
                  size={18}
                />
              ) : readiness.ready ? (
                <CheckCircle2
                  size={18}
                />
              ) : (
                <AlertTriangle
                  size={18}
                />
              )}

              {completed
                ? "Approved and completed"
                : pendingReview
                  ? "Pending review"
                  : readiness.ready
                    ? "Ready for review"
                    : `${readiness.issueCount} requirement${
                        readiness.issueCount === 1
                          ? ""
                          : "s"
                      } remaining`}
            </p>

            <p className="mt-2 text-sm text-slate-300">
              {
                readiness.metrics
                  .answeredQuestionCount
              }{" "}
              of{" "}
              {
                readiness.metrics
                  .totalQuestionCount
              }{" "}
              questions answered
              {" · "}
              {
                readiness.metrics
                  .failedQuestionCount
              }{" "}
              failed
              {" · "}
              {readiness.metrics
                .scorePercentage
                ? `${Number(
                    readiness.metrics
                      .scorePercentage
                  ).toFixed(1)}% score`
                : "No score"}
            </p>
          </div>

          {!pendingReview &&
            !completed &&
            readiness.issues.length >
              0 && (
              <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
                {readiness.issues.map(
                  (issue, index) => (
                    <a
                      key={`${issue.questionId}-${issue.reason}-${index}`}
                      href={`#question-${issue.questionId}`}
                      className="block rounded-xl border border-white/10 bg-slate-950/60 p-3 transition hover:border-cyan-400/30"
                    >
                      <p className="text-xs font-medium uppercase tracking-wide text-cyan-300">
                        {
                          issue.sectionTitle
                        }
                      </p>
                      <p className="mt-1 text-sm text-white">
                        {
                          issue.questionText
                        }
                      </p>
                      <p className="mt-1 text-xs text-amber-200">
                        {issue.message}
                      </p>
                    </a>
                  )
                )}
              </div>
            )}

          {!locked &&
            !pendingReview &&
            readiness.ready &&
            readiness.access.canEdit && (
              <button
                type="button"
                onClick={() =>
                  void submitForReview()
                }
                disabled={working}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
              >
                {working ? (
                  <Loader2
                    size={16}
                    className="animate-spin"
                  />
                ) : (
                  <Send size={16} />
                )}
                Submit for review
              </button>
            )}

          {pendingReview &&
            readiness.access.canReview && (
              <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <label className="text-sm font-medium text-white">
                  Review comments
                </label>

                <textarea
                  rows={3}
                  value={comments}
                  onChange={(event) =>
                    setComments(
                      event.target.value
                    )
                  }
                  placeholder="Record approval notes or explain required corrections."
                  disabled={working}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400/50"
                />

                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      void reviewAudit(
                        "APPROVE"
                      )
                    }
                    disabled={working}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:opacity-60"
                  >
                    <CheckCircle2
                      size={16}
                    />
                    Approve and complete
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void reviewAudit(
                        "RETURN"
                      )
                    }
                    disabled={
                      working ||
                      !comments.trim()
                    }
                    className="inline-flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2.5 text-sm font-semibold text-amber-200 transition hover:bg-amber-400/15 disabled:opacity-60"
                  >
                    <RotateCcw
                      size={16}
                    />
                    Return for correction
                  </button>
                </div>
              </div>
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
