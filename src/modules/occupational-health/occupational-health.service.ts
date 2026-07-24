import { createNotification } from "@/core/notifications/notifications.service";
import { prisma } from "@/lib/prisma";
import { addSurveillanceMonths } from "@/modules/occupational-health/surveillance-recurrence";
import { isSurveillanceProgramTransitionAllowed } from "@/modules/occupational-health/surveillance-program-lifecycle";
import { ActivityAction, FitnessOutcome, NotificationType, Prisma, SurveillanceEnrollmentStatus, SurveillanceProgramStatus } from "@prisma/client";

type OfflineSubmissionInput = {
  id: string;
  capturedAt: Date;
  payloadHash: string;
};

async function recordOccupationalHealthOfflineSubmission(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    userId: string;
    offlineSubmission?: OfflineSubmissionInput;
  },
  recordType: string,
  recordId: string
) {
  if (!input.offlineSubmission) return;
  await tx.offlineSubmission.create({
    data: {
      id: input.offlineSubmission.id,
      organizationId: input.organizationId,
      userId: input.userId,
      recordType,
      recordId,
      capturedAt: input.offlineSubmission.capturedAt,
      payloadHash: input.offlineSubmission.payloadHash,
    },
  });
}

export async function createSurveillanceProgramService(input: { organizationId: string; userId: string; name: string; description?: string | null; regulatoryBasis?: string | null; protocolReference?: string | null; providerName?: string | null; frequencyMonths: number; leadDays: number; agentId?: string | null; groupId?: string | null; responsibleUserId: string }) {
  if (!Number.isInteger(input.frequencyMonths) || input.frequencyMonths < 1 || input.frequencyMonths > 60) throw new Error("Surveillance frequency must be between 1 and 60 months.");
  if (!Number.isInteger(input.leadDays) || input.leadDays < 0 || input.leadDays > 365) throw new Error("Reminder lead time must be between 0 and 365 days.");
  const [responsible, agent, group] = await Promise.all([
    prisma.user.findFirst({ where: { id: input.responsibleUserId, organizationId: input.organizationId, isActive: true } }),
    input.agentId ? prisma.hygieneAgent.findFirst({ where: { id: input.agentId, organizationId: input.organizationId } }) : null,
    input.groupId ? prisma.similarExposureGroup.findFirst({ where: { id: input.groupId, organizationId: input.organizationId } }) : null,
  ]);
  if (!responsible || (input.agentId && !agent) || (input.groupId && !group)) throw new Error("Select valid tenant owners, agents, and exposure groups.");
  if (agent && group) {
    const linked = await prisma.similarExposureGroupAgent.findUnique({ where: { groupId_agentId: { groupId: group.id, agentId: agent.id } } });
    if (!linked) throw new Error("The selected agent is not linked to the exposure group.");
  }
  return prisma.$transaction(async tx => {
    const program = await tx.medicalSurveillanceProgram.create({ data: { organizationId: input.organizationId, name: input.name, description: input.description, regulatoryBasis: input.regulatoryBasis, protocolReference: input.protocolReference, providerName: input.providerName, frequencyMonths: input.frequencyMonths, leadDays: input.leadDays, agentId: input.agentId, groupId: input.groupId, responsibleUserId: input.responsibleUserId } });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: input.userId, action: ActivityAction.CREATE, entityType: "MedicalSurveillanceProgram", entityId: program.id, title: "Medical surveillance program created", description: program.name, metadata: { frequencyMonths: program.frequencyMonths, agentId: program.agentId, groupId: program.groupId } } });
    return program;
  });
}

export async function updateSurveillanceProgramStatusService(input: { organizationId: string; userId: string; programId: string; status: SurveillanceProgramStatus; offlineSubmission?: OfflineSubmissionInput }) {
  const program = await prisma.medicalSurveillanceProgram.findFirst({ where: { id: input.programId, organizationId: input.organizationId } });
  if (!program) throw new Error("Surveillance program not found in this organization.");
  if (program.status === input.status) {
    if (input.offlineSubmission) {
      await prisma.$transaction((tx) =>
        recordOccupationalHealthOfflineSubmission(
          tx,
          input,
          "OH_PROGRAM_STATUS",
          program.id
        )
      );
    }
    return program;
  }
  if (!isSurveillanceProgramTransitionAllowed(program.status, input.status)) throw new Error(`A ${program.status.toLowerCase()} surveillance program cannot move to ${input.status.toLowerCase()}.`);
  return prisma.$transaction(async tx => {
    const updated = await tx.medicalSurveillanceProgram.update({ where: { id: program.id }, data: { status: input.status, isActive: input.status !== SurveillanceProgramStatus.ARCHIVED } });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: input.userId, action: ActivityAction.STATUS_CHANGE, entityType: "MedicalSurveillanceProgram", entityId: program.id, title: "Surveillance program status changed", description: `${program.status} → ${input.status}` } });
    await recordOccupationalHealthOfflineSubmission(tx, input, "OH_PROGRAM_STATUS", updated.id);
    return updated;
  });
}

