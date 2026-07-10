import {
  AlertTriangle,
  ClipboardCheck,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Status, RiskLevel } from "@prisma/client";
import { getCurrentUserTenant } from "@/lib/tenant";

export default async function DashboardPage() {
  const { organizationId } = await getCurrentUserTenant();

  const siteIds = await prisma.site.findMany({
    where: {
      organizationId,
    },
    select: {
      id: true,
    },
  });

  const siteIdList = siteIds.map((site) => site.id);

  const [openIncidents, openActions, complianceItems, highRiskIncidents] =
    await Promise.all([
      prisma.incident.count({
        where: {
          siteId: {
            in: siteIdList,
          },
          status: {
            not: Status.CLOSED,
          },
        },
      }),

      prisma.correctiveAction.count({
        where: {
          incident: {
            siteId: {
              in: siteIdList,
            },
          },
          status: {
            not: Status.CLOSED,
          },
        },
      }),

      prisma.complianceItem.count({
        where: {
          siteId: {
            in: siteIdList,
          },
        },
      }),

      prisma.incident.count({
        where: {
          siteId: {
            in: siteIdList,
          },
          riskLevel: {
            in: [RiskLevel.HIGH, RiskLevel.CRITICAL],
          },
        },
      }),
    ]);

  const stats = [
    {
      title: "Open Incidents",
      value: openIncidents.toString(),
      note: "Tenant-safe",
      icon: AlertTriangle,
    },
    {
      title: "Corrective Actions",
      value: openActions.toString(),
      note: "Open / active",
      icon: ClipboardCheck,
    },
    {
      title: "Compliance Items",
      value: complianceItems.toString(),
      note: "Tracked obligations",
      icon: ShieldCheck,
    },
    {
      title: "High Risk Items",
      value: highRiskIncidents.toString(),
      note: "High + critical incidents",
      icon: TrendingUp,
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <p className="text-sm text-cyan-300">Welcome back</p>
        <h1 className="text-4xl font-bold tracking-tight">
          Senzilytics Dashboard
        </h1>
        <p className="mt-2 max-w-2xl text-slate-400">
          Monitor incidents, compliance, corrective actions, audits, and risk
          intelligence across your organization.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.title}
              className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl"
            >
              <div className="mb-5 flex items-center justify-between">
                <div className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-300">
                  <Icon size={24} />
                </div>
                <span className="text-xs text-slate-400">{item.note}</span>
              </div>

              <p className="text-sm text-slate-400">{item.title}</p>
              <h2 className="mt-2 text-3xl font-bold">{item.value}</h2>
            </div>
          );
        })}
      </div>
    </div>
  );
}