import type { PermissionKey } from "@prisma/client";

export type NavigationAccessRequirement = {
  permission?: PermissionKey;
  anyPermissions?: readonly PermissionKey[];
};

export function canViewNavigationItem(
  item: NavigationAccessRequirement,
  grantedPermissions: readonly PermissionKey[],
) {
  const granted = new Set(grantedPermissions);

  if (item.permission && !granted.has(item.permission)) {
    return false;
  }

  if (
    item.anyPermissions?.length &&
    !item.anyPermissions.some((permission) => granted.has(permission))
  ) {
    return false;
  }

  return true;
}

export function filterNavigationItems<T extends NavigationAccessRequirement>(
  items: readonly T[],
  grantedPermissions: readonly PermissionKey[],
) {
  return items.filter((item) =>
    canViewNavigationItem(item, grantedPermissions),
  );
}
