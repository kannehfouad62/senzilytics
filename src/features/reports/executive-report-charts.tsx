"use client";

import type {
  ExecutiveReportDistributionItem,
  ExecutiveReportMonthlyTrendItem,
  ExecutiveReportSitePerformanceItem,
} from "@/core/analytics/executive-report.service";
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

type ExecutiveReportChartsProps = {
  monthlyTrend: ExecutiveReportMonthlyTrendItem[];

  incidentRiskDistribution: ExecutiveReportDistributionItem[];

  incidentStatusDistribution: ExecutiveReportDistributionItem[];

  correctiveActionStatusDistribution: ExecutiveReportDistributionItem[];

  correctiveActionRiskDistribution: ExecutiveReportDistributionItem[];

  correctiveActionSourceDistribution: ExecutiveReportDistributionItem[];

  auditStatusDistribution: ExecutiveReportDistributionItem[];

  inspectionStatusDistribution: ExecutiveReportDistributionItem[];

  sitePerformance: ExecutiveReportSitePerformanceItem[];
};

export function ExecutiveReportCharts({
  monthlyTrend,
  incidentRiskDistribution,
  incidentStatusDistribution,
  correctiveActionStatusDistribution,
  correctiveActionRiskDistribution,
  correctiveActionSourceDistribution,
  auditStatusDistribution,
  inspectionStatusDistribution,
  sitePerformance,
}: ExecutiveReportChartsProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-2 print:block">
      <ChartCard
        title="Enterprise Activity Trend"
        description="Monthly incidents, audits, inspections, and corrective actions during the selected reporting period."
      >
        {monthlyTrend.length > 0 ? (
          <ResponsiveContainer
            width="100%"
            height={360}
          >
            <LineChart
              data={monthlyTrend}
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
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{
                  fill: "#94a3b8",
                  fontSize: 11,
                }}
              />

              <YAxis
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                tick={{
                  fill: "#94a3b8",
                  fontSize: 11,
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

              <Legend />

              <Line
                type="monotone"
                dataKey="incidents"
                name="Incidents"
                stroke="#22d3ee"
                strokeWidth={3}
                dot={{
                  r: 3,
                }}
                activeDot={{
                  r: 6,
                }}
              />

              <Line
                type="monotone"
                dataKey="audits"
                name="Audits"
                stroke="#8b5cf6"
                strokeWidth={3}
                dot={{
                  r: 3,
                }}
                activeDot={{
                  r: 6,
                }}
              />

              <Line
                type="monotone"
                dataKey="inspections"
                name="Inspections"
                stroke="#22c55e"
                strokeWidth={3}
                dot={{
                  r: 3,
                }}
                activeDot={{
                  r: 6,
                }}
              />

              <Line
                type="monotone"
                dataKey="correctiveActions"
                name="Corrective Actions"
                stroke="#f97316"
                strokeWidth={3}
                dot={{
                  r: 3,
                }}
                activeDot={{
                  r: 6,
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart />
        )}
      </ChartCard>

      <DistributionChart
        title="Incident Risk Distribution"
        description="Incident volume grouped by assigned risk classification."
        data={
          incidentRiskDistribution
        }
        fill="#f97316"
      />

      <DistributionChart
        title="Incident Status"
        description="Incident lifecycle distribution during the reporting period."
        data={
          incidentStatusDistribution
        }
        fill="#22d3ee"
      />

      <DistributionChart
        title="Corrective-Action Status"
        description="CAPA lifecycle distribution across incidents, audits, and inspections."
        data={
          correctiveActionStatusDistribution
        }
        fill="#8b5cf6"
      />

      <DistributionChart
        title="Corrective-Action Risk"
        description="Corrective actions grouped by assigned risk level."
        data={
          correctiveActionRiskDistribution
        }
        fill="#f97316"
      />

      <DistributionChart
        title="Corrective-Action Sources"
        description="CAPAs generated from incidents, audits, inspections, and standalone records."
        data={
          correctiveActionSourceDistribution
        }
        fill="#22c55e"
      />

      <DistributionChart
        title="Audit Status"
        description="Audit completion and lifecycle status during the reporting period."
        data={
          auditStatusDistribution
        }
        fill="#22d3ee"
      />

      <DistributionChart
        title="Inspection Status"
        description="Inspection completion and lifecycle status during the reporting period."
        data={
          inspectionStatusDistribution
        }
        fill="#8b5cf6"
      />

      <div className="xl:col-span-2">
        <ChartCard
          title="Site Risk Exposure"
          description="Comparison of incidents, high-risk incidents, open CAPAs, and overdue CAPAs by site."
        >
          {sitePerformance.length > 0 ? (
            <ResponsiveContainer
              width="100%"
              height={420}
            >
              <BarChart
                data={sitePerformance.slice(
                  0,
                  12
                )}
                layout="vertical"
                margin={{
                  top: 10,
                  right: 20,
                  bottom: 10,
                  left: 35,
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
                    fontSize: 11,
                  }}
                />

                <YAxis
                  type="category"
                  dataKey="siteName"
                  width={145}
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "#cbd5e1",
                    fontSize: 11,
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

                <Legend />

                <Bar
                  dataKey="incidents"
                  name="Incidents"
                  fill="#22d3ee"
                  radius={[
                    0,
                    6,
                    6,
                    0,
                  ]}
                />

                <Bar
                  dataKey="highRiskIncidents"
                  name="High Risk"
                  fill="#f97316"
                  radius={[
                    0,
                    6,
                    6,
                    0,
                  ]}
                />

                <Bar
                  dataKey="openCorrectiveActions"
                  name="Open CAPAs"
                  fill="#8b5cf6"
                  radius={[
                    0,
                    6,
                    6,
                    0,
                  ]}
                />

                <Bar
                  dataKey="overdueCorrectiveActions"
                  name="Overdue CAPAs"
                  fill="#ef4444"
                  radius={[
                    0,
                    6,
                    6,
                    0,
                  ]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>
      </div>
    </div>
  );
}

function DistributionChart({
  title,
  description,
  data,
  fill,
}: {
  title: string;
  description: string;
  data: ExecutiveReportDistributionItem[];
  fill: string;
}) {
  return (
    <ChartCard
      title={title}
      description={description}
    >
      {data.length > 0 ? (
        <ResponsiveContainer
          width="100%"
          height={340}
        >
          <BarChart
            data={data}
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
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{
                fill: "#94a3b8",
                fontSize: 10,
              }}
              interval={0}
            />

            <YAxis
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              tick={{
                fill: "#94a3b8",
                fontSize: 11,
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
              dataKey="value"
              name="Records"
              fill={fill}
              radius={[
                7,
                7,
                0,
                0,
              ]}
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <EmptyChart />
      )}
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
    <section className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl print:break-inside-avoid print:border-slate-300 print:bg-white print:text-black print:shadow-none">
      <h2 className="text-xl font-semibold text-white print:text-black">
        {title}
      </h2>

      <p className="mt-1 text-sm text-slate-400 print:text-slate-600">
        {description}
      </p>

      <div className="mt-5">
        {children}
      </div>
    </section>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[340px] items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-slate-500 print:border-slate-300">
      No report data is available.
    </div>
  );
}