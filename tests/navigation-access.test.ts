import assert from "node:assert/strict";
import test from "node:test";
import { PermissionKey } from "@prisma/client";
import {
  canViewNavigationItem,
  filterNavigationItems,
} from "../src/core/permissions/navigation-access";

test("navigation hides an item when its required permission is not granted", () => {
  assert.equal(
    canViewNavigationItem(
      { permission: PermissionKey.VIEW_USERS },
      [PermissionKey.VIEW_AUDITS],
    ),
    false,
  );
});

test("navigation supports pages that accept any one of several permissions", () => {
  const requirement = {
    anyPermissions: [PermissionKey.CREATE_CAPA, PermissionKey.VIEW_REPORTS],
  };

  assert.equal(
    canViewNavigationItem(requirement, [PermissionKey.VIEW_REPORTS]),
    true,
  );
  assert.equal(
    canViewNavigationItem(requirement, [PermissionKey.VIEW_AUDITS]),
    false,
  );
});

test("navigation filtering preserves only accessible modules", () => {
  const items = [
    { href: "/audits", permission: PermissionKey.VIEW_AUDITS },
    { href: "/users", permission: PermissionKey.VIEW_USERS },
    { href: "/tasks" },
  ];

  assert.deepEqual(
    filterNavigationItems(items, [PermissionKey.VIEW_AUDITS]).map(
      (item) => item.href,
    ),
    ["/audits", "/tasks"],
  );
});
