import {
  ActivityAction,
  NotificationType,
  ResearchSampleUnitStatus,
  ResearchSamplingExecutionStatus,
} from "@prisma/client";

import {
  getApplicationUrl,
  sendTenantNotificationEmail,
} from "@/core/email/email.service";
import { createNotification } from "@/core/notifications/notifications.service";
import { prisma } from "@/lib/prisma";

export function fieldworkEscalationLevel(dueAt: Date, now: Date) {
  const hours = (now.getTime() - dueAt.getTime()) / 3_600_000;
  if (hours >= 72) return 3;
  if (hours >= 0) return 2;
  if (hours >= -24) return 1;
  return 0;
}

export async function processResearchFieldworkSla(now = new Date()) {
  const units = await prisma.researchSampleUnit.findMany({
    where: {
      status: {
        in: [
          ResearchSampleUnitStatus.ASSIGNED,
          ResearchSampleUnitStatus.CONTACTED,
          ResearchSampleUnitStatus.PARTIAL,
        ],
      },
      dueAt: { lte: new Date(now.getTime() + 24 * 3_600_000) },
      assignedToId: { not: null },
      execution: { status: ResearchSamplingExecutionStatus.ACTIVE },
    },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      execution: { select: { organizationId: true, projectId: true } },
    },
    take: 200,
  });
  let notified = 0;
  for (const unit of units) {
    if (!unit.dueAt || !unit.assignedTo) continue;
    const level = fieldworkEscalationLevel(unit.dueAt, now);
    if (!level || level <= unit.escalationLevel) continue;
    const overdue = level >= 2;
    const severe = level === 3;
    const link = `/research/projects/${unit.execution.projectId}/sampling-design`;
    const title = severe
      ? "Research fieldwork seriously overdue"
      : overdue
        ? "Research fieldwork overdue"
        : "Research fieldwork due soon";
    const timing = overdue
      ? `was due ${unit.dueAt.toLocaleDateString("en-US")}`
      : `is due ${unit.dueAt.toLocaleDateString("en-US")}`;
    const notification = await createNotification({
      organizationId: unit.execution.organizationId,
      userId: unit.assignedTo.id,
      type: severe
        ? NotificationType.CRITICAL
        : overdue
          ? NotificationType.WARNING
          : NotificationType.DUE_DATE,
      title,
      message: `${unit.unitReference} ${timing}.`,
      link,
    }).catch(() => null);
    await sendTenantNotificationEmail({
      to: unit.assignedTo.email,
      subject: title,
      html: `<p>${unit.unitReference} ${timing}.</p><p><a href="${getApplicationUrl()}${link}">Open fieldwork register</a></p>`,
      text: `${unit.unitReference} ${timing}.`,
    }).catch(() => undefined);
    await prisma.$transaction([
      prisma.researchSampleUnit.update({
        where: { id: unit.id },
        data: { escalationLevel: level, lastEscalatedAt: now },
      }),
      prisma.activityLog.create({
        data: {
          organizationId: unit.execution.organizationId,
          action: ActivityAction.SYSTEM,
          entityType: "ResearchSampleUnit",
          entityId: unit.id,
          title: "Research fieldwork SLA escalation processed",
          description: `${unit.unitReference} advanced to escalation level ${level}.`,
          metadata: {
            projectId: unit.execution.projectId,
            level,
            dueAt: unit.dueAt.toISOString(),
          },
        },
      }),
    ]);
    if (notification) notified += 1;
  }
  return { examined: units.length, notified };
}
