"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const palette = ["#22d3ee", "#60a5fa", "#34d399", "#fbbf24", "#fb7185", "#a78bfa"];

export function ResearchPortfolioCharts({statusData,methodologyData}:{statusData:{name:string;value:number}[];methodologyData:{name:string;value:number}[]}) {
  return <div className="grid gap-5 xl:grid-cols-2">
    <ChartShell title="Project lifecycle" subtitle="Controlled projects by current governance state">
      <ResponsiveContainer width="100%" height={280}><BarChart data={statusData} margin={{left:0,right:12,top:10,bottom:20}}><CartesianGrid stroke="rgba(148,163,184,.1)" vertical={false}/><XAxis dataKey="name" tick={{fill:"#94a3b8",fontSize:11}} angle={-18} textAnchor="end" interval={0}/><YAxis allowDecimals={false} tick={{fill:"#94a3b8",fontSize:11}}/><Tooltip contentStyle={{background:"#071421",border:"1px solid rgba(255,255,255,.12)",borderRadius:12}}/><Bar dataKey="value" radius={[7,7,0,0]}>{statusData.map((entry,index)=><Cell key={entry.name} fill={palette[index%palette.length]}/>)}</Bar></BarChart></ResponsiveContainer>
    </ChartShell>
    <ChartShell title="Methodology portfolio" subtitle="Research design mix across the tenant">
      <div className="grid items-center gap-4 sm:grid-cols-[1fr_.8fr]"><ResponsiveContainer width="100%" height={280}><PieChart><Pie data={methodologyData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={102} paddingAngle={3}>{methodologyData.map((entry,index)=><Cell key={entry.name} fill={palette[index%palette.length]}/>)}</Pie><Tooltip contentStyle={{background:"#071421",border:"1px solid rgba(255,255,255,.12)",borderRadius:12}}/></PieChart></ResponsiveContainer><div className="space-y-3">{methodologyData.map((entry,index)=><div key={entry.name} className="flex items-center justify-between gap-4 text-sm"><span className="flex items-center gap-2 text-slate-300"><span className="h-2.5 w-2.5 rounded-full" style={{backgroundColor:palette[index%palette.length]}}/>{entry.name}</span><strong>{entry.value}</strong></div>)}</div></div>
    </ChartShell>
  </div>;
}

function ChartShell({title,subtitle,children}:{title:string;subtitle:string;children:React.ReactNode}) { return <section className="rounded-3xl border border-white/10 bg-white/[.035] p-6"><h2 className="text-lg font-semibold">{title}</h2><p className="mt-1 text-sm text-slate-500">{subtitle}</p><div className="mt-5">{children}</div></section>; }
