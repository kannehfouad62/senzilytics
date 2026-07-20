import { createTenant, updateTenantSubscription } from "@/features/identity/tenant.actions";
import { requirePlatformAdministrator } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";
import { planEntitlements } from "@/lib/subscription";
import { SubscriptionPlan } from "@prisma/client";

const input = "mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3";
export default async function TenantConsole() {
  await requirePlatformAdministrator();
  const tenants = await prisma.organization.findMany({ include: { _count: { select: { users: true, sites: true } }, identityProviders: true }, orderBy: { name: "asc" } });
  return <div><p className="text-sm text-cyan-300">Platform Administration</p><h1 className="mt-2 text-4xl font-bold">Tenant Provisioning</h1><p className="mt-2 text-slate-400">Create tenants and control their commercial feature entitlements.</p>
    <div className="mt-8 grid gap-6 xl:grid-cols-[.8fr_1.2fr]"><form action={createTenant} className="h-fit space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6"><h2 className="text-xl font-semibold">Create Tenant</h2>
      {[["name","Company name"],["industry","Industry"],["domain","Approved email domain"],["adminName","Tenant administrator"],["adminEmail","Administrator email"]].map(([name,label])=><label key={name} className="block text-sm">{label}<input name={name} required={name!=="industry"} type={name==="adminEmail"?"email":"text"} className={input}/></label>)}
      <label className="block text-sm">Subscription plan<select name="subscriptionPlan" defaultValue={SubscriptionPlan.ENTERPRISE} className={input}>{Object.values(SubscriptionPlan).map(plan=><option key={plan} value={plan}>{pretty(plan)}</option>)}</select></label>
      <label className="block text-sm">Contracted users<input type="number" min="1" name="contractedUserMinimum" placeholder="Defaults to plan minimum" className={input}/></label>
      <label className="block text-sm">Agreement notes<textarea name="subscriptionNotes" rows={3} placeholder="Agreed pricing, term, implementation notes..." className={input}/></label>
      <button className="w-full rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950">Create & Invite Administrator</button>
    </form><section className="space-y-4">{tenants.map(tenant=><article key={tenant.id} className="rounded-3xl border border-white/10 bg-white/5 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{tenant.name}</p><p className="mt-1 text-sm text-slate-400">{tenant._count.users} users · {tenant._count.sites} sites · {tenant.identityProviders.length} SSO connections</p></div><div className="text-right"><span className={tenant.status==="ACTIVE"?"text-emerald-300":"text-red-300"}>{tenant.status}</span><p className="mt-1 text-xs font-semibold text-cyan-300">{pretty(tenant.subscriptionPlan)}</p></div></div>
      <div className="mt-4 flex flex-wrap gap-2">{Object.entries(planEntitlements[tenant.subscriptionPlan]).map(([feature,enabled])=><span key={feature} className={`rounded-full px-3 py-1 text-[11px] ${enabled?"bg-emerald-400/10 text-emerald-300":"bg-slate-950 text-slate-600"}`}>{pretty(feature)}</span>)}</div>
      <details className="mt-5 rounded-2xl border border-white/10 p-4"><summary className="cursor-pointer text-sm font-semibold text-cyan-300">Manage subscription</summary><form action={updateTenantSubscription} className="mt-4 grid gap-4 md:grid-cols-2"><input type="hidden" name="organizationId" value={tenant.id}/><label className="text-sm">Plan<select name="subscriptionPlan" defaultValue={tenant.subscriptionPlan} className={input}>{Object.values(SubscriptionPlan).map(plan=><option key={plan} value={plan}>{pretty(plan)}</option>)}</select></label><label className="text-sm">Contracted users<input type="number" min="1" name="contractedUserMinimum" defaultValue={tenant.contractedUserMinimum??""} className={input}/></label><label className="text-sm md:col-span-2">Agreement notes<textarea name="subscriptionNotes" rows={2} defaultValue={tenant.subscriptionNotes??""} className={input}/></label><button className="rounded-xl bg-cyan-300 px-4 py-2 font-semibold text-slate-950 md:col-span-2">Update Subscription</button></form></details>
    </article>)}</section></div>
  </div>;
}
function pretty(value:string){return value.replaceAll("_"," ").toLowerCase().replace(/\b\w/g,letter=>letter.toUpperCase())}
