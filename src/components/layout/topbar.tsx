import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  Bell,
  Building2,
  ClipboardList,
  LogOut,
  Search,
  ServerCog,
  Sparkles,
  LifeBuoy,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import {
  auditNavItems,
  complianceNavItems,
  ehsNavItems,
  inspectionNavItems,
  primaryNavItems,
  researchNavItems,
  type NavigationItem,
} from "./sidebar";
import { isApprovedPlatformAdministrator } from "@/lib/platform-admin";
import { MobileNavigationMenu } from "./mobile-navigation-menu";
import { IndustryCategory, PermissionKey, UserRole } from "@prisma/client";
import { planEntitlements } from "@/lib/subscription";
import { getCurrentUserPermissions } from "@/lib/permissions";
import { filterNavigationItems } from "@/core/permissions/navigation-access";
import { ActiveNavigationLink } from "@/components/layout/active-navigation-link";
import { filterTenantVisibleModules, filterUserVisibleModules } from "@/core/navigation/tenant-module-catalog";

export const dynamic = "force-dynamic";

export async function Topbar() {
  const [session, permissions] = await Promise.all([
    auth(),
    getCurrentUserPermissions(),
  ]);

  const currentUser = session?.user?.email
    ? await prisma.user.findUnique({
        where: {
          email: session.user.email,
        },
        select: {
          id: true,
          name: true,
          role: true,
          email: true,
          isActive: true,
          isPlatformAdmin: true,
          organizationId: true,
          userModuleAssignments: { select: { moduleKey: true, enabled: true } },
          organization: {
            select: {
              subscriptionPlan: true,
              industryCategory: true,
              moduleAssignments: { select: { moduleKey: true, enabled: true } },
            },
          },
        },
      })
    : null;

  const entitlements = currentUser?.organization
    ? planEntitlements[currentUser.organization.subscriptionPlan]
    : planEntitlements.PREMIUM;
  const unreadCount =
    currentUser && entitlements.IN_APP_NOTIFICATIONS
      ? await prisma.notification.count({
          where: {
            userId: currentUser.id,
            readAt: null,
          },
        })
      : 0;

  const taskCount = currentUser?.organizationId
    ? await prisma.workflowInstanceStep.count({
        where: {
          status: "IN_PROGRESS",
          instance: {
            organizationId: currentUser.organizationId,
            status: "ACTIVE",
          },
          OR: [
            { assignedUserId: currentUser.id },
            { assignedRole: currentUser.role },
            { assignedRole: null },
          ],
        },
      })
    : 0;

  const overdueTaskCount = currentUser?.organizationId
    ? await prisma.workflowInstanceStep.count({
        where: {
          status: "IN_PROGRESS",
          dueAt: {
            lt: new Date(),
          },
          instance: {
            organizationId: currentUser.organizationId,
            status: "ACTIVE",
          },
          OR: [
            { assignedUserId: currentUser.id },
            { assignedRole: currentUser.role },
            { assignedRole: null },
          ],
        },
      })
    : 0;

  const permittedPrimaryItems = filterNavigationItems(
    primaryNavItems,
    permissions,
  ).filter(
    (item) =>
      item.href !== "/field-collection" || entitlements.OFFLINE_COLLECTION,
  );
  const platformAdministrator = Boolean(currentUser && isApprovedPlatformAdministrator(currentUser));
  const recommend = <T extends NavigationItem>(items: T[]) => platformAdministrator
    ? items
    : filterUserVisibleModules(
        currentUser?.userModuleAssignments ?? [],
        filterTenantVisibleModules(
          currentUser?.organization?.industryCategory ?? IndustryCategory.GENERAL,
          currentUser?.organization?.moduleAssignments ?? [],
          items,
        ),
      );
  const visiblePrimaryItems = recommend(permittedPrimaryItems);
  const platformItems: NavigationItem[] =
    platformAdministrator
      ? [
          ...visiblePrimaryItems,
          {
            label: "Tenant Provisioning",
            href: "/platform/tenants",
            icon: Building2,
          },
          {
            label: "Platform Operations",
            href: "/platform/operations",
            icon: ServerCog,
          },
          {
            label: "Support Access Console",
            href: "/platform/support-access",
            icon: LifeBuoy,
          },
        ]
      : currentUser?.role === UserRole.DEMO_VIEWER
        ? visiblePrimaryItems.filter((item) => item.href === "/dashboard")
        : visiblePrimaryItems;

  const demoMode = currentUser?.role === UserRole.DEMO_VIEWER;
  const visibleEhsItems = recommend(filterNavigationItems(ehsNavItems, permissions));
  const visibleAuditItems = recommend(filterNavigationItems(auditNavItems, permissions));
  const visibleInspectionItems = recommend(filterNavigationItems(
    inspectionNavItems,
    permissions,
  ));
  const visibleResearchItems = recommend(filterNavigationItems(
    researchNavItems,
    permissions,
  ));
  const permittedGovernanceItems = filterNavigationItems(
    complianceNavItems,
    permissions,
  );

  const mobileSections = [
    { label: "Platform", items: platformItems },
    { label: "EHS Management", items: visibleEhsItems },
    { label: "Audit Management 2.0", items: visibleAuditItems },
    { label: "Research & Analytics", items: visibleResearchItems },
    { label: "Inspections", items: visibleInspectionItems },
    {
      label: "Governance",
      items: recommend(demoMode
        ? permittedGovernanceItems.filter(
            (item) => item.href !== "/notifications",
          )
        : permittedGovernanceItems.filter(
            (item) =>
              item.href !== "/notifications" ||
              entitlements.IN_APP_NOTIFICATIONS,
          )),
    },
  ].filter((section) => section.items.length > 0);

  async function logout() {
    "use server";

    await signOut({
      redirectTo: "/login",
    });
  }

  return (
    <header className="relative z-40 flex min-h-16 shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-slate-950/95 px-3 py-2.5 backdrop-blur-xl sm:min-h-20 sm:gap-3 sm:px-6 sm:py-3 lg:pl-20 lg:pr-8">
      <div className="min-w-0">
        <p className="hidden text-sm text-cyan-300 sm:block">AI Command Center</p>
        <h2 className="truncate text-sm font-semibold sm:text-xl">Enterprise Risk Overview</h2>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 lg:gap-3">
        <MobileNavigationMenu>
          {mobileSections.map((section) => (
            <div key={section.label} className="mb-4 last:mb-0">
              <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {section.label}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <MobileLink
                      key={item.href}
                      href={item.href}
                      matchHrefs={section.items.map(
                        (candidate) => candidate.href,
                      )}
                      label={item.label}
                      icon={<Icon size={17} />}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </MobileNavigationMenu>
        <form
          action="/search"
          method="get"
          role="search"
          className="hidden min-w-64 items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 transition focus-within:border-cyan-400/40 focus-within:bg-white/[.07] md:flex xl:min-w-80"
        >
          <Search size={18} className="text-slate-400" />
          <input
            type="search"
            name="q"
            required
            minLength={2}
            maxLength={100}
            aria-label="Search Senzilytics"
            placeholder="Search incidents, audits, risks..."
            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
          />
          <button type="submit" className="sr-only">
            Search
          </button>
        </form>
        <Link
          href="/search"
          className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-300 hover:bg-white/10 sm:rounded-2xl sm:p-3 md:hidden"
          title="Search Senzilytics"
        >
          <Search size={20} />
        </Link>

        {entitlements.AI && permissions.includes(PermissionKey.USE_AI) && (
          <Link
            href="/intelligence"
            className="hidden rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-2.5 text-cyan-300 hover:bg-cyan-400/20 sm:block sm:rounded-2xl sm:p-3"
            title="EHS Intelligence Workspace"
          >
            <Sparkles size={20} />
          </Link>
        )}

        {!demoMode && entitlements.IN_APP_NOTIFICATIONS && (
          <Link
            href="/tasks"
            className="relative rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-300 hover:bg-white/10 sm:rounded-2xl sm:p-3"
            title="My Tasks"
          >
            <ClipboardList size={20} />

            {taskCount > 0 && (
              <span
                className={`absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-bold text-slate-950 ${
                  overdueTaskCount > 0 ? "bg-red-400" : "bg-orange-400"
                }`}
              >
                {overdueTaskCount > 0 ? overdueTaskCount : taskCount}
              </span>
            )}
          </Link>
        )}

        {!demoMode && entitlements.IN_APP_NOTIFICATIONS && (
          <Link
            href="/notifications"
            className="relative rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-300 hover:bg-white/10 sm:rounded-2xl sm:p-3"
            title="Notifications"
          >
            <Bell size={20} />

            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-cyan-400 px-1 text-xs font-bold text-slate-950">
                {unreadCount}
              </span>
            )}
          </Link>
        )}

        <Link
          href="/profile"
          className="group flex items-center gap-3 rounded-2xl border border-transparent p-2 text-right transition hover:border-cyan-400/20 hover:bg-cyan-400/[.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 md:px-3"
          title="Open my profile"
        >
          <span className="grid size-9 place-items-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-200 transition group-hover:bg-cyan-400/15">
            <UserRound size={18} />
          </span>
          <span className="hidden md:block">
            <span className="block text-sm font-medium text-white group-hover:text-cyan-100">
              {currentUser?.name}
            </span>
            <span className="block text-xs text-slate-400">
              {currentUser?.role?.replaceAll("_", " ")}
            </span>
          </span>
        </Link>

        <form action={logout}>
          <button
            type="submit"
            className="rounded-xl border border-red-400/20 bg-red-400/10 p-2.5 text-red-300 transition hover:bg-red-400/20 sm:rounded-2xl sm:p-3"
            title="Logout"
          >
            <LogOut size={20} />
          </button>
        </form>
      </div>
    </header>
  );
}

function MobileLink({
  href,
  matchHrefs,
  label,
  icon,
}: {
  href: string;
  matchHrefs: readonly string[];
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <ActiveNavigationLink
      href={href}
      matchHrefs={matchHrefs}
      className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition"
      activeClassName="bg-cyan-300/15 font-semibold text-cyan-100 ring-1 ring-cyan-300/20"
      inactiveClassName="text-slate-300 hover:bg-cyan-400/10 hover:text-cyan-200"
    >
      {icon}
      {label}
    </ActiveNavigationLink>
  );
}
