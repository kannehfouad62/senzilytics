import { acknowledgeJsa, addJsaHazard, addJsaStep, approveJsa } from "@/features/risks/jsa.actions";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { JsaStatus, PermissionKey, RiskImpact, RiskLikelihood } from "@prisma/client";
import { notFound } from "next/navigation";

const input = "mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2";

export default async function JsaDetail({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission(PermissionKey.VIEW_RISKS);
  const [{ id }, { organizationId, user }] = await Promise.all([params, getCurrentUserTenant()]);
  const [jsa, risks] = await Promise.all([
    prisma.jobSafetyAnalysis.findFirst({ where: { id, organizationId }, include: { site: true, owner: true, approvedBy: true, steps: { orderBy: { sequence: "asc" }, include: { hazards: { include: { controls: true, risk: true } } } }, acknowledgments: { include: { user: true } } } }),
    prisma.risk.findMany({ where: { organizationId } }),
  ]);
  if (!jsa) notFound();
  const draft = jsa.status === JsaStatus.DRAFT;
  return <div>
    <p className="text-sm text-cyan-300">{jsa.reference} · Version {jsa.version}</p>
    <h1 className="mt-2 text-4xl font-bold">{jsa.title}</h1>
    <p className="mt-2 text-slate-400">{jsa.jobDescription}</p>
    <div className="mt-8 space-y-6">
      {jsa.steps.map((step) => <section key={step.id} className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-xl font-semibold">{step.sequence}. {step.taskStep}</h2>
        {step.hazards.map((hazard) => <div key={hazard.id} className="mt-4 rounded-2xl bg-slate-950/50 p-4">
          <p className="font-medium">{hazard.hazard}</p><p className="text-sm text-slate-400">Consequence: {hazard.potentialConsequence}</p>
          <p className="mt-2 text-sm">Initial {hazard.initialScore} → Residual {hazard.residualScore}{hazard.risk ? ` · Linked ${hazard.risk.reference}` : ""}</p>
          <ul className="mt-2 list-disc pl-5 text-sm text-emerald-200">{hazard.controls.map((control) => <li key={control.id}>{control.hierarchy}: {control.description}</li>)}</ul>
        </div>)}
        {draft && <form action={addJsaHazard} className="mt-5 grid gap-3 md:grid-cols-2">
          <input type="hidden" name="stepId" value={step.id}/><input name="hazard" placeholder="Hazard" required className={input}/><input name="potentialConsequence" placeholder="Potential consequence" required className={input}/>
          <select name="initialLikelihood" className={input}>{Object.values(RiskLikelihood).map((value) => <option key={value}>{value}</option>)}</select><select name="initialImpact" className={input}>{Object.values(RiskImpact).map((value) => <option key={value}>{value}</option>)}</select>
          <select name="residualLikelihood" className={input}>{Object.values(RiskLikelihood).map((value) => <option key={value}>{value}</option>)}</select><select name="residualImpact" className={input}>{Object.values(RiskImpact).map((value) => <option key={value}>{value}</option>)}</select>
          <select name="riskId" className={input}><option value="">No Risk Register link</option>{risks.map((risk) => <option key={risk.id} value={risk.id}>{risk.reference} — {risk.title}</option>)}</select><textarea name="controls" placeholder="Controls, one per line" required className={input}/><button className="rounded-xl bg-cyan-300 px-4 py-2 text-slate-950">Add Hazard</button>
        </form>}
      </section>)}
      {draft && <form action={addJsaStep} className="flex gap-3 rounded-3xl border border-white/10 bg-white/5 p-6"><input type="hidden" name="jsaId" value={jsa.id}/><input name="taskStep" placeholder="Next task step" required className={input}/><button className="rounded-xl bg-cyan-300 px-4 py-2 text-slate-950">Add Step</button></form>}
      <div className="flex gap-3">{draft && <form action={approveJsa}><input type="hidden" name="id" value={jsa.id}/><button className="rounded-xl bg-emerald-300 px-5 py-3 text-slate-950">Approve & Activate</button></form>}{jsa.status === JsaStatus.ACTIVE && <form action={acknowledgeJsa} className="flex gap-3"><input type="hidden" name="jsaId" value={jsa.id}/><input name="statement" defaultValue="I understand this JSA and the required controls." className={input}/><button className="rounded-xl bg-cyan-300 px-5 py-3 text-slate-950">Acknowledge</button></form>}</div>
      <p className="text-sm text-slate-400">{jsa.acknowledgments.length} acknowledgments{jsa.acknowledgments.some((item) => item.userId === user.id) ? " · You acknowledged this version" : ""}</p>
    </div>
  </div>;
}
