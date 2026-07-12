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

type IncidentTypePoint = {
  incidentType: string;
  count: number;
};

type ActionStatusPoint = {
  status: string;
  count: number;
};

type PerformanceDashboardChartsProps = {
  incidentTypeDistribution: IncidentTypePoint[];
  actionStatusDistribution: ActionStatusPoint[];
};

const ACTION_STATUS_COLORS: Record<string, string> = {
  OPEN: "#22d3ee",
  IN_PROGRESS: "#8b5cf6",
  PENDING: "#eab308",
  COMPLETED: "#22c55e",
  CLOSED: "#16a34a",
  CANCELLED: "#64748b",
};

const CHART_COLORS = [
  "#22d3ee",
  "#8b5cf6",
  "#f97316",
  "#22c55e",
  "#eab308",
  "#ef4444",
  "#14b8a6",
  "#ec4899",
];

export function PerformanceDashboardCharts({
  incidentTypeDistribution,
  actionStatusDistribution,
}: PerformanceDashboardChartsProps) {
  const visibleIncidentTypes =
    incidentTypeDistribution.slice(0, 10);

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
        <div className="mb-6">
          <p className="text-sm text-cyan-300">
            Incident Classification
          </p>

          <h2 className="mt-1 text-2xl font-semibold text-white">
            Incidents by Type
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            The most frequently reported incident categories
            across the organization.
          </p>
        </div>

        <div className="h-[380px]">
          {visibleIncidentTypes.length > 0 ? (
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <BarChart
                data={visibleIncidentTypes}
                layout="vertical"
                margin={{
                  top: 10,
                  right: 20,
                  bottom: 10,
                  left: 30,
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
                    fontSize: 12,
                  }}
                />

                <YAxis
                  type="category"
                  dataKey="incidentType"
                  width={150}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value: string) =>
                    value.replaceAll("_", " ")
                  }
                  tick={{
                    fill: "#cbd5e1",
                    fontSize: 12,
                  }}
                />

                <Tooltip
                  labelFormatter={(value) =>
                    String(value).replaceAll("_", " ")
                  }
                  contentStyle={{
                    background: "#020617",
                    border:
                      "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "16px",
                  }}
                />

                <Bar
                  dataKey="count"
                  name="Incidents"
                  fill="#22d3ee"
                  radius={[0, 7, 7, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-slate-400">
              No incident type data is available.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
        <div className="mb-6">
          <p className="text-sm text-cyan-300">
            Corrective-Action Performance
          </p>

          <h2 className="mt-1 text-2xl font-semibold text-white">
            Actions by Status
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            Distribution of corrective actions across their
            current lifecycle statuses.
          </p>
        </div>

        <div className="h-[340px]">
          {actionStatusDistribution.length > 0 ? (
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <PieChart>
                <Pie
                  data={actionStatusDistribution}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={115}
                  paddingAngle={3}
                >
                  {actionStatusDistribution.map(
                    (entry, index) => (
                      <Cell
                        key={entry.status}
                        fill={
                          ACTION_STATUS_COLORS[
                            entry.status
                          ] ||
                          CHART_COLORS[
                            index %
                              CHART_COLORS.length
                          ]
                        }
                      />
                    )
                  )}
                </Pie>

                <Tooltip
                  formatter={(value) => [
                    value,
                    "Actions",
                  ]}
                  labelFormatter={(value) =>
                    String(value).replaceAll("_", " ")
                  }
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
              No corrective-action data is available.
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-4">
          {actionStatusDistribution.map(
            (item, index) => (
              <div
                key={item.status}
                className="flex items-center gap-2 text-sm text-slate-300"
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{
                    backgroundColor:
                      ACTION_STATUS_COLORS[
                        item.status
                      ] ||
                      CHART_COLORS[
                        index %
                          CHART_COLORS.length
                      ],
                  }}
                />

                {item.status.replaceAll("_", " ")}:{" "}
                {item.count}
              </div>
            )
          )}
        </div>
      </section>
    </div>
  );
}