import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { findTenantRisks } from "@/modules/risk/risk.repository";
import {
  PermissionKey,
  RiskCategory,
  RiskLevel,
  RiskStatus,
  Status,
} from "@prisma/client";
import {
  AlertTriangle,
  CalendarClock,
  Gauge,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import Link from "next/link";

export const dynamic =
  "force-dynamic";

type RisksPageProps = {
  searchParams: Promise<{
    search?: string;
    siteId?: string;
    category?: string;
    status?: string;
  }>;
};

function isRiskCategory(
  value: string
): value is RiskCategory {
  return Object.values(
    RiskCategory
  ).includes(
    value as RiskCategory
  );
}

function isRiskStatus(
  value: string
): value is RiskStatus {
  return Object.values(
    RiskStatus
  ).includes(
    value as RiskStatus
  );
}

export default async function RisksPage({
  searchParams,
}: RisksPageProps) {
  await requirePermission(
    PermissionKey.VIEW_RISKS
  );

  const {
    organizationId,
  } =
    await getCurrentUserTenant();

  const params =
    await searchParams;

  const search =
    params.search?.trim() ||
    null;

  const siteId =
    params.siteId?.trim() ||
    null;

  const category =
    params.category &&
    isRiskCategory(
      params.category
    )
      ? params.category
      : null;

  const status =
    params.status &&
    isRiskStatus(
      params.status
    )
      ? params.status
      : null;

  const [risks, sites] =
    await Promise.all([
      findTenantRisks({
        organizationId,
        search,
        siteId,
        category,
        status,
      }),

      prisma.site.findMany({
        where: {
          organizationId,
        },

        select: {
          id: true,
          name: true,
        },

        orderBy: {
          name: "asc",
        },
      }),
    ]);

  const now = new Date();

  const activeRisks =
    risks.filter(
      (risk) =>
        risk.status !==
          RiskStatus.CLOSED &&
        risk.status !==
          RiskStatus.ARCHIVED
    );

  const criticalRisks =
    activeRisks.filter(
      (risk) =>
        risk.currentRiskLevel ===
          RiskLevel.CRITICAL ||
        risk.residualRiskLevel ===
          RiskLevel.CRITICAL
    );

  const highResidualRisks =
    activeRisks.filter(
      (risk) =>
        risk.residualRiskLevel ===
          RiskLevel.HIGH ||
        risk.residualRiskLevel ===
          RiskLevel.CRITICAL
    );

  const overdueReviews =
    activeRisks.filter(
      (risk) =>
        Boolean(
          risk.nextReviewDate &&
            risk.nextReviewDate <
              now
        )
    );

  const unassignedRisks =
    activeRisks.filter(
      (risk) =>
        !risk.owner
    );

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="flex items-center gap-2 text-sm text-cyan-300">
            <ShieldAlert size={16} />
            Enterprise Risk Management
          </p>

          <h1 className="mt-2 text-4xl font-bold tracking-tight">
            Risk Register
          </h1>

          <p className="mt-2 max-w-3xl text-slate-400">
            Identify, assess, assign,
            control, review, and monitor
            enterprise EHS and operational
            risks across every site and
            department.
          </p>
        </div>

        <Link
          href="/risks/new"
          className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
        >
          <Plus size={17} />
          Create Risk
        </Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          label="Active risks"
          value={
            activeRisks.length
          }
          icon={
            <Gauge size={20} />
          }
        />

        <SummaryCard
          label="Critical risks"
          value={
            criticalRisks.length
          }
          icon={
            <AlertTriangle
              size={20}
            />
          }
          critical={
            criticalRisks.length >
            0
          }
        />

        <SummaryCard
          label="High residual"
          value={
            highResidualRisks.length
          }
          icon={
            <ShieldAlert
              size={20}
            />
          }
          critical={
            highResidualRisks.length >
            0
          }
        />

        <SummaryCard
          label="Overdue reviews"
          value={
            overdueReviews.length
          }
          icon={
            <CalendarClock
              size={20}
            />
          }
          critical={
            overdueReviews.length >
            0
          }
        />

        <SummaryCard
          label="Unassigned"
          value={
            unassignedRisks.length
          }
          icon={
            <UserRoundCheck
              size={20}
            />
          }
        />
      </div>

      <form
        method="get"
        className="mt-8 grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 md:grid-cols-5"
      >
        <label className="md:col-span-2">
          <span className="text-xs text-slate-500">
            Search risks
          </span>

          <div className="relative mt-2">
            <Search
              size={17}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
            />

            <input
              type="search"
              name="search"
              defaultValue={
                search ?? ""
              }
              placeholder="Reference, title, hazard, process..."
              className={`${inputClass} mt-0 pl-11`}
            />
          </div>
        </label>

        <FilterField label="Site">
          <select
            name="siteId"
            defaultValue={
              siteId ?? ""
            }
            className={inputClass}
          >
            <option value="">
              All sites
            </option>

            {sites.map(
              (site) => (
                <option
                  key={site.id}
                  value={site.id}
                >
                  {site.name}
                </option>
              )
            )}
          </select>
        </FilterField>

        <FilterField label="Category">
          <select
            name="category"
            defaultValue={
              category ?? ""
            }
            className={inputClass}
          >
            <option value="">
              All categories
            </option>

            {Object.values(
              RiskCategory
            ).map(
              (riskCategory) => (
                <option
                  key={
                    riskCategory
                  }
                  value={
                    riskCategory
                  }
                >
                  {riskCategory.replaceAll(
                    "_",
                    " "
                  )}
                </option>
              )
            )}
          </select>
        </FilterField>

        <FilterField label="Status">
          <select
            name="status"
            defaultValue={
              status ?? ""
            }
            className={inputClass}
          >
            <option value="">
              All statuses
            </option>

            {Object.values(
              RiskStatus
            ).map(
              (riskStatus) => (
                <option
                  key={
                    riskStatus
                  }
                  value={
                    riskStatus
                  }
                >
                  {riskStatus.replaceAll(
                    "_",
                    " "
                  )}
                </option>
              )
            )}
          </select>
        </FilterField>

        <div className="flex items-end md:col-span-5 md:justify-end">
          <div className="flex w-full gap-3 md:w-auto">
            <Link
              href="/risks"
              className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-center text-sm text-slate-300 transition hover:bg-white/5 md:flex-none"
            >
              Clear
            </Link>

            <button
              type="submit"
              className="flex-1 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 md:flex-none"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </form>

      <div className="mt-8 grid gap-5">
        {risks.map((risk) => {
          const overdueReview =
            Boolean(
              risk.nextReviewDate &&
                risk.nextReviewDate <
                  now &&
                risk.status !==
                  RiskStatus.CLOSED &&
                risk.status !==
                  RiskStatus.ARCHIVED
            );

          const openControls =
            risk.controls.filter(
              (control) =>
                control.status !==
                  Status.COMPLETED &&
                control.status !==
                  Status.CLOSED
            ).length;

          const overdueControls =
            risk.controls.filter(
              (control) =>
                control.dueDate &&
                control.dueDate <
                  now &&
                control.status !==
                  Status.COMPLETED &&
                control.status !==
                  Status.CLOSED
            ).length;

          return (
            <Link
              key={risk.id}
              href={`/risks/${risk.id}`}
              className="group rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:border-cyan-400/30 hover:bg-cyan-400/[0.04]"
            >
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-cyan-300">
                      {risk.reference}
                    </span>

                    <StatusBadge
                      status={
                        risk.status
                      }
                    />

                    <CategoryBadge
                      category={
                        risk.category
                      }
                    />

                    {overdueReview && (
                      <span className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1 text-xs text-red-300">
                        REVIEW OVERDUE
                      </span>
                    )}
                  </div>

                  <h2 className="mt-3 text-xl font-semibold text-white transition group-hover:text-cyan-200">
                    {risk.title}
                  </h2>

                  <p className="mt-2 line-clamp-2 max-w-4xl text-sm leading-6 text-slate-400">
                    {risk.description}
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <Detail
                      label="Site"
                      value={
                        risk.site
                          ?.name ||
                        "Enterprise"
                      }
                    />

                    <Detail
                      label="Department"
                      value={
                        risk.department
                          ?.name ||
                        "Not assigned"
                      }
                    />

                    <Detail
                      label="Owner"
                      value={
                        risk.owner
                          ?.name ||
                        "Not assigned"
                      }
                    />

                    <Detail
                      label="Next Review"
                      value={
                        formatDate(
                          risk.nextReviewDate
                        )
                      }
                    />

                    <Detail
                      label="Controls"
                      value={`${openControls} open · ${overdueControls} overdue`}
                    />
                  </div>
                </div>

                <div className="grid min-w-[230px] gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <RiskRatingCard
                    label="Current Risk"
                    score={
                      risk.currentScore
                    }
                    riskLevel={
                      risk.currentRiskLevel
                    }
                    likelihood={
                      risk.currentLikelihood
                    }
                    impact={
                      risk.currentImpact
                    }
                  />

                  <RiskRatingCard
                    label="Residual Risk"
                    score={
                      risk.residualScore
                    }
                    riskLevel={
                      risk.residualRiskLevel
                    }
                    likelihood={
                      risk.residualLikelihood
                    }
                    impact={
                      risk.residualImpact
                    }
                  />
                </div>
              </div>
            </Link>
          );
        })}

        {risks.length === 0 && (
          <div className="rounded-3xl border border-dashed border-white/15 p-12 text-center">
            <ShieldCheck
              size={36}
              className="mx-auto text-slate-600"
            />

            <h2 className="mt-4 text-lg font-semibold text-white">
              No risks found
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Adjust the filters or
              create the first risk in
              this organization.
            </p>

            <Link
              href="/risks/new"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950"
            >
              <Plus size={16} />
              Create Risk
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

const inputClass =
  "mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/50";

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span className="text-xs text-slate-500">
        {label}
      </span>

      {children}
    </label>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  critical = false,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  critical?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl border p-5 ${
        critical
          ? "border-red-400/20 bg-red-400/10"
          : "border-white/10 bg-white/5"
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          {label}
        </p>

        <span
          className={
            critical
              ? "text-red-300"
              : "text-cyan-300"
          }
        >
          {icon}
        </span>
      </div>

      <p className="mt-3 text-3xl font-semibold text-white">
        {value}
      </p>
    </div>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
      <p className="text-xs text-slate-500">
        {label}
      </p>

      <p className="mt-1 truncate text-sm text-slate-200">
        {value}
      </p>
    </div>
  );
}

function RiskRatingCard({
  label,
  score,
  riskLevel,
  likelihood,
  impact,
}: {
  label: string;
  score: number;
  riskLevel: RiskLevel;
  likelihood: string;
  impact: string;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${getRiskLevelClassName(
        riskLevel
      )}`}
    >
      <p className="text-xs font-medium opacity-80">
        {label}
      </p>

      <div className="mt-2 flex items-end justify-between gap-4">
        <div>
          <p className="text-3xl font-bold">
            {score}
          </p>

          <p className="mt-1 text-xs font-semibold">
            {riskLevel}
          </p>
        </div>

        <div className="text-right text-[10px] leading-5 opacity-80">
          <p>
            L:{" "}
            {likelihood.replaceAll(
              "_",
              " "
            )}
          </p>

          <p>
            I:{" "}
            {impact.replaceAll(
              "_",
              " "
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: RiskStatus;
}) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
      {status.replaceAll(
        "_",
        " "
      )}
    </span>
  );
}

function CategoryBadge({
  category,
}: {
  category: RiskCategory;
}) {
  return (
    <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300">
      {category.replaceAll(
        "_",
        " "
      )}
    </span>
  );
}

function getRiskLevelClassName(
  riskLevel: RiskLevel
) {
  switch (riskLevel) {
    case RiskLevel.CRITICAL:
      return "border-purple-400/20 bg-purple-400/10 text-purple-200";

    case RiskLevel.HIGH:
      return "border-red-400/20 bg-red-400/10 text-red-200";

    case RiskLevel.MEDIUM:
      return "border-orange-400/20 bg-orange-400/10 text-orange-200";

    case RiskLevel.LOW:
    default:
      return "border-green-400/20 bg-green-400/10 text-green-200";
  }
}

function formatDate(
  value: Date | null
) {
  if (!value) {
    return "Not scheduled";
  }

  return value.toLocaleDateString(
    "en-US",
    {
      dateStyle: "medium",
    }
  );
}