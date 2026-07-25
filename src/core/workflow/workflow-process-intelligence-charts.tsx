"use client";

import type {
  WorkflowBottleneck,
  WorkflowOutcomeReliability,
  WorkflowOwnerWorkload,
  WorkflowTrendPoint,
} from "@/core/workflow/workflow-process-intelligence.service";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const tooltipStyle = {
  background: "#020617",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "16px",
};

export function WorkflowProcessIntelligenceCharts({
  trend,
  bottlenecks,
  outcomes,
  ownerWorkload,
}: {
  trend: WorkflowTrendPoint[];
  bottlenecks: WorkflowBottleneck[];
  outcomes: WorkflowOutcomeReliability[];
  ownerWorkload: WorkflowOwnerWorkload[];
}) {
  const bottleneckData = bottlenecks
    .filter((item) => item.averageCycleHours !== null)
    .slice(0, 8)
    .map((item) => ({
      step:
        item.stepName.length > 24
          ? `${item.stepName.slice(0, 23)}…`
          : item.stepName,
      averageHours: item.averageCycleHours,
      p90Hours: item.p90CycleHours,
    }));
  const outcomeData = outcomes.map((item) => ({
    outcome: pretty(item.outcomeType),
    completed: item.completed,
    failed: item.failed,
    awaiting: item.awaitingApproval,
    rejected: item.rejected,
  }));

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <ChartCard
        eyebrow="Throughput trend"
        title="Started, completed, and breached"
        empty={trend.length === 0}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trend}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(148,163,184,0.15)"
            />
            <XAxis
              dataKey="month"
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            <Line
              type="monotone"
              dataKey="started"
              name="Started"
              stroke="#22d3ee"
              strokeWidth={3}
            />
            <Line
              type="monotone"
              dataKey="completed"
              name="Completed"
              stroke="#34d399"
              strokeWidth={3}
            />
            <Line
              type="monotone"
              dataKey="slaBreaches"
              name="SLA breaches"
              stroke="#fb7185"
              strokeWidth={3}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        eyebrow="Step performance"
        title="Highest-duration workflow steps"
        empty={bottleneckData.length === 0}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bottleneckData} layout="vertical">
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(148,163,184,0.15)"
            />
            <XAxis
              type="number"
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="step"
              width={140}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value) => [`${value} hours`]}
            />
            <Legend />
            <Bar
              dataKey="averageHours"
              name="Average hours"
              fill="#22d3ee"
              radius={[0, 6, 6, 0]}
            />
            <Bar
              dataKey="p90Hours"
              name="P90 hours"
              fill="#8b5cf6"
              radius={[0, 6, 6, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        eyebrow="Outcome reliability"
        title="Cross-module execution disposition"
        empty={outcomeData.length === 0}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={outcomeData}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(148,163,184,0.15)"
            />
            <XAxis
              dataKey="outcome"
              tick={{ fill: "#94a3b8", fontSize: 10 }}
              angle={-18}
              textAnchor="end"
              height={70}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            <Bar
              dataKey="completed"
              name="Completed"
              stackId="outcomes"
              fill="#34d399"
            />
            <Bar
              dataKey="awaiting"
              name="Awaiting approval"
              stackId="outcomes"
              fill="#fbbf24"
            />
            <Bar
              dataKey="rejected"
              name="Rejected"
              stackId="outcomes"
              fill="#94a3b8"
            />
            <Bar
              dataKey="failed"
              name="Failed"
              stackId="outcomes"
              fill="#fb7185"
              radius={[6, 6, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        eyebrow="Current workload"
        title="Active and overdue work by owner"
        empty={ownerWorkload.length === 0}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={ownerWorkload.slice(0, 10)} layout="vertical">
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(148,163,184,0.15)"
            />
            <XAxis
              type="number"
              allowDecimals={false}
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="owner"
              width={145}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            <Bar
              dataKey="active"
              name="Active"
              fill="#22d3ee"
              radius={[0, 6, 6, 0]}
            />
            <Bar
              dataKey="overdue"
              name="Overdue"
              fill="#fb7185"
              radius={[0, 6, 6, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function ChartCard({
  eyebrow,
  title,
  empty,
  children,
}: {
  eyebrow: string;
  title: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
      <p className="text-sm text-cyan-300">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-semibold text-white">{title}</h2>
      <div className="mt-6 h-[360px]">
        {empty ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            No workflow data is available for this selection.
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

function pretty(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