export async function enrollSurveillanceUserService(input: { organizationId: string; userId: string; programId: string; enrolledUserId: string; nextDueAt: Date; notes?: string | null; offlineSubmission?: OfflineSubmissionInput }) {
  const [program, enrolledUser, existing] = await Promise.all([
    prisma.medicalSurveillanceProgram.findFirst({ where: { id: input.programId, organizationId: input.organizationId, status: { not: SurveillanceProgramStatus.ARCHIVED } } }),
    prisma.user.findFirst({ where: { id: input.enrolledUserId, organizationId: input.organizationId, isActive: true } }),
    prisma.medicalSurveillanceEnrollment.findUnique({ where: { programId_userId: { programId: input.programId, userId: input.enrolledUserId } } }),
  ]);
  if (!program || !enrolledUser) throw new Error("Select a valid surveillance program and active tenant user.");
  if (existing && existing.status !== SurveillanceEnrollmentStatus.REMOVED) throw new Error("This worker is already enrolled in the surveillance program.");
  const now = new Date(); const status = input.nextDueAt < now ? SurveillanceEnrollmentStatus.OVERDUE : SurveillanceEnrollmentStatus.ENROLLED;
  return prisma.$transaction(async tx => {
    const enrollment = await tx.medicalSurveillanceEnrollment.upsert({ where: { programId_userId: { programId: program.id, userId: enrolledUser.id } }, update: { status, enrolledAt: now, lastCompletedAt: null, nextDueAt: input.nextDueAt, fitnessOutcome: FitnessOutcome.NOT_ASSESSED, workRestrictions: null, certificateReference: null, completedById: null, removedAt: null, notes: input.notes }, create: { programId: program.id, userId: enrolledUser.id, status, nextDueAt: input.nextDueAt, notes: input.notes } });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: input.userId, action: ActivityAction.ASSIGN, entityType: "MedicalSurveillanceEnrollment", entityId: enrollment.id, title: "Surveillance enrollment created", description: program.name, metadata: { programId: program.id, nextDueAt: input.nextDueAt } } });
    await recordOccupationalHealthOfflineSubmission(tx, input, "OH_ENROLLMENT", enrollment.id);
    return enrollment;
  });
}

export async function completeSurveillanceEnrollmentService(input: { organizationId: string; userId: string; enrollmentId: string; completedAt: Date; fitnessOutcome: FitnessOutcome; workRestrictions?: string | null; certificateReference?: string | null; notes?: string | null; offlineSubmission?: OfflineSubmissionInput }) {
  const enrollment = await prisma.medicalSurveillanceEnrollment.findFirst({ where: { id: input.enrollmentId, program: { organizationId: input.organizationId } }, include: { program: true } });
  if (!enrollment) throw new Error("Surveillance enrollment not found in this organization.");
  if (enrollment.status === SurveillanceEnrollmentStatus.REMOVED) throw new Error("A removed enrollment cannot be completed.");
  if (input.fitnessOutcome === FitnessOutcome.NOT_ASSESSED) throw new Error("Select a provider-issued fitness-for-work outcome.");
  if ((input.fitnessOutcome === FitnessOutcome.CLEARED_WITH_RESTRICTIONS || input.fitnessOutcome === FitnessOutcome.TEMPORARILY_NOT_CLEARED) && !input.workRestrictions) throw new Error("Record the occupational work restrictions communicated by the provider.");
  if (input.completedAt > new Date()) throw new Error("Completion date cannot be in the future.");
  const enrollmentDay = new Date(enrollment.enrolledAt); enrollmentDay.setUTCHours(0, 0, 0, 0);
  if (input.completedAt < enrollmentDay) throw new Error("Completion date cannot be before the enrollment date.");
  const nextDueAt = addSurveillanceMonths(input.completedAt, enrollment.program.frequencyMonths);
  return prisma.$transaction(async tx => {
    const updated = await tx.medicalSurveillanceEnrollment.update({ where: { id: enrollment.id }, data: { status: SurveillanceEnrollmentStatus.COMPLETED, lastCompletedAt: input.completedAt, nextDueAt, fitnessOutcome: input.fitnessOutcome, workRestrictions: input.workRestrictions, certificateReference: input.certificateReference, completedById: input.userId, notes: input.notes } });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: input.userId, action: ActivityAction.UPDATE, entityType: "MedicalSurveillanceEnrollment", entityId: enrollment.id, title: "Surveillance completion recorded", description: enrollment.program.name, metadata: { nextDueAt } } });
    await recordOccupationalHealthOfflineSubmission(tx, input, "OH_ENROLLMENT_COMPLETE", updated.id);
    return updated;
  });
}

