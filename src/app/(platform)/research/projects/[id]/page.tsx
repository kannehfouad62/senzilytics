import {
  ResearchMilestoneForm,
  ResearchStatusForm,
  ResearchTeamForm,
} from "@/features/research/research-forms";
import {
  getCurrentUserPermissions,
  requirePermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  availableResearchProjectStatuses,
  researchProjectReadiness,
} from "@/modules/research/research-governance";
import { getResearchProject } from "@/modules/research/research.service";
import { PermissionKey, ResearchMilestoneStatus } from "@prisma/client";
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Database,
  FileQuestion,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export default async function ResearchProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission(PermissionKey.VIEW_RESEARCH);
  const [{ id }, tenant, permissions] = await Promise.all([
    params,
    getCurrentUserTenant(),
    getCurrentUserPermissions(),
  ]);
  const project = await getResearchProject(tenant.organizationId, id);
  if (!project) notFound();
  const canManage = permissions.includes(
    PermissionKey.MANAGE_RESEARCH_PROJECTS,
  );
  const canManageTeam = permissions.includes(
    PermissionKey.MANAGE_RESEARCH_TEAMS,
  );
  const users =
    canManage || canManageTeam
      ? await prisma.user.findMany({
          where: { organizationId: tenant.organizationId, isActive: true },
          select: { id: true, name: true, jobTitle: true },
          orderBy: { name: "asc" },
        })
      : [];
  const readiness = researchProjectReadiness({
    ...project,
    clientRequired: Boolean(project.clientId),
    teamCount: project.teamMembers.length,
    milestoneCount: project.milestones.length,
  });
  const nextStatuses = canManage
    ? availableResearchProjectStatuses(project.status)
    : [];
  return (
    <div>
      <Link
        href="/research/projects"
        className="inline-flex items-center gap-2 text-sm text-slate-400"
      >
        <ArrowLeft size={16} />
        Research project register
      </Link>
      <div className="mt-6 flex flex-wrap items-start justify-between gap-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-xs text-cyan-200">
              {pretty(project.status)}
            </span>
            <span className="text-xs text-slate-500">
              {project.reference} · {pretty(project.dataClassification)}
            </span>
          </div>
          <h1 className="mt-3 text-4xl font-bold">{project.title}</h1>
          <p className="mt-2 max-w-3xl text-slate-400">{project.purpose}</p>
        </div>
        <div className="min-w-64 rounded-2xl border border-white/10 bg-white/[.04] p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Governance readiness
            </p>
            <ShieldCheck size={18} className="text-cyan-300" />
          </div>
          <p className="mt-2 text-3xl font-bold">{readiness.score}%</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-300"
              style={{ width: `${readiness.score}%` }}
            />
          </div>
        </div>
      </div>
      {canManage ? (
        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[.035] p-5">
          <ResearchStatusForm projectId={project.id} statuses={nextStatuses} />
        </section>
      ) : null}
      <div className="mt-8 grid gap-5 xl:grid-cols-[1.45fr_.75fr]">
        <div className="space-y-5">
          <Card title="Research protocol" icon={FileQuestion}>
            <Definition label="Objectives" value={project.objectives} />
            <Definition
              label="Research questions"
              value={project.researchQuestions}
            />
            <Definition label="Hypotheses" value={project.hypotheses} />
            <div className="grid gap-4 md:grid-cols-2">
              <Definition
                label="Methodology"
                value={pretty(project.methodology)}
              />
              <Definition
                label="Target population"
                value={project.targetPopulation}
              />
              <Definition
                label="Sampling strategy"
                value={project.samplingStrategy}
              />
              <Definition
                label="Sample target"
                value={project.sampleTarget?.toLocaleString()}
              />
            </div>
          </Card>
          <Card title="Client and data governance" icon={Database}>
            <div className="grid gap-4 md:grid-cols-2">
              <Definition
                label="Commissioning client"
                value={project.client?.name ?? "Internal research"}
              />
              <Definition
                label="Legal data owner"
                value={
                  project.client?.dataOwnerName ??
                  project.dataOwnershipStatement
                }
              />
              <Definition label="Intended use" value={project.intendedUse} />
              <Definition
                label="Retention"
                value={
                  project.retentionDays
                    ? `${project.retentionDays.toLocaleString()} days`
                    : null
                }
              />
              <Definition
                label="Consent required"
                value={project.consentRequired ? "Yes" : "No"}
              />
              <Definition
                label="Ethics approval"
                value={
                  project.ethicsApprovalRequired
                    ? (project.ethicsApprovalReference ??
                      "Required — evidence pending")
                    : "Not required"
                }
              />
            </div>
            <Definition
              label="Confidentiality terms"
              value={project.confidentialityTerms}
            />
          </Card>
          <Card title="Research team" icon={Users}>
            <div className="divide-y divide-white/10">
              {project.teamMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <strong>{member.user.name}</strong>
                    <p className="text-xs text-slate-500">
                      {member.user.jobTitle ?? member.user.email}
                    </p>
                  </div>
                  <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-300">
                    {pretty(member.role)}
                    {member.isLead ? " · Lead" : ""}
                  </span>
                </div>
              ))}
            </div>
            {canManageTeam ? (
              <div className="mt-5 border-t border-white/10 pt-5">
                <ResearchTeamForm projectId={project.id} users={users} />
              </div>
            ) : null}
          </Card>
          <Card
            title="Milestones, task ownership and SLA preparation"
            icon={CalendarDays}
          >
            <div className="divide-y divide-white/10">
              {project.milestones.map((milestone) => (
                <div
                  key={milestone.id}
                  className="grid gap-2 py-3 md:grid-cols-[1fr_auto] md:items-center"
                >
                  <div>
                    <strong className="text-sm">{milestone.title}</strong>
                    <p className="mt-1 text-xs text-slate-500">
                      Owner {milestone.owner?.name ?? "Unassigned"} · Due{" "}
                      {milestone.dueDate?.toLocaleDateString() ?? "not set"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs ${milestone.status === ResearchMilestoneStatus.BLOCKED ? "bg-red-400/10 text-red-200" : milestone.status === ResearchMilestoneStatus.COMPLETED ? "bg-emerald-400/10 text-emerald-200" : "bg-white/5 text-slate-300"}`}
                  >
                    {pretty(milestone.status)}
                  </span>
                </div>
              ))}
            </div>
            {canManage ? (
              <div className="mt-5 border-t border-white/10 pt-5">
                <ResearchMilestoneForm projectId={project.id} users={users} />
              </div>
            ) : null}
          </Card>
        </div>
        <div className="space-y-5">
          <Card title="Accountability" icon={ClipboardCheck}>
            <Definition
              label="Project manager"
              value={`${project.projectManager.name}${project.projectManager.jobTitle ? ` — ${project.projectManager.jobTitle}` : ""}`}
            />
            <Definition
              label="Principal investigator"
              value={project.principalInvestigator?.name}
            />
            <Definition
              label="Start date"
              value={project.startDate?.toLocaleDateString()}
            />
            <Definition
              label="Due date"
              value={project.dueDate?.toLocaleDateString()}
            />
            <Definition
              label="Geographic scope"
              value={project.geographicScope}
            />
          </Card>
          <Card title="Readiness controls" icon={CheckCircle2}>
            <div className="space-y-3">
              {readiness.checks.map((check) => (
                <div
                  key={check.label}
                  className="flex items-center justify-between gap-4 text-sm"
                >
                  <span className="text-slate-300">{check.label}</span>
                  <span
                    className={
                      check.ready ? "text-emerald-300" : "text-amber-300"
                    }
                  >
                    {check.ready ? "Ready" : "Required"}
                  </span>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Research workspaces" icon={BarChart3}>
            <div className="space-y-3">
              <Link
                href={`/research/projects/${project.id}/questionnaires`}
                className="flex items-center justify-between rounded-xl border border-cyan-300/15 bg-cyan-300/[.05] p-4 text-sm font-semibold text-cyan-200"
              >
                <span>Questionnaire Studio</span>
                <span>Open →</span>
              </Link>
              <Link
                href={`/research/projects/${project.id}/reports`}
                className="flex items-center justify-between rounded-xl border border-violet-300/15 bg-violet-300/[.05] p-4 text-sm font-semibold text-violet-200"
              >
                <span>Governed Report Builder</span>
                <span>Open →</span>
              </Link>
              <p className="text-sm leading-6 text-slate-400">
                Data management, statistical analysis, frozen evidence,
                publication review, and controlled exports remain attached to
                this project and its data-owner rules.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof ShieldCheck;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[.035] p-6">
      <div className="mb-5 flex items-center gap-2">
        <Icon size={18} className="text-cyan-300" />
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}
function Definition({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="mb-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-200">
        {value || "Not specified"}
      </p>
    </div>
  );
}
function pretty(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
