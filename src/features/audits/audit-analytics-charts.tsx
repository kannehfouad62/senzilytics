"use client";
import type { AuditDistribution, AuditTrend } from "@/modules/audit/audit-analytics.service";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function AuditAnalyticsCharts({ status, type, risk, severity, trend, sites }: { status: AuditDistribution[]; type: AuditDistribution[]; risk: AuditDistribution[]; severity: AuditDistribution[]; trend: AuditTrend[]; sites: Array<{ siteName: string; total: number; completed: number; overdue: number; findings: number }> }) {
  return <div className="grid gap-6 xl:grid-cols-2">
    <Distribution title="Audit status" data={status} color="#22d3ee" /><Distribution title="Audit type" data={type} color="#8b5cf6" />
    <Distribution title="Overall risk" data={risk} color="#f97316" /><Distribution title="Finding severity" data={severity} color="#ef4444" />
    <Card title="12-month delivery trend"><ResponsiveContainer width="100%" height={300}><LineChart data={trend}><CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.15)"/><XAxis dataKey="month" tick={{fill:"#94a3b8",fontSize:11}}/><YAxis allowDecimals={false} tick={{fill:"#94a3b8",fontSize:11}}/><Tooltip/><Legend/><Line dataKey="scheduled" stroke="#22d3ee"/><Line dataKey="completed" stroke="#22c55e"/><Line dataKey="overdue" stroke="#ef4444"/></LineChart></ResponsiveContainer></Card>
    <Card title="Site performance"><ResponsiveContainer width="100%" height={300}><BarChart data={sites.slice(0,10)}><CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.15)"/><XAxis dataKey="siteName" tick={{fill:"#94a3b8",fontSize:10}}/><YAxis allowDecimals={false} tick={{fill:"#94a3b8",fontSize:11}}/><Tooltip/><Legend/><Bar dataKey="completed" fill="#22c55e"/><Bar dataKey="overdue" fill="#ef4444"/><Bar dataKey="findings" fill="#f97316"/></BarChart></ResponsiveContainer></Card>
  </div>;
}
function Distribution({ title, data, color }: { title: string; data: AuditDistribution[]; color: string }) { return <Card title={title}><ResponsiveContainer width="100%" height={280}><BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.15)"/><XAxis dataKey="label" tick={{fill:"#94a3b8",fontSize:10}}/><YAxis allowDecimals={false} tick={{fill:"#94a3b8",fontSize:11}}/><Tooltip/><Bar dataKey="value" fill={color} radius={[6,6,0,0]}/></BarChart></ResponsiveContainer></Card>; }
function Card({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-3xl border border-white/10 bg-white/5 p-6"><h2 className="mb-5 text-lg font-semibold">{title}</h2>{children}</section>; }
