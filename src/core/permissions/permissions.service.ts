import { PermissionKey, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { redirect } from "next/navigation";

export async function getCurrentUserPermissions() {
  const { user } = await getCurrentUserTenant();

  if (user.role === UserRole.SUPER_ADMIN) {
    return Object.values(PermissionKey);
  }

  const permissions = await prisma.rolePermission.findMany({
    where: {
      role: user.role,
    },
    select: {
      permission: true,
    },
  });

  return permissions.map((item) => item.permission);
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
