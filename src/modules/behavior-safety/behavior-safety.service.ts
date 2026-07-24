import { createNotification } from "@/core/notifications/notifications.service";
import { prisma } from "@/lib/prisma";
import { canTransitionBehaviorProgram, summarizeBehaviorResults } from "@/modules/behavior-safety/behavior-safety-lifecycle";
import { createPreparedSubmissions, type PreparedSubmission } from "@/modules/forms/runtime-form.service";
import {
  recordMobileOfflineSubmission,
  type MobileOfflineSubmission,
} from "@/modules/mobile/mobile-offline-record";
import {
  ActivityAction,
  BehaviorCoachingType,
  BehaviorFollowUpStatus,
  BehaviorObservationOutcome,
  BehaviorProgramStatus,
  BehaviorRecognitionStatus,
  ConfigurableFormModule,
  NotificationType,
  RiskLevel,
  SafetyObservationStatus,
  SafetyObservationType,
  SifExposureCategory,
  Status,
} from "@prisma/client";
import { randomUUID } from "node:crypto";

const reference = (prefix: string) => `${prefix}-${new Date().getUTCFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;

async function tenantUser(organizationId: string, userId: string) {
  return prisma.user.findFirst({ where: { id: userId, organizationId, isActive: true } });
}

export async function createBehaviorProgramService(input: {
  organizationId: string; userId: string; code: string; name: string; description?: string | null; objective?: string | null;
  siteId?: string | null; departmentId?: string | null; ownerId: string; targetSessionsPerMonth: number;
  effectiveFrom?: Date | null; effectiveTo?: Date | null; nextReviewAt?: Date | null;
}) {
  const [creator, owner, site, department] = await Promise.all([
    tenantUser(input.organizationId, input.userId), tenantUser(input.organizationId, input.ownerId),
    input.siteId ? prisma.site.findFirst({ where: { id: input.siteId, organizationId: input.organizationId } }) : null,
    input.departmentId ? prisma.department.findFirst({ where: { id: input.departmentId, site: { organizationId: input.organizationId } } }) : null,
  ]);
  if (!creator || !owner || (input.siteId && !site) || (input.departmentId && !department)) throw new Error("Select valid tenant ownership and scope values.");
  if (department && site && department.siteId !== site.id) throw new Error("The selected department does not belong to the program site.");
  if (!Number.isInteger(input.targetSessionsPerMonth) || input.targetSessionsPerMonth < 1 || input.targetSessionsPerMonth > 10000) throw new Error("Monthly coaching target must be between 1 and 10,000.");
  if (input.effectiveFrom && input.effectiveTo && input.effectiveTo < input.effectiveFrom) throw new Error("Effective end date must be after the start date.");
  return prisma.$transaction(async tx => {
    const program = await tx.behaviorSafetyProgram.create({ data: { organizationId: input.organizationId, code: input.code.toUpperCase(), name: input.name, description: input.description, objective: input.objective, siteId: input.siteId, departmentId: input.departmentId, ownerId: owner.id, createdById: creator.id, targetSessionsPerMonth: input.targetSessionsPerMonth, effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo, nextReviewAt: input.nextReviewAt } });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: creator.id, action: ActivityAction.CREATE, entityType: "BehaviorSafetyProgram", entityId: program.id, title: "Behavior-safety program created", description: `${program.code} — ${program.name}`, metadata: { ownerId: program.ownerId, siteId: program.siteId, targetSessionsPerMonth: program.targetSessionsPerMonth } } });
    return program;
  });
}

export async function addBehaviorDefinitionService(input: {
  organizationId: string; userId: string; programId: string; code: string; title: string; category: SifExposureCategory;
  prompt: string; safeDescription: string; atRiskDescription: string; isCritical: boolean; sequence: number;
}) {
  const [program, user] = await Promise.all([prisma.behaviorSafetyProgram.findFirst({ where: { id: input.programId, organizationId: input.organizationId } }), tenantUser(input.organizationId, input.userId)]);
  if (!program || !user) throw new Error("Behavior-safety program not found in this organization.");
  if (program.status === BehaviorProgramStatus.ARCHIVED) throw new Error("Archived programs cannot be changed.");
  return prisma.$transaction(async tx => {
    const behavior = await tx.behaviorDefinition.create({ data: { programId: program.id, code: input.code.toUpperCase(), title: input.title, category: input.category, prompt: input.prompt, safeDescription: input.safeDescription, atRiskDescription: input.atRiskDescription, isCritical: input.isCritical, sequence: input.sequence } });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: user.id, action: ActivityAction.CREATE, entityType: "BehaviorDefinition", entityId: behavior.id, title: "Critical behavior added", description: `${program.code} — ${behavior.title}`, metadata: { programId: program.id, category: behavior.category, isCritical: behavior.isCritical } } });
    return behavior;
  });
}

export async function changeBehaviorProgramStatusService(input: { organizationId: string; userId: string; programId: string; status: BehaviorProgramStatus; reason: string }) {
  const [program, user] = await Promise.all([prisma.behaviorSafetyProgram.findFirst({ where: { id: input.programId, organizationId: input.organizationId }, include: { behaviors: { where: { isActive: true }, select: { id: true } } } }), tenantUser(input.organizationId, input.userId)]);
  if (!program || !user) throw new Error("Behavior-safety program not found in this organization.");
  if (!canTransitionBehaviorProgram(program.status, input.status)) throw new Error(`A program cannot move from ${program.status.toLowerCase()} to ${input.status.toLowerCase()}.`);
  if (input.status === BehaviorProgramStatus.ACTIVE && !program.behaviors.length) throw new Error("Add at least one active behavior before activating the program.");
  if (!input.reason.trim()) throw new Error("Record the reason for the program status change.");
  return prisma.$transaction(async tx => {
    const updated = await tx.behaviorSafetyProgram.update({ where: { id: program.id }, data: { status: input.status } });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: user.id, action: ActivityAction.STATUS_CHANGE, entityType: "BehaviorSafetyProgram", entityId: program.id, title: "Behavior-safety program status changed", description: `${program.status} → ${updated.status}: ${input.reason}`, metadata: { previousStatus: program.status, status: updated.status, reason: input.reason } } });
    return updated;
  });
}

export async function recordBehaviorProgramReviewService(input: { organizationId: string; userId: string; programId: string; reviewNotes: string; nextReviewAt: Date; offlineSubmission?: MobileOfflineSubmission }) {
  const [program, user] = await Promise.all([prisma.behaviorSafetyProgram.findFirst({ where: { id: input.programId, organizationId: input.organizationId } }), tenantUser(input.organizationId, input.userId)]);
  if (!program || !user) throw new Error("Behavior-safety program not found in this organization.");
  if (program.status === BehaviorProgramStatus.ARCHIVED) throw new Error("Archived programs cannot be reviewed.");
  if (input.nextReviewAt <= new Date()) throw new Error("Next review date must be in the future.");
  if (!input.reviewNotes.trim()) throw new Error("Record the program review outcome.");
  return prisma.$transaction(async tx => {
    const updated = await tx.behaviorSafetyProgram.update({ where: { id: program.id }, data: { nextReviewAt: input.nextReviewAt, reviewReminderAt: null } });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: user.id, action: ActivityAction.UPDATE, entityType: "BehaviorSafetyProgram", entityId: program.id, title: "Behavior-safety program reviewed", description: input.reviewNotes, metadata: { previousReviewDueAt: program.nextReviewAt, nextReviewAt: updated.nextReviewAt } } });
    await recordMobileOfflineSubmission(tx, input, "BEHAVIOR_PROGRAM_REVIEW", updated.id);
    return updated;
  });
}

export async function recordBehaviorCoachingSessionService(input: {
  organizationId: string; userId: string; programId: string; siteId: string; departmentId?: string | null; participantId?: string | null;
  isParticipantAnonymous: boolean; workGroup?: string | null; observedAt: Date; location?: string | null; coachingType: BehaviorCoachingType;
  discussionSummary?: string | null; workerCommitment?: string | null; immediateAction?: string | null; followUpOwnerId?: string | null;
  followUpDueAt?: Date | null; createSafetyObservation: boolean; customSubmissions?: PreparedSubmission[];
  results: Array<{ behaviorId: string; outcome: BehaviorObservationOutcome; note?: string | null; immediateAction?: string | null }>;
  offlineSubmission?: MobileOfflineSubmission;
}) {
  const [program, observer, site, department, participant, followUpOwner] = await Promise.all([
    prisma.behaviorSafetyProgram.findFirst({ where: { id: input.programId, organizationId: input.organizationId }, include: { behaviors: { where: { isActive: true } } } }),
    tenantUser(input.organizationId, input.userId), prisma.site.findFirst({ where: { id: input.siteId, organizationId: input.organizationId } }),
    input.departmentId ? prisma.department.findFirst({ where: { id: input.departmentId, site: { organizationId: input.organizationId } } }) : null,
    !input.isParticipantAnonymous && input.participantId ? tenantUser(input.organizationId, input.participantId) : null,
    input.followUpOwnerId ? tenantUser(input.organizationId, input.followUpOwnerId) : null,
  ]);
  if (!program || !observer || !site || (input.departmentId && !department) || (!input.isParticipantAnonymous && input.participantId && !participant) || (input.followUpOwnerId && !followUpOwner)) throw new Error("Select a valid active program and tenant session scope.");
  if (program.status !== BehaviorProgramStatus.ACTIVE) throw new Error("Only an active behavior-safety program can accept coaching sessions.");
  if (program.siteId && program.siteId !== site.id) throw new Error("The selected site is outside this behavior-safety program.");
  if (department && department.siteId !== site.id) throw new Error("The selected department does not belong to the session site.");
  if (program.departmentId && program.departmentId !== input.departmentId) throw new Error("The selected department is outside this behavior-safety program.");
  if (Number.isNaN(input.observedAt.getTime()) || input.observedAt > new Date()) throw new Error("Observation date cannot be invalid or in the future.");
  if (program.effectiveFrom && input.observedAt < program.effectiveFrom) throw new Error("Observation date cannot be before the program effective date.");
  if (program.effectiveTo && input.observedAt > program.effectiveTo) throw new Error("Observation date cannot be after the program effective end date.");
  if (input.results.length !== program.behaviors.length || new Set(input.results.map(result => result.behaviorId)).size !== input.results.length) throw new Error("Record one result for every active behavior without duplicates.");
  const behaviorMap = new Map(program.behaviors.map(behavior => [behavior.id, behavior]));
  if (input.results.some(result => !behaviorMap.has(result.behaviorId))) throw new Error("One or more behavior results do not belong to this active program.");
  const summary = summarizeBehaviorResults(input.results.map(result => ({ outcome: result.outcome, isCritical: behaviorMap.get(result.behaviorId)!.isCritical })));
  if (summary.criticalAtRiskCount && !input.immediateAction) throw new Error("Record the immediate control taken for a critical at-risk behavior.");
  if (summary.atRiskCount && (!input.followUpOwnerId || !input.followUpDueAt)) throw new Error("Assign an owner and due date for at-risk behavior follow-up.");
  if (input.followUpDueAt && input.followUpDueAt <= new Date()) throw new Error("Follow-up due date must be in the future.");
  const sessionReference = reference("BBS");
  const session = await prisma.$transaction(async tx => {
    let safetyObservationId: string | null = null;
    if (input.createSafetyObservation || summary.criticalAtRiskCount > 0) {
      const observation = await tx.safetyObservation.create({ data: { organizationId: input.organizationId, siteId: site.id, departmentId: input.departmentId, reportedById: observer.id, assignedToId: summary.atRiskCount ? input.followUpOwnerId : null, reference: reference("OBS"), title: summary.atRiskCount ? `${program.name}: at-risk behavior coaching` : `${program.name}: positive behavior recognition`, description: `${sessionReference} captured ${summary.safeCount} safe and ${summary.atRiskCount} at-risk behavior result${input.isParticipantAnonymous ? " with participant identity withheld" : ""}.`, type: summary.atRiskCount ? SafetyObservationType.UNSAFE_ACT : SafetyObservationType.POSITIVE_PRACTICE, status: summary.atRiskCount ? SafetyObservationStatus.ACTION_REQUIRED : SafetyObservationStatus.REPORTED, riskLevel: summary.criticalAtRiskCount ? RiskLevel.CRITICAL : summary.atRiskCount ? RiskLevel.HIGH : RiskLevel.LOW, location: input.location, observedAt: input.observedAt, immediateAction: input.immediateAction, isAnonymous: input.isParticipantAnonymous, followUpDueDate: summary.atRiskCount ? input.followUpDueAt : null } });
      safetyObservationId = observation.id;
    }
    const created = await tx.behaviorCoachingSession.create({ data: { organizationId: input.organizationId, reference: sessionReference, programId: program.id, siteId: site.id, departmentId: input.departmentId, observerId: observer.id, participantId: input.isParticipantAnonymous ? null : input.participantId, isParticipantAnonymous: input.isParticipantAnonymous, workGroup: input.workGroup, observedAt: input.observedAt, location: input.location, coachingType: input.coachingType, ...summary, discussionSummary: input.discussionSummary, workerCommitment: input.workerCommitment, immediateAction: input.immediateAction, followUpStatus: summary.atRiskCount ? BehaviorFollowUpStatus.OPEN : BehaviorFollowUpStatus.NOT_REQUIRED, followUpOwnerId: summary.atRiskCount ? input.followUpOwnerId : null, followUpDueAt: summary.atRiskCount ? input.followUpDueAt : null, safetyObservationId, results: { create: input.results.map(result => ({ behaviorId: result.behaviorId, outcome: result.outcome, note: result.note, immediateAction: result.immediateAction })) } } });
    await createPreparedSubmissions(tx, { organizationId: input.organizationId, userId: observer.id, module: ConfigurableFormModule.BEHAVIOR_SAFETY, entityId: created.id, submissions: input.customSubmissions ?? [] });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: observer.id, action: ActivityAction.CREATE, entityType: "BehaviorCoachingSession", entityId: created.id, title: "Behavior coaching session recorded", description: `${created.reference} — ${program.name}`, metadata: { programId: program.id, siteId: site.id, safeCount: created.safeCount, atRiskCount: created.atRiskCount, criticalAtRiskCount: created.criticalAtRiskCount, safetyObservationId } } });
    await recordMobileOfflineSubmission(tx, input, "BEHAVIOR_SESSION", created.id);
    return created;
  });
  if (session.followUpOwnerId) await createNotification({ organizationId: input.organizationId, userId: session.followUpOwnerId, type: summary.criticalAtRiskCount ? NotificationType.CRITICAL : NotificationType.ASSIGNMENT, title: "Behavior-safety follow-up assigned", message: `${session.reference} requires follow-up by ${session.followUpDueAt?.toLocaleDateString("en-US")}.`, link: `/behavior-safety/sessions/${session.id}` }).catch(() => undefined);
  return session;
}

export async function updateBehaviorFollowUpService(input: { organizationId: string; userId: string; canManage: boolean; sessionId: string; status: BehaviorFollowUpStatus; note: string; offlineSubmission?: MobileOfflineSubmission }) {
  const [session, user] = await Promise.all([prisma.behaviorCoachingSession.findFirst({ where: { id: input.sessionId, organizationId: input.organizationId } }), tenantUser(input.organizationId, input.userId)]);
  if (!session || !user) throw new Error("Behavior coaching session not found in this organization.");
  if (session.followUpOwnerId !== user.id && !input.canManage) throw new Error("Only the assigned follow-up owner or a behavior-safety manager can update this follow-up.");
  if (session.followUpStatus === BehaviorFollowUpStatus.NOT_REQUIRED) throw new Error("This session does not require follow-up.");
  if (session.followUpStatus === BehaviorFollowUpStatus.COMPLETED && input.status !== BehaviorFollowUpStatus.COMPLETED) throw new Error("Completed follow-up cannot be reopened.");
  if (input.status === BehaviorFollowUpStatus.NOT_REQUIRED) throw new Error("A required follow-up cannot be removed.");
  if (!input.note.trim()) throw new Error("Record a follow-up note.");
  return prisma.$transaction(async tx => {
    const updated = await tx.behaviorCoachingSession.update({ where: { id: session.id }, data: { followUpStatus: input.status, followUpCompletedAt: input.status === BehaviorFollowUpStatus.COMPLETED ? new Date() : null } });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: user.id, action: ActivityAction.STATUS_CHANGE, entityType: "BehaviorCoachingSession", entityId: session.id, title: "Behavior follow-up updated", description: `${session.reference}: ${session.followUpStatus} → ${updated.followUpStatus}. ${input.note}`, metadata: { previousStatus: session.followUpStatus, status: updated.followUpStatus, note: input.note } } });
    await recordMobileOfflineSubmission(tx, input, "BEHAVIOR_FOLLOW_UP", updated.id);
    return updated;
  });
}

export async function createCapaFromBehaviorSessionService(input: { organizationId: string; userId: string; sessionId: string; title: string; description?: string | null; assignedToId: string; dueDate: Date }) {
  const [session, creator, assignee] = await Promise.all([prisma.behaviorCoachingSession.findFirst({ where: { id: input.sessionId, organizationId: input.organizationId }, include: { program: true } }), tenantUser(input.organizationId, input.userId), tenantUser(input.organizationId, input.assignedToId)]);
  if (!session || !creator || !assignee) throw new Error("Select a valid tenant coaching session and corrective-action owner.");
  if (!session.atRiskCount) throw new Error("Corrective action is only available for a session with at-risk behavior.");
  if (session.correctiveActionId) throw new Error("This session already has a linked corrective action.");
  if (input.dueDate <= new Date()) throw new Error("Corrective-action due date must be in the future.");
  const action = await prisma.$transaction(async tx => {
    const created = await tx.correctiveAction.create({ data: { title: input.title, description: input.description, status: Status.OPEN, riskLevel: session.criticalAtRiskCount ? RiskLevel.CRITICAL : RiskLevel.HIGH, dueDate: input.dueDate, assignedToId: assignee.id } });
    await tx.behaviorCoachingSession.update({ where: { id: session.id }, data: { correctiveActionId: created.id } });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: creator.id, action: ActivityAction.CREATE, entityType: "CorrectiveAction", entityId: created.id, title: "Behavior-safety CAPA created", description: `${session.reference} — ${created.title}`, metadata: { sessionId: session.id, assignedToId: assignee.id, dueDate: created.dueDate } } });
    return created;
  });
  await createNotification({ organizationId: input.organizationId, userId: assignee.id, type: NotificationType.ASSIGNMENT, title: "Behavior-safety corrective action assigned", message: `${session.reference} — ${action.title}`, link: `/actions/${action.id}` }).catch(() => undefined);
  return action;
}

export async function nominateBehaviorRecognitionService(input: { organizationId: string; userId: string; sessionId: string; nominatedUserId: string; reason: string; offlineSubmission?: MobileOfflineSubmission }) {
  const [session, nominator, nominee] = await Promise.all([prisma.behaviorCoachingSession.findFirst({ where: { id: input.sessionId, organizationId: input.organizationId } }), tenantUser(input.organizationId, input.userId), tenantUser(input.organizationId, input.nominatedUserId)]);
  if (!session || !nominator || !nominee) throw new Error("Select a valid tenant coaching session and recognition nominee.");
  if (!session.safeCount) throw new Error("Recognition requires at least one safe behavior result.");
  if (session.isParticipantAnonymous) throw new Error("An anonymous participant cannot be identified through recognition.");
  if (!session.participantId || session.participantId !== nominee.id) throw new Error("Recognition requires and must match the recorded session participant.");
  if (await prisma.behaviorRecognition.findFirst({ where: { organizationId: input.organizationId, sessionId: session.id } })) throw new Error("This coaching session already has a recognition nomination.");
  if (!input.reason.trim()) throw new Error("Record the specific safe behavior and its positive impact.");
  return prisma.$transaction(async tx => {
    const recognition = await tx.behaviorRecognition.create({ data: { organizationId: input.organizationId, sessionId: session.id, nominatedUserId: nominee.id, nominatedById: nominator.id, reason: input.reason } });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: nominator.id, action: ActivityAction.CREATE, entityType: "BehaviorRecognition", entityId: recognition.id, title: "Safety recognition nominated", description: `${session.reference} — ${nominee.name}`, metadata: { sessionId: session.id, nominatedUserId: nominee.id } } });
    await recordMobileOfflineSubmission(tx, input, "BEHAVIOR_RECOGNITION", recognition.id);
    return recognition;
  });
}

export async function reviewBehaviorRecognitionService(input: { organizationId: string; userId: string; recognitionId: string; status: BehaviorRecognitionStatus }) {
  const [recognition, approver] = await Promise.all([prisma.behaviorRecognition.findFirst({ where: { id: input.recognitionId, organizationId: input.organizationId }, include: { nominatedUser: true } }), tenantUser(input.organizationId, input.userId)]);
  if (!recognition || !approver) throw new Error("Recognition nomination not found in this organization.");
  if (recognition.status !== BehaviorRecognitionStatus.NOMINATED) throw new Error("This recognition nomination has already been reviewed.");
  if (input.status === BehaviorRecognitionStatus.NOMINATED) throw new Error("Approve or decline the recognition nomination.");
  const updated = await prisma.$transaction(async tx => {
    const decision = await tx.behaviorRecognition.update({ where: { id: recognition.id }, data: { status: input.status, approvedById: approver.id, awardedAt: input.status === BehaviorRecognitionStatus.APPROVED ? new Date() : null } });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: approver.id, action: ActivityAction.STATUS_CHANGE, entityType: "BehaviorRecognition", entityId: recognition.id, title: "Safety recognition reviewed", description: `${recognition.nominatedUser.name}: ${recognition.status} → ${decision.status}`, metadata: { previousStatus: recognition.status, status: decision.status, nominatedUserId: recognition.nominatedUserId } } });
    return decision;
  });
  if (updated.status === BehaviorRecognitionStatus.APPROVED) await createNotification({ organizationId: input.organizationId, userId: recognition.nominatedUserId, type: NotificationType.SUCCESS, title: "Safety leadership recognized", message: recognition.reason, link: "/behavior-safety" }).catch(() => undefined);
  return updated;
}

export async function getBehaviorSafetyDashboardService(organizationId: string, now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const sixMonths = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const [programs, sessions, activeUsers, approvedRecognitions] = await Promise.all([
    prisma.behaviorSafetyProgram.findMany({ where: { organizationId }, include: { owner: true, site: true, behaviors: { where: { isActive: true } }, sessions: { where: { observedAt: { gte: start } } } }, orderBy: { name: "asc" } }),
    prisma.behaviorCoachingSession.findMany({ where: { organizationId, observedAt: { gte: sixMonths } }, include: { site: true, observer: true, results: { include: { behavior: true } } }, orderBy: { observedAt: "asc" } }),
    prisma.user.count({ where: { organizationId, isActive: true } }),
    prisma.behaviorRecognition.count({ where: { organizationId, status: BehaviorRecognitionStatus.APPROVED, awardedAt: { gte: sixMonths } } }),
  ]);
  const monthly = sessions.filter(session => session.observedAt >= start);
  const observedResults = monthly.reduce((sum, session) => sum + session.safeCount + session.atRiskCount, 0);
  const target = programs.filter(program => program.status === BehaviorProgramStatus.ACTIVE).reduce((sum, program) => sum + program.targetSessionsPerMonth, 0);
  const participating = new Set(monthly.flatMap(session => [session.observerId, session.participantId].filter((id): id is string => Boolean(id))));
  const behaviorMap = new Map<string, { title: string; category: string; atRisk: number; total: number }>();
  for (const session of sessions) for (const result of session.results) { const row = behaviorMap.get(result.behaviorId) ?? { title: result.behavior.title, category: result.behavior.category, atRisk: 0, total: 0 }; if (result.outcome !== BehaviorObservationOutcome.NOT_OBSERVED) row.total++; if (result.outcome === BehaviorObservationOutcome.AT_RISK) row.atRisk++; behaviorMap.set(result.behaviorId, row); }
  return { programs, sessions, hotspots: [...behaviorMap.values()].sort((a, b) => b.atRisk - a.atRisk || b.total - a.total), metrics: { activePrograms: programs.filter(program => program.status === BehaviorProgramStatus.ACTIVE).length, sessionsThisMonth: monthly.length, monthlyTarget: target, targetAchievement: target ? Math.min(100, Math.round(monthly.length / target * 100)) : 0, safeRate: observedResults ? Math.round(monthly.reduce((sum, session) => sum + session.safeCount, 0) / observedResults * 100) : 0, criticalAtRisk: monthly.reduce((sum, session) => sum + session.criticalAtRiskCount, 0), openFollowUps: sessions.filter(session => session.followUpStatus !== BehaviorFollowUpStatus.NOT_REQUIRED && session.followUpStatus !== BehaviorFollowUpStatus.COMPLETED).length, participationRate: activeUsers ? Math.round(participating.size / activeUsers * 100) : 0, approvedRecognitions } };
}

export async function processBehaviorSafetyMonitoring(now = new Date()) {
  const reviewHorizon = new Date(now.getTime() + 14 * 86400000);
  const [programs, followUps] = await Promise.all([
    prisma.behaviorSafetyProgram.findMany({ where: { status: BehaviorProgramStatus.ACTIVE, nextReviewAt: { lte: reviewHorizon }, reviewReminderAt: null }, include: { owner: true } }),
    prisma.behaviorCoachingSession.findMany({ where: { followUpStatus: { in: [BehaviorFollowUpStatus.OPEN, BehaviorFollowUpStatus.IN_PROGRESS] }, followUpDueAt: { lt: now }, followUpReminderAt: null }, include: { followUpOwner: true } }),
  ]);
  let notificationsSent = 0;
  for (const program of programs) { const notification = await createNotification({ organizationId: program.organizationId, userId: program.ownerId, type: program.nextReviewAt && program.nextReviewAt < now ? NotificationType.CRITICAL : NotificationType.DUE_DATE, title: `Behavior-safety program review ${program.nextReviewAt && program.nextReviewAt < now ? "overdue" : "due soon"}`, message: `${program.code} — ${program.name}`, link: `/behavior-safety/programs/${program.id}` }).catch(() => null); if (notification) { await prisma.behaviorSafetyProgram.update({ where: { id: program.id }, data: { reviewReminderAt: now } }); notificationsSent++; } }
  for (const session of followUps) { if (!session.followUpOwnerId) continue; const notification = await createNotification({ organizationId: session.organizationId, userId: session.followUpOwnerId, type: NotificationType.CRITICAL, title: "Behavior-safety follow-up overdue", message: `${session.reference} requires overdue follow-up.`, link: `/behavior-safety/sessions/${session.id}` }).catch(() => null); if (notification) { await prisma.behaviorCoachingSession.update({ where: { id: session.id }, data: { followUpReminderAt: now } }); notificationsSent++; } }
  return { programsChecked: programs.length, overdueFollowUps: followUps.length, notificationsSent };
}
