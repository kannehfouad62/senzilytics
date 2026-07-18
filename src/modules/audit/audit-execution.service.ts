import { createNotification } from "@/core/notifications/notifications.service";
import { prisma } from "@/lib/prisma";
import {
  EnterpriseAuditEvidenceType,
  EnterpriseAuditFindingStatus,
  EnterpriseAuditFindingTrigger,
  EnterpriseAuditQuestionStatus,
  EnterpriseAuditResponseResult,
  EnterpriseAuditSectionStatus,
  EnterpriseAuditSeverity,
  EnterpriseAuditStatus,
  NotificationType,
  UserRole,
} from "@prisma/client";

const managementRoles = new Set<UserRole>([UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.EHS_MANAGER]);
const startableStatuses = new Set<EnterpriseAuditStatus>([EnterpriseAuditStatus.DRAFT, EnterpriseAuditStatus.PLANNED, EnterpriseAuditStatus.SCHEDULED]);
const closedFindingStatuses = new Set<EnterpriseAuditFindingStatus>([EnterpriseAuditFindingStatus.CLOSED, EnterpriseAuditFindingStatus.CANCELLED, EnterpriseAuditFindingStatus.REJECTED]);
const answeredResults = new Set<EnterpriseAuditResponseResult>(Object.values(EnterpriseAuditResponseResult).filter((value) => value !== EnterpriseAuditResponseResult.NOT_ASSESSED));
const compliantResults = new Set<EnterpriseAuditResponseResult>([EnterpriseAuditResponseResult.PASS, EnterpriseAuditResponseResult.YES, EnterpriseAuditResponseResult.COMPLIANT]);
const failedResults = new Set<EnterpriseAuditResponseResult>([EnterpriseAuditResponseResult.FAIL, EnterpriseAuditResponseResult.NO, EnterpriseAuditResponseResult.NON_COMPLIANT]);

async function getAuthorizedAudit(input: { organizationId: string; userId: string; userRole: UserRole; auditId: string; review?: boolean }) {
  const audit = await prisma.enterpriseAudit.findFirst({
    where: { id: input.auditId, organizationId: input.organizationId },
    include: { teamMembers: { where: { userId: input.userId } } },
  });
  if (!audit) throw new Error("Audit not found.");
  const membership = audit.teamMembers[0];
  const allowed = managementRoles.has(input.userRole) || audit.leadAuditorId === input.userId || (input.review ? membership?.canReview : membership?.canEdit);
  if (!allowed) throw new Error("You are not authorized to perform this Audit action.");
  return audit;
}

export async function startAuditExecutionService(input: { organizationId: string; userId: string; userRole: UserRole; auditId: string }) {
  const audit = await getAuthorizedAudit(input);
  if (!startableStatuses.has(audit.status)) throw new Error("Only a planned or scheduled Audit can be started.");
  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const value = await tx.enterpriseAudit.update({ where: { id: audit.id }, data: { status: EnterpriseAuditStatus.IN_PROGRESS, startedAt: audit.startedAt ?? now, updatedById: input.userId } });
    await tx.enterpriseAuditHistory.create({ data: { organizationId: input.organizationId, auditId: audit.id, userId: input.userId, action: "STARTED", entityType: "EnterpriseAudit", entityId: audit.id, title: "Audit execution started" } });
    return value;
  });
  return updated;
}

function scoreResponse(result: EnterpriseAuditResponseResult, maximumScore: number) {
  if (compliantResults.has(result)) return { awarded: maximumScore, compliant: true };
  if (failedResults.has(result)) return { awarded: 0, compliant: false };
  if (result === EnterpriseAuditResponseResult.PARTIALLY_COMPLIANT) return { awarded: maximumScore / 2, compliant: false };
  if (result === EnterpriseAuditResponseResult.NOT_APPLICABLE || result === EnterpriseAuditResponseResult.INFORMATION_ONLY || result === EnterpriseAuditResponseResult.OBSERVATION) return { awarded: 0, compliant: null };
  return { awarded: 0, compliant: null };
}

function shouldCreateFinding(input: { trigger: EnterpriseAuditFindingTrigger; result: EnterpriseAuditResponseResult; numericValue?: number | null; minimum?: number | null; maximum?: number | null; selectedOptionTriggers: boolean }) {
  switch (input.trigger) {
    case EnterpriseAuditFindingTrigger.ON_FAIL: return input.result === EnterpriseAuditResponseResult.FAIL || input.result === EnterpriseAuditResponseResult.NON_COMPLIANT;
    case EnterpriseAuditFindingTrigger.ON_NO: return input.result === EnterpriseAuditResponseResult.NO;
    case EnterpriseAuditFindingTrigger.BELOW_THRESHOLD: return input.numericValue != null && input.minimum != null && input.numericValue < input.minimum;
    case EnterpriseAuditFindingTrigger.ABOVE_THRESHOLD: return input.numericValue != null && input.maximum != null && input.numericValue > input.maximum;
    case EnterpriseAuditFindingTrigger.SELECTED_OPTIONS: return input.selectedOptionTriggers;
    case EnterpriseAuditFindingTrigger.NEVER:
    case EnterpriseAuditFindingTrigger.MANUAL_REVIEW:
      return false;
  }
}

