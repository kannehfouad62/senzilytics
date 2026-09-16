"use client";

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

export function EmployeePerformanceCharts({
  workload,
  trends,
}: {
  workload: Array<{ name: string; assigned: number; completed: number; overdue: number }>;
  trends: Array<{ month: string; assigned: number; completed: number; onTime: number }>;
}) {
  return (
    <div className="mt-8 grid gap-6 xl:grid-cols-2">
      <ChartCard title="Workload distribution" description="Assigned, completed and currently overdue work for the first 20 employees in the filtered portfolio.">
        {workload.length ? <ResponsiveContainer width="100%" height={340}><BarChart data={workload} margin={{ left: 0, right: 12, top: 12, bottom: 50 }}><CartesianGrid stroke="rgba(148,163,184,.12)" strokeDasharray="3 3"/><XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} tick={{ fill: "#94a3b8", fontSize: 10 }}/><YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 11 }}/><Tooltip contentStyle={{ background: "#07111f", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12 }}/><Legend/><Bar dataKey="assigned" fill="#22d3ee" radius={[5,5,0,0]}/><Bar dataKey="completed" fill="#34d399" radius={[5,5,0,0]}/><Bar dataKey="overdue" fill="#f59e0b" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer> : <Empty/>}
      </ChartCard>
      <ChartCard title="Monthly work trend" description="New assignments, completions and on-time completions within the selected reporting window.">
        {trends.length ? <ResponsiveContainer width="100%" height={340}><LineChart data={trends} margin={{ left: 0, right: 18, top: 12, bottom: 12 }}><CartesianGrid stroke="rgba(148,163,184,.12)" strokeDasharray="3 3"/><XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 11 }}/><YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 11 }}/><Tooltip contentStyle={{ background: "#07111f", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12 }}/><Legend/><Line type="monotone" dataKey="assigned" stroke="#22d3ee" strokeWidth={2}/><Line type="monotone" dataKey="completed" stroke="#34d399" strokeWidth={2}/><Line type="monotone" dataKey="onTime" name="on time" stroke="#a78bfa" strokeWidth={2}/></LineChart></ResponsiveContainer> : <Empty/>}
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <section className="rounded-3xl border border-white/10 bg-white/5 p-6"><h2 className="text-xl font-semibold">{title}</h2><p className="mt-2 text-sm text-slate-400">{description}</p><div className="mt-5">{children}</div></section>; }
function Empty() { return <div className="grid h-[340px] place-items-center text-sm text-slate-500">No governed work data is available for this view.</div>; }
