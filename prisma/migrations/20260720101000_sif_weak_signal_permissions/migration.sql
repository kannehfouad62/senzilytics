INSERT INTO "RolePermission" ("id", "role", "permission", "createdAt") VALUES
  ('rp_super_admin_view_sif', 'SUPER_ADMIN', 'VIEW_SIF_INTELLIGENCE', CURRENT_TIMESTAMP),
  ('rp_super_admin_manage_controls', 'SUPER_ADMIN', 'MANAGE_CRITICAL_CONTROLS', CURRENT_TIMESTAMP),
  ('rp_org_admin_view_sif', 'ORG_ADMIN', 'VIEW_SIF_INTELLIGENCE', CURRENT_TIMESTAMP),
  ('rp_org_admin_manage_controls', 'ORG_ADMIN', 'MANAGE_CRITICAL_CONTROLS', CURRENT_TIMESTAMP),
  ('rp_ehs_manager_view_sif', 'EHS_MANAGER', 'VIEW_SIF_INTELLIGENCE', CURRENT_TIMESTAMP),
  ('rp_ehs_manager_manage_controls', 'EHS_MANAGER', 'MANAGE_CRITICAL_CONTROLS', CURRENT_TIMESTAMP),
  ('rp_supervisor_view_sif', 'SUPERVISOR', 'VIEW_SIF_INTELLIGENCE', CURRENT_TIMESTAMP),
  ('rp_supervisor_manage_controls', 'SUPERVISOR', 'MANAGE_CRITICAL_CONTROLS', CURRENT_TIMESTAMP),
  ('rp_auditor_view_sif', 'AUDITOR', 'VIEW_SIF_INTELLIGENCE', CURRENT_TIMESTAMP),
  ('rp_demo_view_sif', 'DEMO_VIEWER', 'VIEW_SIF_INTELLIGENCE', CURRENT_TIMESTAMP)
ON CONFLICT ("role", "permission") DO NOTHING;
