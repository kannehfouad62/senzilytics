import { prisma } from "@/lib/prisma";
import { getCompetencyMatrixService } from "@/modules/training/competency.service";
import { getSifExecutiveMetricsService } from "@/modules/assurance/sif-intelligence.service";
import { getCertificationExecutiveMetricsService } from "@/modules/assurance/certification-readiness.service";
import {
  EnterpriseAuditFindingStatus,
  EnterpriseAuditStatus,
  ExposureAssessmentStatus,
  ExposureResultClassification,
  ChemicalApprovalStatus,
  ContractorStatus,
  EnvironmentalDataStatus,
  EsgDisclosureStatus,
  JsaStatus,
  MocStatus,
  PermitStatus,
  PermitToWorkStatus,
  PermissionKey,
  RiskLevel,
  RiskStatus,
  SafetyObservationStatus,
  Status,
  SurveillanceEnrollmentStatus,
} from "@prisma/client";

const closedStatuses = [Status.COMPLETED, Status.CLOSED];

const capaPermissions = [
  PermissionKey.CREATE_CAPA,
  PermissionKey.UPDATE_CAPA,
  PermissionKey.CLOSE_CAPA,
  PermissionKey.VIEW_REPORTS,
] as const;

const modulePermissions: Record<string, readonly PermissionKey[]> = {
  Observations: [PermissionKey.VIEW_OBSERVATIONS],
  CAPA: capaPermissions,
  Risk: [PermissionKey.VIEW_RISKS],
  MOC: [PermissionKey.VIEW_MOC],
  Audits: [PermissionKey.VIEW_AUDITS],
  "Audit Findings": [PermissionKey.VIEW_AUDITS],
  Inspections: [PermissionKey.VIEW_INSPECTIONS],
  "Training & Competency": [PermissionKey.VIEW_TRAINING],
  Compliance: [PermissionKey.VIEW_COMPLIANCE],
  "Regulatory Change": [PermissionKey.VIEW_COMPLIANCE],
  Permits: [PermissionKey.VIEW_COMPLIANCE],
  Chemicals: [PermissionKey.VIEW_CHEMICALS],
  Environmental: [PermissionKey.VIEW_ENVIRONMENTAL],
  ESG: [PermissionKey.VIEW_ESG],
  "JSA / JHA": [PermissionKey.VIEW_RISKS],
  Contractors: [PermissionKey.VIEW_CONTRACTORS],
  "Permits to Work": [PermissionKey.VIEW_PERMITS_TO_WORK],
  "Industrial Hygiene": [PermissionKey.VIEW_INDUSTRIAL_HYGIENE],
  "Occupational Health": [PermissionKey.VIEW_OCCUPATIONAL_HEALTH],
  "SIF Prevention": [PermissionKey.VIEW_SIF_INTELLIGENCE],
  "Certification Readiness": [PermissionKey.VIEW_CERTIFICATION_READINESS],
  "Assets & Equipment": [PermissionKey.VIEW_ASSETS],
  "Behavior-Based Safety": [PermissionKey.VIEW_BEHAVIOR_SAFETY],
  "Emergency Preparedness": [PermissionKey.VIEW_EMERGENCY_PREPAREDNESS],
};

export function canViewExecutiveModule(
  moduleLabel: string,
  permissions: Iterable<PermissionKey>,
) {
  const required = modulePermissions[moduleLabel];
  if (!required) return false;
  const allowed = permissions instanceof Set ? permissions : new Set(permissions);
  return required.some((permission) => allowed.has(permission));
}

