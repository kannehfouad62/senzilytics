"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type SitePerformancePoint = {
  siteId: string;
  siteName: string;
  incidents: number;
  openIncidents: number;
  highRiskIncidents: number;
};

type ActionAgingPoint = {
  bucket: string;
  count: number;
};

type OperationalDashboardChartsProps = {
  sitePerformance: SitePerformancePoint[];
  actionAging: ActionAgingPoint[];
};

export function OperationalDashboardCharts({
  sitePerformance,
  actionAging,
}: OperationalDashboardChartsProps) {
  const visibleSites = sitePerformance.slice(0, 10);

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
        <div className="mb-6">
          <p className="text-sm text-cyan-300">
            Site Performance
          </p>

          <h2 className="mt-1 text-2xl font-semibold text-white">
            Incidents by Site
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            Total, open, and high-risk incidents across
            the highest-volume sites.
          </p>
        </div>

        <div className="h-[380px]">
          {visibleSites.length > 0 ? (
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <BarChart
                data={visibleSites}
                layout="vertical"
                margin={{
                  top: 10,
                  right: 20,
                  bottom: 10,
                  left: 20,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(148,163,184,0.15)"
                  horizontal={false}
                />

                <XAxis
                  type="number"
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "#94a3b8",
                    fontSize: 12,
                  }}
                />

                <YAxis
                  type="category"
                  dataKey="siteName"
                  width={130}
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "#cbd5e1",
                    fontSize: 12,
                  }}
                />

                <Tooltip
                  contentStyle={{
                    background: "#020617",
                    border:
                      "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "16px",
                  }}
                  labelStyle={{
                    color: "#e2e8f0",
                  }}
                />

                <Legend
                  wrapperStyle={{
                    color: "#cbd5e1",
                    fontSize: "12px",
                  }}
                />

                <Bar
                  dataKey="incidents"
                  name="Total"
                  fill="#22d3ee"
                  radius={[0, 6, 6, 0]}
                />

                <Bar
                  dataKey="openIncidents"
                  name="Open"
                  fill="#8b5cf6"
                  radius={[0, 6, 6, 0]}
                />

                <Bar
                  dataKey="highRiskIncidents"
                  name="High Risk"
                  fill="#f97316"
                  radius={[0, 6, 6, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-slate-400">
              No site incident data is available.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
        <div className="mb-6">
          <p className="text-sm text-cyan-300">
            Corrective-Action Aging
          </p>

          <h2 className="mt-1 text-2xl font-semibold text-white">
            Open Actions by Age
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            How long unresolved corrective actions have
            remained open.
          </p>
        </div>

        <div className="h-[380px]">
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <BarChart
              data={actionAging}
              margin={{
                top: 10,
                right: 20,
                bottom: 10,
                left: 0,
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(148,163,184,0.15)"
              />

              <XAxis
                dataKey="bucket"
                axisLine={false}
                tickLine={false}
                tick={{
                  fill: "#94a3b8",
                  fontSize: 12,
                }}
              />

              <YAxis
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                tick={{
                  fill: "#94a3b8",
                  fontSize: 12,
                }}
              />

              <Tooltip
                contentStyle={{
                  background: "#020617",
                  border:
                    "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "16px",
                }}
                labelStyle={{
                  color: "#e2e8f0",
                }}
              />

              <Bar
                dataKey="count"
                name="Open Actions"
                fill="#f97316"
                radius={[7, 7, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}