import Link from "next/link";
import { PermissionKey } from "@prisma/client";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { requirePermission } from "@/lib/permissions";

const resources = [
  ["incidents", "READ_INCIDENTS"],
  ["actions", "READ_ACTIONS"],
  ["audits", "READ_AUDITS"],
  ["inspections", "READ_INSPECTIONS"],
  ["risks", "READ_RISKS"],
  ["compliance", "READ_COMPLIANCE"],
  ["training", "READ_TRAINING"],
  ["assurance", "READ_ASSURANCE"],
];

export default async function IntegrationApiDocsPage() {
  await requirePermission(PermissionKey.MANAGE_INTEGRATIONS);
  return <div className="max-w-5xl">
    <Link href="/integrations" className="flex items-center gap-2 text-sm text-cyan-300"><ArrowLeft size={16} />Back to Integrations</Link>
    <p className="mt-7 text-sm text-cyan-300">Senzilytics API v1</p>
    <h1 className="mt-2 text-4xl font-bold">Integration guide</h1>
    <p className="mt-3 text-slate-400">Read tenant-scoped operational records and verify signed webhook events. API v1 is intentionally read-only; application workflows remain governed inside Senzilytics.</p>
    <section className={card}><h2 className={heading}>Authentication</h2><p className={copy}>Send the one-time credential in the Authorization header. Never place it in a URL, browser bundle, or source repository.</p><Code value={'curl -H "Authorization: Bearer sz_live_…" "https://www.senzilytics.cloud/api/v1/incidents?limit=50"'} /></section>
    <section className={card}><h2 className={heading}>Resources and scopes</h2><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-slate-500"><tr><th className="pb-3">Path</th><th>Required scope</th></tr></thead><tbody className="divide-y divide-white/5">{resources.map(([path, scope]) => <tr key={path}><td className="py-3 font-mono text-cyan-200">/api/v1/{path}</td><td className="font-mono text-slate-400">{scope}</td></tr>)}</tbody></table></div><p className={`${copy} mt-4`}>Use <code>limit</code> from 1–100, <code>cursor</code> from the prior response, and optional ISO 8601 <code>updatedSince</code>. Responses include an <code>x-request-id</code> and are never cached.</p></section>
    <section className={card}><h2 className={heading}>Webhook verification</h2><p className={copy}>Compute HMAC-SHA256 over <code>timestamp.rawBody</code> using the signing secret. Compare the result to the <code>senzilytics-signature</code> header using a constant-time comparison.</p><Code value={'const signed = timestamp + "." + rawBody;\nconst expected = "v1=" + hmacSha256(signingSecret, signed);'} /><div className="mt-4 grid gap-2 text-sm text-slate-400"><p><code>senzilytics-event</code> — event category</p><p><code>senzilytics-delivery</code> — stable delivery identifier</p><p><code>senzilytics-timestamp</code> — Unix seconds used in the signature</p><p><code>senzilytics-signature</code> — versioned HMAC signature</p></div></section>
    <section className="mt-6 rounded-3xl border border-emerald-400/20 bg-emerald-400/[.05] p-6"><h2 className="flex items-center gap-2 text-lg font-semibold text-emerald-200"><ShieldCheck size={18} />Operational safeguards</h2><p className="mt-3 text-sm text-slate-300">Accept events idempotently using the delivery ID. Return a 2xx response only after durable receipt. Failed events retry after approximately 1 minute, 5 minutes, 30 minutes, 2 hours, 12 hours, and 24 hours, then become abandoned for administrator review. Reject stale timestamps according to your security policy.</p></section>
  </div>;
}

function Code({ value }: { value: string }) { return <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-sm text-cyan-200"><code>{value}</code></pre>; }
const card = "mt-6 rounded-3xl border border-white/10 bg-white/[.04] p-6";
const heading = "text-xl font-semibold";
const copy = "mt-3 text-sm leading-6 text-slate-400";