export async function removeSurveillanceEnrollmentService(input: { organizationId: string; userId: string; enrollmentId: string; reason: string; offlineSubmission?: OfflineSubmissionInput }) {
  const enrollment = await prisma.medicalSurveillanceEnrollment.findFirst({ where: { id: input.enrollmentId, program: { organizationId: input.organizationId } }, include: { program: true } });
  if (!enrollment) throw new Error("Surveillance enrollment not found in this organization.");
  return prisma.$transaction(async tx => {
    const updated = await tx.medicalSurveillanceEnrollment.update({ where: { id: enrollment.id }, data: { status: SurveillanceEnrollmentStatus.REMOVED, removedAt: new Date(), notes: input.reason } });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: input.userId, action: ActivityAction.STATUS_CHANGE, entityType: "MedicalSurveillanceEnrollment", entityId: enrollment.id, title: "Surveillance enrollment removed", description: enrollment.program.name } });
    await recordOccupationalHealthOfflineSubmission(tx, input, "OH_ENROLLMENT_REMOVE", updated.id);
    return updated;
  });
}

export async function processOccupationalHealthMonitoring(now = new Date()) {
  const enrollments = await prisma.medicalSurveillanceEnrollment.findMany({ where: { status: { not: SurveillanceEnrollmentStatus.REMOVED }, program: { status: SurveillanceProgramStatus.ACTIVE, isActive: true } }, include: { program: true, user: true } });
  const result = { checked: enrollments.length, due: 0, overdue: 0, notificationsSent: 0 };
  for (const enrollment of enrollments) {
    const dueThreshold = new Date(enrollment.nextDueAt.getTime() - enrollment.program.leadDays * 86400000);
    const status = enrollment.nextDueAt < now ? SurveillanceEnrollmentStatus.OVERDUE : dueThreshold <= now ? SurveillanceEnrollmentStatus.DUE : enrollment.status === SurveillanceEnrollmentStatus.COMPLETED ? SurveillanceEnrollmentStatus.COMPLETED : SurveillanceEnrollmentStatus.ENROLLED;
    if (status !== enrollment.status) await prisma.medicalSurveillanceEnrollment.update({ where: { id: enrollment.id }, data: { status } });
    if (status === SurveillanceEnrollmentStatus.OVERDUE) result.overdue++; else if (status === SurveillanceEnrollmentStatus.DUE) result.due++;
    if ((status === SurveillanceEnrollmentStatus.DUE || status === SurveillanceEnrollmentStatus.OVERDUE) && status !== enrollment.status) {
      const notificationRequests = [createNotification({ organizationId: enrollment.program.organizationId, userId: enrollment.program.responsibleUserId, type: status === SurveillanceEnrollmentStatus.OVERDUE ? NotificationType.CRITICAL : NotificationType.DUE_DATE, title: "Occupational health surveillance action", message: `${enrollment.user.name} has a ${status.toLowerCase()} surveillance milestone in ${enrollment.program.name}.`, link: `/occupational-health/${enrollment.programId}` }).catch(() => null)];
      if (enrollment.userId !== enrollment.program.responsibleUserId) notificationRequests.push(createNotification({ organizationId: enrollment.program.organizationId, userId: enrollment.userId, type: status === SurveillanceEnrollmentStatus.OVERDUE ? NotificationType.WARNING : NotificationType.DUE_DATE, title: "Occupational health appointment due", message: `A required occupational health surveillance milestone is ${status.toLowerCase()}. Contact your program administrator.`, link: "/tasks" }).catch(() => null));
      const created = await Promise.all(notificationRequests);
      result.notificationsSent += created.filter(Boolean).length;
    }
  }
  return result;
}
