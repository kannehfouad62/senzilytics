import {
  ActivityAction,
  NotificationType,
  ResearchFieldworkBackcheckStatus,
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
  const backchecks = await prisma.researchFieldworkResponse.findMany({
    where: {
      backcheckRequired: true,
      backcheckStatus: { in: [ResearchFieldworkBackcheckStatus.PENDING, ResearchFieldworkBackcheckStatus.RECONTACT_REQUIRED] },
      backcheckDueAt: { lte: new Date(now.getTime() + 24 * 3_600_000) },
      backcheckAssignedToId: { not: null },
    },
    include: {
      backcheckAssignedTo: { select: { id: true, name: true, email: true } },
      sampleUnit: { select: { unitReference: true, execution: { select: { project: { select: { id: true, projectManager: { select: { id: true, name: true, email: true } } } } } } } },
    },
    take: 200,
  });
  for (const response of backchecks) {
    if (!response.backcheckDueAt || !response.backcheckAssignedTo) continue;
    const level = fieldworkEscalationLevel(response.backcheckDueAt, now);
    if (!level || level <= response.backcheckEscalationLevel) continue;
    const overdue = level >= 2, severe = level === 3;
    const project = response.sampleUnit.execution.project;
    const link = `/research/projects/${project.id}/fieldwork`;
    const title = severe ? "Research back-check seriously overdue" : overdue ? "Research back-check overdue" : "Research back-check due soon";
    const timing = overdue ? `was due ${response.backcheckDueAt.toLocaleDateString("en-US")}` : `is due ${response.backcheckDueAt.toLocaleDateString("en-US")}`;
    const recipients = [response.backcheckAssignedTo, ...(overdue && project.projectManager.id !== response.backcheckAssignedTo.id ? [project.projectManager] : [])];
    for (const recipient of recipients) {
      const notification = await createNotification({ organizationId: response.organizationId, userId: recipient.id, type: severe ? NotificationType.CRITICAL : overdue ? NotificationType.WARNING : NotificationType.DUE_DATE, title, message: `${response.sampleUnit.unitReference} ${timing}.`, link }).catch(() => null);
      await sendTenantNotificationEmail({ to: recipient.email, subject: title, html: `<p>Hello ${recipient.name},</p><p>Back-check for ${response.sampleUnit.unitReference} ${timing}.</p><p><a href="${getApplicationUrl()}${link}">Open fieldwork assurance</a></p>`, text: `Research back-check for ${response.sampleUnit.unitReference} ${timing}.` }).catch(() => undefined);
      if (notification) notified += 1;
    }
    await prisma.$transaction([
      prisma.researchFieldworkResponse.update({ where: { id: response.id }, data: { backcheckEscalationLevel: level, backcheckLastEscalatedAt: now } }),
      prisma.activityLog.create({ data: { organizationId: response.organizationId, action: ActivityAction.SYSTEM, entityType: "ResearchFieldworkResponse", entityId: response.id, title: "Research back-check SLA escalation processed", description: `${response.sampleUnit.unitReference} advanced to escalation level ${level}.`, metadata: { projectId: project.id, level, dueAt: response.backcheckDueAt.toISOString(), assignedReviewerId: response.backcheckAssignedTo.id, escalatedToProjectManager: overdue } } }),
    ]);
  }
  return { examined: units.length + backchecks.length, fieldworkExamined: units.length, backchecksExamined: backchecks.length, notified };
}
