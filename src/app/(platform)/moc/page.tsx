import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { findTenantMocs } from "@/modules/moc/moc.repository";
import {
  MocApprovalStatus,
  MocChangeDuration,
  MocChangeType,
  MocPriority,
  MocStatus,
  MocTaskStatus,
  PermissionKey,
  RiskLevel,
} from "@prisma/client";
import {
  BarChart3,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  Plus,
  Search,
  Settings2,
  ShieldAlert,
  UserRoundX,
  Workflow,
} from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

type MocPageProps = {
  searchParams: Promise<{
    search?: string;
    siteId?: string;
    status?: string;
    changeType?: string;
    changeDuration?: string;
    priority?: string;
  }>;
};

function isEnumValue<T extends Record<string, string>>(
  enumObject: T,
  value: string
): value is T[keyof T] {
  return Object.values(enumObject).includes(
    value as T[keyof T]
  );
}

export default async function MocPage({
  searchParams,
}: MocPageProps) {
  await requirePermission(
    PermissionKey.VIEW_MOC
  );

  const { organizationId } =
    await getCurrentUserTenant();

  const params = await searchParams;

  const search =
    params.search?.trim() || null;

  const siteId =
    params.siteId?.trim() || null;

  const status =
    params.status &&
    isEnumValue(
      MocStatus,
      params.status
    )
      ? params.status
      : null;

  const changeType =
    params.changeType &&
    isEnumValue(
      MocChangeType,
      params.changeType
    )
      ? params.changeType
      : null;

  const changeDuration =
    params.changeDuration &&
    isEnumValue(
      MocChangeDuration,
      params.changeDuration
    )
      ? params.changeDuration
      : null;

  const priority =
    params.priority &&
    isEnumValue(
      MocPriority,
      params.priority
    )
      ? params.priority
      : null;

  const [mocs, sites] =
    await Promise.all([
      findTenantMocs({
        organizationId,
        search,
        siteId,
        status,
        changeType,
        changeDuration,
        priority,
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

  const activeMocs =
    mocs.filter(
      (moc) =>
        moc.status !==
          MocStatus.CLOSED &&
        moc.status !==
          MocStatus.CANCELLED &&
        moc.status !==
          MocStatus.REJECTED
    );

  const highRiskMocs =
    activeMocs.filter(
      (moc) =>
        moc.residualRiskLevel ===
          RiskLevel.HIGH ||
        moc.residualRiskLevel ===
          RiskLevel.CRITICAL
    );

  const overdueMocs =
    activeMocs.filter(
      (moc) =>
        Boolean(
          moc.plannedCompletionDate &&
            moc.plannedCompletionDate <
              now
        )
    );

  const pendingApprovals =
    mocs.reduce(
      (total, moc) =>
        total +
        moc.approvals.filter(
          (approval) =>
            approval.status ===
            MocApprovalStatus.PENDING
        ).length,
      0
    );

  const incompleteTasks =
    mocs.reduce(
      (total, moc) =>
        total +
        moc.tasks.filter(
          (task) =>
            task.isRequired &&
            task.status !==
              MocTaskStatus.COMPLETED &&
            task.status !==
              MocTaskStatus.CANCELLED
        ).length,
      0
    );

  const unassignedMocs =
    activeMocs.filter(
      (moc) => !moc.owner
    );

    return (
      <div>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="flex items-center gap-2 text-sm text-cyan-300">
              <Workflow size={16} />
              Change Governance
            </p>
    
            <h1 className="mt-2 text-4xl font-bold tracking-tight">
              Management of Change
            </h1>
    
            <p className="mt-2 max-w-3xl text-slate-400">
              Register, assess, review, approve, implement, verify,
              and close operational and organizational changes.
            </p>
          </div>
    
          <div className="flex flex-wrap gap-3">
            <Link
              href="/moc/dashboard"
              className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-400/15"
            >
              <BarChart3 size={17} />
              Executive Dashboard
            </Link>
    
            <Link
              href="/moc/new"
              className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
            >
              <Plus size={17} />
              Create Change
            </Link>
          </div>
        </div>
    
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <SummaryCard
            label="Active changes"
            value={activeMocs.length}
            icon={<CircleDot size={20} />}
          />

        <SummaryCard
          label="High residual risk"
          value={highRiskMocs.length}
          icon={
            <ShieldAlert size={20} />
          }
          critical={
            highRiskMocs.length > 0
          }
        />

        <SummaryCard
          label="Overdue changes"
          value={overdueMocs.length}
          icon={
            <CalendarClock size={20} />
          }
          critical={
            overdueMocs.length > 0
          }
        />

        <SummaryCard
          label="Pending approvals"
          value={pendingApprovals}
          icon={
            <CheckCircle2 size={20} />
          }
          critical={
            pendingApprovals > 0
          }
        />

        <SummaryCard
          label="Incomplete tasks"
          value={incompleteTasks}
          icon={
            <Settings2 size={20} />
          }
          critical={
            incompleteTasks > 0
          }
        />

        <SummaryCard
          label="Unassigned"
          value={unassignedMocs.length}
          icon={
            <UserRoundX size={20} />
          }
          critical={
            unassignedMocs.length > 0
          }
        />
      </div>

      <form
        method="get"
        className="mt-8 grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 md:grid-cols-6"
      >
        <label className="md:col-span-2">
          <span className="text-xs text-slate-500">
            Search changes
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
              placeholder="Reference, title, process, equipment..."
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

            {sites.map((site) => (
              <option
                key={site.id}
                value={site.id}
              >
                {site.name}
              </option>
            ))}
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
              MocStatus
            ).map((value) => (
              <option
                key={value}
                value={value}
              >
                {formatEnum(value)}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="Change type">
          <select
            name="changeType"
            defaultValue={
              changeType ?? ""
            }
            className={inputClass}
          >
            <option value="">
              All types
            </option>

            {Object.values(
              MocChangeType
            ).map((value) => (
              <option
                key={value}
                value={value}
              >
                {formatEnum(value)}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="Priority">
          <select
            name="priority"
            defaultValue={
              priority ?? ""
            }
            className={inputClass}
          >
            <option value="">
              All priorities
            </option>

            {Object.values(
              MocPriority
            ).map((value) => (
              <option
                key={value}
                value={value}
              >
                {formatEnum(value)}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="Duration">
          <select
            name="changeDuration"
            defaultValue={
              changeDuration ?? ""
            }
            className={inputClass}
          >
            <option value="">
              All durations
            </option>

            {Object.values(
              MocChangeDuration
            ).map((value) => (
              <option
                key={value}
                value={value}
              >
                {formatEnum(value)}
              </option>
            ))}
          </select>
        </FilterField>

        <div className="flex items-end md:col-span-5 md:justify-end">
          <div className="flex w-full gap-3 md:w-auto">
            <Link
              href="/moc"
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
        {mocs.map((moc) => {
          const overdue =
            Boolean(
              moc.plannedCompletionDate &&
                moc.plannedCompletionDate <
                  now &&
                moc.status !==
                  MocStatus.CLOSED &&
                moc.status !==
                  MocStatus.CANCELLED
            );

          const pendingApprovalCount =
            moc.approvals.filter(
              (approval) =>
                approval.status ===
                MocApprovalStatus.PENDING
            ).length;

          const requiredTaskCount =
            moc.tasks.filter(
              (task) =>
                task.isRequired
            ).length;

          const completedRequiredTaskCount =
            moc.tasks.filter(
              (task) =>
                task.isRequired &&
                task.status ===
                  MocTaskStatus.COMPLETED
            ).length;

          const taskProgress =
            requiredTaskCount > 0
              ? Math.round(
                  (completedRequiredTaskCount /
                    requiredTaskCount) *
                    100
                )
              : 0;

          return (
            <Link
              key={moc.id}
              href={`/moc/${moc.id}`}
              className="group rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:border-cyan-400/30 hover:bg-cyan-400/[0.04]"
            >
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-cyan-300">
                      {moc.reference}
                    </span>

                    <StatusBadge
                      status={moc.status}
                    />

                    <PriorityBadge
                      priority={moc.priority}
                    />

                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                      {formatEnum(
                        moc.changeType
                      )}
                    </span>

                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                      {formatEnum(
                        moc.changeDuration
                      )}
                    </span>

                    {overdue && (
                      <span className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1 text-xs text-red-300">
                        OVERDUE
                      </span>
                    )}
                  </div>

                  <h2 className="mt-3 text-xl font-semibold text-white transition group-hover:text-cyan-200">
                    {moc.title}
                  </h2>

                  <p className="mt-2 line-clamp-2 max-w-4xl text-sm leading-6 text-slate-400">
                    {moc.description}
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <Detail
                      label="Site"
                      value={
                        moc.site.name
                      }
                    />

                    <Detail
                      label="Department"
                      value={
                        moc.department
                          ?.name ||
                        "Not assigned"
                      }
                    />

                    <Detail
                      label="Owner"
                      value={
                        moc.owner?.name ||
                        "Not assigned"
                      }
                    />

                    <Detail
                      label="Planned Completion"
                      value={formatDate(
                        moc.plannedCompletionDate
                      )}
                    />

                    <Detail
                      label="Linked Risks"
                      value={`${moc.riskLinks.length}`}
                    />
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    <Detail
                      label="Pending Approvals"
                      value={`${pendingApprovalCount}`}
                    />

                    <Detail
                      label="Required Tasks"
                      value={`${completedRequiredTaskCount}/${requiredTaskCount}`}
                    />

                    <Detail
                      label="Task Progress"
                      value={`${taskProgress}%`}
                    />
                  </div>

                  {requiredTaskCount >
                    0 && (
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-900">
                      <div
                        className="h-full rounded-full bg-cyan-300"
                        style={{
                          width: `${taskProgress}%`,
                        }}
                      />
                    </div>
                  )}
                </div>

                <RiskCard
                  score={
                    moc.residualScore
                  }
                  riskLevel={
                    moc.residualRiskLevel
                  }
                />
              </div>
            </Link>
          );
        })}

        {mocs.length === 0 && (
          <div className="rounded-3xl border border-dashed border-white/15 p-12 text-center">
            <Workflow
              size={36}
              className="mx-auto text-slate-600"
            />

            <h2 className="mt-4 text-lg font-semibold text-white">
              No changes found
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Adjust the filters or create
              the first management-of-change
              request.
            </p>

            <Link
              href="/moc/new"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950"
            >
              <Plus size={16} />
              Create Change
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

function StatusBadge({
  status,
}: {
  status: MocStatus;
}) {
  return (
    <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300">
      {formatEnum(status)}
    </span>
  );
}

function PriorityBadge({
  priority,
}: {
  priority: MocPriority;
}) {
  const className =
    priority === MocPriority.CRITICAL
      ? "border-purple-400/20 bg-purple-400/10 text-purple-300"
      : priority === MocPriority.HIGH
        ? "border-red-400/20 bg-red-400/10 text-red-300"
        : priority === MocPriority.MEDIUM
          ? "border-orange-400/20 bg-orange-400/10 text-orange-300"
          : "border-green-400/20 bg-green-400/10 text-green-300";

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs ${className}`}
    >
      {priority}
    </span>
  );
}

function RiskCard({
  score,
  riskLevel,
}: {
  score: number;
  riskLevel: RiskLevel;
}) {
  const className =
    riskLevel === RiskLevel.CRITICAL
      ? "border-purple-400/20 bg-purple-400/10 text-purple-200"
      : riskLevel === RiskLevel.HIGH
        ? "border-red-400/20 bg-red-400/10 text-red-200"
        : riskLevel === RiskLevel.MEDIUM
          ? "border-orange-400/20 bg-orange-400/10 text-orange-200"
          : "border-green-400/20 bg-green-400/10 text-green-200";

  return (
    <div
      className={`min-w-[150px] rounded-2xl border p-4 text-center ${className}`}
    >
      <p className="text-xs opacity-80">
        Residual Risk
      </p>

      <p className="mt-2 text-3xl font-bold">
        {score}
      </p>

      <p className="mt-1 text-xs font-semibold">
        {riskLevel}
      </p>
    </div>
  );
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

function formatEnum(
  value: string
) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );
}