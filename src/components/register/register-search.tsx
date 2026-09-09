import { Search } from "lucide-react";
import Link from "next/link";

export function RegisterSearch({ action, value, placeholder }: { action: string; value: string; placeholder: string }) {
  return <form action={action} className="flex flex-wrap gap-3"><label className="relative min-w-64 flex-1"><Search size={18} className="pointer-events-none absolute left-4 top-3.5 text-slate-500"/><span className="sr-only">Search register</span><input name="search" defaultValue={value} maxLength={120} placeholder={placeholder} className="w-full rounded-xl border border-white/10 bg-slate-950/70 py-3 pl-11 pr-4 outline-none focus:border-cyan-400"/></label><button className="rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950">Search</button>{value && <Link href={action} className="rounded-xl border border-white/10 px-5 py-3 text-slate-300">Clear</Link>}</form>;
}
