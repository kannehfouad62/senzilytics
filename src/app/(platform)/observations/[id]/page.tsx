import { triageSafetyObservation } from "@/features/observations/actions";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { ConfigurableFormModule, PermissionKey, SafetyObservationStatus } from "@prisma/client";
import { notFound } from "next/navigation";

const input="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3";
const displayValue=(value:unknown)=>Array.isArray(value)?value.join(", "):typeof value==="boolean"?(value?"Yes":"No"):String(value??"");

export default async function ObservationPage({params}:{params:Promise<{id:string}>}){
  await requirePermission(PermissionKey.VIEW_OBSERVATIONS);
  const[{id},{organizationId}]=await Promise.all([params,getCurrentUserTenant()]);
  const[o,users,submissions]=await Promise.all([
    prisma.safetyObservation.findFirst({where:{id,organizationId},include:{site:true,reportedBy:true,assignedTo:true}}),
    prisma.user.findMany({where:{organizationId},orderBy:{name:"asc"}}),
    prisma.configurableFormSubmission.findMany({where:{organizationId,entityType:ConfigurableFormModule.OBSERVATION,entityId:id,status:"SUBMITTED"},include:{definition:true,version:true,answers:{include:{field:true},orderBy:{field:{sequence:"asc"}}}},orderBy:{submittedAt:"asc"}}),
  ]);
  if(!o)notFound();
  return <div><p className="text-sm text-cyan-300">{o.reference}</p><h1 className="mt-2 text-4xl font-bold">{o.title}</h1><div className="mt-8 grid gap-6 lg:grid-cols-2"><div className="space-y-6"><section className="rounded-3xl border border-white/10 bg-white/5 p-6"><p className="whitespace-pre-wrap text-slate-300">{o.description}</p><dl className="mt-6 space-y-3 text-sm"><div>Type: {o.type.replaceAll("_"," ")}</div><div>Risk: {o.riskLevel}</div><div>Site: {o.site.name}</div><div>Reporter: {o.isAnonymous?"Anonymous":o.reportedBy.name}</div><div>Immediate action: {o.immediateAction||"None recorded"}</div><div>Follow-up due: {o.followUpDueDate?o.followUpDueDate.toLocaleDateString():"Not set"}</div></dl></section>{submissions.map(submission=><section key={submission.id} className="rounded-3xl border border-cyan-400/20 bg-cyan-400/5 p-6"><p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">Custom form · Version {submission.version.version}</p><h2 className="mt-2 text-xl font-semibold">{submission.definition.name}</h2><dl className="mt-5 space-y-3">{submission.answers.map(answer=><div key={answer.id} className="rounded-xl bg-slate-950/40 p-3"><dt className="text-xs text-slate-500">{answer.field.label}</dt><dd className="mt-1 text-sm text-white">{displayValue(answer.value)}</dd></div>)}</dl><p className="mt-4 text-xs text-slate-500">Submitted {submission.submittedAt.toLocaleString()}</p></section>)}</div><form action={triageSafetyObservation} className="h-fit rounded-3xl border border-white/10 bg-white/5 p-6"><input type="hidden" name="id" value={o.id}/><h2 className="text-xl font-semibold">Triage</h2><label className="mt-5 block">Status<select name="status" defaultValue={o.status} className={input}>{Object.values(SafetyObservationStatus).map(x=><option key={x}>{x}</option>)}</select></label><label className="mt-5 block">Assignee<select name="assignedToId" defaultValue={o.assignedToId||""} className={input}><option value="">Unassigned</option>{users.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label className="mt-5 block">Follow-up due date<input type="date" name="followUpDueDate" defaultValue={o.followUpDueDate?.toISOString().slice(0,10)||""} className={input}/></label><label className="mt-5 block">Review notes<textarea name="reviewNotes" defaultValue={o.reviewNotes||""} rows={5} className={input}/></label><button className="mt-5 rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950">Save Triage</button></form></div></div>;
}
