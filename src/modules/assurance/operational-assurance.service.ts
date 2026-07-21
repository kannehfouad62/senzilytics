import { prisma } from "@/lib/prisma";
import { getCompetencyMatrixService } from "@/modules/training/competency.service";
import { CriticalControlVerificationResult, ExposureResultClassification, PermissionKey, RiskLevel, SifSignalClassification, SurveillanceEnrollmentStatus } from "@prisma/client";

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
      { criticalControlVerifications: { some: { organizationId: input.organizationId } } },
      { certificationReviewActions: { some: { review: { organizationId: input.organizationId } } } },
      { assetDefects: { some: { organizationId: input.organizationId } } },
      { behaviorSessions: { some: { organizationId: input.organizationId } } },
      { regulatoryChangeLinks: { some: { change: { organizationId: input.organizationId } } } },
    ],
  };

  const contractorHorizon = new Date(now);
  contractorHorizon.setUTCDate(contractorHorizon.getUTCDate() + 30);
  const [observations, incidents, auditFindings, inspectionFindings, risks, mocs, contractors, permitsToWork, exposureSamples, surveillancePrograms, competencyMatrix, sifControls, sifReviews, certificationReviews, assetDefects, behaviorSessions, regulatoryChanges, connections] = await Promise.all([
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
    allowed.has(PermissionKey.VIEW_INDUSTRIAL_HYGIENE) ? prisma.exposureSample.findMany({
      where: { assessment: { organizationId: input.organizationId }, classification: ExposureResultClassification.ABOVE_LIMIT },
      include: { agent: true, assessment: { include: { site: true } } }, orderBy: { sampledAt: "desc" }, take: 20,
    }) : [],
    allowed.has(PermissionKey.VIEW_OCCUPATIONAL_HEALTH) ? prisma.medicalSurveillanceProgram.findMany({
      where: { organizationId: input.organizationId, enrollments: { some: { status: { in: [SurveillanceEnrollmentStatus.DUE, SurveillanceEnrollmentStatus.OVERDUE] } } } },
      include: { enrollments: { where: { status: { in: [SurveillanceEnrollmentStatus.DUE, SurveillanceEnrollmentStatus.OVERDUE] } }, select: { status: true } } }, take: 20,
    }) : [],
    allowed.has(PermissionKey.VIEW_TRAINING) ? getCompetencyMatrixService(input.organizationId, now) : { rows: [], total: 0, satisfied: 0, expiring: 0, gaps: 0, criticalGaps: 0 },
    allowed.has(PermissionKey.VIEW_SIF_INTELLIGENCE) ? prisma.criticalControlStandard.findMany({ where: { organizationId: input.organizationId, isActive: true }, include: { site: true, verifications: { orderBy: { verifiedAt: "desc" }, take: 1 } } }) : [],
    allowed.has(PermissionKey.VIEW_SIF_INTELLIGENCE) ? prisma.sifSignalReview.findMany({ where: { organizationId: input.organizationId, classification: { in: [SifSignalClassification.POTENTIAL_SIF, SifSignalClassification.PRECURSOR] } }, select: { exposureCategory: true } }) : [],
    allowed.has(PermissionKey.VIEW_CERTIFICATION_READINESS) ? prisma.certificationManagementReview.findMany({ where: { organizationId: input.organizationId, OR: [{ status: { in: ["PLANNED", "IN_PROGRESS"] }, scheduledAt: { lt: now } }, { status: "APPROVED", nextReviewAt: { lt: now } }] }, include: { program: true }, take: 20 }) : [],
    allowed.has(PermissionKey.VIEW_ASSETS) ? prisma.assetDefect.findMany({ where: { organizationId: input.organizationId, status: { not: "CLOSED" }, OR: [{ severity: { in: ["HIGH", "CRITICAL"] } }, { dueDate: { lt: now } }, { asset: { status: { in: ["OUT_OF_SERVICE", "QUARANTINED"] } } }] }, include: { asset: { include: { site: true } }, correctiveAction: true }, orderBy: { createdAt: "desc" }, take: 20 }) : [],
    allowed.has(PermissionKey.VIEW_BEHAVIOR_SAFETY) ? prisma.behaviorCoachingSession.findMany({ where: { organizationId: input.organizationId, OR: [{ criticalAtRiskCount: { gt: 0 }, followUpStatus: { not: "COMPLETED" } }, { followUpStatus: { in: ["OPEN", "IN_PROGRESS"] }, followUpDueAt: { lt: now } }] }, include: { program: true, site: true, correctiveAction: true }, orderBy: { observedAt: "desc" }, take: 20 }) : [],
    allowed.has(PermissionKey.VIEW_COMPLIANCE) ? prisma.regulatoryChange.findMany({ where: { organizationId: input.organizationId, status: { in: ["DETECTED", "UNDER_REVIEW", "IMPACT_ASSESSMENT", "ACTION_REQUIRED"] }, OR: [{ significance: { in: ["HIGH", "CRITICAL"] } }, { assessmentDueAt: { lt: now } }] }, include: { source: true, obligationLinks: true, actionLinks: true }, orderBy: { detectedAt: "desc" }, take: 20 }) : [],
    Promise.all([
      prisma.safetyObservation.count({ where: { organizationId: input.organizationId, incidentId: { not: null } } }),
      prisma.correctiveAction.count({ where: { ...actionScope, incidentId: { not: null } } }),
      prisma.enterpriseAuditFindingActionLink.count({ where: { finding: { organizationId: input.organizationId }, correctiveActionId: { not: null } } }),
      prisma.enterpriseAuditFindingRiskLink.count({ where: { finding: { organizationId: input.organizationId }, riskId: { not: null } } }),
      prisma.inspectionFinding.count({ where: { inspection: { site: { organizationId: input.organizationId } }, correctiveAction: { isNot: null } } }),
      prisma.mocRiskLink.count({ where: { moc: { organizationId: input.organizationId } } }),
      prisma.permitToWork.count({ where: { organizationId: input.organizationId, contractorId: { not: null } } }),
      allowed.has(PermissionKey.VIEW_INDUSTRIAL_HYGIENE) ? prisma.exposureAssessment.count({ where: { organizationId: input.organizationId } }) : 0,
      allowed.has(PermissionKey.VIEW_OCCUPATIONAL_HEALTH) ? prisma.medicalSurveillanceProgram.count({ where: { organizationId: input.organizationId, groupId: { not: null } } }) : 0,
      allowed.has(PermissionKey.VIEW_TRAINING) ? prisma.competencyCourseLink.count({ where: { competency: { organizationId: input.organizationId } } }) : 0,
      allowed.has(PermissionKey.VIEW_CERTIFICATION_READINESS) ? prisma.certificationManagementReview.count({ where: { organizationId: input.organizationId, status: { in: ["COMPLETED", "APPROVED"] } } }) : 0,
      allowed.has(PermissionKey.VIEW_ASSETS) ? prisma.assetDefect.count({ where: { organizationId: input.organizationId, correctiveActionId: { not: null } } }) : 0,
      allowed.has(PermissionKey.VIEW_BEHAVIOR_SAFETY) ? prisma.behaviorCoachingSession.count({ where: { organizationId: input.organizationId, safetyObservationId: { not: null } } }) : 0,
      allowed.has(PermissionKey.VIEW_BEHAVIOR_SAFETY) ? prisma.behaviorCoachingSession.count({ where: { organizationId: input.organizationId, correctiveActionId: { not: null } } }) : 0,
      allowed.has(PermissionKey.VIEW_COMPLIANCE) ? prisma.regulatoryChangeObligationLink.count({ where: { change: { organizationId: input.organizationId } } }) : 0,
      allowed.has(PermissionKey.VIEW_COMPLIANCE) ? prisma.regulatoryChangeActionLink.count({ where: { change: { organizationId: input.organizationId } } }) : 0,
    ]),
  ]);

  const criticalCompetencyGroups = new Map<string,{name:string;count:number}>();
  for(const row of competencyMatrix.rows)if(row.requirement.competency.isCritical&&(row.status==="GAP"||row.status==="EXPIRED")){const current=criticalCompetencyGroups.get(row.requirement.competencyId)||{name:row.requirement.competency.name,count:0};current.count++;criticalCompetencyGroups.set(row.requirement.competencyId,current)}
  const signals: AssuranceSignal[] = [
    ...observations.map(x => ({ id: `observation:${x.id}`, title: x.title, detail: overdue(x.followUpDueDate, now) ? "High-risk observation follow-up is overdue." : "High-risk observation remains unresolved.", source: "Observation", href: `/observations/${x.id}`, severity: x.riskLevel as "CRITICAL" | "HIGH", site: x.site.name })),
    ...incidents.map(x => { const overdueActions=x.actions.filter(a=>overdue(a.dueDate,now)&&a.status!=="COMPLETED"&&a.status!=="CLOSED").length; return { id:`incident:${x.id}`, title:x.title, detail:overdueActions?`${overdueActions} linked corrective action${overdueActions===1?" is":"s are"} overdue.`:"Elevated-risk incident remains open.", source:"Incident", href:`/incidents/${x.id}`, severity:x.riskLevel as "CRITICAL"|"HIGH", site:x.site.name }; }),
    ...auditFindings.map(x => ({ id:`audit:${x.id}`, title:x.title, detail:`${x.isRepeatFinding?"Repeat finding. ":""}${x.correctiveActionLinks.length} CAPA and ${x.riskLinks.length} risk link${x.riskLinks.length===1?"":"s"}.`, source:"Audit Finding", href:`/audits/${x.auditId}`, severity:(x.severity==="CRITICAL"?"CRITICAL":x.severity==="HIGH"?"HIGH":"MEDIUM") as AssuranceSignal["severity"], site:x.audit.site.name })),
    ...inspectionFindings.map(x => ({ id:`inspection:${x.id}`, title:x.title, detail:`High-risk inspection finding${x.correctiveAction?" with linked CAPA":" without a linked CAPA"}.`, source:"Inspection Finding", href:`/inspections/${x.inspectionId}`, severity:x.riskLevel as "CRITICAL"|"HIGH", site:x.inspection.site.name })),
    ...risks.map(x => { const overdueControls=x.controls.filter(c=>overdue(c.dueDate,now)).length; return { id:`risk:${x.id}`, title:x.title, detail:overdue(x.nextReviewDate,now)?"Risk review is overdue.":overdueControls?`${overdueControls} risk control${overdueControls===1?" is":"s are"} overdue.`:"Elevated residual exposure requires monitoring.", source:"Risk", href:`/risks/${x.id}`, severity:x.currentRiskLevel as "CRITICAL"|"HIGH", site:x.site?.name??null }; }),
    ...mocs.map(x => { const overdueTasks=x.tasks.filter(t=>overdue(t.dueDate,now)).length; return { id:`moc:${x.id}`, title:x.title, detail:overdueTasks?`${overdueTasks} required change task${overdueTasks===1?" is":"s are"} overdue.`:`Elevated residual risk with ${x.riskLinks.length} linked risk${x.riskLinks.length===1?"":"s"}.`, source:"MOC", href:`/moc/${x.id}`, severity:x.residualRiskLevel as "CRITICAL"|"HIGH", site:x.site.name }; }),
    ...contractors.map(x => ({ id:`contractor:${x.id}`, title:x.name, detail:x.insuranceExpiresAt && x.insuranceExpiresAt < now ? "Approved contractor insurance has expired." : `Contractor insurance expires within 30 days${x.insuranceExpiresAt ? ` (${x.insuranceExpiresAt.toLocaleDateString()})` : ""}.`, source:"Contractor", href:`/contractors/${x.id}`, severity:(x.insuranceExpiresAt && x.insuranceExpiresAt < now ? "CRITICAL" : "HIGH") as AssuranceSignal["severity"], site:null })),
    ...permitsToWork.map(x => ({ id:`permit-to-work:${x.id}`, title:`${x.reference} — ${x.title}`, detail:x.status==="SUSPENDED"?"High-risk work permit is suspended and requires resolution.":"Active work permit is past its authorized end time.", source:"Permit to Work", href:`/permits-to-work/${x.id}`, severity:(x.plannedEndAt < now ? "CRITICAL" : "HIGH") as AssuranceSignal["severity"], site:x.site.name })),
    ...exposureSamples.map(x => ({ id:`exposure-sample:${x.id}`, title:`${x.assessment.reference} — ${x.agent.name}`, detail:`Exposure result exceeded the recorded occupational limit${x.exposureRatio ? ` (${x.exposureRatio.toFixed(2)}× limit)` : ""}.`, source:"Industrial Hygiene", href:`/industrial-hygiene/${x.assessmentId}`, severity:"CRITICAL" as const, site:x.assessment.site.name })),
    ...surveillancePrograms.map(x => { const overdueCount=x.enrollments.filter(row=>row.status===SurveillanceEnrollmentStatus.OVERDUE).length; return { id:`surveillance-program:${x.id}`, title:x.name, detail:`${x.enrollments.length} restricted surveillance milestone${x.enrollments.length===1?"":"s"} require${x.enrollments.length===1?"s":""} administrative attention.`, source:"Occupational Health", href:`/occupational-health/${x.id}`, severity:(overdueCount?"HIGH":"MEDIUM") as AssuranceSignal["severity"], site:null }; }),
    ...[...criticalCompetencyGroups.entries()].map(([id,group])=>({id:`competency:${id}`,title:group.name,detail:`${group.count} worker requirement${group.count===1?"":"s"} lack verified current proficiency.`,source:"Competency",href:"/training/competencies/matrix",severity:"HIGH" as const,site:null})),
    ...sifControls.filter(control=>control.nextVerificationDueAt<now||control.verifications[0]?.result===CriticalControlVerificationResult.FAILED||control.verifications[0]?.result===CriticalControlVerificationResult.DEGRADED).map(control=>({id:`critical-control:${control.id}`,title:`${control.code} — ${control.name}`,detail:control.nextVerificationDueAt<now?"Critical-control field verification is overdue.":`Latest field verification is ${control.verifications[0]!.result.toLowerCase()}.`,source:"SIF Critical Control",href:`/assurance/sif/controls/${control.id}`,severity:(control.verifications[0]?.result===CriticalControlVerificationResult.FAILED?"CRITICAL":"HIGH") as AssuranceSignal["severity"],site:control.site?.name??null})),
    ...certificationReviews.map(review=>({id:`management-review:${review.id}`,title:`${review.reference} — ${review.title}`,detail:review.status==="APPROVED"?"The next required management review is overdue.":"A scheduled management review is overdue.",source:"Certification Readiness",href:`/assurance/certification/reviews/${review.id}`,severity:"HIGH" as const,site:null})),
    ...assetDefects.map(defect=>({id:`asset-defect:${defect.id}`,title:`${defect.reference} — ${defect.title}`,detail:`${defect.asset.status.replaceAll("_"," ")} · ${defect.correctiveAction?"linked CAPA":"no linked CAPA"}${overdue(defect.dueDate,now)?" · resolution overdue":""}.`,source:"Asset Defect",href:`/assets/${defect.assetId}`,severity:(defect.severity==="CRITICAL"||defect.asset.status==="OUT_OF_SERVICE"?"CRITICAL":defect.severity==="HIGH"?"HIGH":"MEDIUM") as AssuranceSignal["severity"],site:defect.asset.site.name})),
    ...behaviorSessions.map(session=>({id:`behavior-session:${session.id}`,title:`${session.reference} — ${session.program.name}`,detail:`${session.criticalAtRiskCount} critical at-risk result${session.criticalAtRiskCount===1?"":"s"} · ${session.correctiveAction?"linked CAPA":"no linked CAPA"}${overdue(session.followUpDueAt,now)?" · follow-up overdue":""}.`,source:"Behavior Safety",href:`/behavior-safety/sessions/${session.id}`,severity:(session.criticalAtRiskCount>0?"CRITICAL":"HIGH") as AssuranceSignal["severity"],site:session.site.name})),
    ...regulatoryChanges.map(change=>({id:`regulatory-change:${change.id}`,title:`${change.reference} — ${change.title}`,detail:`${change.status.replaceAll("_"," ")} · ${change.obligationLinks.length} obligation link${change.obligationLinks.length===1?"":"s"} · ${change.actionLinks.length} CAPA link${change.actionLinks.length===1?"":"s"}${change.assessmentDueAt<now&&(change.status==="DETECTED"||change.status==="UNDER_REVIEW"||change.status==="IMPACT_ASSESSMENT")?" · assessment overdue":""}.`,source:"Regulatory Change",href:`/compliance/regulatory/changes/${change.id}`,severity:(change.significance==="CRITICAL"?"CRITICAL":"HIGH") as AssuranceSignal["severity"],site:change.source.jurisdiction})),
  ];

  const connectionRows: AssuranceConnection[] = [
    { label: "Observations → Incidents", count: connections[0], detail: "Escalated frontline warning signals", href: "/observations" },
    { label: "Incidents → CAPA", count: connections[1], detail: "Corrective actions created from events", href: "/incidents" },
    { label: "Audit Findings → CAPA", count: connections[2], detail: "Audit deficiencies under correction", href: "/audits" },
    { label: "Audit Findings → Risks", count: connections[3], detail: "Material findings escalated to risk", href: "/risks" },
    { label: "Inspection Findings → CAPA", count: connections[4], detail: "Inspection deficiencies under correction", href: "/inspections" },
    { label: "MOC → Risks", count: connections[5], detail: "Change-related risk relationships", href: "/moc" },
    { label: "Contractors → Work Permits", count: connections[6], detail: "Third-party work under permit control", href: "/permits-to-work" },
    ...(allowed.has(PermissionKey.VIEW_INDUSTRIAL_HYGIENE) ? [{ label: "Exposure Groups → Assessments", count: connections[7], detail: "Worker exposure groups under assessment", href: "/industrial-hygiene" }] : []),
    ...(allowed.has(PermissionKey.VIEW_OCCUPATIONAL_HEALTH) ? [{ label: "Exposure Groups → Surveillance", count: connections[8], detail: "Exposure-driven administrative health programs", href: "/occupational-health" }] : []),
    ...(allowed.has(PermissionKey.VIEW_TRAINING) ? [{ label: "Courses → Competencies", count: connections[9], detail: "Learning outcomes mapped to verified capability", href: "/training/competencies" }] : []),
    ...(allowed.has(PermissionKey.VIEW_SIF_INTELLIGENCE) ? [{ label: "Weak Signals → Critical Controls", count: sifReviews.filter(review=>sifControls.some(control=>control.category===review.exposureCategory)).length, detail: "Reviewed precursors covered by an active control standard", href: "/assurance/sif" }] : []),
    ...(allowed.has(PermissionKey.VIEW_CERTIFICATION_READINESS) ? [{ label: "Audit Programs → Management Reviews", count: connections[10], detail: "Completed leadership reviews supporting management-system assurance", href: "/assurance/certification" }] : []),
    ...(allowed.has(PermissionKey.VIEW_ASSETS) ? [{ label: "Asset Defects → CAPA", count: connections[11], detail: "Equipment deficiencies under corrective-action governance", href: "/assets" }] : []),
    ...(allowed.has(PermissionKey.VIEW_BEHAVIOR_SAFETY) ? [{ label: "Behavior Coaching → Observations", count: connections[12], detail: "Coaching signals escalated into the observation workflow", href: "/behavior-safety" }, { label: "Behavior Coaching → CAPA", count: connections[13], detail: "Systemic at-risk behaviors under corrective-action governance", href: "/behavior-safety" }] : []),
    ...(allowed.has(PermissionKey.VIEW_COMPLIANCE) ? [{ label: "Regulatory Changes → Obligations", count: connections[14], detail: "Approved applicability decisions reflected in the legal register", href: "/compliance/regulatory" }, { label: "Regulatory Changes → CAPA", count: connections[15], detail: "Regulatory implementation work under corrective-action governance", href: "/compliance/regulatory" }] : []),
  ];

  const ranked = rankAssuranceSignals(signals);
  return { signals: ranked.slice(0, input.limit ?? 30), signalCount: ranked.length, criticalCount: ranked.filter(x=>x.severity==="CRITICAL").length, connections: connectionRows, connectionCount: connectionRows.reduce((sum,row)=>sum+row.count,0), generatedAt: now };
}
