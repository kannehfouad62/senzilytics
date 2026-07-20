import { startDemo } from "@/features/demo/actions";
import { ArrowLeft, CheckCircle2, Clock3, Eye, ShieldCheck } from "lucide-react";
import Link from "next/link";

const errors: Record<string, string> = {
  invalid: "Complete all required fields and use a valid work email.",
  unavailable: "The interactive demo is temporarily unavailable. Please request a consultation.",
  limit: "This email has reached today’s demo-session limit. Please try again tomorrow or contact us.",
};

export default async function DemoPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white sm:px-8 lg:py-14">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-cyan-300"><ArrowLeft size={16}/> Back to Senzilytics</Link>
        <div className="mt-8 grid gap-10 lg:grid-cols-[1.05fr_.95fr] lg:items-start">
          <section className="pt-4">
            <p className="text-sm font-semibold uppercase tracking-[.22em] text-cyan-300">Interactive product experience</p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-6xl">See connected EHS intelligence in action.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">Explore a fictional organization with realistic incidents, actions, risks, audits, inspections, training, environmental and ESG information—without accessing any customer data.</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                [Eye, "Read-only workspace", "Explore workflows safely without changing the demonstration baseline."],
                [Clock3, "Two-hour access", "Your temporary session expires automatically."],
                [ShieldCheck, "Tenant isolated", "The demo organization is separated from every customer tenant."],
                [CheckCircle2, "No payment required", "Use a valid work email and begin immediately."],
              ].map(([Icon, title, text]) => {
                const I = Icon as typeof Eye;
                return <div key={String(title)} className="rounded-2xl border border-white/10 bg-white/5 p-5"><I className="text-cyan-300" size={21}/><h2 className="mt-3 font-semibold">{String(title)}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{String(text)}</p></div>;
              })}
            </div>
          </section>
          <form action={startDemo} className="rounded-3xl border border-cyan-400/20 bg-white/[.06] p-6 shadow-2xl sm:p-8">
            <h2 className="text-2xl font-semibold">Start your demo</h2>
            <p className="mt-2 text-sm text-slate-400">Tell us who you are so we can prepare your temporary workspace.</p>
            {error && errors[error] && <p role="alert" className="mt-5 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{errors[error]}</p>}
            <div className="mt-6 space-y-4">
              <Field label="Full name"><input name="name" required minLength={2} autoComplete="name" className={input}/></Field>
              <Field label="Work email"><input name="workEmail" type="email" required autoComplete="email" className={input}/></Field>
              <Field label="Company"><input name="company" required minLength={2} autoComplete="organization" className={input}/></Field>
              <Field label="Job title (optional)"><input name="jobTitle" autoComplete="organization-title" className={input}/></Field>
              <label className="flex items-start gap-3 text-sm leading-6 text-slate-300"><input type="checkbox" name="consent" required className="mt-1"/><span>I agree to the demo terms and consent to Senzilytics contacting me about this product experience.</span></label>
              <button className="w-full rounded-2xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200">Enter Interactive Demo</button>
            </div>
            <p className="mt-5 text-xs leading-5 text-slate-500">Demo information is fictional. Administrative controls, destructive actions, outbound email and production integrations are disabled.</p>
          </form>
        </div>
      </div>
    </main>
  );
}

const input = "mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400";
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-medium text-slate-300">{label}{children}</label>; }
