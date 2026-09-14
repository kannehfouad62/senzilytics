import {
  addExternalAuditComment,
  submitExternalAuditDecision,
  verifyExternalAuditPasscode,
} from "@/features/audits/audit-external-access.actions";
import {
  auditExternalSessionCookie,
  resolveAuditExternalAccess,
} from "@/modules/audit/audit-external-access.service";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AuditExternalDecisionType } from "@prisma/client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Secure Audit Review | Senzilytics",
  robots: { index: false, follow: false },
};

const pretty = (value: string) =>
  value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export default async function ExternalAuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const [{ token }, query, jar] = await Promise.all([
    params,
    searchParams,
    cookies(),
  ]);
  const sessionToken = jar.get(auditExternalSessionCookie)?.value;
  const access = await resolveAuditExternalAccess(token, sessionToken);

  return (
    <main className="min-h-screen bg-[#07111f] px-5 py-10 text-slate-100">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-300 font-black text-slate-950">
            S
          </span>
          <div>
            <p className="font-semibold">Senzilytics</p>
            <p className="text-xs text-slate-400">Controlled audit access</p>
          </div>
        </header>
        {!access ? (
          <section className="rounded-3xl border border-white/10 bg-white/[.05] p-7 shadow-2xl shadow-cyan-950/20 sm:p-10">
            <p className="text-sm font-medium text-cyan-300">
              Authority verification
            </p>
            <h1 className="mt-2 text-3xl font-bold">Enter your passcode</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Use the six-digit passcode sent to your authorized email address.
              Access is time-limited, monitored, and must not be forwarded.
            </p>
            {query.error && (
              <p className="mt-5 rounded-xl border border-red-400/20 bg-red-400/[.07] p-3 text-sm text-red-200">
                The passcode is incorrect, expired, or temporarily locked.
              </p>
            )}
            <form action={verifyExternalAuditPasscode} className="mt-6">
              <input type="hidden" name="token" value={token} />
              <label className="text-sm text-slate-300">
                Verification passcode
                <input
                  name="passcode"
                  required
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  autoComplete="one-time-code"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-lg tracking-[.35em] outline-none focus:border-cyan-300/60"
                />
              </label>
              <button className="mt-4 w-full rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950">
                Verify and continue
              </button>
            </form>
          </section>
        ) : (
          <section className="rounded-3xl border border-cyan-300/15 bg-white/[.05] p-7 sm:p-10">
            <p className="text-sm text-emerald-300">Authority verified</p>
            <h1 className="mt-2 text-3xl font-bold">{access.title}</h1>
            <p className="mt-3 text-sm text-slate-400">
              {access.organization.name} · {access.engagement.reference} ·{" "}
              {pretty(access.scope)}
            </p>
            <div className="mt-7 rounded-2xl border border-white/10 bg-slate-950/50 p-5">
              <h2 className="text-xl font-semibold">
                {access.engagement.title}
              </h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                {access.engagement.purpose}
              </p>
              {access.instructions && (
                <p className="mt-4 whitespace-pre-wrap rounded-xl bg-cyan-300/[.05] p-4 text-sm text-cyan-100">
                  {access.instructions}
                </p>
              )}
            </div>
            {access.informationRequest && (
              <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/50 p-5">
                <p className="text-xs text-cyan-300">
                  {access.informationRequest.reference}
                </p>
                <h2 className="mt-2 text-xl font-semibold">
                  {access.informationRequest.title}
                </h2>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                  {access.informationRequest.description}
                </p>
              </div>
            )}
            {access.resourceSnapshot && (
              <ExternalSnapshot value={access.resourceSnapshot} />
            )}
            {query.saved && (
              <p className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/[.07] p-3 text-sm text-emerald-200">
                Your {query.saved} was recorded successfully.
              </p>
            )}
            {query.error === "action" && (
              <p className="mt-5 rounded-xl border border-red-400/20 bg-red-400/[.07] p-3 text-sm text-red-200">
                The action could not be recorded. Confirm the session is still
                active and provide all required information.
              </p>
            )}
            <section className="mt-6 rounded-2xl border border-white/10 bg-slate-950/50 p-5">
              <h2 className="text-xl font-semibold">Comments and feedback</h2>
              <div className="mt-4 space-y-3">
                {access.comments.map((comment) => (
                  <div key={comment.id} className="rounded-xl bg-white/[.04] p-3">
                    <p className="text-xs text-slate-500">
                      {comment.representativeName} · {comment.createdAt.toLocaleString()}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-200">
                      {comment.body}
                    </p>
                  </div>
                ))}
              </div>
              <form action={addExternalAuditComment} className="mt-4">
                <input type="hidden" name="token" value={token} />
                <textarea
                  name="body"
                  required
                  rows={3}
                  placeholder="Write a comment or feedback"
                  className="w-full rounded-xl border border-white/10 bg-slate-950 p-3 text-sm"
                />
                <button className="mt-2 rounded-xl border border-cyan-300/25 px-4 py-2 text-sm text-cyan-200">
                  Add comment
                </button>
              </form>
            </section>
            <section className="mt-6 rounded-2xl border border-violet-300/15 bg-violet-300/[.035] p-5">
              <h2 className="text-xl font-semibold">Formal response</h2>
              {access.decision ? (
                <div className="mt-4 rounded-xl bg-white/[.04] p-4">
                  <p className="font-semibold text-violet-200">
                    {pretty(access.decision.decision)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {access.decision.representativeName} ·{" "}
                    {access.decision.decidedAt.toLocaleString()}
                  </p>
                  {access.decision.comment && (
                    <p className="mt-3 whitespace-pre-wrap text-sm text-slate-300">
                      {access.decision.comment}
                    </p>
                  )}
                </div>
              ) : (
                <form action={submitExternalAuditDecision} className="mt-4">
                  <input type="hidden" name="token" value={token} />
                  <textarea
                    name="comment"
                    rows={3}
                    placeholder="Decision comment (required when denying)"
                    className="w-full rounded-xl border border-white/10 bg-slate-950 p-3 text-sm"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.values(AuditExternalDecisionType).map((decision) => (
                      <button
                        key={decision}
                        name="decision"
                        value={decision}
                        className="rounded-xl border border-violet-300/25 px-4 py-2 text-sm text-violet-100"
                      >
                        {pretty(decision)}
                      </button>
                    ))}
                  </div>
                </form>
              )}
            </section>
            <p className="mt-6 text-xs leading-5 text-slate-500">
              This controlled session expires automatically. Decision and
              feedback controls will appear only for explicitly shared items.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}

function ExternalSnapshot({ value }: { value: unknown }) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const snapshot = value as Record<string, unknown>;
  const results = Array.isArray(snapshot.results) ? snapshot.results : [];
  return (
    <section className="mt-5 rounded-2xl border border-white/10 bg-slate-950/50 p-5">
      <p className="text-xs text-violet-300">Frozen controlled snapshot</p>
      <h2 className="mt-2 text-xl font-semibold">
        {String(snapshot.auditTitle ?? snapshot.questionText ?? "Audit record")}
      </h2>
      {Boolean(snapshot.questionText) && (
        <div className="mt-4 space-y-2 text-sm">
          <p>{String(snapshot.questionText)}</p>
          <p className="text-slate-400">
            Result: {String((snapshot.response as Record<string, unknown> | null)?.result ?? "Not assessed")}
          </p>
          {(snapshot.response as Record<string, unknown> | null)?.comments ? (
            <p className="whitespace-pre-wrap text-slate-300">
              {String((snapshot.response as Record<string, unknown>).comments)}
            </p>
          ) : null}
        </div>
      )}
      {Boolean(snapshot.executiveSummary) && (
        <p className="mt-4 whitespace-pre-wrap text-sm text-slate-300">
          {String(snapshot.executiveSummary)}
        </p>
      )}
      {results.map((section, index) => {
        const item = section as Record<string, unknown>;
        const questions = Array.isArray(item.questions) ? item.questions : [];
        return (
          <div key={index} className="mt-5">
            <h3 className="font-semibold">{String(item.title ?? "Section")}</h3>
            <div className="mt-2 divide-y divide-white/10">
              {questions.map((question, questionIndex) => {
                const row = question as Record<string, unknown>;
                return (
                  <div key={questionIndex} className="py-2 text-sm">
                    <p>{String(row.text ?? "Question")}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {String(row.result ?? "NOT_ASSESSED")}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <p className="mt-4 text-xs text-slate-500">
        Frozen {String(snapshot.frozenAt ?? "at issuance")}
      </p>
    </section>
  );
}
