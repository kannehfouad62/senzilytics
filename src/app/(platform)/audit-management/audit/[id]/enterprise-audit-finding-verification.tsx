"use client";

import {
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

type Verification = {
  id: string;
  status: string;
  verificationMethod: string | null;
  verificationEvidence: string | null;
  comments: string | null;
  verifiedAt: string | null;
  createdAt: string;
  verifiedBy: {
    id: string;
    name: string | null;
    email: string;
    jobTitle: string | null;
  } | null;
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

export function EnterpriseAuditFindingVerification({
  auditId,
  findingId,
  locked,
  onChanged,
}: {
  auditId: string;
  findingId: string;
  locked: boolean;
  onChanged: () => void;
}) {
  const endpoint = `/api/audit-management/audit/${auditId}/findings/${findingId}/verifications`;

  const [verifications, setVerifications] =
    useState<Verification[]>([]);
  const [findingStatus, setFindingStatus] =
    useState("");
  const [loading, setLoading] =
    useState(true);
  const [working, setWorking] =
    useState<string | null>(null);
  const [message, setMessage] =
    useState<{
      success: boolean;
      text: string;
    } | null>(null);
  const [draft, setDraft] =
    useState({
      verificationMethod: "",
      verificationEvidence: "",
      comments: "",
    });
  const [closureSummary, setClosureSummary] =
    useState("");

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
              "Verification records could not be loaded."
          );
        }

        setVerifications(
          payload.verifications
        );
        setFindingStatus(
          payload.findingStatus
        );
        setClosureSummary(
          payload.closureSummary ||
            ""
        );
      } catch (error) {
        setMessage({
          success: false,
          text:
            error instanceof Error
              ? error.message
              : "Verification records could not be loaded.",
        });
      } finally {
        setLoading(false);
      }
    }, [endpoint]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitVerification() {
    setWorking("submit");
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
            "The verification could not be submitted."
        );
      }

      setDraft({
        verificationMethod: "",
        verificationEvidence: "",
        comments: "",
      });
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
            : "The verification could not be submitted.",
      });
    } finally {
      setWorking(null);
    }
  }

  async function review(
    verificationId: string,
    decision:
      | "VERIFY"
      | "FAIL"
      | "REOPEN"
  ) {
    setWorking(
      verificationId
    );
    setMessage(null);

    try {
      const response =
        await fetch(
          `${endpoint}/${verificationId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              decision,
              closureSummary:
                decision === "VERIFY"
                  ? closureSummary
                  : undefined,
            }),
          }
        );

      const payload =
        await response.json();

      if (!response.ok) {
        throw new Error(
          payload.message ||
            "The verification could not be reviewed."
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
            : "The verification could not be reviewed.",
      });
    } finally {
      setWorking(null);
    }
  }

  async function closeFinding() {
    setWorking("close");
    setMessage(null);

    try {
      const response =
        await fetch(
          `/api/audit-management/audit/${auditId}/findings/${findingId}/close`,
          {
            method: "POST",
          }
        );

      const payload =
        await response.json();

      if (!response.ok) {
        throw new Error(
          payload.message ||
            "The finding could not be closed."
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
            : "The finding could not be closed.",
      });
    } finally {
      setWorking(null);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-emerald-400/10 bg-emerald-400/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-white">
            <ShieldCheck size={15} />
            Effectiveness verification
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Current finding status:{" "}
            {findingStatus
              ? label(findingStatus)
              : "Loading"}
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            void load()
          }
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-slate-300"
        >
          <RefreshCw
            size={13}
            className={
              loading
                ? "animate-spin"
                : ""
            }
          />
          Refresh
        </button>
      </div>

      {!locked &&
        ["IN_PROGRESS", "PENDING_VERIFICATION"].includes(
          findingStatus
        ) && (
          <div className="mt-4 grid gap-3">
            <input
              value={
                draft.verificationMethod
              }
              onChange={(event) =>
                setDraft(
                  (current) => ({
                    ...current,
                    verificationMethod:
                      event.target
                        .value,
                  })
                )
              }
              placeholder="Verification method"
              className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
            />

            <textarea
              rows={3}
              value={
                draft.verificationEvidence
              }
              onChange={(event) =>
                setDraft(
                  (current) => ({
                    ...current,
                    verificationEvidence:
                      event.target
                        .value,
                  })
                )
              }
              placeholder="Verification evidence"
              className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
            />

            <textarea
              rows={2}
              value={
                draft.comments
              }
              onChange={(event) =>
                setDraft(
                  (current) => ({
                    ...current,
                    comments:
                      event.target
                        .value,
                  })
                )
              }
              placeholder="Reviewer comments"
              className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
            />

            <button
              type="button"
              onClick={() =>
                void submitVerification()
              }
              disabled={
                working !== null ||
                !draft.verificationMethod.trim() ||
                !draft.verificationEvidence.trim()
              }
              className="inline-flex w-fit items-center gap-2 rounded-xl bg-emerald-400 px-3 py-2 text-xs font-medium text-slate-950 disabled:opacity-50"
            >
              {working ===
              "submit" ? (
                <Loader2
                  size={14}
                  className="animate-spin"
                />
              ) : (
                <ClipboardCheck
                  size={14}
                />
              )}
              Submit verification
            </button>
          </div>
        )}

      {verifications.map(
        (verification) => (
          <article
            key={verification.id}
            className="mt-3 rounded-xl border border-white/10 bg-slate-950/50 p-3"
          >
            <p className="text-sm text-white">
              {verification.verificationMethod}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {label(
                verification.status
              )}
              {" · "}
              {new Date(
                verification.createdAt
              ).toLocaleString()}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-300">
              {verification.verificationEvidence}
            </p>

            {verification.status ===
              "PENDING" &&
              !locked && (
                <div className="mt-3 grid gap-2">
                  <textarea
                    rows={2}
                    value={closureSummary}
                    onChange={(event) =>
                      setClosureSummary(
                        event.target
                          .value
                      )
                    }
                    placeholder="Closure summary required to verify"
                    className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white"
                  />

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void review(
                          verification.id,
                          "VERIFY"
                        )
                      }
                      disabled={
                        working !==
                          null ||
                        !closureSummary.trim()
                      }
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-400 px-2.5 py-1.5 text-xs font-medium text-slate-950 disabled:opacity-50"
                    >
                      <CheckCircle2
                        size={13}
                      />
                      Verify
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void review(
                          verification.id,
                          "FAIL"
                        )
                      }
                      disabled={
                        working !==
                        null
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-red-400/20 px-2.5 py-1.5 text-xs text-red-200"
                    >
                      <XCircle
                        size={13}
                      />
                      Fail
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void review(
                          verification.id,
                          "REOPEN"
                        )
                      }
                      disabled={
                        working !==
                        null
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-amber-400/20 px-2.5 py-1.5 text-xs text-amber-200"
                    >
                      <RotateCcw
                        size={13}
                      />
                      Reopen
                    </button>
                  </div>
                </div>
              )}
          </article>
        )
      )}

      {findingStatus ===
        "VERIFIED" &&
        !locked && (
          <button
            type="button"
            onClick={() =>
              void closeFinding()
            }
            disabled={
              working !== null
            }
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-3 py-2 text-xs font-medium text-slate-950 disabled:opacity-50"
          >
            {working ===
            "close" ? (
              <Loader2
                size={14}
                className="animate-spin"
              />
            ) : (
              <CheckCircle2
                size={14}
              />
            )}
            Close finding
          </button>
        )}

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
