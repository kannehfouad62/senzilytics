import {
  ActivityAction,
  EmployeePerformanceGoalStatus,
  EmployeePerformanceReviewStatus,
  NotificationType,
  Prisma,
} from "@prisma/client";
import { logActivity } from "@/core/activity-log/activity-log.service";
import { getApplicationUrl, sendTenantNotificationEmail } from "@/core/email/email.service";
import { createNotification } from "@/core/notifications/notifications.service";
import { prisma } from "@/lib/prisma";
import { getEmployeePerformanceWorkspace, type EmployeePerformanceWindow } from "@/modules/employee-performance/employee-performance.service";

export async function getEmployeePerformanceGovernance(input: { organizationId: string; employeeId: string }) {
  return Promise.all([
    prisma.employeePerformanceGoal.findMany({ where: { organizationId: input.organizationId, employeeId: input.employeeId }, include: { createdBy: { select: { name: true } } }, orderBy: [{ status: "asc" }, { dueAt: "asc" }] }),
    prisma.employeePerformanceReview.findMany({ where: { organizationId: input.organizationId, employeeId: input.employeeId }, include: { reviewer: { select: { name: true } }, closedBy: { select: { name: true } } }, orderBy: { periodEnd: "desc" }, take: 24 }),
  ]).then(([goals, reviews]) => ({ goals, reviews }));
}

export async function createEmployeePerformanceGoalService(input: { organizationId: string; actorId: string; employeeId: string; title: string; description?: string | null; metric: string; unit: string; targetValue: number; dueAt: Date }) {
  await requireTenantUsers(input.organizationId, [input.actorId, input.employeeId]);
  if (!Number.isFinite(input.targetValue) || input.targetValue <= 0) throw new Error("Enter a positive target value.");
  if (input.dueAt <= new Date()) throw new Error("The goal due date must be in the future.");
  const goal = await prisma.employeePerformanceGoal.create({ data: { organizationId: input.organizationId, employeeId: input.employeeId, createdById: input.actorId, title: bounded(input.title, 160), description: optionalBounded(input.description, 2_000), metric: bounded(input.metric, 120), unit: bounded(input.unit, 40), targetValue: input.targetValue, dueAt: input.dueAt } });
  await Promise.all([
    logActivity({ organizationId: input.organizationId, userId: input.actorId, action: ActivityAction.CREATE, entityType: "EmployeePerformanceGoal", entityId: goal.id, title: "Employee performance goal created", description: goal.title, metadata: { employeeId: input.employeeId, targetValue: input.targetValue, unit: goal.unit, dueAt: goal.dueAt.toISOString() } }),
    createNotification({ organizationId: input.organizationId, userId: input.employeeId, type: NotificationType.ASSIGNMENT, title: "Performance goal assigned", message: `${goal.title} is due ${goal.dueAt.toLocaleDateString("en-US")}.`, link: `/employee-performance/${input.employeeId}` }).catch(() => null),
  ]);
  return goal;
}

export async function updateEmployeePerformanceGoalService(input: { organizationId: string; actorId: string; goalId: string; currentValue: number; status: EmployeePerformanceGoalStatus }) {
  const goal = await prisma.employeePerformanceGoal.findFirst({ where: { id: input.goalId, organizationId: input.organizationId } });
  if (!goal) throw new Error("Performance goal not found.");
  if (!Number.isFinite(input.currentValue) || input.currentValue < 0) throw new Error("Enter a valid current value.");
  if (goal.status === EmployeePerformanceGoalStatus.CANCELLED || goal.status === EmployeePerformanceGoalStatus.COMPLETED) throw new Error("A terminal goal cannot be changed.");
  const updated = await prisma.employeePerformanceGoal.update({ where: { id: goal.id }, data: { currentValue: input.currentValue, status: input.status, completedAt: input.status === EmployeePerformanceGoalStatus.COMPLETED ? new Date() : null } });
  await logActivity({ organizationId: input.organizationId, userId: input.actorId, action: ActivityAction.STATUS_CHANGE, entityType: "EmployeePerformanceGoal", entityId: goal.id, title: "Employee performance goal updated", description: `${goal.status} → ${updated.status}`, metadata: { currentValue: updated.currentValue } });
  return updated;
}

