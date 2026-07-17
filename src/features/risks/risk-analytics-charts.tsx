"use client";

import type {
  RiskAnalyticsDistributionItem,
  RiskAnalyticsSiteItem,
} from "@/core/analytics/risk-analytics.service";
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

type RiskAnalyticsChartsProps = {
  categoryDistribution:
    RiskAnalyticsDistributionItem[];

  statusDistribution:
    RiskAnalyticsDistributionItem[];

  currentRiskDistribution:
    RiskAnalyticsDistributionItem[];

  residualRiskDistribution:
    RiskAnalyticsDistributionItem[];

  controlEffectivenessDistribution:
    RiskAnalyticsDistributionItem[];

  controlHierarchyDistribution:
    RiskAnalyticsDistributionItem[];

  sitePerformance:
    RiskAnalyticsSiteItem[];
};

export function RiskAnalyticsCharts({
  categoryDistribution,
  statusDistribution,
  currentRiskDistribution,
  residualRiskDistribution,
  controlEffectivenessDistribution,
  controlHierarchyDistribution,
  sitePerformance,
}: RiskAnalyticsChartsProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <DistributionChart
        title="Risks by Category"
        description="Enterprise risk concentration by category."
        data={categoryDistribution}
        fill="#22d3ee"
      />

      <DistributionChart
        title="Risk Status"
        description="Risk-register lifecycle distribution."
        data={statusDistribution}
        fill="#8b5cf6"
      />

      <DistributionChart
        title="Current Risk Profile"
        description="Active risks grouped by current risk level."
        data={
          currentRiskDistribution
        }
        fill="#f97316"
      />

      <DistributionChart
        title="Residual Risk Profile"
        description="Active risks grouped by expected residual risk."
        data={
          residualRiskDistribution
        }
        fill="#ef4444"
      />

      <DistributionChart
        title="Control Effectiveness"
        description="Recorded controls by effectiveness rating."
        data={
          controlEffectivenessDistribution
        }
        fill="#22c55e"
      />

      <DistributionChart
        title="Control Hierarchy"
        description="Risk controls distributed across the hierarchy of controls."
        data={
          controlHierarchyDistribution
        }
        fill="#22d3ee"
      />

      <div className="xl:col-span-2">
        <ChartCard
          title="Site Risk Exposure"
          description="Site comparison using active risk, high residual risk, overdue review, and control exposure."
        >
          {sitePerformance.length > 0 ? (
            <ResponsiveContainer
              width="100%"
              height={440}
            >
              <BarChart
                data={sitePerformance.slice(
                  0,
                  12
                )}
                layout="vertical"
                margin={{
                  top: 10,
                  right: 25,
                  bottom: 10,
                  left: 40,
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
                  width={150}
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
                  dataKey="activeRisks"
                  name="Active Risks"
                  fill="#22d3ee"
                  radius={[
                    0,
                    6,
                    6,
                    0,
                  ]}
                />

                <Bar
                  dataKey="highResidualRisks"
                  name="High Residual"
                  fill="#f97316"
                  radius={[
                    0,
                    6,
                    6,
                    0,
                  ]}
                />

                <Bar
                  dataKey="overdueReviews"
                  name="Overdue Reviews"
                  fill="#8b5cf6"
                  radius={[
                    0,
                    6,
                    6,
                    0,
                  ]}
                />

                <Bar
                  dataKey="overdueControls"
                  name="Overdue Controls"
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
  data:
    RiskAnalyticsDistributionItem[];
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
              bottom: 20,
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
              interval={0}
              angle={
                data.length > 5
                  ? -20
                  : 0
              }
              textAnchor={
                data.length > 5
                  ? "end"
                  : "middle"
              }
              height={
                data.length > 5
                  ? 70
                  : 35
              }
              tick={{
                fill: "#94a3b8",
                fontSize: 10,
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

            <Bar
              dataKey="value"
              name="Risk records"
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
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
      <h2 className="text-xl font-semibold text-white">
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

function EmptyChart() {
  return (
    <div className="flex h-[340px] items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-slate-500">
      No risk analytics data is available.
    </div>
  );
}