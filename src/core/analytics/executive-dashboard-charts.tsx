"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type MonthlyTrendPoint = {
  month: string;
  incidents: number;
  documents: number;
};

type RiskDistributionPoint = {
  riskLevel: string;
  count: number;
};

type ExecutiveDashboardChartsProps = {
  monthlyTrend: MonthlyTrendPoint[];
  riskDistribution: RiskDistributionPoint[];
};

const RISK_COLORS: Record<string, string> = {
  LOW: "#22c55e",
  MEDIUM: "#eab308",
  HIGH: "#f97316",
  CRITICAL: "#ef4444",
};

export function ExecutiveDashboardCharts({
  monthlyTrend,
  riskDistribution,
}: ExecutiveDashboardChartsProps) {
  const visibleRiskData = riskDistribution.filter(
    (item) => item.count > 0
  );

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
        <div className="mb-6">
          <p className="text-sm text-cyan-300">
            Twelve-Month Trend
          </p>

          <h2 className="mt-1 text-2xl font-semibold text-white">
            Incidents and Document Activity
          </h2>
        </div>

        <div className="h-[340px]">
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <BarChart data={monthlyTrend}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(148,163,184,0.15)"
              />

              <XAxis
                dataKey="month"
                tick={{
                  fill: "#94a3b8",
                  fontSize: 12,
                }}
                axisLine={false}
                tickLine={false}
              />

              <YAxis
                allowDecimals={false}
                tick={{
                  fill: "#94a3b8",
                  fontSize: 12,
                }}
                axisLine={false}
                tickLine={false}
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
                dataKey="incidents"
                name="Incidents"
                fill="#22d3ee"
                radius={[6, 6, 0, 0]}
              />

              <Bar
                dataKey="documents"
                name="Documents"
                fill="#8b5cf6"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
        <div className="mb-6">
          <p className="text-sm text-cyan-300">
            Risk Exposure
          </p>

          <h2 className="mt-1 text-2xl font-semibold text-white">
            Incident Risk Distribution
          </h2>
        </div>

        <div className="h-[340px]">
          {visibleRiskData.length > 0 ? (
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <PieChart>
                <Pie
                  data={visibleRiskData}
                  dataKey="count"
                  nameKey="riskLevel"
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={115}
                  paddingAngle={3}
                >
                  {visibleRiskData.map((entry) => (
                    <Cell
                      key={entry.riskLevel}
                      fill={
                        RISK_COLORS[
                          entry.riskLevel
                        ] || "#64748b"
                      }
                    />
                  ))}
                </Pie>

                <Tooltip
                  contentStyle={{
                    background: "#020617",
                    border:
                      "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "16px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-slate-400">
              No incident risk data is available.
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-4">
          {riskDistribution.map((item) => (
            <div
              key={item.riskLevel}
              className="flex items-center gap-2 text-sm text-slate-300"
            >
              <span
                className="h-3 w-3 rounded-full"
                style={{
                  backgroundColor:
                    RISK_COLORS[item.riskLevel] ||
                    "#64748b",
                }}
              />

              {item.riskLevel.replaceAll("_", " ")}:{" "}
              {item.count}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}