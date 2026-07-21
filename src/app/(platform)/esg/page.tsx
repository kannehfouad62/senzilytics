import { recordEsgData } from "@/features/esg/actions";
import { EsgPeriodCreateForm } from "@/features/esg/esg-period-create-form";
import {
  getCurrentUserPermissions,
  requirePermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { getPublishedRuntimeForms } from "@/modules/forms/runtime-form.service";
import {
  ConfigurableFormModule,
  EsgDataQuality,
  PermissionKey,
} from "@prisma/client";
import Link from "next/link";

const inputClassName =
  "mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3";

export default async function EsgPage() {
  await requirePermission(PermissionKey.VIEW_ESG);
  const [{ organizationId }, permissions] = await Promise.all([
    getCurrentUserTenant(),
    getCurrentUserPermissions(),
  ]);
  const canManage = permissions.includes(PermissionKey.MANAGE_ESG);
  const [periods, metrics, forms] = await Promise.all([
    prisma.esgDisclosurePeriod.findMany({
      where: { organizationId },
      include: { dataPoints: { include: { metric: true } } },
      orderBy: { periodEnd: "desc" },
    }),
    prisma.esgMetricDefinition.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: "asc" },
    }),
    getPublishedRuntimeForms(organizationId, ConfigurableFormModule.ESG),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-cyan-300">Sustainability Intelligence</p>
          <h1 className="mt-2 text-4xl font-bold">ESG Disclosures</h1>
          <p className="mt-2 max-w-3xl text-slate-400">
            Govern disclosure periods, reported metrics, evidence, approvals,
            and publication readiness.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/esg/dashboard"
            className="rounded-xl border border-white/10 px-4 py-2"
          >
            Analytics
          </Link>
          {canManage && (
            <>
              <Link
                href="/esg/frameworks"
                className="rounded-xl border border-white/10 px-4 py-2"
              >
                Frameworks & Metrics
              </Link>
              <Link
                href="/esg/operations"
                className="rounded-xl border border-white/10 px-4 py-2"
              >
                Operations
              </Link>
            </>
          )}
        </div>
      </div>

      {canManage && (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <EsgPeriodCreateForm forms={forms}>
            <label className="block text-sm">
              Period name
              <input
                name="name"
                placeholder="FY 2027"
                required
                className={inputClassName}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
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
            </div>
            <label className="block text-sm">
              Reporting boundary
              <textarea
                name="boundaryDescription"
                rows={4}
                required
                className={inputClassName}
              />
            </label>
          </EsgPeriodCreateForm>

          <form
            action={recordEsgData}
            className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6"
          >
            <h2 className="text-xl font-semibold">Record ESG Data</h2>
            <label className="block text-sm">
              Disclosure period
              <select name="periodId" className={inputClassName}>
                {periods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              ESG metric
              <select name="metricId" className={inputClassName}>
                {metrics.map((metric) => (
                  <option key={metric.id} value={metric.id}>
                    {metric.code} — {metric.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Value
              <input
                type="number"
                step="any"
                name="value"
                required
                className={inputClassName}
              />
            </label>
            <label className="block text-sm">
              Data quality
              <select name="quality" className={inputClassName}>
                {Object.values(EsgDataQuality).map((quality) => (
                  <option key={quality} value={quality}>
                    {quality.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Evidence summary
              <textarea
                name="evidenceSummary"
                rows={3}
                className={inputClassName}
              />
            </label>
            <label className="block text-sm">
              Source description
              <textarea
                name="sourceDescription"
                rows={3}
                className={inputClassName}
              />
            </label>
            <button className="rounded-xl bg-cyan-300 px-4 py-2 font-semibold text-slate-950">
              Save ESG Data
            </button>
          </form>
        </div>
      )}

      <div className="mt-8 space-y-4">
        {periods.map((period) => (
          <Link
            key={period.id}
            href={`/esg/${period.id}`}
            className="block rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:border-cyan-400/30"
          >
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{period.name}</h2>
                <p className="mt-1 text-sm text-slate-400">
                  {period.boundaryDescription}
                </p>
              </div>
              <span className="text-sm text-cyan-300">
                {period.status.replaceAll("_", " ")}
              </span>
            </div>
            <p className="mt-4 text-sm">
              {period.dataPoints.length} of {metrics.length} active metrics
              recorded
            </p>
          </Link>
        ))}

        {periods.length === 0 && (
          <p className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-slate-400">
            No ESG disclosure periods have been created.
          </p>
        )}
      </div>
    </div>
  );
}
