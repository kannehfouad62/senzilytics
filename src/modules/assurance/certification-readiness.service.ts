import { createNotification } from "@/core/notifications/notifications.service";
import { prisma } from "@/lib/prisma";
import { calculateCertificationReadiness, operationalControlScore, protocolFoundationScore } from "@/modules/assurance/certification-readiness";
import { createPreparedSubmissions, type PreparedSubmission } from "@/modules/forms/runtime-form.service";
import {
  ActivityAction,
  CertificationManagementReviewStatus,
  ConfigurableFormModule,
  ConfigurableSubmissionStatus,
  CriticalControlVerificationResult,
  EnterpriseAuditFindingStatus,
  EnterpriseAuditProtocolStatus,
  EnterpriseAuditQuestionStatus,
  EnterpriseAuditResponseResult,
  EnterpriseAuditStatus,
  ManagementSystemConclusion,
  NotificationType,
  Prisma,
  RiskLevel,
  RiskStatus,
  Status,
} from "@prisma/client";

const day = 86400000;
const addDays = (date: Date, value: number) => new Date(date.getTime() + value * day);
const closedFindingStatuses = new Set<EnterpriseAuditFindingStatus>([EnterpriseAuditFindingStatus.VERIFIED, EnterpriseAuditFindingStatus.CLOSED, EnterpriseAuditFindingStatus.REJECTED, EnterpriseAuditFindingStatus.CANCELLED]);
const assessedResults = new Set<EnterpriseAuditResponseResult>([EnterpriseAuditResponseResult.PASS, EnterpriseAuditResponseResult.FAIL, EnterpriseAuditResponseResult.YES, EnterpriseAuditResponseResult.NO, EnterpriseAuditResponseResult.COMPLIANT, EnterpriseAuditResponseResult.NON_COMPLIANT, EnterpriseAuditResponseResult.PARTIALLY_COMPLIANT, EnterpriseAuditResponseResult.OBSERVATION, EnterpriseAuditResponseResult.INFORMATION_ONLY]);
const compliantResults = new Set<EnterpriseAuditResponseResult>([EnterpriseAuditResponseResult.PASS, EnterpriseAuditResponseResult.YES, EnterpriseAuditResponseResult.COMPLIANT]);
const closedActionStatuses = new Set<Status>([Status.COMPLETED, Status.CLOSED]);
const activeReviewStatuses = new Set<CertificationManagementReviewStatus>([CertificationManagementReviewStatus.PLANNED, CertificationManagementReviewStatus.IN_PROGRESS]);
const completedReviewStatuses = new Set<CertificationManagementReviewStatus>([CertificationManagementReviewStatus.COMPLETED, CertificationManagementReviewStatus.APPROVED]);

const programInclude = {
  owner: true,
  sites: { include: { site: true } },
  departments: { include: { department: { include: { site: true } } } },
  defaultProtocol: { include: { sections: { where: { isActive: true }, include: { questions: { where: { isActive: true } }, }, orderBy: { sequence: "asc" } } } },
  enterpriseAudits: {
    where: { status: { in: [EnterpriseAuditStatus.COMPLETED, EnterpriseAuditStatus.CLOSED] } },
    include: { site: true, questions: { include: { response: true, evidence: { select: { id: true } } } }, findings: { include: { correctiveActionLinks: { include: { correctiveAction: true } } } } },
    orderBy: [{ completedAt: "desc" }, { updatedAt: "desc" }],
  },
  certificationReviews: { include: { chair: true, approvedBy: true, actions: { include: { correctiveAction: true } } }, orderBy: { scheduledAt: "desc" } },
} satisfies Prisma.AuditProgramInclude;