export async function getGlobalExecutivePortfolio(organizationId: string, permissions: PermissionKey[]) {
  const now = new Date();
  const allowed = new Set(permissions);
  const canViewCapa = capaPermissions.some((permission) => allowed.has(permission));
  const credentialHorizon = new Date(now.getTime() + 30 * 86400000);
  const auditClosed = [EnterpriseAuditStatus.COMPLETED, EnterpriseAuditStatus.CLOSED, EnterpriseAuditStatus.CANCELLED];
  const findingClosed = [EnterpriseAuditFindingStatus.VERIFIED, EnterpriseAuditFindingStatus.CLOSED, EnterpriseAuditFindingStatus.REJECTED, EnterpriseAuditFindingStatus.CANCELLED];
  const mocClosed = [MocStatus.CLOSED, MocStatus.REJECTED, MocStatus.CANCELLED];
  const actionTenantScope = { OR: [
    { incident: { site: { organizationId } } },
    { auditFinding: { audit: { site: { organizationId } } } },
    { inspectionFinding: { inspection: { site: { organizationId } } } },
    { enterpriseAuditFindingLinks: { some: { finding: { organizationId } } } },
    { criticalControlVerifications: { some: { organizationId } } },
    { certificationReviewActions: { some: { review: { organizationId } } } },
    { assetDefects: { some: { organizationId } } },
    { behaviorSessions: { some: { organizationId } } },
    { regulatoryChangeLinks: { some: { change: { organizationId } } } },
  ] };
  const competencyMatrix = allowed.has(PermissionKey.VIEW_TRAINING)
    ? await getCompetencyMatrixService(organizationId, now)
    : { gaps: 0, criticalGaps: 0 };
  const sifMetrics = allowed.has(PermissionKey.VIEW_SIF_INTELLIGENCE)
    ? await getSifExecutiveMetricsService(organizationId, now)
    : { potentialSif: 0, precursors: 0, failedOrDegraded: 0, overdueControls: 0, attentionCount: 0 };
  const certificationMetrics = allowed.has(PermissionKey.VIEW_CERTIFICATION_READINESS)
    ? await getCertificationExecutiveMetricsService(organizationId, now)
    : { programCount: 0, withoutManagementReview: 0, overdueReviews: 0, attentionCount: 0 };

  const [
    openObservations, openActions, overdueActions, highRisks, overdueRiskReviews, openMocs, overdueMocs,
    activeAudits, overdueAudits, openAuditFindings, overdueInspections,
    overdueTraining, expiringTraining, overdueCompliance, expiringPermits,
    governedChemicals, pendingEnvironmentalData, openEsgPeriods, activeJsas,
    overdueJsaReviews, approvedContractors, expiringContractorInsurance,
    activeWorkPermits, overdueWorkPermits, openExposureAssessments,
    aboveLimitExposureSamples, overdueSurveillance, assetExceptions, overdueAssetInspections, criticalAssetDefects,
    behaviorSessionsThisMonth, criticalBehaviorAtRisk, overdueBehaviorFollowUps,
    openRegulatoryChanges, overdueRegulatoryAssessments, criticalRegulatoryExposure,
    openEmergencyActivations, overdueEmergencyPlanReviews, overdueEmergencyDrills, overdueEmergencyImprovements,
  ] = await Promise.all([
    allowed.has(PermissionKey.VIEW_OBSERVATIONS) ? prisma.safetyObservation.count({ where: { organizationId, status: { notIn: [SafetyObservationStatus.RESOLVED, SafetyObservationStatus.CLOSED] } } }) : 0,
    canViewCapa ? prisma.correctiveAction.count({ where: { ...actionTenantScope, status: { notIn: closedStatuses } } }) : 0,
    canViewCapa ? prisma.correctiveAction.count({ where: { ...actionTenantScope, status: { notIn: closedStatuses }, dueDate: { lt: now } } }) : 0,
    allowed.has(PermissionKey.VIEW_RISKS) ? prisma.risk.count({ where: { organizationId, status: { notIn: [RiskStatus.CLOSED, RiskStatus.ARCHIVED] }, currentRiskLevel: { in: [RiskLevel.HIGH, RiskLevel.CRITICAL] } } }) : 0,
    allowed.has(PermissionKey.VIEW_RISKS) ? prisma.risk.count({ where: { organizationId, status: { notIn: [RiskStatus.CLOSED, RiskStatus.ARCHIVED] }, nextReviewDate: { lt: now } } }) : 0,
    allowed.has(PermissionKey.VIEW_MOC) ? prisma.managementOfChange.count({ where: { organizationId, status: { notIn: mocClosed } } }) : 0,
    allowed.has(PermissionKey.VIEW_MOC) ? prisma.managementOfChange.count({ where: { organizationId, status: { notIn: mocClosed }, plannedCompletionDate: { lt: now } } }) : 0,
    allowed.has(PermissionKey.VIEW_AUDITS) ? prisma.enterpriseAudit.count({ where: { organizationId, status: { notIn: auditClosed } } }) : 0,
    allowed.has(PermissionKey.VIEW_AUDITS) ? prisma.enterpriseAudit.count({ where: { organizationId, status: { notIn: auditClosed }, dueDate: { lt: now } } }) : 0,
    allowed.has(PermissionKey.VIEW_AUDITS) ? prisma.enterpriseAuditFinding.count({ where: { organizationId, status: { notIn: findingClosed } } }) : 0,
    allowed.has(PermissionKey.VIEW_INSPECTIONS) ? prisma.inspection.count({ where: { site: { organizationId }, status: { notIn: closedStatuses }, dueDate: { lt: now } } }) : 0,
    allowed.has(PermissionKey.VIEW_TRAINING) ? prisma.trainingRecord.count({ where: { user: { organizationId }, status: { notIn: closedStatuses }, dueDate: { lt: now } } }) : 0,
    allowed.has(PermissionKey.VIEW_TRAINING) ? prisma.trainingRecord.count({ where: { user: { organizationId }, status: { in: closedStatuses }, expiresAt: { gte: now, lte: new Date(now.getTime() + 30 * 86400000) } } }) : 0,
    allowed.has(PermissionKey.VIEW_COMPLIANCE) ? prisma.complianceItem.count({ where: { site: { organizationId }, status: { notIn: closedStatuses }, dueDate: { lt: now } } }) : 0,
    allowed.has(PermissionKey.VIEW_COMPLIANCE) ? prisma.permit.count({ where: { organizationId, status: { in: [PermitStatus.EXPIRING, PermitStatus.EXPIRED] } } }) : 0,
    allowed.has(PermissionKey.VIEW_CHEMICALS) ? prisma.chemicalInventory.count({ where: { chemical: { organizationId, status: { notIn: [ChemicalApprovalStatus.DRAFT, ChemicalApprovalStatus.ARCHIVED] } } } }) : 0,
    allowed.has(PermissionKey.VIEW_ENVIRONMENTAL) ? prisma.environmentalDataPoint.count({ where: { metric: { organizationId }, status: { in: [EnvironmentalDataStatus.DRAFT, EnvironmentalDataStatus.SUBMITTED, EnvironmentalDataStatus.REJECTED] } } }) : 0,
    allowed.has(PermissionKey.VIEW_ESG) ? prisma.esgDisclosurePeriod.count({ where: { organizationId, status: { in: [EsgDisclosureStatus.DRAFT, EsgDisclosureStatus.DATA_COLLECTION, EsgDisclosureStatus.UNDER_REVIEW] } } }) : 0,
    allowed.has(PermissionKey.VIEW_RISKS) ? prisma.jobSafetyAnalysis.count({ where: { organizationId, status: JsaStatus.ACTIVE } }) : 0,
    allowed.has(PermissionKey.VIEW_RISKS) ? prisma.jobSafetyAnalysis.count({ where: { organizationId, status: JsaStatus.ACTIVE, reviewDueDate: { lt: now } } }) : 0,
    allowed.has(PermissionKey.VIEW_CONTRACTORS) ? prisma.contractor.count({ where: { organizationId, status: ContractorStatus.APPROVED } }) : 0,
    allowed.has(PermissionKey.VIEW_CONTRACTORS) ? prisma.contractor.count({ where: { organizationId, status: ContractorStatus.APPROVED, insuranceExpiresAt: { lte: credentialHorizon } } }) : 0,
    allowed.has(PermissionKey.VIEW_PERMITS_TO_WORK) ? prisma.permitToWork.count({ where: { organizationId, status: { in: [PermitToWorkStatus.APPROVED, PermitToWorkStatus.ACTIVE, PermitToWorkStatus.SUSPENDED] } } }) : 0,
    allowed.has(PermissionKey.VIEW_PERMITS_TO_WORK) ? prisma.permitToWork.count({ where: { organizationId, status: { in: [PermitToWorkStatus.DRAFT, PermitToWorkStatus.PENDING_APPROVAL, PermitToWorkStatus.APPROVED, PermitToWorkStatus.ACTIVE, PermitToWorkStatus.SUSPENDED] }, plannedEndAt: { lt: now } } }) : 0,
    allowed.has(PermissionKey.VIEW_INDUSTRIAL_HYGIENE) ? prisma.exposureAssessment.count({ where: { organizationId, status: { notIn: [ExposureAssessmentStatus.COMPLETED, ExposureAssessmentStatus.CANCELLED] } } }) : 0,
    allowed.has(PermissionKey.VIEW_INDUSTRIAL_HYGIENE) ? prisma.exposureSample.count({ where: { assessment: { organizationId }, classification: ExposureResultClassification.ABOVE_LIMIT } }) : 0,
    allowed.has(PermissionKey.VIEW_OCCUPATIONAL_HEALTH) ? prisma.medicalSurveillanceEnrollment.count({ where: { program: { organizationId }, status: SurveillanceEnrollmentStatus.OVERDUE } }) : 0,
    allowed.has(PermissionKey.VIEW_ASSETS) ? prisma.asset.count({ where: { organizationId, status: { in: ["OUT_OF_SERVICE", "QUARANTINED"] } } }) : 0,
    allowed.has(PermissionKey.VIEW_ASSETS) ? prisma.asset.count({ where: { organizationId, status: { not: "RETIRED" }, nextInspectionDueAt: { lt: now } } }) : 0,
    allowed.has(PermissionKey.VIEW_ASSETS) ? prisma.assetDefect.count({ where: { organizationId, severity: "CRITICAL", status: { not: "CLOSED" } } }) : 0,
    allowed.has(PermissionKey.VIEW_BEHAVIOR_SAFETY) ? prisma.behaviorCoachingSession.count({ where: { organizationId, observedAt: { gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)) } } }) : 0,
    allowed.has(PermissionKey.VIEW_BEHAVIOR_SAFETY) ? prisma.behaviorCoachingSession.count({ where: { organizationId, criticalAtRiskCount: { gt: 0 }, followUpStatus: { not: "COMPLETED" } } }) : 0,
    allowed.has(PermissionKey.VIEW_BEHAVIOR_SAFETY) ? prisma.behaviorCoachingSession.count({ where: { organizationId, followUpStatus: { in: ["OPEN", "IN_PROGRESS"] }, followUpDueAt: { lt: now } } }) : 0,
    allowed.has(PermissionKey.VIEW_COMPLIANCE) ? prisma.regulatoryChange.count({ where: { organizationId, status: { in: ["DETECTED", "UNDER_REVIEW", "IMPACT_ASSESSMENT", "ACTION_REQUIRED"] } } }) : 0,
    allowed.has(PermissionKey.VIEW_COMPLIANCE) ? prisma.regulatoryChange.count({ where: { organizationId, status: { in: ["DETECTED", "UNDER_REVIEW", "IMPACT_ASSESSMENT"] }, assessmentDueAt: { lt: now } } }) : 0,
    allowed.has(PermissionKey.VIEW_COMPLIANCE) ? prisma.regulatoryChange.count({ where: { organizationId, significance: "CRITICAL", status: { in: ["DETECTED", "UNDER_REVIEW", "IMPACT_ASSESSMENT", "ACTION_REQUIRED"] } } }) : 0,
    allowed.has(PermissionKey.VIEW_EMERGENCY_PREPAREDNESS) ? prisma.emergencyActivation.count({ where: { organizationId, status: { in: ["ACTIVE", "STABILIZED"] } } }) : 0,
    allowed.has(PermissionKey.VIEW_EMERGENCY_PREPAREDNESS) ? prisma.emergencyPlan.count({ where: { organizationId, status: "ACTIVE", reviewDueAt: { lt: now } } }) : 0,
    allowed.has(PermissionKey.VIEW_EMERGENCY_PREPAREDNESS) ? prisma.emergencyDrill.count({ where: { organizationId, status: "PLANNED", scheduledAt: { lt: now } } }) : 0,
    allowed.has(PermissionKey.VIEW_EMERGENCY_PREPAREDNESS) ? prisma.emergencyImprovement.count({ where: { organizationId, status: { in: ["OPEN", "IN_PROGRESS", "COMPLETED"] }, dueAt: { lt: now } } }) : 0,
  ]);

  const modules: { label: string; value: number; note: string; href: string; tone: "danger" | "warning" | "good" | "neutral" }[] = [
    { label: "Observations", value: openObservations, note: "open", href: "/observations", tone: openObservations ? "warning" : "good" },
    { label: "CAPA", value: openActions, note: `${overdueActions} overdue`, href: "/capa", tone: overdueActions ? "danger" : "neutral" },
    { label: "Risk", value: highRisks, note: `${overdueRiskReviews} reviews overdue`, href: "/risks/dashboard", tone: highRisks || overdueRiskReviews ? "danger" : "good" },
    { label: "MOC", value: openMocs, note: `${overdueMocs} overdue`, href: "/moc/dashboard", tone: overdueMocs ? "danger" : "neutral" },
    { label: "Audits", value: activeAudits, note: `${overdueAudits} overdue`, href: "/audits/dashboard", tone: overdueAudits ? "danger" : "neutral" },
    { label: "Audit Findings", value: openAuditFindings, note: "requiring closure", href: "/audits", tone: openAuditFindings ? "warning" : "good" },
    { label: "Inspections", value: overdueInspections, note: "overdue", href: "/inspections", tone: overdueInspections ? "danger" : "good" },
    { label: "Training & Competency", value: overdueTraining + competencyMatrix.criticalGaps, note: `${expiringTraining} training records expire in 30 days · ${competencyMatrix.gaps} competency gaps`, href: "/training/dashboard", tone: overdueTraining || competencyMatrix.criticalGaps ? "danger" : competencyMatrix.gaps ? "warning" : "good" },
    { label: "Compliance", value: overdueCompliance, note: "obligations overdue", href: "/compliance/dashboard", tone: overdueCompliance ? "danger" : "good" },
    { label: "Regulatory Change", value: openRegulatoryChanges, note: `${overdueRegulatoryAssessments} assessments overdue · ${criticalRegulatoryExposure} critical`, href: "/compliance/regulatory", tone: criticalRegulatoryExposure || overdueRegulatoryAssessments ? "danger" : openRegulatoryChanges ? "warning" : "good" },
    { label: "Permits", value: expiringPermits, note: "expiring or expired", href: "/compliance/permits", tone: expiringPermits ? "danger" : "good" },
    { label: "Chemicals", value: governedChemicals, note: "in governed inventory", href: "/chemicals/dashboard", tone: "neutral" },
    { label: "Environmental", value: pendingEnvironmentalData, note: "records need approval", href: "/environmental/dashboard", tone: pendingEnvironmentalData ? "warning" : "good" },
    { label: "ESG", value: openEsgPeriods, note: "disclosures in progress", href: "/esg/dashboard", tone: "neutral" },
    { label: "JSA / JHA", value: activeJsas, note: `${overdueJsaReviews} reviews overdue`, href: "/risks/jsa", tone: overdueJsaReviews ? "danger" : "neutral" },
    { label: "Contractors", value: approvedContractors, note: `${expiringContractorInsurance} insurance credentials due`, href: "/contractors", tone: expiringContractorInsurance ? "danger" : "neutral" },
    { label: "Permits to Work", value: activeWorkPermits, note: `${overdueWorkPermits} past authorized end`, href: "/permits-to-work", tone: overdueWorkPermits ? "danger" : "neutral" },
  ];
  if (allowed.has(PermissionKey.VIEW_INDUSTRIAL_HYGIENE)) modules.push({ label: "Industrial Hygiene", value: openExposureAssessments, note: `${aboveLimitExposureSamples} results above limit`, href: "/industrial-hygiene", tone: aboveLimitExposureSamples ? "danger" : openExposureAssessments ? "neutral" : "good" });
  if (allowed.has(PermissionKey.VIEW_OCCUPATIONAL_HEALTH)) modules.push({ label: "Occupational Health", value: overdueSurveillance, note: "restricted milestones overdue", href: "/occupational-health", tone: overdueSurveillance ? "danger" : "good" });
  if (allowed.has(PermissionKey.VIEW_SIF_INTELLIGENCE)) modules.push({ label: "SIF Prevention", value: sifMetrics.attentionCount, note: `${sifMetrics.potentialSif} pSIF decisions · ${sifMetrics.failedOrDegraded} degraded or failed controls`, href: "/assurance/sif", tone: sifMetrics.failedOrDegraded || sifMetrics.overdueControls ? "danger" : sifMetrics.potentialSif ? "warning" : "good" });
  if (allowed.has(PermissionKey.VIEW_CERTIFICATION_READINESS)) modules.push({ label: "Certification Readiness", value: certificationMetrics.attentionCount, note: `${certificationMetrics.programCount} standard programs · ${certificationMetrics.overdueReviews} reviews overdue`, href: "/assurance/certification", tone: certificationMetrics.overdueReviews ? "danger" : certificationMetrics.withoutManagementReview ? "warning" : "good" });
  if (allowed.has(PermissionKey.VIEW_ASSETS)) modules.push({ label: "Assets & Equipment", value: assetExceptions + criticalAssetDefects, note: `${overdueAssetInspections} inspections overdue · ${criticalAssetDefects} critical defects`, href: "/assets/dashboard", tone: assetExceptions || criticalAssetDefects ? "danger" : overdueAssetInspections ? "warning" : "good" });
  if (allowed.has(PermissionKey.VIEW_BEHAVIOR_SAFETY)) modules.push({ label: "Behavior-Based Safety", value: criticalBehaviorAtRisk + overdueBehaviorFollowUps, note: `${behaviorSessionsThisMonth} coaching sessions this month · ${overdueBehaviorFollowUps} follow-ups overdue`, href: "/behavior-safety/dashboard", tone: criticalBehaviorAtRisk || overdueBehaviorFollowUps ? "danger" : behaviorSessionsThisMonth ? "good" : "neutral" });
  if (allowed.has(PermissionKey.VIEW_EMERGENCY_PREPAREDNESS)) modules.push({ label: "Emergency Preparedness", value: openEmergencyActivations + overdueEmergencyPlanReviews + overdueEmergencyDrills + overdueEmergencyImprovements, note: `${openEmergencyActivations} active responses · ${overdueEmergencyPlanReviews} plan reviews overdue · ${overdueEmergencyDrills} drills overdue`, href: "/emergency", tone: openEmergencyActivations || overdueEmergencyPlanReviews || overdueEmergencyDrills || overdueEmergencyImprovements ? "danger" : "good" });

  const authorizedModules = modules.filter((item) =>
    canViewExecutiveModule(item.label, allowed),
  );

  return {
    modules: authorizedModules,
    attentionCount: authorizedModules
      .filter((item) => item.tone === "danger")
      .reduce((sum, item) => sum + item.value, 0),
  };
}
