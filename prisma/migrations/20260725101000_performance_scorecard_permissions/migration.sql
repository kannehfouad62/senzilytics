INSERT INTO "RolePermission" ("id", "role", "permission", "createdAt") VALUES
  ('rp_super_admin_view_performance', 'SUPER_ADMIN', 'VIEW_PERFORMANCE_SCORECARDS', CURRENT_TIMESTAMP),
  ('rp_super_admin_manage_performance', 'SUPER_ADMIN', 'MANAGE_PERFORMANCE_SCORECARDS', CURRENT_TIMESTAMP),
  ('rp_org_admin_view_performance', 'ORG_ADMIN', 'VIEW_PERFORMANCE_SCORECARDS', CURRENT_TIMESTAMP),
  ('rp_org_admin_manage_performance', 'ORG_ADMIN', 'MANAGE_PERFORMANCE_SCORECARDS', CURRENT_TIMESTAMP),
  ('rp_ehs_manager_view_performance', 'EHS_MANAGER', 'VIEW_PERFORMANCE_SCORECARDS', CURRENT_TIMESTAMP),
  ('rp_ehs_manager_manage_performance', 'EHS_MANAGER', 'MANAGE_PERFORMANCE_SCORECARDS', CURRENT_TIMESTAMP),
  ('rp_supervisor_view_performance', 'SUPERVISOR', 'VIEW_PERFORMANCE_SCORECARDS', CURRENT_TIMESTAMP),
  ('rp_auditor_view_performance', 'AUDITOR', 'VIEW_PERFORMANCE_SCORECARDS', CURRENT_TIMESTAMP),
  ('rp_demo_view_performance', 'DEMO_VIEWER', 'VIEW_PERFORMANCE_SCORECARDS', CURRENT_TIMESTAMP)
ON CONFLICT ("role", "permission") DO NOTHING;
