import { PermissionKey } from "@prisma/client";
import { getCurrentUserPermissions } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  buildEmployeePerformanceCsv,
  getEmployeePerformanceWorkspace,
  parseEmployeePerformanceFilters,
} from "@/modules/employee-performance/employee-performance.service";

export async function GET(request: Request) {
  const [{ organizationId, user }, permissions] = await Promise.all([
    getCurrentUserTenant(),
    getCurrentUserPermissions(),
  ]);
  const canViewTeam = permissions.includes(PermissionKey.VIEW_EMPLOYEE_PERFORMANCE);
  const canViewOwn = permissions.includes(PermissionKey.VIEW_OWN_EMPLOYEE_PERFORMANCE);
  if (!canViewTeam && !canViewOwn) return new Response("Forbidden", { status: 403 });
  const url = new URL(request.url);
  const filters = parseEmployeePerformanceFilters({
    days: url.searchParams.get("days") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
    siteId: url.searchParams.get("siteId") ?? undefined,
    departmentId: url.searchParams.get("departmentId") ?? undefined,
  });
  const workspace = await getEmployeePerformanceWorkspace({
    organizationId,
    viewerId: user.id,
    canViewTeam,
    ...filters,
  });
  return new Response(buildEmployeePerformanceCsv(workspace), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="senzilytics-employee-performance-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
