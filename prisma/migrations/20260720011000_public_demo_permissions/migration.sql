INSERT INTO "RolePermission" ("id", "role", "permission", "createdAt")
SELECT
  'demo_' || lower(permission::text),
  'DEMO_VIEWER'::"UserRole",
  permission,
  CURRENT_TIMESTAMP
FROM unnest(ARRAY[
  'VIEW_DASHBOARD'::"PermissionKey",
  'VIEW_REPORTS'::"PermissionKey",
  'VIEW_INCIDENT'::"PermissionKey",
  'VIEW_AUDITS'::"PermissionKey",
  'VIEW_INSPECTIONS'::"PermissionKey",
  'VIEW_COMPLIANCE'::"PermissionKey",
  'VIEW_TRAINING'::"PermissionKey",
  'VIEW_ACTIVITY_LOG'::"PermissionKey",
  'VIEW_RISKS'::"PermissionKey",
  'VIEW_MOC'::"PermissionKey",
  'VIEW_OBSERVATIONS'::"PermissionKey",
  'VIEW_CHEMICALS'::"PermissionKey",
  'VIEW_ENVIRONMENTAL'::"PermissionKey",
  'VIEW_ESG'::"PermissionKey"
]) AS permission
ON CONFLICT ("role", "permission") DO NOTHING;
