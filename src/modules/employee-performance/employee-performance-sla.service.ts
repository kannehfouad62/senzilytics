import { ActivityAction, EmployeePerformanceGoalStatus, EmployeePerformanceReviewStatus, NotificationType, UserRole } from "@prisma/client";
import { createSenzilyticsEmailTemplate } from "@/core/email/email-template";
import { getApplicationUrl, sendTenantNotificationEmail } from "@/core/email/email.service";
import { createNotification } from "@/core/notifications/notifications.service";
import { prisma } from "@/lib/prisma";

const day = 86_400_000;
export const employeePerformanceSlaLevel = (dueAt: Date, now: Date) => {
  const overdueDays = Math.floor((now.getTime() - dueAt.getTime()) / day);
  if (overdueDays >= 3) return "ESCALATED" as const;
  if (overdueDays >= 0) return "OVERDUE" as const;
  return "DUE_SOON" as const;
};

type Signal = { organizationId: string; entityType: string; entityId: string; label: string; milestone: string; dueAt: Date; link: string; recipientIds: string[] };
const compact = (values: Array<string | null | undefined>) => [...new Set(values.filter((value): value is string => Boolean(value)))];

export async function processEmployeePerformanceSla(now = new Date()) {
  const horizon = new Date(now.getTime() + 7 * day);
  const [goals, reviews] = await Promise.all([
    prisma.employeePerformanceGoal.findMany({
      where: { status: EmployeePerformanceGoalStatus.ACTIVE, dueAt: { lte: horizon } },
      select: { id: true, organizationId: true, employeeId: true, createdById: true, title: true, dueAt: true },
    }),
    prisma.employeePerformanceReview.findMany({
      where: { status: { in: [EmployeePerformanceReviewStatus.SHARED, EmployeePerformanceReviewStatus.CONTEXT_REQUESTED, EmployeePerformanceReviewStatus.ACKNOWLEDGED] } },
      select: { id: true, organizationId: true, employeeId: true, reviewerId: true, status: true, sharedAt: true, respondedAt: true, acknowledgedAt: true, employee: { select: { name: true } } },
    }),
  ]);
  const signals: Signal[] = [
    ...goals.map((goal) => ({ organizationId: goal.organizationId, entityType: "EmployeePerformanceGoal", entityId: goal.id, label: goal.title, milestone: "performance goal", dueAt: goal.dueAt, link: `/employee-performance/${goal.employeeId}`, recipientIds: compact([goal.employeeId, goal.createdById]) })),
    ...reviews.map((review) => {
      const basis = review.status === EmployeePerformanceReviewStatus.SHARED ? review.sharedAt : review.status === EmployeePerformanceReviewStatus.CONTEXT_REQUESTED ? review.respondedAt : review.acknowledgedAt;
      const waitDays = review.status === EmployeePerformanceReviewStatus.SHARED ? 3 : 2;
      return { organizationId: review.organizationId, entityType: "EmployeePerformanceReview", entityId: review.id, label: `${review.employee.name || "Employee"} review`, milestone: review.status === EmployeePerformanceReviewStatus.SHARED ? "employee acknowledgement" : review.status === EmployeePerformanceReviewStatus.CONTEXT_REQUESTED ? "manager context response" : "review closure", dueAt: new Date((basis ?? now).getTime() + waitDays * day), link: `/employee-performance/${review.employeeId}`, recipientIds: compact(review.status === EmployeePerformanceReviewStatus.SHARED ? [review.employeeId, review.reviewerId] : [review.reviewerId]) };
    }),
  ].filter((signal) => signal.dueAt <= horizon);

  let notificationsSent = 0;
  let emailsSent = 0;
  let escalations = 0;
  let skipped = 0;
  for (const signal of signals) {
    const level = employeePerformanceSlaLevel(signal.dueAt, now);
    const recipients = new Set(signal.recipientIds);
    if (level !== "DUE_SOON") {
      const managers = await prisma.user.findMany({ where: { organizationId: signal.organizationId, isActive: true, role: { in: [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.EHS_MANAGER] } }, select: { id: true } });
      managers.forEach((manager) => recipients.add(manager.id));
    }
    const users = await prisma.user.findMany({ where: { organizationId: signal.organizationId, isActive: true, id: { in: [...recipients] } }, select: { id: true, name: true, email: true } });
    for (const recipient of users) {
      const evidenceKey = `Employee performance SLA:${signal.milestone}:${level}:${recipient.id}`;
      const sent = await prisma.activityLog.findFirst({ where: { organizationId: signal.organizationId, entityType: signal.entityType, entityId: signal.entityId, title: evidenceKey }, select: { id: true } });
      if (sent) { skipped += 1; continue; }
      const overdue = level !== "DUE_SOON";
      const title = `${signal.milestone} ${overdue ? "overdue" : "due soon"}`;
      const message = `${signal.label} is ${overdue ? "past its governed milestone" : `due ${signal.dueAt.toLocaleDateString("en-US")}`}.`;
      const notification = await createNotification({ organizationId: signal.organizationId, userId: recipient.id, type: level === "ESCALATED" ? NotificationType.CRITICAL : overdue ? NotificationType.WARNING : NotificationType.DUE_DATE, title, message, link: signal.link }).catch(() => null);
      if (notification) notificationsSent += 1;
      const email = await sendTenantNotificationEmail({ to: recipient.email, subject: `Senzilytics: ${title}`, html: createSenzilyticsEmailTemplate({ preheader: title, heading: title, body: `${recipient.name}, ${message}`, actionLabel: "Open Employee Performance", actionUrl: `${getApplicationUrl()}${signal.link}` }) });
      if (email.messageId) emailsSent += 1;
      if (notification || email.messageId) {
        await prisma.activityLog.create({ data: { organizationId: signal.organizationId, userId: recipient.id, action: ActivityAction.SYSTEM, entityType: signal.entityType, entityId: signal.entityId, title: evidenceKey, description: message, metadata: { level, milestone: signal.milestone, dueAt: signal.dueAt.toISOString(), notificationId: notification?.id ?? null, emailMessageId: email.messageId } } });
        if (level === "ESCALATED") escalations += 1;
      }
    }
  }
  return { checked: signals.length, notificationsSent, emailsSent, escalations, skipped };
}
