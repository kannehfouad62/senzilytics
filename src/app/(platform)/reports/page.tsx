import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { requirePermission } from "@/lib/permissions";
import { PermissionKey } from "@prisma/client";
import {
  AlertTriangle,
  BarChart3,
  CalendarCheck,
  ClipboardCheck,
  GraduationCap,
  SearchCheck,
  ShieldCheck,
} from "lucide-react";
import { RiskLevel, Status } from "@prisma/client";

export default async function ReportsPage() {
  await requirePermission(PermissionKey.VIEW_REPORTS);
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
const [
  totalIncidents,
  highRiskIncidents,
  openActions,
  overdueActions,
  audits,
  inspections,
  complianceItems,
  trainingRecords,
] = await Promise.all([
  prisma.incident.count({
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

  prisma.correctiveAction.count({
    where: {
      incident: {
        siteId: {
          in: siteIdList,
        },
      },
      OR: [
        { status: Status.OVERDUE },
        {
          dueDate: {
            lt: new Date(),
          },
        },
      ],
    },
  }),

  prisma.audit.count({
    where: {
      siteId: {
        in: siteIdList,
      },
    },
  }),

  prisma.inspection.count({
    where: {
      siteId: {
        in: siteIdList,
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

  prisma.trainingRecord.count({
    where: {
      user: {
        organizationId,
      },
    },
  }),
]);

  const cards = [
    {
      title: "Total Incidents",
      value: totalIncidents,
      note: "All safety events",
      icon: AlertTriangle,
    },
    {
      title: "High Risk Incidents",
      value: highRiskIncidents,
      note: "High + critical risk",
      icon: BarChart3,
    },
    {
      title: "Open Actions",
      value: openActions,
      note: "Active CAPA workload",
      icon: ClipboardCheck,
    },
    {
      title: "Overdue Actions",
      value: overdueActions,
      note: "Needs attention",
      icon: CalendarCheck,
    },
    {
      title: "Audits",
      value: audits,
      note: "Audit records",
      icon: SearchCheck,
    },
    {
      title: "Inspections",
      value: inspections,
      note: "Inspection records",
      icon: ShieldCheck,
    },
    {
      title: "Compliance Items",
      value: complianceItems,
      note: "Tracked obligations",
      icon: CalendarCheck,
    },
    {
      title: "Training Records",
      value: trainingRecords,
      note: "Employee learning",
      icon: GraduationCap,
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <p className="flex items-center gap-2 text-sm text-cyan-300">
          <BarChart3 size={16} />
          Executive Intelligence
        </p>

        <h1 className="mt-2 text-4xl font-bold tracking-tight">Reports</h1>

        <p className="mt-2 max-w-2xl text-slate-400">
          View enterprise EHS performance, risk exposure, corrective action
          workload, compliance obligations, audits, inspections, and training.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <div
              key={card.title}
              className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl"
            >
              <div className="mb-5 flex items-center justify-between">
                <div className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-300">
                  <Icon size={24} />
                </div>

                <span className="text-xs text-slate-400">{card.note}</span>
              </div>

              <p className="text-sm text-slate-400">{card.title}</p>
              <h2 className="mt-2 text-3xl font-bold">{card.value}</h2>
            </div>
          );
        })}
      </div>

      <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
        <h2 className="text-2xl font-semibold">AI Insights Preview</h2>
        <p className="mt-3 max-w-3xl text-slate-400">
          Later, this section will summarize trends, identify recurring root
          causes, detect overdue risk patterns, and recommend preventive actions
          using the Senzilytics AI engine.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <InsightCard
            title="Risk Signal"
            value={`${highRiskIncidents} high-risk incident(s) detected`}
          />
          <InsightCard
            title="CAPA Load"
            value={`${openActions} open corrective action(s) need tracking`}
          />
          <InsightCard
            title="Overdue Exposure"
            value={`${overdueActions} overdue action(s) may require escalation`}
          />
        </div>
      </div>
    </div>
  );
}

function InsightCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-5">
      <p className="text-sm text-cyan-300">{title}</p>
      <p className="mt-2 text-slate-300">{value}</p>
    </div>
  );
}