import { evaluateComplianceObligation } from "@/features/compliance/actions";
import { ComplianceCustomFormCompletion } from "@/features/compliance/compliance-custom-form-completion";
import { EntityCustomFormSubmissions } from "@/features/forms/entity-custom-form-submissions";
import {
  getCurrentUserPermissions,
  requirePermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { hasSubscriptionFeature } from "@/lib/subscription";
import { getCurrentUserTenant } from "@/lib/tenant";
import { getPublishedRuntimeForms } from "@/modules/forms/runtime-form.service";
import {
  ConfigurableFormModule,
  DocumentEntityType,
  PermissionKey,
} from "@prisma/client";
import { ArrowLeft, CalendarClock, MapPin, Scale } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

const inputClassName =
  "mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3";

export default async function ComplianceObligationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission(PermissionKey.VIEW_COMPLIANCE);

  const [{ id }, { organizationId, user }, permissions] =
    await Promise.all([
      params,
      getCurrentUserTenant(),
      getCurrentUserPermissions(),
    ]);
  const canManage = permissions.includes(
    PermissionKey.MANAGE_COMPLIANCE
  );

  const item = await prisma.complianceItem.findFirst({
    where: {
      id,
      site: { organizationId },
    },
    include: {
      site: true,
      owner: true,
      evaluations: {
        include: { evaluatedBy: true },
        orderBy: { evaluatedAt: "desc" },
      },
      regulatorySource: true,
      regulatoryChanges: { include: { change: true }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!item) {
    notFound();
  }

  const [forms, capturedForms, documentUploadEnabled] = await Promise.all([
    getPublishedRuntimeForms(
      organizationId,
      ConfigurableFormModule.COMPLIANCE
    ),
    prisma.configurableFormSubmission.findMany({
      where: {
        organizationId,
        entityType: ConfigurableFormModule.COMPLIANCE,
        entityId: item.id,
      },
      select: { definitionId: true },
    }),
    hasSubscriptionFeature(organizationId, "DOCUMENT_UPLOAD"),
  ]);
  const capturedDefinitionIds = new Set(
    capturedForms.map((submission) => submission.definitionId)
  );
  const missingForms = forms.filter(
    (form) => !capturedDefinitionIds.has(form.id)
  );

  return (
    <div>
      <Link
        href="/compliance"
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
      >
        <ArrowLeft size={16} />
        Back to compliance
      </Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-sm text-cyan-300">
            {item.reference || item.obligationType.replaceAll("_", " ")}
          </p>
          <h1 className="mt-2 text-4xl font-bold">{item.title}</h1>
          <p className="mt-3 max-w-4xl whitespace-pre-wrap text-slate-400">
            {item.description || "No description provided."}
          </p>
        </div>
        <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
          {item.status.replaceAll("_", " ")}
        </span>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InfoCard
          label="Site"
          value={item.site.name}
          icon={<MapPin size={18} />}
        />
        <InfoCard
          label="Due date"
          value={item.dueDate.toLocaleDateString()}
          icon={<CalendarClock size={18} />}
        />
        <InfoCard
          label="Authority"
          value={item.authority || "Not specified"}
          icon={<Scale size={18} />}
        />
        <InfoCard
          label="Owner"
          value={item.owner?.name || "Unassigned"}
          icon={<Scale size={18} />}
        />
      </div>

      {canManage && (
        <ComplianceCustomFormCompletion
          complianceItemId={item.id}
          forms={missingForms}
        />
      )}

      <EntityCustomFormSubmissions
        organizationId={organizationId}
        userId={user.id}
        module={ConfigurableFormModule.COMPLIANCE}
        entityType={DocumentEntityType.COMPLIANCE}
        entityId={item.id}
        canUpload={canManage && documentUploadEnabled}
        className="mt-8 space-y-6"
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold">Obligation details</h2>
          <dl className="mt-5 space-y-4 text-sm">
            <Detail label="Type" value={item.obligationType} />
            <Detail label="Jurisdiction" value={item.jurisdiction} />
            <Detail label="Legal reference" value={item.legalReference} />
            <Detail label="Regulatory source" value={item.regulatorySource ? `${item.regulatorySource.code} — ${item.regulatorySource.name}` : null} />
            <Detail label="Applicability" value={item.applicability} />
            <Detail
              label="Recurrence"
              value={`${item.recurrence.replaceAll("_", " ")} · every ${
                item.intervalValue
              } interval${item.intervalValue === 1 ? "" : "s"}`}
            />
            <Detail label="Evidence required" value={item.evidenceRequired} />
          </dl>

          {item.regulatoryChanges.length > 0 && <div className="mt-6"><h3 className="text-sm font-semibold text-cyan-200">Regulatory change traceability</h3><div className="mt-3 space-y-2">{item.regulatoryChanges.map(link => <Link key={link.id} href={`/compliance/regulatory/changes/${link.changeId}`} className="block rounded-xl border border-white/10 p-3 text-sm"><span className="text-cyan-200">{link.change.reference}</span> — {link.change.title}<span className="ml-2 text-xs text-slate-500">{link.relationship}</span></Link>)}</div></div>}

          <h2 className="mt-8 text-xl font-semibold">Evaluation history</h2>
          <div className="mt-4 space-y-3">
            {item.evaluations.map((evaluation) => (
              <div
                key={evaluation.id}
                className="rounded-xl bg-slate-950/50 p-4"
              >
                <p
                  className={
                    evaluation.isCompliant
                      ? "text-emerald-300"
                      : "text-red-300"
                  }
                >
                  {evaluation.isCompliant ? "COMPLIANT" : "NONCOMPLIANT"}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {evaluation.evaluatedBy.name} · {" "}
                  {evaluation.evaluatedAt.toLocaleDateString()}
                </p>
                {evaluation.findings && (
                  <p className="mt-2 whitespace-pre-wrap text-sm">
                    {evaluation.findings}
                  </p>
                )}
                {evaluation.evidenceSummary && (
                  <p className="mt-2 whitespace-pre-wrap text-xs text-slate-400">
                    Evidence: {evaluation.evidenceSummary}
                  </p>
                )}
              </div>
            ))}

            {item.evaluations.length === 0 && (
              <p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-slate-400">
                No evaluations have been recorded.
              </p>
            )}
          </div>
        </section>

        {canManage ? (
          <form
            action={evaluateComplianceObligation}
            className="h-fit rounded-3xl border border-white/10 bg-white/5 p-6"
          >
            <input type="hidden" name="id" value={item.id} />
            <h2 className="text-xl font-semibold">Record Evaluation</h2>
            <p className="mt-1 text-sm text-slate-400">
              Record the latest compliance determination and supporting evidence.
            </p>
            <label className="mt-5 block text-sm">
              Result
              <select name="result" className={inputClassName}>
                <option value="COMPLIANT">Compliant</option>
                <option value="NONCOMPLIANT">Noncompliant</option>
              </select>
            </label>
            <label className="mt-5 block text-sm">
              Findings
              <textarea
                name="findings"
                rows={4}
                className={inputClassName}
              />
            </label>
            <label className="mt-5 block text-sm">
              Evidence summary
              <textarea
                name="evidenceSummary"
                rows={4}
                className={inputClassName}
              />
            </label>
            <button className="mt-5 rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950">
              Save Evaluation
            </button>
          </form>
        ) : (
          <section className="h-fit rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">Evaluation access</h2>
            <p className="mt-2 text-sm text-slate-400">
              You can review this obligation. A compliance manager must record or
              update formal evaluations.
            </p>
          </section>
        )}
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
      <div className="text-cyan-300">{icon}</div>
      <p className="mt-3 text-xs uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 font-semibold text-white">{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 whitespace-pre-wrap text-slate-200">
        {value || "Not specified"}
      </dd>
    </div>
  );
}
