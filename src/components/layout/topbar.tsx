import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Bell, Building2, ClipboardList, LogOut, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import {
  auditNavItems,
  complianceNavItems,
  ehsNavItems,
  inspectionNavItems,
  primaryNavItems,
  type NavigationItem,
} from "./sidebar";
import { isApprovedPlatformAdministrator } from "@/lib/platform-admin";
import { MobileNavigationMenu } from "./mobile-navigation-menu";
import { PermissionKey, UserRole } from "@prisma/client";
import { planEntitlements } from "@/lib/subscription";
import { getCurrentUserPermissions } from "@/lib/permissions";
import { filterNavigationItems } from "@/core/permissions/navigation-access";

export const dynamic = "force-dynamic";

export async function Topbar() {
  const [session, permissions] = await Promise.all([auth(), getCurrentUserPermissions()]);

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
          organization: { select: { subscriptionPlan: true } },
        },
      })
    : null;

  const entitlements = currentUser?.organization ? planEntitlements[currentUser.organization.subscriptionPlan] : planEntitlements.PREMIUM;
  const unreadCount = currentUser && entitlements.IN_APP_NOTIFICATIONS
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

  const visiblePrimaryItems = filterNavigationItems(primaryNavItems, permissions).filter(item => item.href !== "/field-collection" || entitlements.OFFLINE_COLLECTION);
  const platformItems: NavigationItem[] =
    currentUser && isApprovedPlatformAdministrator(currentUser)
      ? [
          ...visiblePrimaryItems,
          {
            label: "Tenant Provisioning",
            href: "/platform/tenants",
            icon: Building2,
          },
        ]
      : currentUser?.role === UserRole.DEMO_VIEWER
        ? visiblePrimaryItems.filter((item) => item.href === "/dashboard")
        : visiblePrimaryItems;

  const demoMode = currentUser?.role === UserRole.DEMO_VIEWER;
  const visibleEhsItems = filterNavigationItems(ehsNavItems, permissions);
  const visibleAuditItems = filterNavigationItems(auditNavItems, permissions);
  const visibleInspectionItems = filterNavigationItems(inspectionNavItems, permissions);
  const permittedGovernanceItems = filterNavigationItems(complianceNavItems, permissions);

  const mobileSections = [
    { label: "Platform", items: platformItems },
    { label: "EHS Management", items: visibleEhsItems },
    { label: "Audit Management 2.0", items: visibleAuditItems },
    { label: "Inspections", items: visibleInspectionItems },
    { label: "Governance", items: demoMode ? permittedGovernanceItems.filter((item) => item.href !== "/notifications") : permittedGovernanceItems.filter(item => item.href !== "/notifications" || entitlements.IN_APP_NOTIFICATIONS) },
  ].filter((section) => section.items.length > 0);

  async function logout() {
    "use server";

    await signOut({
      redirectTo: "/login",
    });
  }

  return (
    <header className="relative z-40 flex min-h-20 shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-slate-950/90 px-4 py-3 backdrop-blur-xl sm:px-8">
      <div>
        <p className="text-sm text-cyan-300">AI Command Center</p>
        <h2 className="text-xl font-semibold">Enterprise Risk Overview</h2>
      </div>

      <div className="flex items-center gap-4">
        <MobileNavigationMenu>
            {mobileSections.map((section) => (
              <div key={section.label} className="mb-4 last:mb-0">
                <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{section.label}</p>
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    return <MobileLink key={item.href} href={item.href} label={item.label} icon={<Icon size={17} />} />;
                  })}
                </div>
              </div>
            ))}
        </MobileNavigationMenu>
        <form action="/search" method="get" role="search" className="hidden min-w-64 items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 transition focus-within:border-cyan-400/40 focus-within:bg-white/[.07] md:flex xl:min-w-80">
          <Search size={18} className="text-slate-400" />
          <input type="search" name="q" required minLength={2} maxLength={100} aria-label="Search Senzilytics" placeholder="Search incidents, audits, risks..." className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500" />
          <button type="submit" className="sr-only">Search</button>
        </form>
        <Link href="/search" className="rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-300 hover:bg-white/10 md:hidden" title="Search Senzilytics"><Search size={20}/></Link>

        {entitlements.AI && permissions.includes(PermissionKey.USE_AI) && <Link href="/intelligence" className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-300 hover:bg-cyan-400/20" title="EHS Intelligence Workspace">
          <Sparkles size={20} />
        </Link>}

        {!demoMode && entitlements.IN_APP_NOTIFICATIONS && <Link
          href="/tasks"
          className="relative rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-300 hover:bg-white/10"
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
        </Link>}

        {!demoMode && entitlements.IN_APP_NOTIFICATIONS && <Link
          href="/notifications"
          className="relative rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-300 hover:bg-white/10"
          title="Notifications"
        >
          <Bell size={20} />

          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-cyan-400 px-1 text-xs font-bold text-slate-950">
              {unreadCount}
            </span>
          )}
        </Link>}

        <div className="hidden text-right md:block">
          <p className="text-sm font-medium text-white">{currentUser?.name}</p>
          <p className="text-xs text-slate-400">
            {currentUser?.role?.replaceAll("_", " ")}
          </p>
        </div>

        <form action={logout}>
          <button
            type="submit"
            className="rounded-2xl border border-red-400/20 bg-red-400/10 p-3 text-red-300 transition hover:bg-red-400/20"
            title="Logout"
          >
            <LogOut size={20} />
          </button>
        </form>
      </div>
    </header>
  );
}

function MobileLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return <Link href={href} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-300 transition hover:bg-cyan-400/10 hover:text-cyan-200">{icon}{label}</Link>;
}
