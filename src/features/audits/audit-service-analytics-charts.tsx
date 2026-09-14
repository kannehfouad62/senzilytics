"use client";

import type { AuditServiceAnalytics } from "@/modules/audit/audit-service-analytics.service";
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

type Distribution = AuditServiceAnalytics["statusDistribution"];

export function AuditServiceAnalyticsCharts({
  data,
}: {
  data: AuditServiceAnalytics;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <DistributionChart
        title="Engagement status"
        data={data.statusDistribution}
        color="#22D3EE"
      />
      <DistributionChart
        title="Risk exposure"
        data={data.riskDistribution}
        color="#F97316"
      />
      <DistributionChart
        title="Deliverable governance"
        data={data.deliverableDistribution}
        color="#8B5CF6"
      />
      <DistributionChart
        title="Client decisions"
        data={data.decisionDistribution}
        color="#22C55E"
      />
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 xl:col-span-2">
        <h2 className="mb-5 text-lg font-semibold">
          12-month service-delivery trend
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={data.trend}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(148,163,184,.15)"
            />
            <XAxis dataKey="month" tick={{ fill: "#94A3B8", fontSize: 11 }} />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "#94A3B8", fontSize: 11 }}
            />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="started"
              stroke="#22D3EE"
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="completed"
              stroke="#22C55E"
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="released"
              stroke="#8B5CF6"
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="decisions"
              stroke="#F59E0B"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
}

function DistributionChart({
  title,
  data,
  color,
}: {
  title: string;
  data: Distribution;
  color: string;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <h2 className="mb-5 text-lg font-semibold">{title}</h2>
      {data.length ? (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(148,163,184,.15)"
            />
            <XAxis dataKey="label" tick={{ fill: "#94A3B8", fontSize: 10 }} />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "#94A3B8", fontSize: 11 }}
            />
            <Tooltip />
            <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-sm text-slate-500">
          No governed records are available.
        </p>
      )}
    </section>
  );
}
