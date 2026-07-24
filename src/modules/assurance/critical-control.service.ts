import { createNotification } from "@/core/notifications/notifications.service";
import { prisma } from "@/lib/prisma";
import { createPreparedSubmissions, type PreparedSubmission } from "@/modules/forms/runtime-form.service";
import {
  recordMobileOfflineSubmission,
  type MobileOfflineSubmission,
} from "@/modules/mobile/mobile-offline-record";
import {
  ActivityAction,
  ConfigurableFormModule,
  CriticalControlVerificationResult,
  NotificationType,
  RiskLevel,
  SifExposureCategory,
  SifSignalClassification,
  SifSignalSourceType,
  Status,
} from "@prisma/client";

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400000);

export async function createCriticalControlService(input: {
  organizationId: string;
  userId: string;
  code: string;
  name: string;
  category: SifExposureCategory;
  description?: string | null;
  performanceStandard: string;
  verificationPrompt: string;
  verificationFrequencyDays: number;
  siteId?: string | null;
  departmentId?: string | null;
  ownerId?: string | null;
}) {
  if (!Number.isInteger(input.verificationFrequencyDays) || input.verificationFrequencyDays < 1 || input.verificationFrequencyDays > 365) throw new Error("Verification frequency must be between 1 and 365 days.");
  const [creator, site, department, owner] = await Promise.all([
    prisma.user.findFirst({ where: { id: input.userId, organizationId: input.organizationId, isActive: true } }),
    input.siteId ? prisma.site.findFirst({ where: { id: input.siteId, organizationId: input.organizationId } }) : null,
    input.departmentId ? prisma.department.findFirst({ where: { id: input.departmentId, site: { organizationId: input.organizationId } } }) : null,
    input.ownerId ? prisma.user.findFirst({ where: { id: input.ownerId, organizationId: input.organizationId, isActive: true } }) : null,
  ]);
  if (!creator || (input.siteId && !site) || (input.departmentId && !department) || (input.ownerId && !owner)) throw new Error("Select valid tenant control ownership and scope values.");
  if (site && department && department.siteId !== site.id) throw new Error("The selected department does not belong to the selected site.");
  const now = new Date();
  const control = await prisma.$transaction(async (tx) => {
    const control = await tx.criticalControlStandard.create({ data: { organizationId: input.organizationId, code: input.code.toUpperCase(), name: input.name, category: input.category, description: input.description, performanceStandard: input.performanceStandard, verificationPrompt: input.verificationPrompt, verificationFrequencyDays: input.verificationFrequencyDays, siteId: input.siteId, departmentId: input.departmentId, ownerId: input.ownerId, createdById: creator.id, nextVerificationDueAt: addDays(now, input.verificationFrequencyDays) } });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: creator.id, action: ActivityAction.CREATE, entityType: "CriticalControlStandard", entityId: control.id, title: "Critical control standard created", description: `${control.code} — ${control.name}`, metadata: { category: control.category, siteId: control.siteId, verificationFrequencyDays: control.verificationFrequencyDays } } });
    return control;
  });
  if (control.ownerId && control.ownerId !== creator.id) await createNotification({ organizationId: input.organizationId, userId: control.ownerId, type: NotificationType.ASSIGNMENT, title: "Critical control assigned", message: `${control.code} — ${control.name} was assigned to you for recurring verification.`, link: `/assurance/sif/controls/${control.id}` }).catch(() => undefined);
  return control;
}