export async function createEmployeePerformanceReviewService(input: { organizationId: string; reviewerId: string; employeeId: string; days: EmployeePerformanceWindow; managerNarrative: string; strengths?: string | null; supportNeeds?: string | null }) {
  await requireTenantUsers(input.organizationId, [input.reviewerId, input.employeeId]);
  if (input.reviewerId === input.employeeId) throw new Error("A reviewer cannot create their own governed review.");
  const workspace = await getEmployeePerformanceWorkspace({ organizationId: input.organizationId, viewerId: input.reviewerId, canViewTeam: true, employeeId: input.employeeId, days: input.days });
  const employee = workspace.employees[0];
  if (!employee) throw new Error("Employee not found.");
  const evidenceSnapshot: Prisma.InputJsonObject = { generatedAt: new Date().toISOString(), periodStart: workspace.filters.from.toISOString(), periodEnd: workspace.filters.to.toISOString(), summary: employee.summary as unknown as Prisma.InputJsonObject, sources: employee.sources.map((source) => ({ source: source.source, assigned: source.summary.assigned, completed: source.summary.completed, overdue: source.summary.overdue, onTimeRate: source.summary.onTimeRate })) };
  const review = await prisma.employeePerformanceReview.create({ data: { organizationId: input.organizationId, employeeId: input.employeeId, reviewerId: input.reviewerId, periodStart: workspace.filters.from, periodEnd: workspace.filters.to, evidenceSnapshot, managerNarrative: bounded(input.managerNarrative, 4_000), strengths: optionalBounded(input.strengths, 2_000), supportNeeds: optionalBounded(input.supportNeeds, 2_000) } });
  await logActivity({ organizationId: input.organizationId, userId: input.reviewerId, action: ActivityAction.CREATE, entityType: "EmployeePerformanceReview", entityId: review.id, title: "Employee performance review drafted", description: employee.name, metadata: { employeeId: employee.id, periodStart: review.periodStart.toISOString(), periodEnd: review.periodEnd.toISOString() } });
  return review;
}

export async function shareEmployeePerformanceReviewService(input: { organizationId: string; actorId: string; reviewId: string }) {
  const review = await getReview(input.organizationId, input.reviewId);
  if (review.status !== EmployeePerformanceReviewStatus.DRAFT && review.status !== EmployeePerformanceReviewStatus.CONTEXT_REQUESTED) throw new Error("Only a draft or context-requested review can be shared.");
  const updated = await prisma.employeePerformanceReview.update({ where: { id: review.id }, data: { status: EmployeePerformanceReviewStatus.SHARED, sharedAt: new Date() } });
  const link = `/employee-performance/${review.employeeId}`;
  await Promise.all([
    logActivity({ organizationId: input.organizationId, userId: input.actorId, action: ActivityAction.STATUS_CHANGE, entityType: "EmployeePerformanceReview", entityId: review.id, title: "Employee performance review shared", description: review.employee.name }),
    createNotification({ organizationId: input.organizationId, userId: review.employeeId, type: NotificationType.INFO, title: "Performance review ready", message: "Your evidence-based performance review is ready for acknowledgement or contextual feedback.", link }).catch(() => null),
    sendTenantNotificationEmail({ to: review.employee.email, subject: "Your Senzilytics performance review is ready", text: `Your performance review is ready. Open ${getApplicationUrl()}${link}`, html: `<p>Your evidence-based performance review is ready.</p><p><a href="${getApplicationUrl()}${link}">Open your review</a></p>` }).catch(() => null),
  ]);
  return updated;
}

