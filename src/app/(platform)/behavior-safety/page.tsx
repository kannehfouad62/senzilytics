import { getCurrentUserPermissions, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { BehaviorFollowUpStatus, PermissionKey } from "@prisma/client";
import { BarChart3, MessageSquareText, Plus, ShieldCheck } from "lucide-react";
import Link from "next/link";

export default async function BehaviorSafetyPage() {
  await requirePermission(PermissionKey.VIEW_BEHAVIOR_SAFETY);
  const [{ organizationId }, permissions] = await Promise.all([getCurrentUserTenant(), getCurrentUserPermissions()]);
  const canManage = permissions.includes(PermissionKey.MANAGE_BEHAVIOR_SAFETY);
  const canRecord = permissions.includes(PermissionKey.RECORD_BEHAVIOR_COACHING);
  const [programs, sessions, sessionCount, openFollowUps, recognitions, recognitionCount] = await Promise.all([
    prisma.behaviorSafetyProgram.findMany({ where: { organizationId }, include: { owner: true, site: true, behaviors: { where: { isActive: true }, select: { id: true } }, _count: { select: { sessions: true } } }, orderBy: { name: "asc" } }),
    prisma.behaviorCoachingSession.findMany({ where: { organizationId }, include: { program: true, site: true, observer: true }, orderBy: { observedAt: "desc" }, take: 20 }),
    prisma.behaviorCoachingSession.count({ where: { organizationId } }),
    prisma.behaviorCoachingSession.count({ where: { organizationId, followUpStatus: { in: [BehaviorFollowUpStatus.OPEN, BehaviorFollowUpStatus.IN_PROGRESS] } } }),
    prisma.behaviorRecognition.findMany({ where: { organizationId, status: "APPROVED" }, include: { nominatedUser: true }, orderBy: { awardedAt: "desc" }, take: 5 }),
    prisma.behaviorRecognition.count({ where: { organizationId, status: "APPROVED" } }),
  ]);
  const activeProgram = programs.find(program => program.status === "ACTIVE");

  return <div>
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="flex items-center gap-2 text-sm text-cyan-300"><ShieldCheck size={17} />Workforce Engagement</p>
        <h1 className="mt-2 text-4xl font-bold">Behavior-Based Safety</h1>
        <p className="mt-2 max-w-3xl text-slate-400">Strengthen safe habits through respectful peer observations, immediate coaching, positive recognition, and transparent leading indicators—not punitive surveillance.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href="/behavior-safety/dashboard" className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3"><BarChart3 size={17} />Analytics</Link>
        {canManage && <Link href="/behavior-safety/new" className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3"><Plus size={17} />New Program</Link>}
        {canRecord && activeProgram && <Link href={`/behavior-safety/sessions/new?programId=${activeProgram.id}`} className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950"><MessageSquareText size={17} />Record Coaching</Link>}
      </div>
    </div>
    <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Programs" value={programs.length} />
      <Metric label="Coaching sessions" value={sessionCount} />
      <Metric label="Open follow-ups" value={openFollowUps} danger={openFollowUps > 0} />
      <Metric label="Recognitions" value={recognitionCount} />
    </div>
    <div className="mt-8 grid gap-6 xl:grid-cols-2">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-xl font-semibold">Behavior programs</h2>
        <div className="mt-4 space-y-3">
          {programs.map(program => <Link key={program.id} href={`/behavior-safety/programs/${program.id}`} className="block rounded-2xl border border-white/10 p-4 hover:bg-white/5">
            <div className="flex justify-between gap-3"><span className="font-semibold text-cyan-200">{program.code} — {program.name}</span><span className="text-xs">{program.status}</span></div>
            <p className="mt-2 text-xs text-slate-500">{program.site?.name || "Organization-wide"} · {program.behaviors.length} behaviors · {program._count.sessions} sessions · Owner {program.owner.name}</p>
          </Link>)}
          {!programs.length && <p className="text-sm text-slate-400">No behavior-safety programs have been defined.</p>}
        </div>
      </section>
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-xl font-semibold">Recent coaching</h2>
        <div className="mt-4 space-y-3">
          {sessions.slice(0, 10).map(session => <Link key={session.id} href={`/behavior-safety/sessions/${session.id}`} className="block rounded-2xl border border-white/10 p-4 hover:bg-white/5">
            <div className="flex justify-between gap-3"><span className="font-semibold">{session.reference}</span><span className={`text-xs ${session.atRiskCount ? "text-amber-300" : "text-emerald-300"}`}>{session.overallOutcome.replaceAll("_", " ")}</span></div>
            <p className="mt-2 text-xs text-slate-500">{session.program.name} · {session.site.name} · {session.safeCount} safe / {session.atRiskCount} at risk · {session.observer.name}</p>
          </Link>)}
          {!sessions.length && <p className="text-sm text-slate-400">No coaching sessions have been recorded.</p>}
        </div>
      </section>
    </div>
    {recognitions.length > 0 && <section className="mt-8 rounded-3xl border border-emerald-400/15 bg-emerald-400/[.04] p-6">
      <h2 className="text-xl font-semibold text-emerald-200">Positive safety leadership</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">{recognitions.map(recognition => <div key={recognition.id} className="rounded-2xl border border-emerald-400/10 p-4"><p className="font-semibold">{recognition.nominatedUser.name}</p><p className="mt-2 text-sm text-slate-300">{recognition.reason}</p></div>)}</div>
    </section>}
  </div>;
}

function Metric({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-sm text-slate-400">{label}</p><p className={`mt-2 text-3xl font-bold ${danger ? "text-amber-300" : ""}`}>{value}</p></div>;
}
