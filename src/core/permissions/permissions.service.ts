import { PermissionKey, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { planEntitlements } from "@/lib/subscription";

export async function getCurrentUserPermissions() {
  const { user, organization } = await getCurrentUserTenant();

  if (user.role === UserRole.SUPER_ADMIN) {
    const permissions = Object.values(PermissionKey);
    return organization && !planEntitlements[organization.subscriptionPlan].AI ? permissions.filter(permission => permission !== PermissionKey.USE_AI) : permissions;
  }

  const permissions = await prisma.rolePermission.findMany({
    where: {
      role: user.role,
    },
    select: {
      permission: true,
    },
  });

  const assigned = permissions.map((item) => item.permission);
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
