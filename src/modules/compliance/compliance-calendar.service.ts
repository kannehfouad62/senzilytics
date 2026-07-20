import { createNotification } from "@/core/notifications/notifications.service";
import { prisma } from "@/lib/prisma";
import { ComplianceCalendarOccurrenceStatus, ComplianceCalendarTaskStatus, NotificationType } from "@prisma/client";
import { nextComplianceDueDate } from "./compliance-recurrence";

const dayMs = 86_400_000;

export async function generateComplianceCalendarOccurrences(now = new Date(), horizonDays = 45) {
  const horizon = new Date(now.getTime() + horizonDays * dayMs);
  const tasks = await prisma.complianceCalendarTask.findMany({ where: { status: ComplianceCalendarTaskStatus.ACTIVE, nextOccurrenceAt: { lte: horizon } } });
  let generated = 0;
  for (const task of tasks) {
    let due = task.nextOccurrenceAt ?? task.startDate;
    while (due <= horizon && (!task.endDate || due <= task.endDate)) {
      const status = due < now ? ComplianceCalendarOccurrenceStatus.DUE : ComplianceCalendarOccurrenceStatus.UPCOMING;
      const created = await prisma.complianceCalendarOccurrence.createMany({ data: [{ organizationId: task.organizationId, taskId: task.id, siteId: task.siteId, departmentId: task.departmentId, assignedToId: task.ownerId, dueAt: due, status }], skipDuplicates: true });
      generated += created.count;
      const next = nextComplianceDueDate(due, task.recurrence, task.intervalValue);
      if (!next) { due = new Date(8640000000000000); break; }
      due = next;
    }
    await prisma.complianceCalendarTask.update({ where: { id: task.id }, data: { nextOccurrenceAt: due.getTime() === 8640000000000000 || (task.endDate && due > task.endDate) ? null : due } });
  }
  return { tasksChecked: tasks.length, generated };
}

export async function monitorComplianceCalendar(now = new Date()) {
  const openStatuses = [ComplianceCalendarOccurrenceStatus.UPCOMING, ComplianceCalendarOccurrenceStatus.DUE, ComplianceCalendarOccurrenceStatus.IN_PROGRESS, ComplianceCalendarOccurrenceStatus.REJECTED];
  const occurrences = await prisma.complianceCalendarOccurrence.findMany({ where: { status: { in: openStatuses }, dueAt: { lte: new Date(now.getTime() + 14 * dayMs) } }, include: { task: true } });
  let reminders = 0, overdue = 0, escalations = 0;
  for (const occurrence of occurrences) {
    if (occurrence.dueAt < now) {
      await prisma.complianceCalendarOccurrence.update({ where: { id: occurrence.id }, data: { status: ComplianceCalendarOccurrenceStatus.OVERDUE } });
      overdue++;
      if (!occurrence.escalatedAt && now.getTime() >= occurrence.dueAt.getTime() + occurrence.task.escalationDaysAfter * dayMs) {
        const recipient = occurrence.task.escalationOwnerId ?? occurrence.assignedToId;
        await createNotification({ organizationId: occurrence.organizationId, userId: recipient, type: NotificationType.CRITICAL, title: "Compliance calendar task overdue", message: `${occurrence.task.title} was due ${occurrence.dueAt.toLocaleDateString("en-US")}.`, link: `/compliance/calendar/${occurrence.id}` }).catch(() => undefined);
        await prisma.complianceCalendarOccurrence.update({ where: { id: occurrence.id }, data: { escalatedAt: now } });
        escalations++;
      }
    } else if (!occurrence.reminderSentAt && occurrence.dueAt.getTime() <= now.getTime() + occurrence.task.reminderDaysBefore * dayMs) {
      await createNotification({ organizationId: occurrence.organizationId, userId: occurrence.assignedToId, type: NotificationType.DUE_DATE, title: "Compliance task due soon", message: `${occurrence.task.title} is due ${occurrence.dueAt.toLocaleDateString("en-US")}.`, link: `/compliance/calendar/${occurrence.id}` }).catch(() => undefined);
      await prisma.complianceCalendarOccurrence.update({ where: { id: occurrence.id }, data: { reminderSentAt: now, status: ComplianceCalendarOccurrenceStatus.DUE } });
      reminders++;
    }
  }
  return { checked: occurrences.length, reminders, overdue, escalations };
}
