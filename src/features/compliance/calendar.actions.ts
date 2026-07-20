"use server";

import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { ComplianceCalendarOccurrenceStatus, ComplianceRecurrence, PermissionKey, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const text = (data: FormData, key: string) => String(data.get(key) || "").trim();
const required = (data: FormData, key: string) => { const value = text(data, key); if (!value) throw new Error(`${key} is required.`); return value; };

export async function createComplianceCalendarTask(data: FormData) {
  await requirePermission(PermissionKey.MANAGE_COMPLIANCE);
  const { organizationId } = await getCurrentUserTenant();
  const siteId = required(data, "siteId"), departmentId = text(data, "departmentId") || null, ownerId = required(data, "ownerId"), escalationOwnerId = text(data, "escalationOwnerId") || null;
  const [site, owner, department, escalationOwner] = await Promise.all([
    prisma.site.findFirst({ where: { id: siteId, organizationId } }),
    prisma.user.findFirst({ where: { id: ownerId, organizationId, isActive: true } }),
    departmentId ? prisma.department.findFirst({ where: { id: departmentId, site: { organizationId } } }) : null,
    escalationOwnerId ? prisma.user.findFirst({ where: { id: escalationOwnerId, organizationId, isActive: true } }) : null,
  ]);
  if (!site || !owner || (departmentId && !department) || (escalationOwnerId && !escalationOwner)) throw new Error("Select valid tenant resources.");
  const recurrence = required(data, "recurrence") as ComplianceRecurrence;
  if (!Object.values(ComplianceRecurrence).includes(recurrence)) throw new Error("Select a valid recurrence.");
  const startDate = new Date(required(data, "startDate") + "T12:00:00.000Z");
  const endRaw = text(data, "endDate"); const endDate = endRaw ? new Date(endRaw + "T12:00:00.000Z") : null;
  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.complianceCalendarTask.create({ data: { organizationId, siteId, departmentId, ownerId, escalationOwnerId, title: required(data, "title"), description: text(data, "description") || null, instructions: text(data, "instructions") || null, category: required(data, "category"), regulatoryReference: text(data, "regulatoryReference") || null, evidenceRequired: data.get("evidenceRequired") === "on", approvalRequired: data.get("approvalRequired") === "on", recurrence, intervalValue: Math.max(1, Number(text(data, "intervalValue") || 1)), startDate, endDate, dueTime: text(data, "dueTime") || null, reminderDaysBefore: Math.max(0, Number(text(data, "reminderDaysBefore") || 7)), escalationDaysAfter: Math.max(0, Number(text(data, "escalationDaysAfter") || 1)), nextOccurrenceAt: recurrence === ComplianceRecurrence.ONE_TIME ? null : startDate } });
    await tx.complianceCalendarOccurrence.create({ data: { organizationId, taskId: created.id, siteId, departmentId, assignedToId: ownerId, dueAt: startDate, status: startDate < new Date() ? ComplianceCalendarOccurrenceStatus.DUE : ComplianceCalendarOccurrenceStatus.UPCOMING } });
    return created;
  });
  redirect(`/compliance/calendar?created=${task.id}`);
}

export async function submitComplianceOccurrence(data: FormData) {
  await requirePermission(PermissionKey.VIEW_COMPLIANCE);
  const { organizationId, user } = await getCurrentUserTenant();
  const id = required(data, "occurrenceId");
  const occurrence = await prisma.complianceCalendarOccurrence.findFirst({ where: { id, organizationId }, include: { task: true } });
  if (!occurrence) throw new Error("Compliance task not found.");
  const canManage = user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ORG_ADMIN || user.role === UserRole.EHS_MANAGER || occurrence.assignedToId === user.id;
  if (!canManage) throw new Error("Only the assignee or an administrator can complete this task.");
  const notes = text(data, "completionNotes"), evidenceUrl = text(data, "evidenceUrl") || null;
  if (occurrence.task.evidenceRequired && !evidenceUrl && !notes) throw new Error("Completion evidence or notes are required.");
  await prisma.complianceCalendarOccurrence.update({ where: { id }, data: { completionNotes: notes || null, evidenceUrl, completedAt: new Date(), completedById: user.id, status: occurrence.task.approvalRequired ? ComplianceCalendarOccurrenceStatus.SUBMITTED : ComplianceCalendarOccurrenceStatus.COMPLETED } });
  revalidatePath("/compliance/calendar"); revalidatePath(`/compliance/calendar/${id}`); revalidatePath("/compliance/calendar/analytics");
}

export async function reviewComplianceOccurrence(data: FormData) {
  await requirePermission(PermissionKey.MANAGE_COMPLIANCE);
  const { organizationId, user } = await getCurrentUserTenant();
  const id = required(data, "occurrenceId"), decision = required(data, "decision");
  const occurrence = await prisma.complianceCalendarOccurrence.findFirst({ where: { id, organizationId, status: ComplianceCalendarOccurrenceStatus.SUBMITTED } });
  if (!occurrence) throw new Error("Submitted compliance task not found.");
  await prisma.complianceCalendarOccurrence.update({ where: { id }, data: { status: decision === "approve" ? ComplianceCalendarOccurrenceStatus.COMPLETED : ComplianceCalendarOccurrenceStatus.REJECTED, reviewedAt: new Date(), reviewedById: user.id, reviewNotes: text(data, "reviewNotes") || null } });
  revalidatePath(`/compliance/calendar/${id}`); revalidatePath("/compliance/calendar");
}
