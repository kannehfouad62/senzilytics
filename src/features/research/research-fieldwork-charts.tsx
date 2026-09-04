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

type Datum = {
  name: string;
  value: number;
  total?: number;
  completed?: number;
  overdue?: number;
};
const colors = [
  "#22d3ee",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#3b82f6",
  "#ec4899",
];
const tooltip = {
  background: "#071421",
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: 12,
};

export function ResearchFieldworkCharts({
  dispositions,
  researchers,
  strata,
  clusters,
}: {
  dispositions: Datum[];
  researchers: Datum[];
  strata: Datum[];
  clusters: Datum[];
}) {
  return (
    <div className="mt-6 grid gap-5 xl:grid-cols-2">
      <Chart title="Disposition mix">
        <ResponsiveContainer width="100%" height={290}>
          <PieChart>
            <Pie
              data={dispositions}
              dataKey="value"
              nameKey="name"
              innerRadius={62}
              outerRadius={105}
              paddingAngle={2}
            >
              {dispositions.map((item, index) => (
                <Cell key={item.name} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltip} />
          </PieChart>
        </ResponsiveContainer>
      </Chart>
      <Chart title="Researcher completion rate">
        <Bars data={researchers} suffix="%" />
      </Chart>
      <Chart title="Completion rate by stratum">
        <Bars data={strata} suffix="%" />
      </Chart>
      <Chart title="Completion rate by cluster">
        <Bars data={clusters.slice(0, 12)} suffix="%" />
      </Chart>
    </div>
  );
}
function Chart({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[.035] p-5">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
function Bars({ data, suffix }: { data: Datum[]; suffix: string }) {
  return (
    <ResponsiveContainer width="100%" height={290}>
      <BarChart data={data.slice(0, 12)} margin={{ bottom: 45 }}>
        <CartesianGrid stroke="rgba(148,163,184,.1)" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fill: "#94a3b8", fontSize: 10 }}
          angle={-22}
          textAnchor="end"
          interval={0}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: "#94a3b8", fontSize: 11 }}
          unit={suffix}
        />
        <Tooltip contentStyle={tooltip} />
        <Bar dataKey="value" fill="#22d3ee" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
