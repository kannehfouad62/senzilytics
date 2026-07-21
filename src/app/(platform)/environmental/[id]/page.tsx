import { reviewEnvironmentalData } from "@/features/environmental/actions";
import { EntityCustomFormSubmissions } from "@/features/forms/entity-custom-form-submissions";
import { RuntimeFormCompletion } from "@/features/forms/runtime-form-completion";
import { completeEnvironmentalForms } from "@/features/environmental/actions";
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
  EnvironmentalDataStatus,
  PermissionKey,
} from "@prisma/client";
import { ArrowLeft, CalendarRange, Leaf, MapPin } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function EnvironmentalDataDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission(PermissionKey.VIEW_ENVIRONMENTAL);
  const [{ id }, { organizationId, user }, permissions] =
    await Promise.all([
      params,
      getCurrentUserTenant(),
      getCurrentUserPermissions(),
    ]);
  const canManage = permissions.includes(
    PermissionKey.MANAGE_ENVIRONMENTAL
  );
  const point = await prisma.environmentalDataPoint.findFirst({
    where: { id, metric: { organizationId } },
    include: {
      metric: true,
      site: true,
      enteredBy: true,
      approvedBy: true,
      revisions: {
        include: { changedBy: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!point) {
    notFound();
  }

  const [forms, capturedForms, documentUploadEnabled] = await Promise.all([
    getPublishedRuntimeForms(
      organizationId,
      ConfigurableFormModule.ENVIRONMENTAL
    ),
    prisma.configurableFormSubmission.findMany({
      where: {
        organizationId,
        entityType: ConfigurableFormModule.ENVIRONMENTAL,
        entityId: point.id,
      },
      select: { definitionId: true },
    }),
    hasSubscriptionFeature(organizationId, "DOCUMENT_UPLOAD"),
  ]);
  const capturedIds = new Set(
    capturedForms.map((submission) => submission.definitionId)
  );
  const missingForms = forms.filter((form) => !capturedIds.has(form.id));

  return (
    <div>
      <Link
        href="/environmental"
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
      >
        <ArrowLeft size={16} />
        Back to environmental metrics
      </Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="flex items-center gap-2 text-sm text-cyan-300">
            <Leaf size={17} />
            Environmental Data Point
          </p>
          <h1 className="mt-2 text-4xl font-bold">{point.metric.name}</h1>
          <p className="mt-2 text-slate-400">
            {point.metric.code} · {point.site.name}
          </p>
        </div>
        <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
          {point.status.replaceAll("_", " ")}
        </span>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InfoCard
          label="Reported value"
          value={`${point.value} ${point.metric.sourceUnit}`}
          icon={<Leaf size={18} />}
        />
        <InfoCard
          label="Normalized value"
          value={`${point.normalizedValue} ${point.metric.reportingUnit}`}
          icon={<Leaf size={18} />}
        />
        <InfoCard
          label="Reporting period"
          value={`${point.periodStart.toLocaleDateString()}–${point.periodEnd.toLocaleDateString()}`}
          icon={<CalendarRange size={18} />}
        />
        <InfoCard
          label="Site"
          value={point.site.name}
          icon={<MapPin size={18} />}
        />
      </div>

      {canManage && (
        <RuntimeFormCompletion
          action={completeEnvironmentalForms}
          entityId={point.id}
          entityIdName="dataPointId"
          forms={missingForms}
          submitLabel="Save Environmental Forms"
        />
      )}

      <EntityCustomFormSubmissions
        organizationId={organizationId}
        userId={user.id}
        module={ConfigurableFormModule.ENVIRONMENTAL}
        entityType={DocumentEntityType.ENVIRONMENTAL}
        entityId={point.id}
        canUpload={canManage && documentUploadEnabled}
        className="mt-8 space-y-6"
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold">Data governance</h2>
          <dl className="mt-5 space-y-4 text-sm">
            <Detail label="Quality" value={point.quality} />
            <Detail label="Entered by" value={point.enteredBy.name} />
            <Detail label="Evidence summary" value={point.evidenceSummary} />
            <Detail label="Notes" value={point.notes} />
            <Detail label="Approved by" value={point.approvedBy?.name || null} />
            <Detail
              label="Approved at"
              value={point.approvedAt?.toLocaleString() || null}
            />
          </dl>

          {canManage && point.status === EnvironmentalDataStatus.DRAFT && (
            <form action={reviewEnvironmentalData} className="mt-6 flex gap-3">
              <input type="hidden" name="id" value={point.id} />
              <button
                name="status"
                value={EnvironmentalDataStatus.APPROVED}
                className="rounded-xl bg-emerald-300 px-4 py-2 font-semibold text-slate-950"
              >
                Approve
              </button>
              <button
                name="status"
                value={EnvironmentalDataStatus.REJECTED}
                className="rounded-xl bg-red-300 px-4 py-2 font-semibold text-slate-950"
              >
                Reject
              </button>
            </form>
          )}
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Restatement history</h2>
            {canManage && (
              <Link
                href="/environmental/restatements"
                className="text-sm text-cyan-300"
              >
                Manage restatements
              </Link>
            )}
          </div>
          <div className="mt-5 space-y-3">
            {point.revisions.map((revision) => (
              <div
                key={revision.id}
                className="rounded-xl bg-slate-950/50 p-4"
              >
                <p className="font-medium">
                  Prior value: {revision.normalizedValue} {point.metric.reportingUnit}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {revision.reason} · {revision.changedBy.name} · {" "}
                  {revision.createdAt.toLocaleString()}
                </p>
              </div>
            ))}
            {point.revisions.length === 0 && (
              <p className="text-sm text-slate-400">
                This record has not been restated.
              </p>
            )}
          </div>
        </section>
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
      <p className="mt-1 font-semibold">{value}</p>
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
        {value || "Not recorded"}
      </dd>
    </div>
  );
}