export async function getCertificationReadinessService(organizationId: string, programId: string, now = new Date()) {
  const program = await prisma.auditProgram.findFirst({ where: { id: programId, organizationId }, include: programInclude });
  if (!program) throw new Error("Certification audit program not found in this organization.");
  const evidenceHorizon = new Date(now.getTime() - 365 * day);
  const scopedSiteIds = [...new Set([...program.sites.map((row) => row.siteId), ...program.departments.map((row) => row.department.siteId)])];
  const latestBySite = new Map<string, (typeof program.enterpriseAudits)[number]>();
  for (const audit of program.enterpriseAudits.filter((row) => (row.completedAt ?? row.updatedAt) >= evidenceHorizon)) if (!latestBySite.has(audit.siteId)) latestBySite.set(audit.siteId, audit);
  const latestAudits = [...latestBySite.values()];
  const protocol = program.defaultProtocol;
  const protocolQuestions = protocol?.sections.flatMap((section) => section.questions) ?? [];
  const clauseMapped = protocolQuestions.filter((question) => Boolean(question.standardClause?.trim() || question.regulatoryRef?.trim())).length;
  const protocolScore = protocolFoundationScore({ active: protocol?.status === EnterpriseAuditProtocolStatus.ACTIVE, sections: protocol?.sections.length ?? 0, questions: protocolQuestions.length, clauseMapped });
  const auditCoverage = scopedSiteIds.length ? Math.round(Math.min(100, latestAudits.filter((audit) => scopedSiteIds.includes(audit.siteId)).length / scopedSiteIds.length * 100)) : 0;
  const questions = latestAudits.flatMap((audit) => audit.questions.filter((question) => question.isRequired));
  const answered = questions.filter((question) => question.status === EnterpriseAuditQuestionStatus.ANSWERED || question.status === EnterpriseAuditQuestionStatus.NOT_APPLICABLE || (question.response && question.response.result !== EnterpriseAuditResponseResult.NOT_ASSESSED));
  const applicable = answered.filter((question) => question.response?.result !== EnterpriseAuditResponseResult.NOT_APPLICABLE && question.response && assessedResults.has(question.response.result));
  const compliant = applicable.filter((question) => question.response?.isCompliant === true || (question.response && compliantResults.has(question.response.result)));
  const conformance = applicable.length ? Math.round(compliant.length / applicable.length * 100) : 0;
  const evidenceRequired = questions.filter((question) => question.requireEvidence);
  const evidenceSatisfied = evidenceRequired.filter((question) => question.evidence.length > 0);
  const evidenceCoverage = evidenceRequired.length ? Math.round(evidenceSatisfied.length / evidenceRequired.length * 100) : protocolQuestions.length ? 100 : 0;
  const findings = latestAudits.flatMap((audit) => audit.findings);
  const openFindings = findings.filter((finding) => !closedFindingStatuses.has(finding.status));
  const findingClosure = findings.length ? Math.round((findings.length - openFindings.length) / findings.length * 100) : latestAudits.length ? 100 : 0;
  const evidenceAndClosure = Math.round(evidenceCoverage * 0.6 + findingClosure * 0.4);
  const overdueCapas = findings.flatMap((finding) => finding.correctiveActionLinks).filter((link) => link.correctiveAction && link.correctiveAction.dueDate < now && !closedActionStatuses.has(link.correctiveAction.status)).length;
  const siteScope = scopedSiteIds.length ? { in: scopedSiteIds } : { in: ["__no_scoped_sites__"] };
  const [highRisks, overdueCompliance, overdueTraining, controls] = await Promise.all([
    prisma.risk.count({ where: { organizationId, OR: [{ siteId: null }, { siteId: siteScope }], status: { notIn: [RiskStatus.CLOSED, RiskStatus.ARCHIVED] }, currentRiskLevel: { in: [RiskLevel.HIGH, RiskLevel.CRITICAL] } } }),
    prisma.complianceItem.count({ where: { siteId: siteScope, dueDate: { lt: now }, status: { notIn: [Status.COMPLETED, Status.CLOSED] } } }),
    prisma.trainingRecord.count({ where: { user: { organizationId, department: { siteId: siteScope } }, dueDate: { lt: now }, status: { notIn: [Status.COMPLETED, Status.CLOSED] } } }),
    prisma.criticalControlStandard.findMany({ where: { organizationId, isActive: true, OR: [{ siteId: null }, { siteId: siteScope }] }, include: { verifications: { orderBy: { verifiedAt: "desc" }, take: 1 } } }),
  ]);
  const failedCriticalControls = controls.filter((control) => control.nextVerificationDueAt < now || control.verifications[0]?.result === CriticalControlVerificationResult.DEGRADED || control.verifications[0]?.result === CriticalControlVerificationResult.FAILED).length;
  const operationalScore = operationalControlScore({ highRisks, overdueCompliance, overdueTraining, overdueCapas, failedCriticalControls });
  const reviewHorizon = evidenceHorizon;
  const latestReview = program.certificationReviews[0] ?? null;
  const qualifyingReview = program.certificationReviews.find((review) => review.scheduledAt >= reviewHorizon && completedReviewStatuses.has(review.status));
  const managementReview = qualifyingReview?.status === CertificationManagementReviewStatus.APPROVED ? 100 : qualifyingReview ? 80 : latestReview?.scheduledAt && latestReview.scheduledAt >= now ? 40 : 0;
  const readiness = calculateCertificationReadiness({ protocolFoundation: protocolScore, auditCoverage, conformance, evidenceAndClosure, operationalControl: operationalScore, managementReview });
  const sections = (protocol?.sections ?? []).map((section) => {
    const questionIds = new Set(section.questions.map((question) => question.id));
    const sectionQuestions = latestAudits.flatMap((audit) => audit.questions.filter((question) => question.sourceProtocolQuestionId && questionIds.has(question.sourceProtocolQuestionId)));
    const sectionAnswered = sectionQuestions.filter((question) => question.status === EnterpriseAuditQuestionStatus.ANSWERED || question.status === EnterpriseAuditQuestionStatus.NOT_APPLICABLE).length;
    const sectionApplicable = sectionQuestions.filter((question) => question.response && assessedResults.has(question.response.result));
    const sectionCompliant = sectionApplicable.filter((question) => question.response?.isCompliant === true || (question.response && compliantResults.has(question.response.result))).length;
    return { id: section.id, title: section.title, standardRef: section.standardRef, questionCount: section.questions.length, executedQuestionCount: sectionQuestions.length, answeredPercent: sectionQuestions.length ? Math.round(sectionAnswered / sectionQuestions.length * 100) : 0, conformancePercent: sectionApplicable.length ? Math.round(sectionCompliant / sectionApplicable.length * 100) : 0 };
  });
  const gaps = [
    ...(!protocol ? ["Select an active default audit protocol for this program."] : protocol.status !== EnterpriseAuditProtocolStatus.ACTIVE ? ["Activate the program's default audit protocol."] : []),
    ...(protocolQuestions.length && clauseMapped < protocolQuestions.length ? [`Map ${protocolQuestions.length - clauseMapped} protocol question${protocolQuestions.length - clauseMapped === 1 ? "" : "s"} to a standard clause or regulatory reference.`] : []),
    ...(scopedSiteIds.length > latestAudits.length ? [`Complete a current audit for ${scopedSiteIds.length - latestAudits.length} program site${scopedSiteIds.length - latestAudits.length === 1 ? "" : "s"}.`] : []),
    ...(questions.length > answered.length ? [`Answer ${questions.length - answered.length} required audit question${questions.length - answered.length === 1 ? "" : "s"}.`] : []),
    ...(evidenceRequired.length > evidenceSatisfied.length ? [`Attach evidence to ${evidenceRequired.length - evidenceSatisfied.length} evidence-required audit response${evidenceRequired.length - evidenceSatisfied.length === 1 ? "" : "s"}.`] : []),
    ...(openFindings.length ? [`Close or formally disposition ${openFindings.length} open audit finding${openFindings.length === 1 ? "" : "s"}.`] : []),
    ...(overdueCapas ? [`Resolve ${overdueCapas} overdue certification-program CAPA${overdueCapas === 1 ? "" : "s"}.`] : []),
    ...(highRisks ? [`Review treatment and acceptance evidence for ${highRisks} elevated risk${highRisks === 1 ? "" : "s"} in certification scope.`] : []),
    ...(overdueCompliance ? [`Resolve ${overdueCompliance} overdue compliance obligation${overdueCompliance === 1 ? "" : "s"} in certification scope.`] : []),
    ...(overdueTraining ? [`Resolve ${overdueTraining} overdue worker training assignment${overdueTraining === 1 ? "" : "s"} in certification scope.`] : []),
    ...(failedCriticalControls ? [`Restore or verify ${failedCriticalControls} deficient or overdue critical control${failedCriticalControls === 1 ? "" : "s"}.`] : []),
    ...(!qualifyingReview ? ["Complete and approve a management review covering the last 12 months."] : []),
  ];
  return { program, scopedSiteIds, latestAudits, latestReview, sections, readiness, gaps, evidence: { protocolQuestions: protocolQuestions.length, clauseMapped, scopedSites: scopedSiteIds.length, auditedSites: latestAudits.length, requiredQuestions: questions.length, answeredQuestions: answered.length, applicableQuestions: applicable.length, compliantQuestions: compliant.length, evidenceRequired: evidenceRequired.length, evidenceSatisfied: evidenceSatisfied.length, findings: findings.length, openFindings: openFindings.length, overdueCapas, highRisks, overdueCompliance, overdueTraining, failedCriticalControls } };
}