export async function recordCriticalControlVerificationService(input: {
  organizationId: string;
  userId: string;
  controlId: string;
  verifiedAt: Date;
  result: CriticalControlVerificationResult;
  evidenceReference?: string | null;
  findings?: string | null;
  immediateAction?: string | null;
  customSubmissions?: PreparedSubmission[];
  offlineSubmission?: MobileOfflineSubmission;
}) {
  const [control, verifier] = await Promise.all([
    prisma.criticalControlStandard.findFirst({ where: { id: input.controlId, organizationId: input.organizationId, isActive: true }, include: { owner: true } }),
    prisma.user.findFirst({ where: { id: input.userId, organizationId: input.organizationId, isActive: true } }),
  ]);
  if (!control || !verifier) throw new Error("Active critical control not found in this organization.");
  if (Number.isNaN(input.verifiedAt.getTime()) || input.verifiedAt > new Date()) throw new Error("Verification date cannot be invalid or in the future.");
  if (input.result === CriticalControlVerificationResult.EFFECTIVE && !input.evidenceReference) throw new Error("Record an evidence reference before confirming this control is effective.");
  if ((input.result === CriticalControlVerificationResult.DEGRADED || input.result === CriticalControlVerificationResult.FAILED) && !input.findings) throw new Error("Describe the control deficiency for a degraded or failed result.");
  const nextDueAt = addDays(input.verifiedAt, control.verificationFrequencyDays);
  const verification = await prisma.$transaction(async (tx) => {
    const record = await tx.criticalControlVerification.create({ data: { organizationId: input.organizationId, controlId: control.id, verifiedById: verifier.id, verifiedAt: input.verifiedAt, nextDueAt, result: input.result, evidenceReference: input.evidenceReference, findings: input.findings, immediateAction: input.immediateAction } });
    await createPreparedSubmissions(tx, { organizationId: input.organizationId, userId: verifier.id, module: ConfigurableFormModule.SIF_ASSURANCE, entityId: record.id, submissions: input.customSubmissions ?? [] });
    await tx.criticalControlStandard.update({ where: { id: control.id }, data: { nextVerificationDueAt: nextDueAt, reminderSentAt: null, overdueNotifiedAt: null } });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: verifier.id, action: ActivityAction.UPDATE, entityType: "CriticalControlVerification", entityId: record.id, title: "Critical control verified", description: `${control.code} — ${control.name}: ${record.result}`, metadata: { controlId: control.id, result: record.result, nextDueAt, customFormCount: input.customSubmissions?.length ?? 0 } } });
    await recordMobileOfflineSubmission(tx, input, "SIF_VERIFICATION", record.id);
    return record;
  });
  if (control.ownerId && (verification.result === CriticalControlVerificationResult.DEGRADED || verification.result === CriticalControlVerificationResult.FAILED)) await createNotification({ organizationId: input.organizationId, userId: control.ownerId, type: verification.result === CriticalControlVerificationResult.FAILED ? NotificationType.CRITICAL : NotificationType.WARNING, title: `Critical control ${verification.result.toLowerCase()}`, message: `${control.code} — ${control.name} requires corrective attention.`, link: `/assurance/sif/controls/${control.id}` }).catch(() => undefined);
  return verification;
}

async function validTenantSource(organizationId: string, sourceType: SifSignalSourceType, sourceId: string) {
  switch (sourceType) {
    case SifSignalSourceType.OBSERVATION: return Boolean(await prisma.safetyObservation.findFirst({ where: { id: sourceId, organizationId }, select: { id: true } }));
    case SifSignalSourceType.INCIDENT: return Boolean(await prisma.incident.findFirst({ where: { id: sourceId, site: { organizationId } }, select: { id: true } }));
    case SifSignalSourceType.AUDIT_FINDING: return Boolean(await prisma.enterpriseAuditFinding.findFirst({ where: { id: sourceId, organizationId }, select: { id: true } }));
    case SifSignalSourceType.INSPECTION_FINDING: return Boolean(await prisma.inspectionFinding.findFirst({ where: { id: sourceId, inspection: { site: { organizationId } } }, select: { id: true } }));
    case SifSignalSourceType.RISK: return Boolean(await prisma.risk.findFirst({ where: { id: sourceId, organizationId }, select: { id: true } }));
    case SifSignalSourceType.PERMIT_TO_WORK: return Boolean(await prisma.permitToWork.findFirst({ where: { id: sourceId, organizationId }, select: { id: true } }));
    case SifSignalSourceType.CONTROL_VERIFICATION: return Boolean(await prisma.criticalControlVerification.findFirst({ where: { id: sourceId, organizationId }, select: { id: true } }));
  }
}

export async function reviewSifSignalService(input: {
  organizationId: string;
  userId: string;
  sourceType: SifSignalSourceType;
  sourceId: string;
  classification: SifSignalClassification;
  exposureCategory: SifExposureCategory;
  potentialSeverity: RiskLevel;
  rationale: string;
  controlFailureNotes?: string | null;
  offlineSubmission?: MobileOfflineSubmission;
}) {
  const [reviewer, validSource] = await Promise.all([prisma.user.findFirst({ where: { id: input.userId, organizationId: input.organizationId, isActive: true } }), validTenantSource(input.organizationId, input.sourceType, input.sourceId)]);
  if (!reviewer || !validSource) throw new Error("The signal source is not available in this organization.");
  if (!input.rationale.trim()) throw new Error("Record the rationale for the SIF classification decision.");
  return prisma.$transaction(async (tx) => {
    const review = await tx.sifSignalReview.upsert({ where: { organizationId_sourceType_sourceId: { organizationId: input.organizationId, sourceType: input.sourceType, sourceId: input.sourceId } }, update: { classification: input.classification, exposureCategory: input.exposureCategory, potentialSeverity: input.potentialSeverity, rationale: input.rationale, controlFailureNotes: input.controlFailureNotes, reviewedById: reviewer.id, reviewedAt: new Date() }, create: { organizationId: input.organizationId, sourceType: input.sourceType, sourceId: input.sourceId, classification: input.classification, exposureCategory: input.exposureCategory, potentialSeverity: input.potentialSeverity, rationale: input.rationale, controlFailureNotes: input.controlFailureNotes, reviewedById: reviewer.id } });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: reviewer.id, action: ActivityAction.UPDATE, entityType: "SifSignalReview", entityId: review.id, title: "SIF signal classification recorded", description: `${input.sourceType}: ${input.classification}`, metadata: { sourceId: input.sourceId, exposureCategory: input.exposureCategory, potentialSeverity: input.potentialSeverity } } });
    await recordMobileOfflineSubmission(tx, input, "SIF_SIGNAL_REVIEW", review.id);
    return review;
  });
}

