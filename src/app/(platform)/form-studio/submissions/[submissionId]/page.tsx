import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  displayFormSubmissionValue,
  prettyFormSubmissionLabel,
} from "@/modules/forms/form-submission-report";
import { getFormSubmissionDetail } from "@/modules/forms/form-submission.service";
import { isRuntimeFieldVisible } from "@/modules/forms/runtime-form.service";
import {
  ConfigurableFieldType,
  ConfigurableSubmissionStatus,
  PermissionKey,
} from "@prisma/client";
import { ArrowLeft, ExternalLink, FileText, Paperclip } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function FormSubmissionDetailPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  await requirePermission(PermissionKey.MANAGE_ORGANIZATION);
  const [{ submissionId }, { organizationId }] = await Promise.all([
    params,
    getCurrentUserTenant(),
  ]);
  const submission = await getFormSubmissionDetail({
    organizationId,
    submissionId,
  });
  if (!submission) notFound();

  const values = new Map(
    submission.answers.map((answer) => [answer.field.key, answer.value]),
  );
  const answerByField = new Map(
    submission.answers.map((answer) => [answer.fieldId, answer]),
  );
  const fileByField = new Map(
    submission.fileAnswers.map((answer) => [answer.fieldId, answer]),
  );
  const visibleFields = submission.version.fields.filter((field) =>
    isRuntimeFieldVisible(field.visibilityRule, values),
  );

  return (
    <div>
      <Link
        href="/form-studio/submissions"
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-cyan-200"
      >
        <ArrowLeft size={16} />
        Submission Center
      </Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm text-cyan-300">
            <FileText size={17} />
            {prettyFormSubmissionLabel(submission.entityType)} · Version{" "}
            {submission.version.version}
          </p>
          <h1 className="mt-2 text-4xl font-bold">
            {submission.definition.name}
          </h1>
          <p className="mt-2 text-slate-400">
            Submitted by {submission.submittedBy?.name ?? "Public respondent"}{" "}
            on {submission.submittedAt.toLocaleString()}
          </p>
        </div>
        <StatusBadge status={submission.status} />
      </div>

      <div className="mt-7 flex flex-wrap gap-3">
        <Link
          href={`/form-studio/${submission.definition.id}`}
          className="rounded-xl border border-white/10 px-4 py-2 text-sm text-cyan-200"
        >
          Open form definition
        </Link>
        {submission.sourceHref && (
          <Link
            href={submission.sourceHref}
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200"
          >
            Open source record
            <ExternalLink size={15} />
          </Link>
        )}
      </div>

      {submission.status === ConfigurableSubmissionStatus.DRAFT && (
        <p className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-200">
          This submission is awaiting one or more required private attachments.
          Complete the upload from the linked source record.
        </p>
      )}

      <div className="mt-7 grid gap-6 xl:grid-cols-[1fr_.42fr]">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold">Captured responses</h2>
          {submission.version.instructions && (
            <p className="mt-2 text-sm text-slate-400">
              {submission.version.instructions}
            </p>
          )}
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {visibleFields.map((field) => {
              const answer = answerByField.get(field.id);
              const file = fileByField.get(field.id);
              return (
                <div
                  key={field.id}
                  className="rounded-2xl border border-white/5 bg-slate-950/45 p-4"
                >
                  <p className="text-xs text-slate-500">
                    {field.label}
                    {field.isRequired ? " · Required" : ""}
                  </p>
                  {field.fieldType === ConfigurableFieldType.FILE ? (
                    file ? (
                      <a
                        href={`/api/documents/${file.document.id}/download`}
                        className="mt-2 inline-flex items-center gap-2 text-sm text-cyan-200 hover:underline"
                      >
                        <Paperclip size={15} />
                        {file.document.originalName}
                      </a>
                    ) : (
                      <p className="mt-2 text-sm text-amber-300">
                        Attachment not uploaded
                      </p>
                    )
                  ) : (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-white">
                      {answer
                        ? displayFormSubmissionValue(answer.value)
                        : "No response"}
                    </p>
                  )}
                  <p className="mt-2 text-[11px] text-slate-600">
                    {prettyFormSubmissionLabel(field.fieldType)} · {field.key}
                  </p>
                </div>
              );
            })}
            {!visibleFields.length && (
              <p className="text-sm text-slate-500">
                This form version has no visible fields.
              </p>
            )}
          </div>
        </section>

        <aside className="space-y-5">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold">Record traceability</h2>
            <dl className="mt-4 space-y-4">
              <Detail label="Submission ID" value={submission.id} mono />
              <Detail
                label="Source record ID"
                value={submission.entityId}
                mono
              />
              <Detail
                label="Module"
                value={prettyFormSubmissionLabel(submission.entityType)}
              />
              <Detail
                label="Form assignment"
                value={
                  submission.definition.isActive ? "Assigned" : "Unassigned"
                }
              />
              <Detail
                label="Version status"
                value={prettyFormSubmissionLabel(submission.version.status)}
              />
              <Detail
                label="Submitted by"
                value={
                  submission.submittedBy
                    ? `${submission.submittedBy.name} · ${submission.submittedBy.email}`
                    : "Public research respondent"
                }
              />
              <Detail
                label="Captured"
                value={submission.submittedAt.toLocaleString()}
              />
              <Detail
                label="Last updated"
                value={submission.updatedAt.toLocaleString()}
              />
            </dl>
          </section>
          <section className="rounded-3xl border border-cyan-400/15 bg-cyan-400/[.04] p-5 text-xs text-slate-400">
            Published form versions and submitted answers are retained even when
            the form is later unassigned. This preserves the record as it
            appeared at the time of capture.
          </section>
        </aside>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ConfigurableSubmissionStatus }) {
  const className =
    status === ConfigurableSubmissionStatus.SUBMITTED
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
      : status === ConfigurableSubmissionStatus.DRAFT
        ? "border-amber-400/20 bg-amber-400/10 text-amber-300"
        : "border-white/10 bg-slate-900 text-slate-400";
  return (
    <span
      className={`rounded-full border px-4 py-2 text-sm font-semibold ${className}`}
    >
      {prettyFormSubmissionLabel(status)}
    </span>
  );
}

function Detail({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd
        className={`mt-1 break-all text-sm text-slate-200 ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