export async function getCertificationPortfolioService(organizationId: string, now = new Date()) {
  const programs = await prisma.auditProgram.findMany({ where: { organizationId, isActive: true, OR: [{ standardName: { not: null } }, { framework: { not: null } }] }, select: { id: true }, orderBy: { name: "asc" }, take: 30 });
  return Promise.all(programs.map((program) => getCertificationReadinessService(organizationId, program.id, now)));
}

export async function getCertificationExecutiveMetricsService(organizationId: string, now = new Date()) {
  const programs = await prisma.auditProgram.findMany({ where: { organizationId, isActive: true, OR: [{ standardName: { not: null } }, { framework: { not: null } }] }, select: { id: true, certificationReviews: { orderBy: { scheduledAt: "desc" }, take: 1, select: { status: true, scheduledAt: true, nextReviewAt: true } } } });
  const withoutManagementReview = programs.filter((program) => !program.certificationReviews.some((review) => completedReviewStatuses.has(review.status))).length;
  const overdueReviews = programs.filter((program) => { const review=program.certificationReviews[0];if(!review)return false;const dueAt=review.status===CertificationManagementReviewStatus.APPROVED?review.nextReviewAt:review.scheduledAt;return Boolean(dueAt&&dueAt<now&&(review.status===CertificationManagementReviewStatus.APPROVED||review.status===CertificationManagementReviewStatus.PLANNED||review.status===CertificationManagementReviewStatus.IN_PROGRESS)); }).length;
  return { programCount: programs.length, withoutManagementReview, overdueReviews, attentionCount: withoutManagementReview + overdueReviews };
}