export async function createCapaFromCriticalControlService(input: { organizationId: string; userId: string; verificationId: string; title: string; description?: string | null; assignedToId: string; dueDate: Date }) {
  const [verification, creator, assignee] = await Promise.all([
    prisma.criticalControlVerification.findFirst({ where: { id: input.verificationId, organizationId: input.organizationId }, include: { control: true } }),
    prisma.user.findFirst({ where: { id: input.userId, organizationId: input.organizationId, isActive: true } }),
    prisma.user.findFirst({ where: { id: input.assignedToId, organizationId: input.organizationId, isActive: true } }),
  ]);
  if (!verification || !creator || !assignee) throw new Error("Select a valid tenant verification and corrective-action owner.");
  if (verification.correctiveActionId) throw new Error("This control verification already has a linked corrective action.");
  if (verification.result === CriticalControlVerificationResult.EFFECTIVE) throw new Error("An effective control result does not require corrective-action conversion.");
  if (Number.isNaN(input.dueDate.getTime()) || input.dueDate <= new Date()) throw new Error("Corrective-action due date must be in the future.");
  const action = await prisma.$transaction(async (tx) => {
    const action = await tx.correctiveAction.create({ data: { title: input.title, description: input.description, status: Status.OPEN, riskLevel: verification.result === CriticalControlVerificationResult.FAILED ? RiskLevel.CRITICAL : RiskLevel.HIGH, dueDate: input.dueDate, assignedToId: assignee.id } });
    await tx.criticalControlVerification.update({ where: { id: verification.id }, data: { correctiveActionId: action.id } });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: creator.id, action: ActivityAction.CREATE, entityType: "CorrectiveAction", entityId: action.id, title: "Critical-control CAPA created", description: `${verification.control.code} — ${input.title}`, metadata: { verificationId: verification.id, controlId: verification.controlId, assignedToId: assignee.id, dueDate: input.dueDate } } });
    return action;
  });
  await createNotification({ organizationId: input.organizationId, userId: assignee.id, type: NotificationType.ASSIGNMENT, title: "Critical-control corrective action assigned", message: `${verification.control.code} — ${action.title} is due ${action.dueDate.toLocaleDateString("en-US")}.`, link: `/actions/${action.id}` }).catch(() => undefined);
  return action;
}

export async function processCriticalControlMonitoring(now = new Date()) {
  const horizon = addDays(now, 7);
  const controls = await prisma.criticalControlStandard.findMany({ where: { isActive: true, nextVerificationDueAt: { lte: horizon } }, include: { owner: true } });
  const result = { checked: controls.length, remindersSent: 0, overdue: 0, unassigned: 0 };
  for (const control of controls) {
    if (control.nextVerificationDueAt < now) result.overdue++;
    if (!control.ownerId) { result.unassigned++; continue; }
    const isOverdue = control.nextVerificationDueAt < now;
    if ((isOverdue && control.overdueNotifiedAt) || (!isOverdue && control.reminderSentAt)) continue;
    const created = await createNotification({ organizationId: control.organizationId, userId: control.ownerId, type: isOverdue ? NotificationType.CRITICAL : NotificationType.DUE_DATE, title: isOverdue ? "Critical-control verification overdue" : "Critical-control verification due soon", message: `${control.code} — ${control.name} is due ${control.nextVerificationDueAt.toLocaleDateString("en-US")}.`, link: `/assurance/sif/controls/${control.id}` }).catch(() => null);
    await prisma.criticalControlStandard.update({ where: { id: control.id }, data: isOverdue ? { overdueNotifiedAt: now } : { reminderSentAt: now } });
    if (created) result.remindersSent++;
  }
  return result;
}
