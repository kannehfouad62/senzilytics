import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  prettyFormSubmissionLabel,
  type FormSubmissionSearchParams,
} from "@/modules/forms/form-submission-report";
import { getFormSubmissionRegister } from "@/modules/forms/form-submission.service";
import {
  ConfigurableFormModule,
  ConfigurableSubmissionStatus,
  PermissionKey,
} from "@prisma/client";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Search,
} from "lucide-react";
import Link from "next/link";

const input =
  "mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm text-white";

export default async function FormSubmissionCenterPage({
  searchParams,
}: {
  searchParams: Promise<FormSubmissionSearchParams>;
}) {
  await requirePermission(PermissionKey.MANAGE_ORGANIZATION);
  const [{ organizationId }, rawSearchParams] = await Promise.all([
    getCurrentUserTenant(),
    searchParams,
  ]);
  const register = await getFormSubmissionRegister({
    organizationId,
    searchParams: rawSearchParams,
  });
  const { filters } = register;
  const exportHref = queryHref("/api/forms/submissions/export", filters);

  return (
    <div>
      <Link
        href="/form-studio"
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-cyan-200"
      >
        <ArrowLeft size={16} />
        Form Studio
      </Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm text-cyan-300">
            <ClipboardList size={17} />
            Governed Tenant Records
          </p>
          <h1 className="mt-2 text-4xl font-bold">Form Submission Center</h1>
          <p className="mt-2 max-w-3xl text-slate-400">
            Search organization-specific form records, inspect captured
            responses and private attachments, and trace each submission back
            to its operational source.
          </p>
        </div>
        <a
          href={exportHref}
          className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-4 py-2 font-semibold text-cyan-200"
        >
          <Download size={16} />
          Export filtered CSV
        </a>
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Filtered results" value={register.total} />
        <Metric
          label="Submitted"
          value={register.statusCounts.SUBMITTED}
          tone="emerald"
        />
        <Metric
          label="Attachments pending"
          value={register.statusCounts.DRAFT}
          tone="amber"
        />
        <Metric
          label="Voided"
          value={register.statusCounts.VOIDED}
          tone="slate"
        />
      </div>

      <form
        method="get"
        className="mt-7 grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 md:grid-cols-2 xl:grid-cols-6"
      >
        <label className="xl:col-span-2">
          <span className="text-xs text-slate-400">Search</span>
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-5 text-slate-500"
            />
            <input
              name="q"
              defaultValue={filters.q}
              maxLength={100}
              placeholder="Form, submitter, email, or source ID"
              className={`${input} pl-9`}
            />
          </div>
        </label>
        <label>
          <span className="text-xs text-slate-400">Module</span>
          <select
            name="module"
            defaultValue={filters.module ?? ""}
            className={input}
          >
            <option value="">All modules</option>
            {Object.values(ConfigurableFormModule).map((module) => (
              <option key={module} value={module}>
                {prettyFormSubmissionLabel(module)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-xs text-slate-400">Status</span>
          <select
            name="status"
            defaultValue={filters.status ?? ""}
            className={input}
          >
            <option value="">All statuses</option>
            {Object.values(ConfigurableSubmissionStatus).map((status) => (
              <option key={status} value={status}>
                {prettyFormSubmissionLabel(status)}
              </option>
            ))}
          </select>
        </label>
        <label className="md:col-span-2">
          <span className="text-xs text-slate-400">Form definition</span>
          <select
            name="definitionId"
            defaultValue={filters.definitionId ?? ""}
            className={input}
          >
            <option value="">All forms</option>
            {register.definitions.map((definition) => (
              <option key={definition.id} value={definition.id}>
                {prettyFormSubmissionLabel(definition.module)} —{" "}
                {definition.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-xs text-slate-400">From</span>
          <input
            type="date"
            name="from"
            defaultValue={filters.fromInput}
            className={input}
          />
        </label>
        <label>
          <span className="text-xs text-slate-400">Through</span>
          <input
            type="date"
            name="to"
            defaultValue={filters.toInput}
            className={input}
          />
        </label>
        <div className="flex items-end gap-2 md:col-span-2 xl:col-span-4">
          <button className="rounded-xl bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-slate-950">
            Apply filters
          </button>
          <Link
            href="/form-studio/submissions"
            className="rounded-xl border border-white/10 px-5 py-2.5 text-sm text-slate-300"
          >
            Clear
          </Link>
        </div>
      </form>

      <div className="mt-7 overflow-hidden rounded-3xl border border-white/10 bg-white/5">
        <div className="hidden grid-cols-[1.4fr_.8fr_.7fr_.9fr_.55fr] gap-4 border-b border-white/10 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 lg:grid">
          <span>Form</span>
          <span>Module</span>
          <span>Status</span>
          <span>Submitted</span>
          <span>Responses</span>
        </div>
        {register.submissions.map((submission) => (
          <Link
            key={submission.id}
            href={`/form-studio/submissions/${submission.id}`}
            className="grid gap-3 border-b border-white/5 px-5 py-5 transition last:border-0 hover:bg-cyan-400/[.04] lg:grid-cols-[1.4fr_.8fr_.7fr_.9fr_.55fr] lg:items-center lg:gap-4"
          >
            <div>
              <p className="font-semibold text-white">
                {submission.definition.name}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                v{submission.version.version} · {submission.submittedBy.name} ·{" "}
                {submission.submittedBy.email}
              </p>
            </div>
            <span className="text-sm text-cyan-200">
              {prettyFormSubmissionLabel(submission.entityType)}
            </span>
            <StatusBadge status={submission.status} />
            <div>
              <p className="text-sm">
                {submission.submittedAt.toLocaleDateString()}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {submission.submittedAt.toLocaleTimeString()}
              </p>
            </div>
            <span className="text-sm text-slate-300">
              {submission._count.answers} answers
              {submission._count.fileAnswers
                ? ` · ${submission._count.fileAnswers} files`
                : ""}
            </span>
          </Link>
        ))}
        {!register.submissions.length && (
          <p className="p-10 text-center text-sm text-slate-500">
            No form submissions match these filters.
          </p>
        )}
      </div>

      {register.pageCount > 1 && (
        <nav
          aria-label="Submission pages"
          className="mt-6 flex items-center justify-between"
        >
          {filters.page > 1 ? (
            <Link
              href={queryHref(
                "/form-studio/submissions",
                filters,
                filters.page - 1,
              )}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm"
            >
              <ChevronLeft size={16} />
              Previous
            </Link>
          ) : (
            <span />
          )}
          <p className="text-sm text-slate-400">
            Page {filters.page} of {register.pageCount}
          </p>
          {filters.page < register.pageCount ? (
            <Link
              href={queryHref(
                "/form-studio/submissions",
                filters,
                filters.page + 1,
              )}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm"
            >
              Next
              <ChevronRight size={16} />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "cyan",
}: {
  label: string;
  value: number;
  tone?: "cyan" | "emerald" | "amber" | "slate";
}) {
  const colors = {
    cyan: "text-cyan-200",
    emerald: "text-emerald-200",
    amber: "text-amber-200",
    slate: "text-slate-300",
  };
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${colors[tone]}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: ConfigurableSubmissionStatus }) {
  const className =
    status === ConfigurableSubmissionStatus.SUBMITTED
      ? "bg-emerald-400/10 text-emerald-300"
      : status === ConfigurableSubmissionStatus.DRAFT
        ? "bg-amber-400/10 text-amber-300"
        : "bg-slate-800 text-slate-400";
  return (
    <span
      className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${className}`}
    >
      {prettyFormSubmissionLabel(status)}
    </span>
  );
}

function queryHref(
  pathname: string,
  filters: {
    q: string;
    module: ConfigurableFormModule | null;
    status: ConfigurableSubmissionStatus | null;
    definitionId: string | null;
    fromInput: string;
    toInput: string;
  },
  page?: number,
) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.module) params.set("module", filters.module);
  if (filters.status) params.set("status", filters.status);
  if (filters.definitionId) params.set("definitionId", filters.definitionId);
  if (filters.fromInput) params.set("from", filters.fromInput);
  if (filters.toInput) params.set("to", filters.toInput);
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
