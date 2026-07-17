"use client";

import type { MocExecutiveDashboardData } from "@/core/analytics/moc-dashboard.service";
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

type MocDashboardChartsProps = {
  data: MocExecutiveDashboardData;
};

const chartTextColor = "#94a3b8";
const chartGridColor = "rgba(148, 163, 184, 0.12)";

const riskColors: Record<string, string> = {
  LOW: "#4ade80",
  MEDIUM: "#fb923c",
  HIGH: "#f87171",
  CRITICAL: "#c084fc",
};

const lifecycleColors: Record<string, string> = {
  DRAFT: "#64748b",
  TECHNICAL_REVIEW: "#38bdf8",
  RISK_REVIEW: "#fb923c",
  PENDING_APPROVAL: "#facc15",
  APPROVED: "#4ade80",
  IMPLEMENTATION: "#22d3ee",
  VERIFICATION: "#a78bfa",
  CLOSED: "#10b981",
};

export function MocDashboardCharts({
  data,
}: MocDashboardChartsProps) {
  const lifecycleData =
    data.lifecycleDistribution.map(
      (item) => ({
        name: formatEnum(item.status),
        status: item.status,
        count: item.count,
      })
    );

  const riskData =
    data.residualRiskDistribution.map(
      (item) => ({
        name: formatEnum(
          item.riskLevel
        ),
        riskLevel:
          item.riskLevel,
        count: item.count,
      })
    );

  const changeTypeData =
    data.changesByType.map(
      (item) => ({
        name: formatEnum(
          item.changeType
        ),
        count: item.count,
      })
    );

  const approvalData =
    data.approvalsByRole.map(
      (item) => ({
        role: formatEnum(
          item.role
        ),
        pending:
          item.pending,
        averageWaitingDays:
          item.averageWaitingDays,
      })
    );

  const siteData =
    data.siteExposure
      .slice(0, 10)
      .map((item) => ({
        site:
          item.siteName,
        active:
          item.active,
        overdue:
          item.overdue,
        highRisk:
          item.highRisk,
      }));

  const ownerData =
    data.workloadByOwner
      .slice(0, 10)
      .map((item) => ({
        owner:
          item.ownerName,
        activeChanges:
          item.activeChanges,
        pendingTasks:
          item.pendingTasks,
        overdueTasks:
          item.overdueTasks,
      }));

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Monthly MOC Trend"
          description="Changes opened and closed during the last 12 months."
        >
          <ResponsiveContainer
            width="100%"
            height={320}
          >
            <LineChart
              data={
                data.monthlyTrends
              }
              margin={{
                top: 10,
                right: 20,
                left: -10,
                bottom: 5,
              }}
            >
              <CartesianGrid
                stroke={
                  chartGridColor
                }
                vertical={false}
              />

              <XAxis
                dataKey="label"
                stroke={
                  chartTextColor
                }
                tickLine={false}
                axisLine={false}
                fontSize={12}
              />

              <YAxis
                allowDecimals={false}
                stroke={
                  chartTextColor
                }
                tickLine={false}
                axisLine={false}
                fontSize={12}
              />

              <Tooltip
                contentStyle={
                  tooltipStyle
                }
              />

              <Legend />

              <Line
                type="monotone"
                dataKey="opened"
                name="Opened"
                stroke="#22d3ee"
                strokeWidth={3}
                dot={{
                  r: 3,
                }}
                activeDot={{
                  r: 5,
                }}
              />

              <Line
                type="monotone"
                dataKey="closed"
                name="Closed"
                stroke="#4ade80"
                strokeWidth={3}
                dot={{
                  r: 3,
                }}
                activeDot={{
                  r: 5,
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Lifecycle Distribution"
          description="Current volume within each MOC workflow stage."
        >
          <ResponsiveContainer
            width="100%"
            height={320}
          >
            <BarChart
              data={
                lifecycleData
              }
              margin={{
                top: 10,
                right: 20,
                left: -10,
                bottom: 55,
              }}
            >
              <CartesianGrid
                stroke={
                  chartGridColor
                }
                vertical={false}
              />

              <XAxis
                dataKey="name"
                stroke={
                  chartTextColor
                }
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={-30}
                textAnchor="end"
                fontSize={11}
              />

              <YAxis
                allowDecimals={false}
                stroke={
                  chartTextColor
                }
                tickLine={false}
                axisLine={false}
                fontSize={12}
              />

              <Tooltip
                contentStyle={
                  tooltipStyle
                }
              />

              <Bar
                dataKey="count"
                name="Changes"
                radius={[
                  8,
                  8,
                  0,
                  0,
                ]}
              >
                {lifecycleData.map(
                  (entry) => (
                    <Cell
                      key={
                        entry.status
                      }
                      fill={
                        lifecycleColors[
                          entry.status
                        ] ??
                        "#22d3ee"
                      }
                    />
                  )
                )}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Residual Risk Distribution"
          description="Risk profile across all registered changes."
        >
          <ResponsiveContainer
            width="100%"
            height={320}
          >
            <PieChart>
              <Pie
                data={riskData}
                dataKey="count"
                nameKey="name"
                innerRadius={70}
                outerRadius={115}
                paddingAngle={3}
              >
                {riskData.map(
                  (entry) => (
                    <Cell
                      key={
                        entry.riskLevel
                      }
                      fill={
                        riskColors[
                          entry.riskLevel
                        ] ??
                        "#94a3b8"
                      }
                    />
                  )
                )}
              </Pie>

              <Tooltip
                contentStyle={
                  tooltipStyle
                }
              />

              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Changes by Type"
          description="Volume by operational, organizational, equipment, process, and other change types."
        >
          <ResponsiveContainer
            width="100%"
            height={320}
          >
            <BarChart
              data={
                changeTypeData
              }
              layout="vertical"
              margin={{
                top: 10,
                right: 20,
                left: 45,
                bottom: 5,
              }}
            >
              <CartesianGrid
                stroke={
                  chartGridColor
                }
                horizontal={false}
              />

              <XAxis
                type="number"
                allowDecimals={false}
                stroke={
                  chartTextColor
                }
                tickLine={false}
                axisLine={false}
              />

              <YAxis
                type="category"
                dataKey="name"
                width={120}
                stroke={
                  chartTextColor
                }
                tickLine={false}
                axisLine={false}
                fontSize={11}
              />

              <Tooltip
                contentStyle={
                  tooltipStyle
                }
              />

              <Bar
                dataKey="count"
                name="Changes"
                fill="#22d3ee"
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

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Approval Bottlenecks"
          description="Pending approvals and average waiting time by approval role."
        >
          <ResponsiveContainer
            width="100%"
            height={340}
          >
            <BarChart
              data={
                approvalData
              }
              margin={{
                top: 10,
                right: 20,
                left: -10,
                bottom: 55,
              }}
            >
              <CartesianGrid
                stroke={
                  chartGridColor
                }
                vertical={false}
              />

              <XAxis
                dataKey="role"
                stroke={
                  chartTextColor
                }
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={-30}
                textAnchor="end"
                fontSize={11}
              />

              <YAxis
                allowDecimals={false}
                stroke={
                  chartTextColor
                }
                tickLine={false}
                axisLine={false}
              />

              <Tooltip
                contentStyle={
                  tooltipStyle
                }
              />

              <Legend />

              <Bar
                dataKey="pending"
                name="Pending Approvals"
                fill="#facc15"
                radius={[
                  8,
                  8,
                  0,
                  0,
                ]}
              />

              <Bar
                dataKey="averageWaitingDays"
                name="Average Waiting Days"
                fill="#c084fc"
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
          title="Site Exposure"
          description="Active, overdue, and high-risk changes by site."
        >
          <ResponsiveContainer
            width="100%"
            height={340}
          >
            <BarChart
              data={siteData}
              margin={{
                top: 10,
                right: 20,
                left: -10,
                bottom: 45,
              }}
            >
              <CartesianGrid
                stroke={
                  chartGridColor
                }
                vertical={false}
              />

              <XAxis
                dataKey="site"
                stroke={
                  chartTextColor
                }
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={-25}
                textAnchor="end"
                fontSize={11}
              />

              <YAxis
                allowDecimals={false}
                stroke={
                  chartTextColor
                }
                tickLine={false}
                axisLine={false}
              />

              <Tooltip
                contentStyle={
                  tooltipStyle
                }
              />

              <Legend />

              <Bar
                dataKey="active"
                name="Active"
                fill="#22d3ee"
                radius={[
                  6,
                  6,
                  0,
                  0,
                ]}
              />

              <Bar
                dataKey="overdue"
                name="Overdue"
                fill="#f87171"
                radius={[
                  6,
                  6,
                  0,
                  0,
                ]}
              />

              <Bar
                dataKey="highRisk"
                name="High Risk"
                fill="#c084fc"
                radius={[
                  6,
                  6,
                  0,
                  0,
                ]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard
        title="Workload by Owner"
        description="Active changes, pending tasks, and overdue tasks assigned to each owner."
      >
        <ResponsiveContainer
          width="100%"
          height={360}
        >
          <BarChart
            data={ownerData}
            margin={{
              top: 10,
              right: 20,
              left: -10,
              bottom: 45,
            }}
          >
            <CartesianGrid
              stroke={
                chartGridColor
              }
              vertical={false}
            />

            <XAxis
              dataKey="owner"
              stroke={
                chartTextColor
              }
              tickLine={false}
              axisLine={false}
              interval={0}
              angle={-25}
              textAnchor="end"
              fontSize={11}
            />

            <YAxis
              allowDecimals={false}
              stroke={
                chartTextColor
              }
              tickLine={false}
              axisLine={false}
            />

            <Tooltip
              contentStyle={
                tooltipStyle
              }
            />

            <Legend />

            <Bar
              dataKey="activeChanges"
              name="Active Changes"
              stackId="workload"
              fill="#22d3ee"
            />

            <Bar
              dataKey="pendingTasks"
              name="Pending Tasks"
              stackId="workload"
              fill="#facc15"
            />

            <Bar
              dataKey="overdueTasks"
              name="Overdue Tasks"
              stackId="workload"
              fill="#f87171"
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

function formatEnum(
  value: string
) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );
}

const tooltipStyle = {
  backgroundColor:
    "rgb(2 6 23)",
  border:
    "1px solid rgba(148, 163, 184, 0.2)",
  borderRadius: "14px",
  color: "#e2e8f0",
};