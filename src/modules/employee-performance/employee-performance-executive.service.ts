import { EmployeePerformanceGoalStatus, EmployeePerformanceReviewStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function getEmployeePerformanceExecutiveSummary(organizationId: string, days: number) {
  const now = new Date();
  const from = new Date(now.getTime() - days * 86_400_000);
  const [activeGoals, overdueGoals, completedGoals, awaitingEmployee, contextRequested, awaitingClosure, closedReviews] = await Promise.all([
    prisma.employeePerformanceGoal.count({ where: { organizationId, status: EmployeePerformanceGoalStatus.ACTIVE } }),
    prisma.employeePerformanceGoal.count({ where: { organizationId, status: EmployeePerformanceGoalStatus.ACTIVE, dueAt: { lt: now } } }),
    prisma.employeePerformanceGoal.count({ where: { organizationId, status: EmployeePerformanceGoalStatus.COMPLETED, completedAt: { gte: from } } }),
    prisma.employeePerformanceReview.count({ where: { organizationId, status: EmployeePerformanceReviewStatus.SHARED } }),
    prisma.employeePerformanceReview.count({ where: { organizationId, status: EmployeePerformanceReviewStatus.CONTEXT_REQUESTED } }),
    prisma.employeePerformanceReview.count({ where: { organizationId, status: EmployeePerformanceReviewStatus.ACKNOWLEDGED } }),
    prisma.employeePerformanceReview.count({ where: { organizationId, status: EmployeePerformanceReviewStatus.CLOSED, closedAt: { gte: from } } }),
  ]);
  return { activeGoals, overdueGoals, completedGoals, awaitingEmployee, contextRequested, awaitingClosure, closedReviews };
}
