import { prisma } from "@/lib/prisma";
import {
  EnterpriseAuditFindingStatus,
  EnterpriseAuditStatus,
  ChemicalApprovalStatus,
  ContractorStatus,
  EnvironmentalDataStatus,
  EsgDisclosureStatus,
  JsaStatus,
  MocStatus,
  PermitStatus,
  PermitToWorkStatus,
  RiskLevel,
  RiskStatus,
  SafetyObservationStatus,
  Status,
} from "@prisma/client";

const closedStatuses = [Status.COMPLETED, Status.CLOSED];

export async function getGlobalExecutivePortfolio(organizationId: string) {
  const now = new Date();
  const credentialHorizon = new Date(now.getTime() + 30 * 86400000);
  const auditClosed = [EnterpriseAuditStatus.COMPLETED, EnterpriseAuditStatus.CLOSED, EnterpriseAuditStatus.CANCELLED];
  const findingClosed = [EnterpriseAuditFindingStatus.VERIFIED, EnterpriseAuditFindingStatus.CLOSED, EnterpriseAuditFindingStatus.REJECTED, EnterpriseAuditFindingStatus.CANCELLED];
  const mocClosed = [MocStatus.CLOSED, MocStatus.REJECTED, MocStatus.CANCELLED];
  const actionTenantScope = { OR: [
    { incident: { site: { organizationId } } },
    { auditFinding: { audit: { site: { organizationId } } } },
    { inspectionFinding: { inspection: { site: { organizationId } } } },
    { enterpriseAuditFindingLinks: { some: { finding: { organizationId } } } },
  ] };

  const [
    openObservations, openActions, overdueActions, highRisks, overdueRiskReviews, openMocs, overdueMocs,
    activeAudits, overdueAudits, openAuditFindings, overdueInspections,
    overdueTraining, expiringTraining, overdueCompliance, expiringPermits,
    governedChemicals, pendingEnvironmentalData, openEsgPeriods, activeJsas,
    overdueJsaReviews, approvedContractors, expiringContractorInsurance,
    activeWorkPermits, overdueWorkPermits,
  ] = await Promise.all([
    prisma.safetyObservation.count({ where: { organizationId, status: { notIn: [SafetyObservationStatus.RESOLVED, SafetyObservationStatus.CLOSED] } } }),
    prisma.correctiveAction.count({ where: { ...actionTenantScope, status: { notIn: closedStatuses } } }),
    prisma.correctiveAction.count({ where: { ...actionTenantScope, status: { notIn: closedStatuses }, dueDate: { lt: now } } }),
    prisma.risk.count({ where: { organizationId, status: { notIn: [RiskStatus.CLOSED, RiskStatus.ARCHIVED] }, currentRiskLevel: { in: [RiskLevel.HIGH, RiskLevel.CRITICAL] } } }),
    prisma.risk.count({ where: { organizationId, status: { notIn: [RiskStatus.CLOSED, RiskStatus.ARCHIVED] }, nextReviewDate: { lt: now } } }),
    prisma.managementOfChange.count({ where: { organizationId, status: { notIn: mocClosed } } }),
    prisma.managementOfChange.count({ where: { organizationId, status: { notIn: mocClosed }, plannedCompletionDate: { lt: now } } }),
    prisma.enterpriseAudit.count({ where: { organizationId, status: { notIn: auditClosed } } }),
    prisma.enterpriseAudit.count({ where: { organizationId, status: { notIn: auditClosed }, dueDate: { lt: now } } }),
    prisma.enterpriseAuditFinding.count({ where: { organizationId, status: { notIn: findingClosed } } }),
    prisma.inspection.count({ where: { site: { organizationId }, status: { notIn: closedStatuses }, dueDate: { lt: now } } }),
    prisma.trainingRecord.count({ where: { user: { organizationId }, status: { notIn: closedStatuses }, dueDate: { lt: now } } }),
    prisma.trainingRecord.count({ where: { user: { organizationId }, status: { in: closedStatuses }, expiresAt: { gte: now, lte: new Date(now.getTime() + 30 * 86400000) } } }),
    prisma.complianceItem.count({ where: { site: { organizationId }, status: { notIn: closedStatuses }, dueDate: { lt: now } } }),
    prisma.permit.count({ where: { organizationId, status: { in: [PermitStatus.EXPIRING, PermitStatus.EXPIRED] } } }),
    prisma.chemicalInventory.count({ where: { chemical: { organizationId, status: { notIn: [ChemicalApprovalStatus.DRAFT, ChemicalApprovalStatus.ARCHIVED] } } } }),
    prisma.environmentalDataPoint.count({ where: { metric: { organizationId }, status: { in: [EnvironmentalDataStatus.DRAFT, EnvironmentalDataStatus.SUBMITTED, EnvironmentalDataStatus.REJECTED] } } }),
    prisma.esgDisclosurePeriod.count({ where: { organizationId, status: { in: [EsgDisclosureStatus.DRAFT, EsgDisclosureStatus.DATA_COLLECTION, EsgDisclosureStatus.UNDER_REVIEW] } } }),
    prisma.jobSafetyAnalysis.count({ where: { organizationId, status: JsaStatus.ACTIVE } }),
    prisma.jobSafetyAnalysis.count({ where: { organizationId, status: JsaStatus.ACTIVE, reviewDueDate: { lt: now } } }),
    prisma.contractor.count({ where: { organizationId, status: ContractorStatus.APPROVED } }),
    prisma.contractor.count({ where: { organizationId, status: ContractorStatus.APPROVED, insuranceExpiresAt: { lte: credentialHorizon } } }),
    prisma.permitToWork.count({ where: { organizationId, status: { in: [PermitToWorkStatus.APPROVED, PermitToWorkStatus.ACTIVE, PermitToWorkStatus.SUSPENDED] } } }),
    prisma.permitToWork.count({ where: { organizationId, status: { in: [PermitToWorkStatus.DRAFT, PermitToWorkStatus.PENDING_APPROVAL, PermitToWorkStatus.APPROVED, PermitToWorkStatus.ACTIVE, PermitToWorkStatus.SUSPENDED] }, plannedEndAt: { lt: now } } }),
  ]);

  const modules = [
    { label: "Observations", value: openObservations, note: "open", href: "/observations", tone: openObservations ? "warning" : "good" },
    { label: "CAPA", value: openActions, note: `${overdueActions} overdue`, href: "/capa", tone: overdueActions ? "danger" : "neutral" },
    { label: "Risk", value: highRisks, note: `${overdueRiskReviews} reviews overdue`, href: "/risks/dashboard", tone: highRisks || overdueRiskReviews ? "danger" : "good" },
    { label: "MOC", value: openMocs, note: `${overdueMocs} overdue`, href: "/moc/dashboard", tone: overdueMocs ? "danger" : "neutral" },
    { label: "Audits", value: activeAudits, note: `${overdueAudits} overdue`, href: "/audits/dashboard", tone: overdueAudits ? "danger" : "neutral" },
    { label: "Audit Findings", value: openAuditFindings, note: "requiring closure", href: "/audits", tone: openAuditFindings ? "warning" : "good" },
    { label: "Inspections", value: overdueInspections, note: "overdue", href: "/inspections", tone: overdueInspections ? "danger" : "good" },
    { label: "Training", value: overdueTraining, note: `${expiringTraining} expire in 30 days`, href: "/training/dashboard", tone: overdueTraining ? "danger" : "good" },
    { label: "Compliance", value: overdueCompliance, note: "obligations overdue", href: "/compliance/dashboard", tone: overdueCompliance ? "danger" : "good" },
    { label: "Permits", value: expiringPermits, note: "expiring or expired", href: "/compliance/permits", tone: expiringPermits ? "danger" : "good" },
    { label: "Chemicals", value: governedChemicals, note: "in governed inventory", href: "/chemicals/dashboard", tone: "neutral" },
    { label: "Environmental", value: pendingEnvironmentalData, note: "records need approval", href: "/environmental/dashboard", tone: pendingEnvironmentalData ? "warning" : "good" },
    { label: "ESG", value: openEsgPeriods, note: "disclosures in progress", href: "/esg/dashboard", tone: "neutral" },
    { label: "JSA / JHA", value: activeJsas, note: `${overdueJsaReviews} reviews overdue`, href: "/risks/jsa", tone: overdueJsaReviews ? "danger" : "neutral" },
    { label: "Contractors", value: approvedContractors, note: `${expiringContractorInsurance} insurance credentials due`, href: "/contractors", tone: expiringContractorInsurance ? "danger" : "neutral" },
    { label: "Permits to Work", value: activeWorkPermits, note: `${overdueWorkPermits} past authorized end`, href: "/permits-to-work", tone: overdueWorkPermits ? "danger" : "neutral" },
  ] as const;

  return { modules, attentionCount: modules.filter((item) => item.tone === "danger").reduce((sum, item) => sum + item.value, 0) };
}
