import { logActivity } from "@/core/activity-log/activity-log.service";
import {
  buildExecutiveDashboardCsv,
  getExecutiveCommandCenter,
  parseExecutiveDashboardFilters,
} from "@/core/analytics/executive-command-center.service";
import { getCurrentUserPermissions, requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { ActivityAction, PermissionKey } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requirePermission(PermissionKey.VIEW_DASHBOARD);
  const [{ organizationId, user }, permissions] = await Promise.all([
    getCurrentUserTenant(),
    getCurrentUserPermissions(),
  ]);
  const url = new URL(request.url);
  const filters = parseExecutiveDashboardFilters({
    days: url.searchParams.get("days") ?? undefined,
    siteId: url.searchParams.get("siteId") ?? undefined,
    departmentId: url.searchParams.get("departmentId") ?? undefined,
  });

  try {
    const dashboard = await getExecutiveCommandCenter({
      organizationId,
      userId: user.id,
      permissions,
      filters,
    });
    const csv = buildExecutiveDashboardCsv(dashboard);
    await logActivity({
      organizationId,
      userId: user.id,
      action: ActivityAction.SYSTEM,
      entityType: "GlobalExecutiveDashboard",
      entityId: null,
      title: "Global executive dashboard exported",
      description: `An executive dashboard export was generated for ${dashboard.scope.label}.`,
      metadata: {
        days: dashboard.filters.days,
        siteId: dashboard.scope.siteId,
        departmentId: dashboard.scope.departmentId,
        authorizedModuleCount: dashboard.portfolio.modules.length,
      },
    });

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="senzilytics-executive-dashboard-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Global executive dashboard export failed:", error);
    return new Response("The executive dashboard export could not be generated.", {
      status: 400,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }
}