export async function recordAuditResponseService(input: {
  organizationId: string;
  userId: string;
  userRole: UserRole;
  auditId: string;
  questionId: string;
  result: EnterpriseAuditResponseResult;
  responseText?: string | null;
  numericValue?: number | null;
  booleanValue?: boolean | null;
  selectedOptionValues: string[];
  comments?: string | null;
  evidenceNote?: string | null;
  evidenceUrl?: string | null;
}) {
  const audit = await getAuthorizedAudit(input);
  if (audit.status !== EnterpriseAuditStatus.IN_PROGRESS) throw new Error("Start the Audit before recording responses.");
  const question = await prisma.enterpriseAuditQuestion.findFirst({ where: { id: input.questionId, auditId: audit.id }, include: { options: true, findings: { select: { id: true } } } });
  if (!question) throw new Error("Audit question not found.");
  if (input.result === EnterpriseAuditResponseResult.NOT_APPLICABLE && !question.allowNotApplicable) throw new Error("Not applicable is not allowed for this question.");
  if (question.requireComment && !input.comments) throw new Error("A comment is required for this question.");
  if (question.requireEvidence && !input.evidenceNote && !input.evidenceUrl) throw new Error("Evidence is required for this question.");
  if (question.requirePhoto && !input.evidenceUrl) throw new Error("A photo or evidence URL is required for this question.");
  const selectedOptions = question.options.filter((option) => input.selectedOptionValues.includes(option.value));
  if (input.selectedOptionValues.length !== selectedOptions.length) throw new Error("One or more selected options are invalid.");

  const maximumScore = Number(question.maximumScore ?? question.weight);
  const score = scoreResponse(input.result, maximumScore);
  const findingRequired = question.automaticallyCreateFinding && shouldCreateFinding({ trigger: question.findingTrigger, result: input.result, numericValue: input.numericValue, minimum: question.minimumNumericValue == null ? null : Number(question.minimumNumericValue), maximum: question.maximumNumericValue == null ? null : Number(question.maximumNumericValue), selectedOptionTriggers: selectedOptions.some((option) => option.triggersFinding) });
  const severity = selectedOptions.find((option) => option.triggersFinding)?.findingSeverity ?? question.defaultSeverity ?? EnterpriseAuditSeverity.MEDIUM;
  const previousFinding = findingRequired ? await prisma.enterpriseAuditFinding.findFirst({ where: { organizationId: input.organizationId, auditId: { not: audit.id }, OR: [...(question.standardClause ? [{ standardClause: question.standardClause }] : []), { question: { questionText: { equals: question.questionText, mode: "insensitive" } } }] }, select: { reference: true, recurrenceCount: true }, orderBy: { createdAt: "desc" } }) : null;

  let createdFindingReference: string | null = null;
  await prisma.$transaction(async (tx) => {
    const response = await tx.enterpriseAuditResponse.upsert({
      where: { questionId: question.id },
      update: { answeredById: input.userId, result: input.result, responseText: input.responseText, numericValue: input.numericValue, booleanValue: input.booleanValue, selectedOptionValues: input.selectedOptionValues, comments: input.comments, scoreAwarded: score.awarded, maximumScore, isCompliant: score.compliant, requiresFollowUp: findingRequired, answeredAt: new Date() },
      create: { auditId: audit.id, questionId: question.id, answeredById: input.userId, result: input.result, responseText: input.responseText, numericValue: input.numericValue, booleanValue: input.booleanValue, selectedOptionValues: input.selectedOptionValues, comments: input.comments, scoreAwarded: score.awarded, maximumScore, isCompliant: score.compliant, requiresFollowUp: findingRequired, answeredAt: new Date() },
    });
    await tx.enterpriseAuditQuestion.update({ where: { id: question.id }, data: { status: input.result === EnterpriseAuditResponseResult.NOT_APPLICABLE ? EnterpriseAuditQuestionStatus.NOT_APPLICABLE : EnterpriseAuditQuestionStatus.ANSWERED } });
    if (input.evidenceNote) await tx.enterpriseAuditEvidence.create({ data: { organizationId: input.organizationId, auditId: audit.id, questionId: question.id, responseId: response.id, evidenceType: EnterpriseAuditEvidenceType.NOTE, title: "Response evidence note", description: input.evidenceNote, capturedAt: new Date(), capturedById: input.userId } });
    if (input.evidenceUrl) await tx.enterpriseAuditEvidence.create({ data: { organizationId: input.organizationId, auditId: audit.id, questionId: question.id, responseId: response.id, evidenceType: question.requirePhoto ? EnterpriseAuditEvidenceType.PHOTO : EnterpriseAuditEvidenceType.LINK, title: question.requirePhoto ? "Response photo evidence" : "Response evidence link", externalUrl: input.evidenceUrl, capturedAt: new Date(), capturedById: input.userId } });
    if (findingRequired && question.findings.length === 0) {
      const reference = `AF-${audit.reference}-${question.sequence}-${crypto.randomUUID().slice(0, 5).toUpperCase()}`;
      const finding = await tx.enterpriseAuditFinding.create({ data: { organizationId: input.organizationId, auditId: audit.id, questionId: question.id, responseId: response.id, reference, title: question.findingTitleTemplate || `Nonconformity: ${question.questionText.slice(0, 100)}`, findingType: severity === EnterpriseAuditSeverity.CRITICAL || severity === EnterpriseAuditSeverity.HIGH ? "MAJOR_NONCONFORMITY" : "NONCONFORMITY", severity, status: EnterpriseAuditFindingStatus.OPEN, description: question.findingDescriptionTemplate || input.comments || `Automatically generated from Audit response ${input.result}.`, standardClause: question.standardClause, regulatoryRef: question.regulatoryRef, isRepeatFinding: Boolean(previousFinding), previousFindingReference: previousFinding?.reference, recurrenceCount: previousFinding ? previousFinding.recurrenceCount + 1 : 0, requiresCapa: question.automaticallySuggestCapa, requiresRiskReview: question.automaticallySuggestRisk, capaSuggestedAt: question.automaticallySuggestCapa ? new Date() : null, riskSuggestedAt: question.automaticallySuggestRisk ? new Date() : null, createdById: input.userId, updatedById: input.userId } });
      createdFindingReference = reference;
      await tx.enterpriseAuditHistory.create({ data: { organizationId: input.organizationId, auditId: audit.id, userId: input.userId, action: "FINDING_CREATED", entityType: "EnterpriseAuditFinding", entityId: finding.id, title: "Automatic Audit finding created", description: reference } });
    }
    await tx.enterpriseAuditHistory.create({ data: { organizationId: input.organizationId, auditId: audit.id, userId: input.userId, action: "RESPONSE_RECORDED", entityType: "EnterpriseAuditResponse", entityId: response.id, title: "Audit response recorded", description: question.questionText } });
  });

  await recalculateAuditProgress(audit.id);
  if (createdFindingReference && audit.leadAuditorId) {
    await createNotification({ organizationId: input.organizationId, userId: audit.leadAuditorId, type: severity === EnterpriseAuditSeverity.CRITICAL ? NotificationType.CRITICAL : NotificationType.WARNING, title: "Automatic Audit finding created", message: `${createdFindingReference} was generated from a nonconforming response.`, link: `/audits/${audit.id}` }).catch(() => undefined);
  }
}