export async function createCertificationManagementReviewService(input: { organizationId: string; userId: string; programId: string; title: string; periodStart: Date; periodEnd: Date; scheduledAt: Date; chairId: string; attendees?: string | null }) {
  const [program, creator, chair] = await Promise.all([
    prisma.auditProgram.findFirst({ where: { id: input.programId, organizationId: input.organizationId, isActive: true } }),
    prisma.user.findFirst({ where: { id: input.userId, organizationId: input.organizationId, isActive: true } }),
    prisma.user.findFirst({ where: { id: input.chairId, organizationId: input.organizationId, isActive: true } }),
  ]);
  if (!program || !creator || !chair) throw new Error("Select a valid certification program and tenant review chair.");
  if ([input.periodStart, input.periodEnd, input.scheduledAt].some((value) => Number.isNaN(value.getTime()))) throw new Error("Enter valid management-review dates.");
  if (input.periodEnd < input.periodStart) throw new Error("The review period end cannot precede its start.");
  if (input.periodEnd > input.scheduledAt) throw new Error("The review period must end on or before the scheduled meeting date.");
  const year = input.scheduledAt.getUTCFullYear();
  const reference = `MR-${year}-${Date.now().toString(36).toUpperCase()}`;
  const review = await prisma.$transaction(async (tx) => {
    const created = await tx.certificationManagementReview.create({ data: { organizationId: input.organizationId, programId: program.id, reference, title: input.title, periodStart: input.periodStart, periodEnd: input.periodEnd, scheduledAt: input.scheduledAt, chairId: chair.id, attendees: input.attendees, createdById: creator.id } });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: creator.id, action: ActivityAction.CREATE, entityType: "CertificationManagementReview", entityId: created.id, title: "Certification management review scheduled", description: `${created.reference} — ${created.title}`, metadata: { programId: program.id, scheduledAt: created.scheduledAt, chairId: chair.id } } });
    return created;
  });
  if (chair.id !== creator.id) await createNotification({ organizationId: input.organizationId, userId: chair.id, type: NotificationType.ASSIGNMENT, title: "Management review assigned", message: `${review.reference} — ${review.title} is scheduled for ${review.scheduledAt.toLocaleDateString("en-US")}.`, link: `/assurance/certification/reviews/${review.id}` }).catch(() => undefined);
  return review;
}

