INSERT INTO "RolePermission" ("id", "role", "permission", "createdAt") VALUES
  ('moc-org-admin-view', 'ORG_ADMIN', 'VIEW_MOC', CURRENT_TIMESTAMP),
  ('moc-org-admin-manage', 'ORG_ADMIN', 'MANAGE_MOC', CURRENT_TIMESTAMP),
  ('moc-ehs-manager-view', 'EHS_MANAGER', 'VIEW_MOC', CURRENT_TIMESTAMP),
  ('moc-ehs-manager-manage', 'EHS_MANAGER', 'MANAGE_MOC', CURRENT_TIMESTAMP),
  ('moc-supervisor-view', 'SUPERVISOR', 'VIEW_MOC', CURRENT_TIMESTAMP),
  ('moc-auditor-view', 'AUDITOR', 'VIEW_MOC', CURRENT_TIMESTAMP)
ON CONFLICT ("role", "permission") DO NOTHING;
