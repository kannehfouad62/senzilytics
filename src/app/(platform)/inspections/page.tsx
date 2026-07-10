import { prisma } from "@/lib/prisma";
import { ShieldCheck } from "lucide-react";
import { getCurrentUserTenant } from "@/lib/tenant";

function riskClass(value: string) {
  switch (value) {
    case "LOW":
      return "bg-green-400/10 text-green-300 border-green-400/20";
    case "MEDIUM":
      return "bg-orange-400/10 text-orange-300 border-orange-400/20";
    case "HIGH":
      return "bg-red-400/10 text-red-300 border-red-400/20";
    case "CRITICAL":
      return "bg-purple-400/10 text-purple-300 border-purple-400/20";
    default:
      return "bg-slate-400/10 text-slate-300 border-slate-400/20";
  }
}

export default async function InspectionsPage() {
  const { organizationId } = await getCurrentUserTenant();

const inspections = await prisma.inspection.findMany({
  where: {
    site: {
      organizationId,
    },
  },
  orderBy: {
    scheduledAt: "asc",
  },
  include: {
    site: true,
    findings: true,
  },
});

  return (
    <div>
      <div className="mb-8">
        <p className="flex items-center gap-2 text-sm text-cyan-300">
          <ShieldCheck size={16} />
          Inspection Management
        </p>

        <h1 className="mt-2 text-4xl font-bold tracking-tight">
          Inspections
        </h1>

        <p className="mt-2 max-w-2xl text-slate-400">
          Track workplace inspections, findings, risk levels, and completion
          status across operational areas.
        </p>
      </div>

      <div className="grid gap-6">
        {inspections.map((inspection) => (
          <div
            key={inspection.id}
            className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl"
          >
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold">{inspection.title}</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Area: {inspection.area || "Not specified"}
                </p>
              </div>

              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300">
                {inspection.status.replaceAll("_", " ")}
              </span>
            </div>

            <div className="mb-6 grid gap-4 md:grid-cols-3">
              <InfoCard label="Site" value={inspection.site.name} />
              <InfoCard
                label="Scheduled"
                value={
                  inspection.scheduledAt
                    ? inspection.scheduledAt.toLocaleDateString()
                    : "Not scheduled"
                }
              />
              <InfoCard
                label="Completed"
                value={
                  inspection.completedAt
                    ? inspection.completedAt.toLocaleDateString()
                    : "Not completed"
                }
              />
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-300">
                Findings
              </h3>

              <div className="space-y-3">
                {inspection.findings.map((finding) => (
                  <div
                    key={finding.id}
                    className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"
                  >
                    <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                      <h4 className="font-medium">{finding.title}</h4>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs ${riskClass(
                          finding.riskLevel
                        )}`}
                      >
                        {finding.riskLevel}
                      </span>
                    </div>

                    <p className="text-sm text-slate-400">
                      {finding.description || "No description provided."}
                    </p>

                    <p className="mt-3 text-xs text-cyan-300">
                      Status: {finding.status.replaceAll("_", " ")}
                    </p>
                  </div>
                ))}

                {inspection.findings.length === 0 && (
                  <p className="text-sm text-slate-500">
                    No findings recorded.
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}

        {inspections.length === 0 && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-slate-400">
            No inspections found.
          </div>
        )}
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-medium text-slate-100">{value}</p>
    </div>
  );
}