export async function completeCertificationManagementReviewService(input: { organizationId: string; userId: string; reviewId: string; attendees?: string | null; auditResultsSummary: string; complianceStatusSummary: string; objectivesPerformance: string; stakeholderFeedback?: string | null; changesInContext?: string | null; risksAndOpportunities: string; resourceAdequacy: string; decisions: string; improvementOpportunities: string; conclusion: ManagementSystemConclusion; nextReviewAt: Date; customSubmissions?: PreparedSubmission[] }) {
  const [review, completer] = await Promise.all([
    prisma.certificationManagementReview.findFirst({ where: { id: input.reviewId, organizationId: input.organizationId }, include: { program: true } }),
    prisma.user.findFirst({ where: { id: input.userId, organizationId: input.organizationId, isActive: true } }),
  ]);
  if (!review || !completer) throw new Error("Management review not found in this organization.");
  if (!activeReviewStatuses.has(review.status)) throw new Error("Only a planned or in-progress management review can be completed.");
  if (Number.isNaN(input.nextReviewAt.getTime()) || input.nextReviewAt <= new Date()) throw new Error("The next management-review date must be in the future.");
  const overview = await getCertificationReadinessService(input.organizationId, review.programId);
  return prisma.$transaction(async (tx) => {
    const completed = await tx.certificationManagementReview.update({ where: { id: review.id }, data: { status: CertificationManagementReviewStatus.COMPLETED, attendees: input.attendees, auditResultsSummary: input.auditResultsSummary, complianceStatusSummary: input.complianceStatusSummary, objectivesPerformance: input.objectivesPerformance, stakeholderFeedback: input.stakeholderFeedback, changesInContext: input.changesInContext, risksAndOpportunities: input.risksAndOpportunities, resourceAdequacy: input.resourceAdequacy, decisions: input.decisions, improvementOpportunities: input.improvementOpportunities, conclusion: input.conclusion, readinessScore: overview.readiness.total, readinessSnapshot: { band: overview.readiness.band, dimensions: overview.readiness.dimensions, evidence: overview.evidence, generatedAt: new Date().toISOString() }, nextReviewAt: input.nextReviewAt, completedById: completer.id, completedAt: new Date(), reminderSentAt: null, overdueNotifiedAt: null } });
    await createPreparedSubmissions(tx, { organizationId: input.organizationId, userId: completer.id, module: ConfigurableFormModule.CERTIFICATION_READINESS, entityId: completed.id, submissions: input.customSubmissions ?? [] });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: completer.id, action: ActivityAction.UPDATE, entityType: "CertificationManagementReview", entityId: completed.id, title: "Certification management review completed", description: `${completed.reference} recorded a ${completed.conclusion?.replaceAll("_", " ")} conclusion.`, metadata: { programId: completed.programId, readinessScore: completed.readinessScore, conclusion: completed.conclusion, nextReviewAt: completed.nextReviewAt } } });
    return completed;
  });
}

export async function approveCertificationManagementReviewService(input: { organizationId: string; userId: string; reviewId: string }) {
  const [review, approver] = await Promise.all([
    prisma.certificationManagementReview.findFirst({ where: { id: input.reviewId, organizationId: input.organizationId }, include: { chair: true } }),
    prisma.user.findFirst({ where: { id: input.userId, organizationId: input.organizationId, isActive: true } }),
  ]);
  if (!review || !approver) throw new Error("Management review not found in this organization.");
  if (review.status !== CertificationManagementReviewStatus.COMPLETED) throw new Error("Complete the management-review inputs before approval.");
  const incompleteForms = await prisma.configurableFormSubmission.count({ where: { organizationId: input.organizationId, entityType: ConfigurableFormModule.CERTIFICATION_READINESS, entityId: review.id, status: ConfigurableSubmissionStatus.DRAFT } });
  if (incompleteForms) throw new Error(`${incompleteForms} required management-review form attachment${incompleteForms === 1 ? " remains" : "s remain"} incomplete.`);
  const approved = await prisma.$transaction(async (tx) => {
    const updated = await tx.certificationManagementReview.update({ where: { id: review.id }, data: { status: CertificationManagementReviewStatus.APPROVED, approvedById: approver.id, approvedAt: new Date() } });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: approver.id, action: ActivityAction.STATUS_CHANGE, entityType: "CertificationManagementReview", entityId: updated.id, title: "Certification management review approved", description: `${updated.reference} was approved.`, metadata: { programId: updated.programId, readinessScore: updated.readinessScore } } });
    return updated;
  });
  if (review.chairId !== approver.id) await createNotification({ organizationId: input.organizationId, userId: review.chairId, type: NotificationType.SUCCESS, title: "Management review approved", message: `${review.reference} — ${review.title} was approved.`, link: `/assurance/certification/reviews/${review.id}` }).catch(() => undefined);
  return approved;
}

