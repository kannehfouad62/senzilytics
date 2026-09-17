import { PermissionKey, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { planEntitlements } from "@/lib/subscription";
import { filterUserModulePermissions } from "@/core/navigation/tenant-module-catalog";

const supportReadPermissions = [
  PermissionKey.VIEW_DASHBOARD, PermissionKey.VIEW_REPORTS, PermissionKey.VIEW_USERS, PermissionKey.VIEW_ACTIVITY_LOG,
  PermissionKey.VIEW_INCIDENT, PermissionKey.VIEW_AUDITS, PermissionKey.VIEW_INSPECTIONS, PermissionKey.VIEW_COMPLIANCE,
  PermissionKey.VIEW_TRAINING, PermissionKey.VIEW_RISKS, PermissionKey.VIEW_MOC, PermissionKey.VIEW_OBSERVATIONS,
  PermissionKey.VIEW_CHEMICALS, PermissionKey.VIEW_ENVIRONMENTAL, PermissionKey.VIEW_ESG, PermissionKey.VIEW_CONTRACTORS,
  PermissionKey.VIEW_PERMITS_TO_WORK, PermissionKey.VIEW_INDUSTRIAL_HYGIENE, PermissionKey.VIEW_OCCUPATIONAL_HEALTH,
  PermissionKey.VIEW_SIF_INTELLIGENCE, PermissionKey.VIEW_CERTIFICATION_READINESS, PermissionKey.VIEW_ASSETS,
  PermissionKey.VIEW_BEHAVIOR_SAFETY, PermissionKey.VIEW_PERFORMANCE_SCORECARDS, PermissionKey.VIEW_EMPLOYEE_PERFORMANCE,
  PermissionKey.VIEW_EMERGENCY_PREPAREDNESS, PermissionKey.VIEW_BUSINESS_CONTINUITY, PermissionKey.VIEW_PREDICTIVE_INTELLIGENCE,
  PermissionKey.VIEW_EXECUTIVE_REVIEWS, PermissionKey.VIEW_RESEARCH,
] as const;

export async function getCurrentUserPermissions() {
  const { user, organization, supportAccess } = await getCurrentUserTenant();

  if (supportAccess) {
    return filterUserModulePermissions(supportReadPermissions, supportAccess.moduleKeys.map((moduleKey) => ({ moduleKey, enabled: true })));
  }

  if (user.role === UserRole.SUPER_ADMIN) {
    const permissions = Object.values(PermissionKey);
    return organization && !planEntitlements[organization.subscriptionPlan].AI ? permissions.filter(permission => permission !== PermissionKey.USE_AI) : permissions;
  }

  const [permissions, moduleAssignments] = await Promise.all([
    prisma.rolePermission.findMany({ where: { role: user.role }, select: { permission: true } }),
    prisma.userModuleAssignment.findMany({ where: { organizationId: user.organizationId!, userId: user.id }, select: { moduleKey: true, enabled: true } }),
  ]);

  const assigned = filterUserModulePermissions(permissions.map((item) => item.permission), moduleAssignments);
  return organization && !planEntitlements[organization.subscriptionPlan].AI ? assigned.filter(permission => permission !== PermissionKey.USE_AI) : assigned;
}

export async function hasPermission(permission: PermissionKey) {
  const permissions = await getCurrentUserPermissions();

  return permissions.includes(permission);
}

export async function requirePermission(permission: PermissionKey) {
  const allowed = await hasPermission(permission);

  if (!allowed) {
    redirect("/unauthorized");
  }
}
