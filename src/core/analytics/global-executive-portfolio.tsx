import Link from "next/link";

type PortfolioItem = { label: string; value: number; note: string; href: string; tone: "danger" | "warning" | "good" | "neutral" };
const tones = { danger: "border-red-400/25 bg-red-400/5 text-red-300", warning: "border-amber-400/25 bg-amber-400/5 text-amber-300", good: "border-emerald-400/20 bg-emerald-400/5 text-emerald-300", neutral: "border-cyan-400/20 bg-cyan-400/5 text-cyan-300" };

export function GlobalExecutivePortfolio({ modules, attentionCount }: { modules: readonly PortfolioItem[]; attentionCount: number }) {
  return <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm text-cyan-300">Enterprise Portfolio</p><h2 className="mt-1 text-2xl font-semibold text-white">Global EHS & ESG control view</h2><p className="mt-1 text-sm text-slate-400">Live, tenant-scoped indicators across every operational module.</p></div><div className="rounded-2xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-right"><p className="text-2xl font-bold text-red-300">{attentionCount}</p><p className="text-xs text-slate-400">priority exceptions</p></div></div>
    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{modules.map((item) => <Link key={item.label} href={item.href} className={`rounded-2xl border p-4 transition hover:-translate-y-0.5 ${tones[item.tone]}`}><div className="flex items-start justify-between gap-3"><p className="text-sm text-slate-300">{item.label}</p><span className="text-2xl font-bold">{item.value}</span></div><p className="mt-3 text-xs text-slate-400">{item.note}</p></Link>)}</div>
  </section>;
}
