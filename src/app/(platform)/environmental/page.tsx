import { EnvironmentalDataForm } from "@/features/environmental/environmental-data-form";
import {
  getCurrentUserPermissions,
  requirePermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { getPublishedRuntimeForms } from "@/modules/forms/runtime-form.service";
import {
  ConfigurableFormModule,
  EnvironmentalDataQuality,
  PermissionKey,
} from "@prisma/client";
import Link from "next/link";

const inputClassName =
  "mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3";

export default async function EnvironmentalPage() {
  await requirePermission(PermissionKey.VIEW_ENVIRONMENTAL);
  const [{ organizationId }, permissions] = await Promise.all([
    getCurrentUserTenant(),
    getCurrentUserPermissions(),
  ]);
  const canManage = permissions.includes(
    PermissionKey.MANAGE_ENVIRONMENTAL
  );
  const [metrics, sites, data, forms] = await Promise.all([
    prisma.environmentalMetricDefinition.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.site.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    }),
    prisma.environmentalDataPoint.findMany({
      where: { metric: { organizationId } },
      include: { metric: true, site: true, enteredBy: true },
      orderBy: { periodEnd: "desc" },
      take: 100,
    }),
    getPublishedRuntimeForms(
      organizationId,
      ConfigurableFormModule.ENVIRONMENTAL
    ),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-cyan-300">Environmental Performance</p>
          <h1 className="mt-2 text-4xl font-bold">Environmental Metrics</h1>
          <p className="mt-2 max-w-3xl text-slate-400">
            Capture governed environmental measurements, supporting evidence,
            quality classifications, and approvals.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/environmental/dashboard"
            className="rounded-xl border border-white/10 px-4 py-2"
          >
            Analytics
          </Link>
          {canManage && (
            <Link
              href="/environmental/metrics"
              className="rounded-xl border border-white/10 px-4 py-2"
            >
              Metric Catalog
            </Link>
          )}
        </div>
      </div>

      {canManage && (
        <EnvironmentalDataForm forms={forms}>
          <label className="text-sm">
            Metric
            <select
              name="metricId"
              required
              defaultValue=""
              className={inputClassName}
            >
              <option value="" disabled>
                Select a metric
              </option>
              {metrics.map((metric) => (
                <option key={metric.id} value={metric.id}>
                  {metric.code} — {metric.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Site
            <select
              name="siteId"
              required
              defaultValue=""
              className={inputClassName}
            >
              <option value="" disabled>
                Select a site
              </option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Value
            <input
              type="number"
              step="any"
              name="value"
              required
              className={inputClassName}
            />
          </label>
          <label className="text-sm">
            Period start
            <input
              type="date"
              name="periodStart"
              required
              className={inputClassName}
            />
          </label>
          <label className="text-sm">
            Period end
            <input
              type="date"
              name="periodEnd"
              required
              className={inputClassName}
            />
          </label>
          <label className="text-sm">
            Data quality
            <select name="quality" className={inputClassName}>
              {Object.values(EnvironmentalDataQuality).map((quality) => (
                <option key={quality} value={quality}>
                  {quality.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm md:col-span-2">
            Evidence summary
            <textarea
              name="evidenceSummary"
              rows={3}
              className={inputClassName}
            />
          </label>
          <label className="text-sm">
            Notes
            <textarea name="notes" rows={3} className={inputClassName} />
          </label>
        </EnvironmentalDataForm>
      )}

      <div className="mt-8 space-y-3">
        {data.map((point) => (
          <Link
            key={point.id}
            href={`/environmental/${point.id}`}
            className="block rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/30"
          >
            <div className="flex flex-wrap justify-between gap-3">
              <p className="font-semibold">
                {point.metric.name} · {point.site.name}
              </p>
              <span className="text-sm text-cyan-300">
                {point.status.replaceAll("_", " ")}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-400">
              {point.value} {point.metric.sourceUnit} = {" "}
              {point.normalizedValue} {point.metric.reportingUnit} · {" "}
              {point.periodStart.toLocaleDateString()}–
              {point.periodEnd.toLocaleDateString()}
            </p>
          </Link>
        ))}

        {data.length === 0 && (
          <p className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-slate-400">
            No environmental data points have been recorded.
          </p>
        )}
      </div>
    </div>
  );
}
