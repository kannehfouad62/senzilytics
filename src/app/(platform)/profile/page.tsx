import {
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  KeyRound,
  Mail,
  MapPin,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { getCurrentUserPermissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  filterUserVisibleModules,
  tenantAssignableModules,
} from "@/core/navigation/tenant-module-catalog";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const [{ user, organization, organizationId, supportAccess }, permissions] =
    await Promise.all([getCurrentUserTenant(), getCurrentUserPermissions()]);

  const [moduleAssignments, tenantAssignments] = await Promise.all([
    supportAccess
      ? Promise.resolve(
          supportAccess.moduleKeys.map((moduleKey) => ({
            moduleKey,
            enabled: true,
          })),
        )
      : prisma.userModuleAssignment.findMany({
          where: { organizationId, userId: user.id },
          select: { moduleKey: true, enabled: true },
        }),
    prisma.tenantModuleAssignment.findMany({
      where: { organizationId },
      select: { moduleKey: true, enabled: true },
    }),
  ]);

  const tenantModules = tenantAssignableModules(
    organization.industryCategory,
    tenantAssignments,
  );
  const visibleModules = filterUserVisibleModules(
    moduleAssignments,
    tenantModules.map((module) => ({ ...module, href: module.root })),
  );

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="flex items-center gap-2 text-sm text-cyan-300">
            <UserRound size={16} />
            Identity & access
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">My Profile</h1>
          <p className="mt-2 max-w-3xl text-slate-400">
            Review your organization identity, assigned modules, and effective
            application access. This profile is intentionally read-only.
          </p>
        </div>
        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-200">
          {user.isActive ? "Active account" : "Inactive account"}
        </span>
      </div>

      {supportAccess ? (
        <section className="mt-6 rounded-2xl border border-amber-400/25 bg-amber-400/[.07] p-5 text-sm text-amber-100">
          <p className="font-semibold">Governed support session active</p>
          <p className="mt-1 text-amber-100/75">
            You are viewing {organization.name} through approved, time-limited,
            read-only support access. Your real administrator identity remains
            recorded in the activity trail.
          </p>
        </section>
      ) : null}

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center gap-4 border-b border-white/10 pb-5">
            <div className="grid size-14 place-items-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-200">
              <UserRound size={26} />
            </div>
            <div>
              <h2 className="text-2xl font-semibold">{user.name}</h2>
              <p className="mt-1 text-sm text-slate-400">
                {humanize(user.role)}
              </p>
            </div>
          </div>

          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <Detail icon={<Mail size={17} />} label="Email" value={user.email} />
            <Detail
              icon={<BriefcaseBusiness size={17} />}
              label="Job title"
              value={user.jobTitle ?? "Not assigned"}
            />
            <Detail
              icon={<Building2 size={17} />}
              label="Organization"
              value={organization.name}
            />
            <Detail
              icon={<MapPin size={17} />}
              label="Site"
              value={user.department?.site.name ?? "Organization-wide"}
            />
            <Detail
              icon={<Building2 size={17} />}
              label="Department"
              value={user.department?.name ?? "Not assigned"}
            />
            <Detail
              icon={<CalendarClock size={17} />}
              label="Last sign-in"
              value={user.lastLoginAt?.toLocaleString() ?? "Not recorded"}
            />
          </dl>
        </section>

        <section className="rounded-3xl border border-cyan-400/15 bg-cyan-400/[.04] p-6">
          <p className="flex items-center gap-2 text-sm font-semibold text-cyan-200">
            <ShieldCheck size={18} />
            Protected account governance
          </p>
          <h2 className="mt-3 text-xl font-semibold">Profile changes are controlled</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            You cannot change your own email, role, organization, department,
            permissions, module access, or account status. These controls prevent
            self-elevation and preserve accountable separation of duties.
          </p>
          <p className="mt-4 text-sm leading-6 text-slate-400">
            Contact a tenant owner or authorized super administrator when your
            identity or access requires correction. Every administrative access
            change remains subject to tenant scope and audit logging.
          </p>
        </section>
      </div>

      <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-cyan-200">
              <KeyRound size={18} />
              Effective access
            </p>
            <h2 className="mt-2 text-xl font-semibold">Assigned modules</h2>
          </div>
          <span className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1.5 text-xs text-slate-300">
            {permissions.length} effective permissions
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          Module visibility never grants authority beyond your governed role permissions.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleModules.map((module) => (
            <div
              key={module.key}
              className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3"
            >
              <p className="font-medium text-slate-100">{module.label}</p>
              <p className="mt-1 text-xs text-slate-500">Assigned and role-filtered</p>
            </div>
          ))}
          {!visibleModules.length ? (
            <p className="text-sm text-slate-400">
              No tenant modules are currently assigned to this account.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function Detail({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
      <dt className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </dt>
      <dd className="mt-2 break-words text-sm font-medium text-slate-100">{value}</dd>
    </div>
  );
}

function humanize(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}
