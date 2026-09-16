"use server";

import { EmployeePerformanceGoalStatus, PermissionKey } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  closeEmployeePerformanceReviewService,
  createEmployeePerformanceGoalService,
  createEmployeePerformanceReviewService,
  resolveEmployeePerformanceContextService,
  respondToEmployeePerformanceReviewService,
  shareEmployeePerformanceReviewService,
  updateEmployeePerformanceGoalService,
} from "@/modules/employee-performance/employee-performance-governance.service";
import { parseEmployeePerformanceWindow } from "@/modules/employee-performance/employee-performance.service";

const text = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const required = (data: FormData, key: string) => {
  const result = text(data, key);
  if (!result) throw new Error(`${key} is required.`);
  return result;
};
const refresh = (employeeId: string) => {
  revalidatePath("/employee-performance");
  revalidatePath(`/employee-performance/${employeeId}`);
  revalidatePath("/dashboard");
};
async function managerContext() {
  await requirePermission(PermissionKey.MANAGE_EMPLOYEE_PERFORMANCE);
  return getCurrentUserTenant();
}

export async function createEmployeePerformanceGoal(data: FormData) {
  const { organizationId, user } = await managerContext();
  const employeeId = required(data, "employeeId");
  await createEmployeePerformanceGoalService({
    organizationId,
    actorId: user.id,
    employeeId,
    title: required(data, "title"),
    description: text(data, "description"),
    metric: required(data, "metric"),
    unit: required(data, "unit"),
    targetValue: Number(required(data, "targetValue")),
    dueAt: new Date(`${required(data, "dueAt")}T23:59:59.999Z`),
  });
  refresh(employeeId);
}

export async function updateEmployeePerformanceGoal(data: FormData) {
  const { organizationId, user } = await managerContext();
  const employeeId = required(data, "employeeId");
  const status = required(data, "status") as EmployeePerformanceGoalStatus;
  if (!Object.values(EmployeePerformanceGoalStatus).includes(status)) throw new Error("Select a valid goal status.");
  await updateEmployeePerformanceGoalService({ organizationId, actorId: user.id, goalId: required(data, "goalId"), currentValue: Number(required(data, "currentValue")), status });
  refresh(employeeId);
}

export async function createEmployeePerformanceReview(data: FormData) {
  const { organizationId, user } = await managerContext();
  const employeeId = required(data, "employeeId");
  await createEmployeePerformanceReviewService({ organizationId, reviewerId: user.id, employeeId, days: parseEmployeePerformanceWindow(text(data, "days")), managerNarrative: required(data, "managerNarrative"), strengths: text(data, "strengths"), supportNeeds: text(data, "supportNeeds") });
  refresh(employeeId);
}

export async function shareEmployeePerformanceReview(data: FormData) {
  const { organizationId, user } = await managerContext();
  const employeeId = required(data, "employeeId");
  await shareEmployeePerformanceReviewService({ organizationId, actorId: user.id, reviewId: required(data, "reviewId") });
  refresh(employeeId);
}

export async function respondToEmployeePerformanceReview(data: FormData) {
  await requirePermission(PermissionKey.VIEW_OWN_EMPLOYEE_PERFORMANCE);
  const { organizationId, user } = await getCurrentUserTenant();
  await respondToEmployeePerformanceReviewService({ organizationId, employeeId: user.id, reviewId: required(data, "reviewId"), acknowledge: required(data, "decision") === "acknowledge", comment: text(data, "comment") });
  refresh(user.id);
}

export async function resolveEmployeePerformanceContext(data: FormData) {
  const { organizationId, user } = await managerContext();
  const employeeId = required(data, "employeeId");
  await resolveEmployeePerformanceContextService({ organizationId, actorId: user.id, reviewId: required(data, "reviewId"), managerResponse: required(data, "managerResponse") });
  refresh(employeeId);
}

export async function closeEmployeePerformanceReview(data: FormData) {
  const { organizationId, user } = await managerContext();
  const employeeId = required(data, "employeeId");
  await closeEmployeePerformanceReviewService({ organizationId, actorId: user.id, reviewId: required(data, "reviewId") });
  refresh(employeeId);
}