async function recalculateAuditProgress(auditId: string) {
  const audit = await prisma.enterpriseAudit.findUnique({ where: { id: auditId }, include: { sections: { include: { questions: { include: { response: true } } } }, findings: true } });
  if (!audit) return;
  let answered = 0, compliant = 0, failed = 0, notApplicable = 0, achieved = 0, maximum = 0;
  for (const section of audit.sections) {
    let sectionAnswered = 0, sectionFailed = 0, sectionAchieved = 0, sectionMaximum = 0;
    for (const question of section.questions) {
      const response = question.response;
      if (!response || !answeredResults.has(response.result)) continue;
      answered += 1; sectionAnswered += 1;
      if (response.result === EnterpriseAuditResponseResult.NOT_APPLICABLE) { notApplicable += 1; continue; }
      const max = Number(response.maximumScore ?? question.maximumScore ?? question.weight); const awarded = Number(response.scoreAwarded ?? 0);
      maximum += max; sectionMaximum += max; achieved += awarded; sectionAchieved += awarded;
      if (response.isCompliant === true) compliant += 1;
      if (response.isCompliant === false) { failed += 1; sectionFailed += 1; }
    }
    const allAnswered = sectionAnswered === section.questions.length && section.questions.length > 0;
    await prisma.enterpriseAuditSection.update({ where: { id: section.id }, data: { answeredQuestionCount: sectionAnswered, failedQuestionCount: sectionFailed, maximumPossibleScore: sectionMaximum, achievedScore: sectionAchieved, scorePercentage: sectionMaximum > 0 ? (sectionAchieved / sectionMaximum) * 100 : null, status: allAnswered ? EnterpriseAuditSectionStatus.COMPLETED : sectionAnswered > 0 ? EnterpriseAuditSectionStatus.IN_PROGRESS : EnterpriseAuditSectionStatus.NOT_STARTED, startedAt: sectionAnswered > 0 ? section.startedAt ?? new Date() : section.startedAt, completedAt: allAnswered ? new Date() : null } });
  }
  const openFindings = audit.findings.filter((finding) => !closedFindingStatuses.has(finding.status));
  await prisma.enterpriseAudit.update({ where: { id: audit.id }, data: { answeredQuestionCount: answered, compliantQuestionCount: compliant, failedQuestionCount: failed, notApplicableCount: notApplicable, maximumPossibleScore: maximum, achievedScore: achieved, scorePercentage: maximum > 0 ? (achieved / maximum) * 100 : null, findingCount: audit.findings.length, openFindingCount: openFindings.length, highRiskFindingCount: openFindings.filter((finding) => finding.severity === EnterpriseAuditSeverity.HIGH || finding.severity === EnterpriseAuditSeverity.CRITICAL).length } });
}

