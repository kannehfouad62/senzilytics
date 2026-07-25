"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const ratingColors: Record<string, string> = {
  ON_TARGET: "#34d399",
  WATCH: "#facc15",
  OFF_TARGET: "#fb923c",
  CRITICAL: "#fb7185",
  NO_TARGET: "#94a3b8",
  NO_DATA: "#475569",
};

export function PerformanceRatingChart({
  data,
}: {
  data: Array<{ rating: string; count: number }>;
}) {
  return (
    <ChartCard title="Portfolio status" description="Indicators by target-control band.">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ left: -20, right: 8 }}>
          <CartesianGrid stroke="rgba(148,163,184,.12)" vertical={false} />
          <XAxis
            dataKey="rating"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            tickFormatter={shortRating}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(34,211,238,.05)" }}
            contentStyle={tooltipStyle}
            labelFormatter={(value) => label(String(value))}
          />
          <Bar dataKey="count" radius={[8, 8, 0, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.rating}
                fill={ratingColors[entry.rating] ?? "#22d3ee"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function PerformanceTrendChart({
  data,
  indicatorName,
  unit,
}: {
  data: Array<{ period: string; value: number | null }>;
  indicatorName: string;
  unit: string;
}) {
  return (
    <ChartCard
      title="Six-month trend"
      description={`${indicatorName} · organization level · ${unit}`}
    >
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ left: -12, right: 12 }}>
          <CartesianGrid stroke="rgba(148,163,184,.12)" vertical={false} />
          <XAxis
            dataKey="period"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip contentStyle={tooltipStyle} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#22d3ee"
            strokeWidth={3}
            connectNulls
            dot={{ fill: "#0f172a", stroke: "#22d3ee", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function PerformanceBenchmarkChart({
  data,
  indicatorName,
  unit,
}: {
  data: Array<{
    siteId: string;
    siteName: string;
    value: number | null;
    rating: string;
  }>;
  indicatorName: string;
  unit: string;
}) {
  return (
    <ChartCard
      title="Internal site benchmark"
      description={`${indicatorName} · ${unit} · tenant data only`}
    >
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: 18, right: 12 }}
        >
          <CartesianGrid stroke="rgba(148,163,184,.12)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="siteName"
            width={110}
            tick={{ fill: "#cbd5e1", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="value" radius={[0, 8, 8, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.siteId}
                fill={ratingColors[entry.rating] ?? "#22d3ee"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-slate-400">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

const tooltipStyle = {
  background: "#020617",
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: "12px",
  color: "#e2e8f0",
};

function shortRating(value: string) {
  return (
    {
      ON_TARGET: "Target",
      WATCH: "Watch",
      OFF_TARGET: "Off",
      CRITICAL: "Critical",
      NO_TARGET: "No tgt",
      NO_DATA: "No data",
    }[value] ?? value
  );
}

function label(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}
