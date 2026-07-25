import { logActivity } from "@/core/activity-log/activity-log.service";
import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  buildPerformanceCsv,
  getPerformanceWorkspace,
  parsePerformanceFilters,
} from "@/modules/performance/performance-scorecard.service";
import { ActivityAction, PermissionKey } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requirePermission(PermissionKey.VIEW_PERFORMANCE_SCORECARDS);
  const { organizationId, user } = await getCurrentUserTenant();
  const url = new URL(request.url);
  const filters = parsePerformanceFilters({
    days: url.searchParams.get("days") ?? undefined,
    siteId: url.searchParams.get("siteId") ?? undefined,
    departmentId: url.searchParams.get("departmentId") ?? undefined,
    indicatorId: url.searchParams.get("indicatorId") ?? undefined,
  });

  try {
    const workspace = await getPerformanceWorkspace({
      organizationId,
      filters,
    });
    const csv = buildPerformanceCsv({
      scopeLabel: workspace.scope.label,
      from: filters.from,
      to: filters.to,
      rows: workspace.rows,
    });
    await logActivity({
      organizationId,
      userId: user.id,
      action: ActivityAction.SYSTEM,
      entityType: "PerformanceScorecard",
      entityId: workspace.scope.scopeKey,
      title: "Performance scorecard exported",
      description: `A ${filters.days}-day scorecard was exported for ${workspace.scope.label}.`,
      metadata: {
        days: filters.days,
        scopeKey: workspace.scope.scopeKey,
        indicatorCount: workspace.rows.length,
      },
    });
    const date = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="senzilytics-performance-scorecard-${date}.csv"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Performance scorecard export failed:", error);
    return new Response("The performance scorecard export could not be generated.", {
      status: 400,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }
}
