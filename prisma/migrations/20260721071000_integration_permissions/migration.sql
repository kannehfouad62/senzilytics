INSERT INTO "RolePermission" ("id", "role", "permission", "createdAt") VALUES
  ('rp_super_admin_manage_integrations', 'SUPER_ADMIN', 'MANAGE_INTEGRATIONS', CURRENT_TIMESTAMP),
  ('rp_org_admin_manage_integrations', 'ORG_ADMIN', 'MANAGE_INTEGRATIONS', CURRENT_TIMESTAMP)
ON CONFLICT ("role", "permission") DO NOTHING;
