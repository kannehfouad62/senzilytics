"use client";

import type { ExecutiveCommandCenterData } from "./executive-command-center.service";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const series = {
  incidents: { label: "Incidents", color: "#fb7185" },
  observations: { label: "Observations", color: "#22d3ee" },
  audits: { label: "Audits", color: "#a78bfa" },
  inspections: { label: "Inspections", color: "#34d399" },
  actions: { label: "Actions", color: "#fbbf24" },
} as const;

const ratingColors: Record<string, string> = {
  ON_TARGET: "#34d399",
  WATCH: "#fbbf24",
  OFF_TARGET: "#fb923c",
  CRITICAL: "#fb7185",
  NO_TARGET: "#64748b",
  NO_DATA: "#334155",
};

const tooltipStyle = {
  background: "#020617",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "16px",
};

export function ExecutiveCommandCenterCharts({
  trend,
  enabledSeries,
  performance,
}: {
  trend: ExecutiveCommandCenterData["trend"];
  enabledSeries: ExecutiveCommandCenterData["enabledTrendSeries"];
  performance: ExecutiveCommandCenterData["performance"];
}) {
  const visibleRatings =
    performance?.ratingCounts.filter((item) => item.count > 0) ?? [];

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="rounded-3xl border border-white/10 bg-white/[.04] p-6 shadow-2xl backdrop-blur-xl">
        <p className="text-sm text-cyan-300">Cross-module movement</p>
        <h2 className="mt-1 text-2xl font-semibold text-white">
          Enterprise activity trend
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Only series authorized for your role are included.
        </p>
        <div className="mt-6 h-[340px]">
          {enabledSeries.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid
                  stroke="rgba(148,163,184,.14)"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                {enabledSeries.map((key) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={series[key as keyof typeof series].label}
                    stroke={series[key as keyof typeof series].color}
                    strokeWidth={2.5}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="No authorized trend series are available." />
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[.04] p-6 shadow-2xl backdrop-blur-xl">
        <p className="text-sm text-violet-300">Target governance</p>
        <h2 className="mt-1 text-2xl font-semibold text-white">
          Performance rating distribution
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Effective targets and approved measurements for the selected scorecard scope.
        </p>
        <div className="mt-6 h-[340px]">
          {visibleRatings.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={visibleRatings}
                  dataKey="count"
                  nameKey="rating"
                  innerRadius={72}
                  outerRadius={118}
                  paddingAngle={3}
                >
                  {visibleRatings.map((item) => (
                    <Cell
                      key={item.rating}
                      fill={ratingColors[item.rating] ?? "#64748b"}
                    />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend
                  formatter={(value) => String(value).replaceAll("_", " ")}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="Configure performance indicators and targets to populate this view." />
          )}
        </div>
      </section>

      {performance?.selectedIndicator && performance.benchmark.length > 0 ? (
        <section className="rounded-3xl border border-white/10 bg-white/[.04] p-6 shadow-2xl backdrop-blur-xl xl:col-span-2">
          <p className="text-sm text-emerald-300">Internal benchmark</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">
            {performance.selectedIndicator.name} by site
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Comparable values use the same governed definition and reporting window.
          </p>
          <div className="mt-6 h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performance.benchmark}>
                <CartesianGrid
                  stroke="rgba(148,163,184,.14)"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="siteName"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" name="Actual" fill="#22d3ee" radius={[7, 7, 0, 0]} />
                <Bar
                  dataKey="targetValue"
                  name="Target"
                  fill="#8b5cf6"
                  radius={[7, 7, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-white/10 bg-slate-950/30 p-6 text-center text-sm text-slate-400">
      {message}
    </div>
  );
}
