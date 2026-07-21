import { prisma } from "@/lib/prisma";
import { PermissionKey, RiskLevel } from "@prisma/client";

export type AssuranceSignal = {
  id: string;
  title: string;
  detail: string;
  source: string;
  href: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  site: string | null;
};

export type AssuranceConnection = {
  label: string;
  count: number;
  detail: string;
  href: string;
};

const elevated = [RiskLevel.HIGH, RiskLevel.CRITICAL];
const overdue = (date: Date | null, now: Date) => Boolean(date && date < now);

export function rankAssuranceSignals(signals: AssuranceSignal[]) {
  const weight = { CRITICAL: 3, HIGH: 2, MEDIUM: 1 } as const;
  return [...signals].sort((a, b) => weight[b.severity] - weight[a.severity] || a.title.localeCompare(b.title));
}

export async function getOperationalAssuranceOverview(input: {
  organizationId: string;
  permissions: PermissionKey[];
  limit?: number;
}) {
  const allowed = new Set(input.permissions);
  const now = new Date();
  const actionScope = {
    OR: [
      { incident: { site: { organizationId: input.organizationId } } },
      { auditFinding: { audit: { site: { organizationId: input.organizationId } } } },
      { inspectionFinding: { inspection: { site: { organizationId: input.organizationId } } } },
      { enterpriseAuditFindingLinks: { some: { finding: { organizationId: input.organizationId } } } },
    ],
  };

  const contractorHorizon = new Date(now);
  contractorHorizon.setUTCDate(contractorHorizon.getUTCDate() + 30);
  const [observations, incidents, auditFindings, inspectionFindings, risks, mocs, contractors, permitsToWork, connections] = await Promise.all([
    allowed.has(PermissionKey.VIEW_OBSERVATIONS) ? prisma.safetyObservation.findMany({
      where: { organizationId: input.organizationId, riskLevel: { in: elevated }, status: { notIn: ["RESOLVED", "CLOSED"] } },
      include: { site: true }, orderBy: { observedAt: "desc" }, take: 20,
    }) : [],
    allowed.has(PermissionKey.VIEW_INCIDENT) ? prisma.incident.findMany({
      where: { site: { organizationId: input.organizationId }, riskLevel: { in: elevated }, status: { notIn: ["COMPLETED", "CLOSED"] } },
      include: { site: true, actions: { select: { id: true, dueDate: true, status: true } } }, orderBy: { occurredAt: "desc" }, take: 20,
    }) : [],
    allowed.has(PermissionKey.VIEW_AUDITS) ? prisma.enterpriseAuditFinding.findMany({
      where: { organizationId: input.organizationId, OR: [{ severity: { in: ["HIGH", "CRITICAL"] } }, { isRepeatFinding: true }], status: { notIn: ["VERIFIED", "CLOSED", "REJECTED", "CANCELLED"] } },
      include: { audit: { include: { site: true } }, correctiveActionLinks: { select: { correctiveActionId: true } }, riskLinks: { select: { riskId: true } } },
      orderBy: { createdAt: "desc" }, take: 20,
    }) : [],
    allowed.has(PermissionKey.VIEW_INSPECTIONS) ? prisma.inspectionFinding.findMany({
      where: { inspection: { site: { organizationId: input.organizationId } }, riskLevel: { in: elevated }, status: { notIn: ["COMPLETED", "CLOSED"] } },
      include: { inspection: { include: { site: true } }, correctiveAction: { select: { id: true } } }, orderBy: { createdAt: "desc" }, take: 20,
    }) : [],
    allowed.has(PermissionKey.VIEW_RISKS) ? prisma.risk.findMany({
      where: { organizationId: input.organizationId, currentRiskLevel: { in: elevated }, status: { notIn: ["CLOSED", "ARCHIVED"] } },
      include: { site: true, controls: { where: { status: { notIn: ["COMPLETED", "CLOSED"] } }, select: { dueDate: true } } }, orderBy: { currentScore: "desc" }, take: 20,
    }) : [],
    allowed.has(PermissionKey.VIEW_MOC) ? prisma.managementOfChange.findMany({
      where: { organizationId: input.organizationId, residualRiskLevel: { in: elevated }, status: { notIn: ["CLOSED", "REJECTED", "CANCELLED"] } },
      include: { site: true, tasks: { where: { status: { notIn: ["COMPLETED", "CANCELLED"] } }, select: { dueDate: true } }, riskLinks: { select: { riskId: true } } }, orderBy: { createdAt: "desc" }, take: 20,
    }) : [],
    allowed.has(PermissionKey.VIEW_CONTRACTORS) ? prisma.contractor.findMany({
      where: { organizationId: input.organizationId, status: "APPROVED", insuranceExpiresAt: { lte: contractorHorizon } },
      orderBy: { insuranceExpiresAt: "asc" }, take: 20,
    }) : [],
    allowed.has(PermissionKey.VIEW_PERMITS_TO_WORK) ? prisma.permitToWork.findMany({
      where: { organizationId: input.organizationId, OR: [{ status: "SUSPENDED" }, { status: "ACTIVE", plannedEndAt: { lt: now } }] },
      include: { site: true }, orderBy: { plannedEndAt: "asc" }, take: 20,
    }) : [],
    Promise.all([
      prisma.safetyObservation.count({ where: { organizationId: input.organizationId, incidentId: { not: null } } }),
      prisma.correctiveAction.count({ where: { ...actionScope, incidentId: { not: null } } }),
      prisma.enterpriseAuditFindingActionLink.count({ where: { finding: { organizationId: input.organizationId }, correctiveActionId: { not: null } } }),
      prisma.enterpriseAuditFindingRiskLink.count({ where: { finding: { organizationId: input.organizationId }, riskId: { not: null } } }),
      prisma.inspectionFinding.count({ where: { inspection: { site: { organizationId: input.organizationId } }, correctiveAction: { isNot: null } } }),
      prisma.mocRiskLink.count({ where: { moc: { organizationId: input.organizationId } } }),
      prisma.permitToWork.count({ where: { organizationId: input.organizationId, contractorId: { not: null } } }),
    ]),
  ]);

  const signals: AssuranceSignal[] = [
    ...observations.map(x => ({ id: `observation:${x.id}`, title: x.title, detail: overdue(x.followUpDueDate, now) ? "High-risk observation follow-up is overdue." : "High-risk observation remains unresolved.", source: "Observation", href: `/observations/${x.id}`, severity: x.riskLevel as "CRITICAL" | "HIGH", site: x.site.name })),
    ...incidents.map(x => { const overdueActions=x.actions.filter(a=>overdue(a.dueDate,now)&&a.status!=="COMPLETED"&&a.status!=="CLOSED").length; return { id:`incident:${x.id}`, title:x.title, detail:overdueActions?`${overdueActions} linked corrective action${overdueActions===1?" is":"s are"} overdue.`:"Elevated-risk incident remains open.", source:"Incident", href:`/incidents/${x.id}`, severity:x.riskLevel as "CRITICAL"|"HIGH", site:x.site.name }; }),
    ...auditFindings.map(x => ({ id:`audit:${x.id}`, title:x.title, detail:`${x.isRepeatFinding?"Repeat finding. ":""}${x.correctiveActionLinks.length} CAPA and ${x.riskLinks.length} risk link${x.riskLinks.length===1?"":"s"}.`, source:"Audit Finding", href:`/audits/${x.auditId}`, severity:(x.severity==="CRITICAL"?"CRITICAL":x.severity==="HIGH"?"HIGH":"MEDIUM") as AssuranceSignal["severity"], site:x.audit.site.name })),
    ...inspectionFindings.map(x => ({ id:`inspection:${x.id}`, title:x.title, detail:`High-risk inspection finding${x.correctiveAction?" with linked CAPA":" without a linked CAPA"}.`, source:"Inspection Finding", href:`/inspections/${x.inspectionId}`, severity:x.riskLevel as "CRITICAL"|"HIGH", site:x.inspection.site.name })),
    ...risks.map(x => { const overdueControls=x.controls.filter(c=>overdue(c.dueDate,now)).length; return { id:`risk:${x.id}`, title:x.title, detail:overdue(x.nextReviewDate,now)?"Risk review is overdue.":overdueControls?`${overdueControls} risk control${overdueControls===1?" is":"s are"} overdue.`:"Elevated residual exposure requires monitoring.", source:"Risk", href:`/risks/${x.id}`, severity:x.currentRiskLevel as "CRITICAL"|"HIGH", site:x.site?.name??null }; }),
    ...mocs.map(x => { const overdueTasks=x.tasks.filter(t=>overdue(t.dueDate,now)).length; return { id:`moc:${x.id}`, title:x.title, detail:overdueTasks?`${overdueTasks} required change task${overdueTasks===1?" is":"s are"} overdue.`:`Elevated residual risk with ${x.riskLinks.length} linked risk${x.riskLinks.length===1?"":"s"}.`, source:"MOC", href:`/moc/${x.id}`, severity:x.residualRiskLevel as "CRITICAL"|"HIGH", site:x.site.name }; }),
    ...contractors.map(x => ({ id:`contractor:${x.id}`, title:x.name, detail:x.insuranceExpiresAt && x.insuranceExpiresAt < now ? "Approved contractor insurance has expired." : `Contractor insurance expires within 30 days${x.insuranceExpiresAt ? ` (${x.insuranceExpiresAt.toLocaleDateString()})` : ""}.`, source:"Contractor", href:`/contractors/${x.id}`, severity:(x.insuranceExpiresAt && x.insuranceExpiresAt < now ? "CRITICAL" : "HIGH") as AssuranceSignal["severity"], site:null })),
    ...permitsToWork.map(x => ({ id:`permit-to-work:${x.id}`, title:`${x.reference} — ${x.title}`, detail:x.status==="SUSPENDED"?"High-risk work permit is suspended and requires resolution.":"Active work permit is past its authorized end time.", source:"Permit to Work", href:`/permits-to-work/${x.id}`, severity:(x.plannedEndAt < now ? "CRITICAL" : "HIGH") as AssuranceSignal["severity"], site:x.site.name })),
  ];

  const connectionRows: AssuranceConnection[] = [
    { label: "Observations → Incidents", count: connections[0], detail: "Escalated frontline warning signals", href: "/observations" },
    { label: "Incidents → CAPA", count: connections[1], detail: "Corrective actions created from events", href: "/incidents" },
    { label: "Audit Findings → CAPA", count: connections[2], detail: "Audit deficiencies under correction", href: "/audits" },
    { label: "Audit Findings → Risks", count: connections[3], detail: "Material findings escalated to risk", href: "/risks" },
    { label: "Inspection Findings → CAPA", count: connections[4], detail: "Inspection deficiencies under correction", href: "/inspections" },
    { label: "MOC → Risks", count: connections[5], detail: "Change-related risk relationships", href: "/moc" },
    { label: "Contractors → Work Permits", count: connections[6], detail: "Third-party work under permit control", href: "/permits-to-work" },
  ];

  const ranked = rankAssuranceSignals(signals);
  return { signals: ranked.slice(0, input.limit ?? 30), signalCount: ranked.length, criticalCount: ranked.filter(x=>x.severity==="CRITICAL").length, connections: connectionRows, connectionCount: connectionRows.reduce((sum,row)=>sum+row.count,0), generatedAt: now };
}
