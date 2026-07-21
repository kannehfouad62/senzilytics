INSERT INTO "RolePermission" ("id", "role", "permission", "createdAt") VALUES
  ('rp_super_admin_view_assets', 'SUPER_ADMIN', 'VIEW_ASSETS', CURRENT_TIMESTAMP),
  ('rp_super_admin_manage_assets', 'SUPER_ADMIN', 'MANAGE_ASSETS', CURRENT_TIMESTAMP),
  ('rp_org_admin_view_assets', 'ORG_ADMIN', 'VIEW_ASSETS', CURRENT_TIMESTAMP),
  ('rp_org_admin_manage_assets', 'ORG_ADMIN', 'MANAGE_ASSETS', CURRENT_TIMESTAMP),
  ('rp_ehs_manager_view_assets', 'EHS_MANAGER', 'VIEW_ASSETS', CURRENT_TIMESTAMP),
  ('rp_ehs_manager_manage_assets', 'EHS_MANAGER', 'MANAGE_ASSETS', CURRENT_TIMESTAMP),
  ('rp_supervisor_view_assets', 'SUPERVISOR', 'VIEW_ASSETS', CURRENT_TIMESTAMP),
  ('rp_supervisor_manage_assets', 'SUPERVISOR', 'MANAGE_ASSETS', CURRENT_TIMESTAMP),
  ('rp_auditor_view_assets', 'AUDITOR', 'VIEW_ASSETS', CURRENT_TIMESTAMP),
  ('rp_demo_view_assets', 'DEMO_VIEWER', 'VIEW_ASSETS', CURRENT_TIMESTAMP)
ON CONFLICT ("role", "permission") DO NOTHING;