export async function submitAuditForReviewService(input: { organizationId: string; userId: string; userRole: UserRole; auditId: string }) {
  const audit = await getAuthorizedAudit(input);
  if (audit.status !== EnterpriseAuditStatus.IN_PROGRESS) throw new Error("Only an Audit in progress can be submitted.");
  const requiredUnanswered = await prisma.enterpriseAuditQuestion.count({ where: { auditId: audit.id, isRequired: true, status: { notIn: [EnterpriseAuditQuestionStatus.ANSWERED, EnterpriseAuditQuestionStatus.NOT_APPLICABLE] } } });
  if (requiredUnanswered > 0) throw new Error(`${requiredUnanswered} required Audit questions remain unanswered.`);
  await prisma.$transaction([prisma.enterpriseAudit.update({ where: { id: audit.id }, data: { status: EnterpriseAuditStatus.PENDING_REVIEW, submittedAt: new Date(), updatedById: input.userId } }), prisma.enterpriseAuditHistory.create({ data: { organizationId: input.organizationId, auditId: audit.id, userId: input.userId, action: "SUBMITTED_FOR_REVIEW", entityType: "EnterpriseAudit", entityId: audit.id, title: "Audit submitted for review" } })]);
}

export async function completeAuditService(input: { organizationId: string; userId: string; userRole: UserRole; auditId: string }) {
  const audit = await getAuthorizedAudit({ ...input, review: true });
  if (audit.status !== EnterpriseAuditStatus.PENDING_REVIEW) throw new Error("Only an Audit pending review can be completed.");
  await prisma.$transaction([prisma.enterpriseAudit.update({ where: { id: audit.id }, data: { status: EnterpriseAuditStatus.COMPLETED, completedAt: new Date(), updatedById: input.userId } }), prisma.enterpriseAuditHistory.create({ data: { organizationId: input.organizationId, auditId: audit.id, userId: input.userId, action: "COMPLETED", entityType: "EnterpriseAudit", entityId: audit.id, title: "Audit completed" } })]);
  const recipients = await prisma.enterpriseAuditTeamMember.findMany({ where: { auditId: audit.id }, select: { userId: true } });
  await Promise.all(recipients.map(({ userId }) => createNotification({ organizationId: input.organizationId, userId, type: NotificationType.SUCCESS, title: "Audit completed", message: `${audit.reference} — ${audit.title} has been completed.`, link: `/audits/${audit.id}` }).catch(() => undefined)));
}

export async function saveAuditConclusionService(input: { organizationId: string; userId: string; userRole: UserRole; auditId: string; executiveSummary: string | null; overallOpinion: string | null; positivePractices: string | null; majorConcerns: string | null; recommendations: string | null }) {
  const audit = await getAuthorizedAudit({ ...input, review: true });
  if (audit.status === EnterpriseAuditStatus.CANCELLED || audit.status === EnterpriseAuditStatus.CLOSED) throw new Error("A closed or cancelled Audit conclusion cannot be changed.");
  await prisma.$transaction([
    prisma.enterpriseAudit.update({ where: { id: audit.id }, data: { executiveSummary: input.executiveSummary, overallOpinion: input.overallOpinion, positivePractices: input.positivePractices, majorConcerns: input.majorConcerns, recommendations: input.recommendations, updatedById: input.userId } }),
    prisma.enterpriseAuditHistory.create({ data: { organizationId: input.organizationId, auditId: audit.id, userId: input.userId, action: "UPDATED", entityType: "EnterpriseAudit", entityId: audit.id, title: "Audit executive conclusion updated" } }),
  ]);
}
