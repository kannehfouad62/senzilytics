"use client";

import { ResearchReportStatus } from "@prisma/client";
import { useActionState } from "react";

import { initialFormActionState } from "@/core/actions/action-state";
import {
  changeResearchReportStatus,
  createResearchReport,
  updateResearchReportDraft,
} from "@/features/research/report-actions";
import { useRefreshOnSuccess } from "@/features/research/use-refresh-on-success";

const input =
  "w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm";

export function ResearchReportForm({
  projectId,
  analyses,
}: {
  projectId: string;
  analyses: Array<{
    id: string;
    title: string;
    method: string;
    collectionName: string;
  }>;
}) {
  const [state, action, pending] = useActionState(
    createResearchReport,
    initialFormActionState,
  );
  useRefreshOnSuccess(state);
  return (
    <form action={action} className="rounded-3xl border border-white/10 bg-white/[.04] p-6">
      <input type="hidden" name="projectId" value={projectId} />
      <h2 className="text-xl font-semibold">Build governed research report</h2>
      <p className="mt-1 text-sm text-slate-400">
        Compose the interpretation and freeze approved analytical evidence into a
        reviewable report version.
      </p>
      <label className="mt-5 block text-xs text-slate-400">
        Report title
        <input name="title" required maxLength={180} className={`${input} mt-1`} />
      </label>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Section name="executiveSummary" label="Executive summary" required />
        <Section name="background" label="Background and context" />
        <Section name="methodology" label="Methodology" required />
        <Section name="findings" label="Key findings" required />
        <Section name="discussion" label="Discussion and interpretation" />
        <Section name="conclusions" label="Conclusions" required />
        <Section name="recommendations" label="Recommendations" required />
        <Section name="limitations" label="Limitations" required />
      </div>
      <fieldset className="mt-5">
        <legend className="text-sm font-medium">Approved analytical evidence</legend>
        <p className="mt-1 text-xs text-slate-500">
          Only independently approved analyses are eligible.
        </p>
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          {analyses.map((analysis) => (
            <label
              key={analysis.id}
              className="flex gap-3 rounded-xl border border-white/10 bg-slate-950/40 p-3 text-sm"
            >
              <input type="checkbox" name="analysisIds" value={analysis.id} />
              <span>
                <strong>{analysis.title}</strong>
                <span className="mt-1 block text-xs text-slate-500">
                  {analysis.method.replaceAll("_", " ")} · {analysis.collectionName}
                </span>
              </span>
            </label>
          ))}
        </div>
        {!analyses.length && (
          <p className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-200">
            Approve at least one project analysis before creating a formal report.
          </p>
        )}
      </fieldset>
      <div className="mt-5 flex items-center gap-3">
        <button
          disabled={pending || !analyses.length}
          className="rounded-xl bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create governed draft"}
        </button>
        {state.message && (
          <span className={state.status === "ERROR" ? "text-sm text-red-300" : "text-sm text-emerald-300"}>
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}

export function ResearchReportDraftEditor({
  report,
}: {
  report: {
    id: string;
    title: string;
    executiveSummary: string;
    background: string | null;
    methodology: string;
    findings: string;
    discussion: string | null;
    conclusions: string;
    recommendations: string;
    limitations: string;
  };
}) {
  const [state, action, pending] = useActionState(
    updateResearchReportDraft,
    initialFormActionState,
  );
  useRefreshOnSuccess(state);
  const fields = [
    ["executiveSummary", "Executive summary", report.executiveSummary, true],
    ["background", "Background and context", report.background ?? "", false],
    ["methodology", "Methodology", report.methodology, true],
    ["findings", "Key findings", report.findings, true],
    ["discussion", "Discussion and interpretation", report.discussion ?? "", false],
    ["conclusions", "Conclusions", report.conclusions, true],
    ["recommendations", "Recommendations", report.recommendations, true],
    ["limitations", "Limitations", report.limitations, true],
  ] as const;
  return (
    <form action={action} className="mt-8 rounded-3xl border border-violet-400/20 bg-violet-400/[.04] p-6">
      <input type="hidden" name="reportId" value={report.id} />
      <h2 className="text-xl font-semibold">Edit report draft</h2>
      <p className="mt-1 text-sm text-slate-400">
        Narrative remains editable in Draft. The approved analytical evidence snapshot
        remains frozen.
      </p>
      <label className="mt-5 block text-xs text-slate-400">
        Report title
        <input name="title" required maxLength={180} defaultValue={report.title} className={`${input} mt-1`} />
      </label>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {fields.map(([name, label, defaultValue, required]) => (
          <label key={name} className="text-xs text-slate-400">
            {label}
            <textarea
              name={name}
              required={required}
              minLength={required ? 20 : undefined}
              maxLength={12000}
              rows={5}
              defaultValue={defaultValue}
              className={`${input} mt-1 resize-y`}
            />
          </label>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-3">
        <button disabled={pending} className="rounded-xl bg-violet-300 px-5 py-2.5 text-sm font-semibold text-slate-950">
          {pending ? "Saving…" : "Save draft changes"}
        </button>
        {state.message && (
          <span className={state.status === "ERROR" ? "text-sm text-red-300" : "text-sm text-emerald-300"}>
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}

function Section({
  name,
  label,
  required = false,
}: {
  name: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label className="text-xs text-slate-400">
      {label}
      <textarea
        name={name}
        required={required}
        minLength={required ? 20 : undefined}
        maxLength={12000}
        rows={5}
        className={`${input} mt-1 resize-y`}
      />
    </label>
  );
}

export function ResearchReportGovernance({
  reportId,
  statuses,
}: {
  reportId: string;
  statuses: ResearchReportStatus[];
}) {
  const [state, action, pending] = useActionState(
    changeResearchReportStatus,
    initialFormActionState,
  );
  useRefreshOnSuccess(state);
  if (!statuses.length) return null;
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="reportId" value={reportId} />
      {statuses.map((status) => (
        <button
          key={status}
          name="status"
          value={status}
          disabled={pending}
          className="rounded-xl border border-cyan-400/25 px-4 py-2 text-sm text-cyan-200"
        >
          {status.replaceAll("_", " ")}
        </button>
      ))}
      {state.message && (
        <span className={state.status === "ERROR" ? "text-sm text-red-300" : "text-sm text-emerald-300"}>
          {state.message}
        </span>
      )}
    </form>
  );
}