export async function createCapaFromCertificationReviewService(input: { organizationId: string; userId: string; reviewId: string; agendaTopic?: string | null; decision: string; title: string; description?: string | null; assignedToId: string; riskLevel: RiskLevel; dueDate: Date }) {
  const [review, creator, assignee] = await Promise.all([
    prisma.certificationManagementReview.findFirst({ where: { id: input.reviewId, organizationId: input.organizationId } }),
    prisma.user.findFirst({ where: { id: input.userId, organizationId: input.organizationId, isActive: true } }),
    prisma.user.findFirst({ where: { id: input.assignedToId, organizationId: input.organizationId, isActive: true } }),
  ]);
  if (!review || !creator || !assignee) throw new Error("Select a valid tenant management review and corrective-action owner.");
  if (!completedReviewStatuses.has(review.status)) throw new Error("Complete the management review before creating decision actions.");
  if (Number.isNaN(input.dueDate.getTime()) || input.dueDate <= new Date()) throw new Error("Corrective-action due date must be in the future.");
  const action = await prisma.$transaction(async (tx) => {
    const created = await tx.correctiveAction.create({ data: { title: input.title, description: input.description, status: Status.OPEN, riskLevel: input.riskLevel, dueDate: input.dueDate, assignedToId: assignee.id } });
    await tx.certificationReviewActionLink.create({ data: { reviewId: review.id, correctiveActionId: created.id, agendaTopic: input.agendaTopic, decision: input.decision } });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: creator.id, action: ActivityAction.CREATE, entityType: "CorrectiveAction", entityId: created.id, title: "Management-review CAPA created", description: `${review.reference} — ${created.title}`, metadata: { reviewId: review.id, assignedToId: assignee.id, dueDate: created.dueDate, decision: input.decision } } });
    return created;
  });
  await createNotification({ organizationId: input.organizationId, userId: assignee.id, type: NotificationType.ASSIGNMENT, title: "Management-review action assigned", message: `${review.reference} — ${action.title} is due ${action.dueDate.toLocaleDateString("en-US")}.`, link: `/actions/${action.id}` }).catch(() => undefined);
  return action;
}

export async function processCertificationReviewMonitoring(now = new Date()) {
  const horizon = addDays(now, 14);
  const reviews = await prisma.certificationManagementReview.findMany({ where: { OR: [{ status: { in: [CertificationManagementReviewStatus.PLANNED, CertificationManagementReviewStatus.IN_PROGRESS] }, scheduledAt: { lte: horizon } }, { status: CertificationManagementReviewStatus.APPROVED, nextReviewAt: { lte: horizon } }] }, include: { chair: true, program: true } });
  const result = { checked: reviews.length, remindersSent: 0, overdue: 0 };
  for (const review of reviews) {
    const dueAt = review.status === CertificationManagementReviewStatus.APPROVED ? review.nextReviewAt! : review.scheduledAt;
    const overdue = dueAt < now;
    if (overdue) result.overdue++;
    if ((overdue && review.overdueNotifiedAt) || (!overdue && review.reminderSentAt)) continue;
    const notification = await createNotification({ organizationId: review.organizationId, userId: review.chairId, type: overdue ? NotificationType.CRITICAL : NotificationType.DUE_DATE, title: overdue ? "Management review overdue" : "Management review approaching", message: `${review.program.name}: ${review.title} ${overdue ? "was due" : "is due"} ${dueAt.toLocaleDateString("en-US")}.`, link: `/assurance/certification/reviews/${review.id}` }).catch(() => null);
    if (!notification) continue;
    await prisma.certificationManagementReview.update({ where: { id: review.id }, data: overdue ? { overdueNotifiedAt: now } : { reminderSentAt: now } });
    result.remindersSent++;
  }
  return result;
}
