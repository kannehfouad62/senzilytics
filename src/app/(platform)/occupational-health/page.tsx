import { RegisterPagination } from "@/components/register/register-pagination";
import { RegisterSearch } from "@/components/register/register-search";
import { normalizeRegisterQuery, registerPageCount } from "@/core/register/register-query";
import { getCurrentUserPermissions, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { PermissionKey, Prisma, SurveillanceEnrollmentStatus, SurveillanceProgramStatus } from "@prisma/client";
import { HeartPulse, Plus } from "lucide-react";
import Link from "next/link";

export default async function OccupationalHealthPage({ searchParams }: { searchParams: Promise<{ search?: string; page?: string }> }) {
  await requirePermission(PermissionKey.VIEW_OCCUPATIONAL_HEALTH);
  const [{ organizationId }, permissions, params] = await Promise.all([getCurrentUserTenant(), getCurrentUserPermissions(), searchParams]);
  const query = normalizeRegisterQuery(params);
  const where: Prisma.MedicalSurveillanceProgramWhereInput = { organizationId, ...(query.search ? { OR: [
    { name: { contains: query.search, mode: "insensitive" } }, { description: { contains: query.search, mode: "insensitive" } },
    { regulatoryBasis: { contains: query.search, mode: "insensitive" } }, { protocolReference: { contains: query.search, mode: "insensitive" } },
    { providerName: { contains: query.search, mode: "insensitive" } }, { agent: { name: { contains: query.search, mode: "insensitive" } } },
    { group: { name: { contains: query.search, mode: "insensitive" } } }, { responsibleUser: { name: { contains: query.search, mode: "insensitive" } } },
  ] } : {}) };
  const [programs, total, registered, active, due, restricted] = await Promise.all([
    prisma.medicalSurveillanceProgram.findMany({ where, include: { agent: true, group: true, responsibleUser: true, _count: { select: { enrollments: true } } }, orderBy: { name: "asc" }, skip: query.skip, take: query.take }),
    prisma.medicalSurveillanceProgram.count({ where }), prisma.medicalSurveillanceProgram.count({ where: { organizationId } }),
    prisma.medicalSurveillanceProgram.count({ where: { organizationId, status: SurveillanceProgramStatus.ACTIVE } }),
    prisma.medicalSurveillanceEnrollment.count({ where: { program: { organizationId }, status: { in: [SurveillanceEnrollmentStatus.DUE, SurveillanceEnrollmentStatus.OVERDUE] } } }),
    prisma.medicalSurveillanceEnrollment.count({ where: { program: { organizationId }, fitnessOutcome: { in: ["CLEARED_WITH_RESTRICTIONS", "TEMPORARILY_NOT_CLEARED"] } } }),
  ]);
  const canManage = permissions.includes(PermissionKey.MANAGE_OCCUPATIONAL_HEALTH);
  return <div>
    <div className="flex flex-wrap justify-between gap-4"><div><p className="flex items-center gap-2 text-sm text-cyan-300"><HeartPulse size={17}/>Privacy-Conscious Workforce Assurance</p><h1 className="mt-2 text-4xl font-bold">Occupational Health</h1><p className="mt-2 max-w-3xl text-slate-400">Administer exposure-based medical surveillance, recurring due dates, provider certificates, and fitness-for-work outcomes without storing diagnoses or clinical test details.</p></div>{canManage&&<Link href="/occupational-health/new" className="inline-flex h-fit items-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950"><Plus size={17}/>New Program</Link>}</div>
    <div className="mt-7 grid gap-4 sm:grid-cols-4"><Metric label="Programs" value={registered}/><Metric label="Active" value={active}/><Metric label="Due / overdue" value={due} danger={due>0}/><Metric label="Work restrictions" value={restricted} danger={restricted>0}/></div>
    <p className="mt-7 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-200">Restricted workspace: record only administrative surveillance status and provider-issued fitness-for-work outcomes. Do not enter diagnoses, treatments, laboratory results, or clinical notes.</p>
    <div className="mt-6"><RegisterSearch action="/occupational-health" value={query.search} placeholder="Search program, protocol, provider, exposure group, or owner"/><p className="mt-3 text-sm text-slate-500">{total} matching program{total===1?"":"s"}</p></div>
    <div className="mt-6 grid gap-4">{programs.map(x=><Link key={x.id} href={`/occupational-health/${x.id}`} className="rounded-3xl border border-white/10 bg-white/5 p-5"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold">{x.name}</p><p className="mt-2 text-sm text-slate-400">{x.agent?.name||"General surveillance"} · {x.group?.name||"No specific SEG"} · Every {x.frequencyMonths} month(s)</p></div><span className="text-xs text-cyan-300">{x.status}</span></div><p className="mt-4 text-xs text-slate-500">{x._count.enrollments} enrolled · Owner {x.responsibleUser.name}</p></Link>)}</div>
    {!programs.length&&<p className="mt-8 rounded-3xl border border-dashed border-white/10 p-10 text-center text-slate-500">{query.search?"No surveillance programs match this search.":"No occupational health surveillance programs have been created."}</p>}
    <RegisterPagination action="/occupational-health" search={query.search} page={query.page} pages={registerPageCount(total)}/>
  </div>;
}
function Metric({label,value,danger=false}:{label:string;value:number;danger?:boolean}){return <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-xs uppercase text-slate-500">{label}</p><p className={`mt-2 text-3xl font-bold ${danger?"text-red-300":"text-white"}`}>{value}</p></div>}
