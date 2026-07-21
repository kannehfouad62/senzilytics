import { completeEsgForms } from "@/features/esg/actions";
import { EsgPeriodApprovalForm } from "@/features/esg/esg-period-approval-form";
import { EntityCustomFormSubmissions } from "@/features/forms/entity-custom-form-submissions";
import { RuntimeFormCompletion } from "@/features/forms/runtime-form-completion";
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
  EsgDisclosureStatus,
  PermissionKey,
} from "@prisma/client";
import { ArrowLeft, CalendarRange, Download, Sprout } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function EsgDisclosureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission(PermissionKey.VIEW_ESG);
  const [{ id }, { organizationId, user }, permissions] =
    await Promise.all([
      params,
      getCurrentUserTenant(),
      getCurrentUserPermissions(),
    ]);
  const canManage = permissions.includes(PermissionKey.MANAGE_ESG);
  const period = await prisma.esgDisclosurePeriod.findFirst({
    where: { id, organizationId },
    include: {
      approvedBy: true,
      publishedBy: true,
      dataPoints: {
        include: { metric: true, enteredBy: true },
        orderBy: { metric: { code: "asc" } },
      },
    },
  });

  if (!period) {
    notFound();
  }

  const [forms, capturedForms, documentUploadEnabled, activeMetricCount] =
    await Promise.all([
      getPublishedRuntimeForms(organizationId, ConfigurableFormModule.ESG),
      prisma.configurableFormSubmission.findMany({
        where: {
          organizationId,
          entityType: ConfigurableFormModule.ESG,
          entityId: period.id,
        },
        select: { definitionId: true },
      }),
      hasSubscriptionFeature(organizationId, "DOCUMENT_UPLOAD"),
      prisma.esgMetricDefinition.count({
        where: { organizationId, isActive: true },
      }),
    ]);
  const capturedIds = new Set(
    capturedForms.map((submission) => submission.definitionId)
  );
  const missingForms = forms.filter((form) => !capturedIds.has(form.id));
  const exportable =
    period.status === EsgDisclosureStatus.APPROVED ||
    period.status === EsgDisclosureStatus.PUBLISHED;

  return (
    <div>
      <Link
        href="/esg"
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
      >
        <ArrowLeft size={16} />
        Back to ESG disclosures
      </Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="flex items-center gap-2 text-sm text-cyan-300">
            <Sprout size={17} />
            ESG Disclosure Period
          </p>
          <h1 className="mt-2 text-4xl font-bold">{period.name}</h1>
          <p className="mt-3 max-w-4xl whitespace-pre-wrap text-slate-400">
            {period.boundaryDescription}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
            {period.status.replaceAll("_", " ")}
          </span>
          {exportable && (
            <Link
              href={`/api/esg/report/${period.id}`}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm"
            >
              <Download size={16} />
              Export CSV
            </Link>
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InfoCard
          label="Reporting period"
          value={`${period.periodStart.toLocaleDateString()}–${period.periodEnd.toLocaleDateString()}`}
        />
        <InfoCard
          label="Metric completeness"
          value={`${period.dataPoints.length}/${activeMetricCount}`}
        />
        <InfoCard
          label="Approved by"
          value={period.approvedBy?.name || "Not approved"}
        />
        <InfoCard
          label="Published by"
          value={period.publishedBy?.name || "Not published"}
        />
      </div>

      {canManage && (
        <RuntimeFormCompletion
          action={completeEsgForms}
          entityId={period.id}
          entityIdName="periodId"
          forms={missingForms}
          submitLabel="Save ESG Forms"
        />
      )}

      <EntityCustomFormSubmissions
        organizationId={organizationId}
        userId={user.id}
        module={ConfigurableFormModule.ESG}
        entityType={DocumentEntityType.ESG}
        entityId={period.id}
        canUpload={canManage && documentUploadEnabled}
        className="mt-8 space-y-6"
      />

      <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Reported ESG metrics</h2>
            <p className="mt-1 text-sm text-slate-400">
              Evidence summaries and data lineage captured for this period.
            </p>
          </div>
          {canManage && !exportable && (
            <EsgPeriodApprovalForm periodId={period.id} />
          )}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {period.dataPoints.map((point) => (
            <article
              key={point.id}
              className="rounded-2xl border border-white/10 bg-slate-950/40 p-5"
            >
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-cyan-300">
                    {point.metric.code} · {point.metric.pillar}
                  </p>
                  <h3 className="mt-1 font-semibold">{point.metric.name}</h3>
                </div>
                <p className="font-semibold">
                  {point.value} {point.metric.unit}
                </p>
              </div>
              <p className="mt-3 text-sm text-slate-400">
                Quality: {point.quality.replaceAll("_", " ")} · entered by {" "}
                {point.enteredBy.name}
              </p>
              {point.evidenceSummary && (
                <p className="mt-2 whitespace-pre-wrap text-sm">
                  {point.evidenceSummary}
                </p>
              )}
              {point.sourceDescription && (
                <p className="mt-2 whitespace-pre-wrap text-xs text-slate-500">
                  Source: {point.sourceDescription}
                </p>
              )}
            </article>
          ))}

          {period.dataPoints.length === 0 && (
            <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-slate-400 lg:col-span-2">
              No ESG metrics have been recorded for this disclosure period.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <CalendarRange size={18} className="text-cyan-300" />
      <p className="mt-3 text-xs uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
