import { PermissionKey } from "@prisma/client";
import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { getAuditServiceAnalytics } from "@/modules/audit/audit-service-analytics.service";
import { requireAuditServicesEntitlement } from "@/modules/audit/audit-services-entitlement";

const cell = (value: string | number) => {
  const raw = String(value);
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
};

export async function GET() {
  await requirePermission(PermissionKey.VIEW_AUDITS);
  const { organizationId } = await getCurrentUserTenant();
  await requireAuditServicesEntitlement(organizationId);
  const data = await getAuditServiceAnalytics(organizationId);
  const rows: Array<[string, string | number]> = [
    ["Generated at", data.generatedAt.toISOString()],
    ["Total engagements", data.summary.totalEngagements],
    ["Open engagements", data.summary.openEngagements],
    ["External engagements", data.summary.externalEngagements],
    ["Overdue engagements", data.summary.overdueEngagements],
    ["High or critical risk engagements", data.summary.highRiskEngagements],
    ["Planning exceptions", data.summary.planningExceptions],
    ["On-time completion rate", `${data.summary.onTimeCompletionRate}%`],
    ["Open information requests", data.summary.openRequests],
    ["Overdue information requests", data.summary.overdueRequests],
    ["Active external access links", data.summary.activeExternalAccesses],
    ["Pending client decisions", data.summary.pendingClientDecisions],
    [
      "Client acceptance rate",
      data.summary.clientAcceptanceRate === null
        ? "No decisions"
        : `${data.summary.clientAcceptanceRate}%`,
    ],
    ["Pending finding response reviews", data.summary.pendingFindingResponses],
    ["Deliverables under review", data.summary.deliverableReviewQueue],
    ["Released deliverables", data.summary.releasedDeliverables],
    ["Recent downloads", data.summary.recentDownloads],
    ["External downloads", data.summary.externalDownloads],
  ];
  const csv = [
    "Metric,Value",
    ...rows.map((row) => row.map(cell).join(",")),
  ].join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        "attachment; filename=governed-audit-service-analytics.csv",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
