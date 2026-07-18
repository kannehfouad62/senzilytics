import { createNotification } from "@/core/notifications/notifications.service";
import { prisma } from "@/lib/prisma";
import {
  AuditType,
  EnterpriseAuditScheduleStatus,
  EnterpriseAuditScheduleTeamRole,
  EnterpriseAuditSource,
  EnterpriseAuditTeamRole,
  NotificationType,
  Prisma,
} from "@prisma/client";
import { createAuditService } from "./audit.service";
import { advanceAuditScheduleDate } from "./audit-schedule-recurrence";

function addDays(value: Date, days: number) {
  const result = new Date(value);
  result.setDate(result.getDate() + days);
  return result;
}

function scheduleTeamRoleToAuditRole(role: EnterpriseAuditScheduleTeamRole) {
  return role as unknown as EnterpriseAuditTeamRole;
}

export async function processAuditSchedules(now = new Date()) {
  const schedules = await prisma.auditSchedule.findMany({
    where: {
      status: EnterpriseAuditScheduleStatus.ACTIVE,
      autoGenerate: true,
      nextRunAt: { not: null },
    },
    include: {
      program: true,
      protocol: true,
      teamMembers: true,
    },
    orderBy: { nextRunAt: "asc" },
  });

  const result = { checked: schedules.length, generated: 0, alreadyGenerated: 0, advanced: 0, expired: 0, skipped: 0, failed: 0 };

  for (const schedule of schedules) {
    const occurrence = schedule.nextRunAt;
    if (!occurrence) { result.skipped += 1; continue; }
    if (occurrence > addDays(now, schedule.generateDaysBefore)) continue;
    if (!schedule.protocol || !schedule.leadAuditorId || (schedule.requireTeam && schedule.teamMembers.length === 0)) {
      result.skipped += 1;
      continue;
    }

    const generationKey = occurrence.toISOString();
    let auditId: string | null = null;
    try {
      const existing = await prisma.enterpriseAudit.findFirst({ where: { scheduleId: schedule.id, generatedByScheduleKey: generationKey }, select: { id: true } });
      if (existing) {
        auditId = existing.id;
        result.alreadyGenerated += 1;
      } else {
        const audit = await createAuditService({
          organizationId: schedule.organizationId,
          userId: schedule.createdById ?? schedule.leadAuditorId,
          title: `${schedule.name} — ${occurrence.toLocaleDateString("en-US")}`,
          description: schedule.description,
          objectives: schedule.program.objectives,
          scope: schedule.program.scope,
          criteria: [schedule.program.standardName, schedule.program.standardVersion].filter(Boolean).join(" ") || schedule.program.framework,
          auditType: AuditType.INTERNAL,
          source: EnterpriseAuditSource.SCHEDULE,
          programId: schedule.programId,
          scheduleId: schedule.id,
          protocolId: schedule.protocolId,
          siteId: schedule.siteId,
          departmentId: schedule.departmentId,
          leadAuditorId: schedule.leadAuditorId,
          ownerId: schedule.program.ownerId,
          scheduledAt: occurrence,
          dueDate: addDays(occurrence, schedule.dueDaysAfter),
          generatedByScheduleKey: generationKey,
          teamMembers: schedule.teamMembers.map((member) => ({
            userId: member.userId,
            role: scheduleTeamRoleToAuditRole(member.role),
            canEdit: member.role !== EnterpriseAuditScheduleTeamRole.OBSERVER,
            canReview: member.role === EnterpriseAuditScheduleTeamRole.LEAD_AUDITOR,
          })),
        });
        auditId = audit.id;
        result.generated += 1;
      }

      const nextOccurrence = advanceAuditScheduleDate(occurrence, schedule.frequency, schedule.intervalValue);
      const isExpired = !nextOccurrence || Boolean(schedule.endDate && nextOccurrence > schedule.endDate);
      const advancement = await prisma.auditSchedule.updateMany({
        where: { id: schedule.id, nextRunAt: occurrence },
        data: {
          nextRunAt: isExpired ? null : nextOccurrence,
          lastRunAt: occurrence,
          lastGenerationKey: generationKey,
          generationCount: { increment: existingGenerationIncrement(auditId, schedule.lastGenerationKey, generationKey) },
          status: isExpired ? EnterpriseAuditScheduleStatus.COMPLETED : EnterpriseAuditScheduleStatus.ACTIVE,
        },
      });
      if (advancement.count > 0) {
        result.advanced += 1;
        if (isExpired) result.expired += 1;
      }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        result.alreadyGenerated += 1;
        const existing = await prisma.enterpriseAudit.findFirst({ where: { scheduleId: schedule.id, generatedByScheduleKey: generationKey }, select: { id: true } });
        const nextOccurrence = advanceAuditScheduleDate(occurrence, schedule.frequency, schedule.intervalValue);
        const isExpired = !nextOccurrence || Boolean(schedule.endDate && nextOccurrence > schedule.endDate);
        const advancement = await prisma.auditSchedule.updateMany({
          where: { id: schedule.id, nextRunAt: occurrence },
          data: { nextRunAt: isExpired ? null : nextOccurrence, lastRunAt: occurrence, lastGenerationKey: generationKey, generationCount: { increment: existingGenerationIncrement(existing?.id ?? null, schedule.lastGenerationKey, generationKey) }, status: isExpired ? EnterpriseAuditScheduleStatus.COMPLETED : EnterpriseAuditScheduleStatus.ACTIVE },
        });
        if (advancement.count > 0) { result.advanced += 1; if (isExpired) result.expired += 1; }
        continue;
      }
      result.failed += 1;
      console.error(`Audit schedule processing failed for ${schedule.id}:`, error);
      continue;
    }

    if (auditId) {
      const recipientIds = [...new Set(schedule.teamMembers.map((member) => member.userId))];
      await Promise.all(recipientIds.map((userId) => createNotification({ organizationId: schedule.organizationId, userId, type: NotificationType.ASSIGNMENT, title: "Scheduled audit generated", message: `“${schedule.name}” generated a new audit for ${occurrence.toLocaleDateString("en-US")}.`, link: `/audits/${auditId}` }).catch((error) => console.error(`Scheduled audit notification failed for ${userId}:`, error))));
    }
  }

  return result;
}

function existingGenerationIncrement(auditId: string | null, lastKey: string | null, generationKey: string) {
  return auditId && lastKey !== generationKey ? 1 : 0;
}