export async function respondToEmployeePerformanceReviewService(input: { organizationId: string; employeeId: string; reviewId: string; acknowledge: boolean; comment?: string | null }) {
  const review = await getReview(input.organizationId, input.reviewId);
  if (review.employeeId !== input.employeeId) throw new Error("You can only respond to your own performance review.");
  if (review.status !== EmployeePerformanceReviewStatus.SHARED) throw new Error("This review is not awaiting an employee response.");
  const comment = optionalBounded(input.comment, 2_000);
  if (!input.acknowledge && !comment) throw new Error("Explain the context you want the reviewer to consider.");
  const now = new Date();
  const status = input.acknowledge ? EmployeePerformanceReviewStatus.ACKNOWLEDGED : EmployeePerformanceReviewStatus.CONTEXT_REQUESTED;
  const updated = await prisma.employeePerformanceReview.update({ where: { id: review.id }, data: { status, employeeComment: comment, respondedAt: now, acknowledgedAt: input.acknowledge ? now : null } });
  await Promise.all([
    logActivity({ organizationId: input.organizationId, userId: input.employeeId, action: ActivityAction.COMMENT, entityType: "EmployeePerformanceReview", entityId: review.id, title: input.acknowledge ? "Employee performance review acknowledged" : "Employee review context requested", description: comment }),
    createNotification({ organizationId: input.organizationId, userId: review.reviewerId, type: input.acknowledge ? NotificationType.SUCCESS : NotificationType.WARNING, title: input.acknowledge ? "Performance review acknowledged" : "Employee requested review context", message: `${review.employee.name} responded to the performance review.`, link: `/employee-performance/${review.employeeId}` }).catch(() => null),
  ]);
  return updated;
}

export async function resolveEmployeePerformanceContextService(input: { organizationId: string; actorId: string; reviewId: string; managerResponse: string }) {
  const review = await getReview(input.organizationId, input.reviewId);
  if (review.status !== EmployeePerformanceReviewStatus.CONTEXT_REQUESTED) throw new Error("This review has no unresolved context request.");
  const response = bounded(input.managerResponse, 2_000);
  const updated = await prisma.employeePerformanceReview.update({ where: { id: review.id }, data: { managerResponse: response, status: EmployeePerformanceReviewStatus.SHARED, sharedAt: new Date() } });
  await Promise.all([
    logActivity({ organizationId: input.organizationId, userId: input.actorId, action: ActivityAction.COMMENT, entityType: "EmployeePerformanceReview", entityId: review.id, title: "Employee review context addressed", description: response }),
    createNotification({ organizationId: input.organizationId, userId: review.employeeId, type: NotificationType.INFO, title: "Performance review response added", message: "Your reviewer addressed the context request. Review and acknowledge when ready.", link: `/employee-performance/${review.employeeId}` }).catch(() => null),
  ]);
  return updated;
}

export async function closeEmployeePerformanceReviewService(input: { organizationId: string; actorId: string; reviewId: string }) {
  const review = await getReview(input.organizationId, input.reviewId);
  if (review.status !== EmployeePerformanceReviewStatus.ACKNOWLEDGED) throw new Error("The employee must acknowledge the review before closure.");
  const updated = await prisma.employeePerformanceReview.update({ where: { id: review.id }, data: { status: EmployeePerformanceReviewStatus.CLOSED, closedById: input.actorId, closedAt: new Date() } });
  await logActivity({ organizationId: input.organizationId, userId: input.actorId, action: ActivityAction.STATUS_CHANGE, entityType: "EmployeePerformanceReview", entityId: review.id, title: "Employee performance review closed", description: review.employee.name });
  return updated;
}

async function getReview(organizationId: string, id: string) {
  const review = await prisma.employeePerformanceReview.findFirst({ where: { id, organizationId }, include: { employee: { select: { id: true, name: true, email: true } } } });
  if (!review) throw new Error("Performance review not found.");
  return review;
}

async function requireTenantUsers(organizationId: string, ids: string[]) {
  const count = await prisma.user.count({ where: { organizationId, id: { in: [...new Set(ids)] }, isActive: true } });
  if (count !== new Set(ids).size) throw new Error("Select active users from this organization.");
}

function bounded(value: string, max: number) { const normalized = value.trim(); if (!normalized || normalized.length > max) throw new Error("Enter complete information within the allowed length."); return normalized; }
function optionalBounded(value: string | null | undefined, max: number) { const normalized = value?.trim() || null; if (normalized && normalized.length > max) throw new Error("The provided information is too long."); return normalized; }
