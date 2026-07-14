"use client";

import type {
  CapaAssigneeWorkload,
  CapaChartItem,
} from "@/core/analytics/capa-analytics.service";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type CapaDashboardChartsProps = {
  statusDistribution: CapaChartItem[];
  riskDistribution: CapaChartItem[];
  sourceDistribution: CapaChartItem[];
  agingDistribution: CapaChartItem[];
  assigneeWorkload: CapaAssigneeWorkload[];
};

export function CapaDashboardCharts({
  statusDistribution,
  riskDistribution,
  sourceDistribution,
  agingDistribution,
  assigneeWorkload,
}: CapaDashboardChartsProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <ChartCard
        title="CAPA Status Distribution"
        description="Current lifecycle position of all corrective actions."
      >
        <ResponsiveContainer
          width="100%"
          height={320}
        >
          <BarChart
            data={statusDistribution}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              opacity={0.15}
            />

            <XAxis
              dataKey="label"
              tick={{
                fill: "#94a3b8",
                fontSize: 11,
              }}
            />

            <YAxis
              allowDecimals={false}
              tick={{
                fill: "#94a3b8",
                fontSize: 11,
              }}
            />

            <Tooltip
              contentStyle={{
                background:
                  "#020617",
                border:
                  "1px solid rgba(255,255,255,0.1)",
                borderRadius:
                  "16px",
              }}
            />

            <Bar
              dataKey="value"
              name="Actions"
              fill="#67e8f9"
              radius={[
                8,
                8,
                0,
                0,
              ]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Risk Distribution"
        description="Corrective actions grouped by assigned risk classification."
      >
        <ResponsiveContainer
          width="100%"
          height={320}
        >
          <PieChart>
            <Pie
              data={riskDistribution}
              dataKey="value"
              nameKey="label"
              innerRadius={70}
              outerRadius={110}
              paddingAngle={3}
              fill="#67e8f9"
              label
            />

            <Tooltip
              contentStyle={{
                background:
                  "#020617",
                border:
                  "1px solid rgba(255,255,255,0.1)",
                borderRadius:
                  "16px",
              }}
            />

            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="CAPA Source"
        description="Corrective actions generated from incidents, audits, and inspections."
      >
        <ResponsiveContainer
          width="100%"
          height={320}
        >
          <BarChart
            data={sourceDistribution}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              opacity={0.15}
            />

            <XAxis
              dataKey="label"
              tick={{
                fill: "#94a3b8",
                fontSize: 11,
              }}
            />

            <YAxis
              allowDecimals={false}
              tick={{
                fill: "#94a3b8",
                fontSize: 11,
              }}
            />

            <Tooltip
              contentStyle={{
                background:
                  "#020617",
                border:
                  "1px solid rgba(255,255,255,0.1)",
                borderRadius:
                  "16px",
              }}
            />

            <Bar
              dataKey="value"
              name="Actions"
              fill="#67e8f9"
              radius={[
                8,
                8,
                0,
                0,
              ]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Open CAPA Aging"
        description="Aging profile of unresolved corrective actions."
      >
        <ResponsiveContainer
          width="100%"
          height={320}
        >
          <BarChart
            data={agingDistribution}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              opacity={0.15}
            />

            <XAxis
              dataKey="label"
              tick={{
                fill: "#94a3b8",
                fontSize: 11,
              }}
            />

            <YAxis
              allowDecimals={false}
              tick={{
                fill: "#94a3b8",
                fontSize: 11,
              }}
            />

            <Tooltip
              contentStyle={{
                background:
                  "#020617",
                border:
                  "1px solid rgba(255,255,255,0.1)",
                borderRadius:
                  "16px",
              }}
            />

            <Bar
              dataKey="value"
              name="Open actions"
              fill="#67e8f9"
              radius={[
                8,
                8,
                0,
                0,
              ]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="xl:col-span-2">
        <ChartCard
          title="Assignee Workload"
          description="Open, overdue, and high-risk corrective actions by owner."
        >
          <ResponsiveContainer
            width="100%"
            height={380}
          >
            <BarChart
              data={assigneeWorkload}
              layout="vertical"
              margin={{
                left: 30,
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                opacity={0.15}
              />

              <XAxis
                type="number"
                allowDecimals={false}
                tick={{
                  fill: "#94a3b8",
                  fontSize: 11,
                }}
              />

              <YAxis
                type="category"
                dataKey="name"
                width={130}
                tick={{
                  fill: "#94a3b8",
                  fontSize: 11,
                }}
              />

              <Tooltip
                contentStyle={{
                  background:
                    "#020617",
                  border:
                    "1px solid rgba(255,255,255,0.1)",
                  borderRadius:
                    "16px",
                }}
              />

              <Legend />

              <Bar
                dataKey="open"
                name="Open"
                stackId="workload"
                fill="#67e8f9"
              />

              <Bar
                dataKey="overdue"
                name="Overdue"
                stackId="workload"
                fill="#fb7185"
              />

              <Bar
                dataKey="highRisk"
                name="High Risk"
                stackId="workload"
                fill="#c084fc"
                radius={[
                  0,
                  8,
                  8,
                  0,
                ]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
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
      <h2 className="text-lg font-semibold text-white">
        {title}
      </h2>

      <p className="mt-1 text-sm text-slate-400">
        {description}
      </p>

      <div className="mt-5">
        {children}
      </div>
    </section>
  );
}