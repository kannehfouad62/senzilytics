import { PermissionKey } from "@prisma/client";
import {
  ArrowLeft,
  BarChart3,
  CalendarClock,
  Download,
  FileCheck2,
  MessageSquareCheck,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { AuditServiceAnalyticsCharts } from "@/features/audits/audit-service-analytics-charts";
import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { getAuditServiceAnalytics } from "@/modules/audit/audit-service-analytics.service";
import { requireAuditServicesEntitlement } from "@/modules/audit/audit-services-entitlement";

export const dynamic = "force-dynamic";

export default async function AuditServiceAnalyticsPage() {
  await requirePermission(PermissionKey.VIEW_AUDITS);
  const { organizationId } = await getCurrentUserTenant();
  await requireAuditServicesEntitlement(organizationId);
  const data = await getAuditServiceAnalytics(organizationId);
  const acceptance =
    data.summary.clientAcceptanceRate === null
      ? "—"
      : `${data.summary.clientAcceptanceRate}%`;
  return (
    <div>
      <Link
        href="/audit-services"
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
      >
        <ArrowLeft size={16} /> Audit services
      </Link>
      <header className="mt-6 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="flex items-center gap-2 text-sm text-cyan-300">
            <BarChart3 size={16} /> Audit service intelligence
          </p>
          <h1 className="mt-2 text-4xl font-bold">
            Assurance Delivery Analytics
          </h1>
          <p className="mt-2 max-w-3xl text-slate-400">
            Decision-ready visibility across engagements, planning governance,
            external coordination, remediation, reports, and client acceptance.
            Updated {data.generatedAt.toLocaleString()}.
          </p>
        </div>
        <a
          href="/api/audit-services/analytics/export"
          className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 px-4 py-2 text-sm text-cyan-200"
        >
          <Download size={16} /> Export governance evidence
        </a>
      </header>
      <section className="my-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Open engagements"
          value={data.summary.openEngagements}
          note={`${data.summary.overdueEngagements} overdue · ${data.summary.highRiskEngagements} high/critical risk`}
          icon={<ShieldAlert />}
          tone={data.summary.overdueEngagements ? "danger" : "neutral"}
        />
        <Metric
          label="Planning exceptions"
          value={data.summary.planningExceptions}
          note={`${data.summary.onTimeCompletionRate}% on-time completion`}
          icon={<CalendarClock />}
          tone={data.summary.planningExceptions ? "warning" : "good"}
        />
        <Metric
          label="Client decision queue"
          value={data.summary.pendingClientDecisions}
          note={`${acceptance} acknowledged or approved`}
          icon={<MessageSquareCheck />}
          tone={data.summary.pendingClientDecisions ? "warning" : "good"}
        />
        <Metric
          label="Deliverable review queue"
          value={data.summary.deliverableReviewQueue}
          note={`${data.summary.releasedDeliverables} released · ${data.summary.recentDownloads} recent downloads`}
          icon={<FileCheck2 />}
          tone={data.summary.deliverableReviewQueue ? "warning" : "good"}
        />
        <Metric
          label="Open information requests"
          value={data.summary.openRequests}
          note={`${data.summary.overdueRequests} overdue`}
          icon={<CalendarClock />}
          tone={data.summary.overdueRequests ? "danger" : "neutral"}
        />
        <Metric
          label="Active secure links"
          value={data.summary.activeExternalAccesses}
          note="Expiring, passcode-protected access"
          icon={<ShieldAlert />}
          tone="neutral"
        />
        <Metric
          label="Finding response review"
          value={data.summary.pendingFindingResponses}
          note="Pending or changes requested"
          icon={<MessageSquareCheck />}
          tone={data.summary.pendingFindingResponses ? "warning" : "good"}
        />
        <Metric
          label="External downloads"
          value={data.summary.externalDownloads}
          note="Within the reporting window"
          icon={<Download />}
          tone="neutral"
        />
      </section>
      <AuditServiceAnalyticsCharts data={data} />
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold">Client portfolio exposure</h2>
          <div className="mt-4 space-y-3">
            {data.clients.length ? (
              data.clients.map((client) => (
                <Link
                  key={client.id}
                  href={`/audit-services/clients/${client.id}`}
                  className="flex items-center justify-between rounded-xl bg-slate-950/40 p-3 text-sm"
                >
                  <span>{client.name}</span>
                  <span>
                    {client.open} open ·{" "}
                    <b
                      className={
                        client.overdue ? "text-red-300" : "text-emerald-300"
                      }
                    >
                      {client.overdue} overdue
                    </b>
                  </span>
                </Link>
              ))
            ) : (
              <p className="text-sm text-slate-500">
                No external client engagements recorded.
              </p>
            )}
          </div>
        </section>
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold">Management attention</h2>
          <div className="mt-4 space-y-3">
            {data.attention.length ? (
              data.attention.map((item) => (
                <Link
                  key={item.id}
                  href={`/audit-services/engagements/${item.id}`}
                  className="block rounded-xl bg-red-400/[.05] p-3 text-sm"
                >
                  <b>{item.reference}</b> · {item.title}
                  <p className="mt-1 text-xs text-slate-500">
                    {item.clientName} · due {item.dueDate.toLocaleDateString()}
                  </p>
                </Link>
              ))
            ) : (
              <p className="text-sm text-emerald-300">
                No overdue engagements require attention.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  note,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  note: string;
  icon: React.ReactNode;
  tone: "danger" | "warning" | "good" | "neutral";
}) {
  const colors = {
    danger: "text-red-300",
    warning: "text-amber-300",
    good: "text-emerald-300",
    neutral: "text-cyan-300",
  };
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="flex justify-between text-sm text-slate-400">
        <span>{label}</span>
        <span className={colors[tone]}>{icon}</span>
      </div>
      <p className={`mt-3 text-3xl font-bold ${colors[tone]}`}>{value}</p>
      <p className="mt-2 text-xs text-slate-500">{note}</p>
    </div>
  );
}
