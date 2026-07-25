import { logActivity } from "@/core/activity-log/activity-log.service";
import {
  buildWorkflowProcessCsv,
  getWorkflowProcessIntelligence,
  parseWorkflowProcessFilters,
} from "@/core/workflow/workflow-process-intelligence.service";
import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { ActivityAction, PermissionKey } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requirePermission(PermissionKey.MANAGE_WORKFLOWS);
  const { organizationId, user } = await getCurrentUserTenant();
  const url = new URL(request.url);
  const filters = parseWorkflowProcessFilters({
    days: url.searchParams.get("days") ?? undefined,
    templateId: url.searchParams.get("templateId") ?? undefined,
  });

  try {
    const intelligence = await getWorkflowProcessIntelligence({
      organizationId,
      filters,
    });
    const csv = buildWorkflowProcessCsv(intelligence);
    await logActivity({
      organizationId,
      userId: user.id,
      action: ActivityAction.SYSTEM,
      entityType: "WorkflowAnalytics",
      entityId: filters.templateId ?? "all",
      title: "Workflow analytics exported",
      description: `A ${filters.days}-day workflow process-intelligence CSV was exported.`,
      metadata: {
        days: filters.days,
        templateId: filters.templateId,
      },
    });
    const date = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="workflow-process-intelligence-${date}.csv"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Workflow process-intelligence export failed:", error);
    return new Response(
      "The workflow process-intelligence export could not be generated.",
      {
        status: 400,
        headers: {
          "Cache-Control": "private, no-store",
          "Content-Type": "text/plain; charset=utf-8",
        },
      },
    );
  }
}
