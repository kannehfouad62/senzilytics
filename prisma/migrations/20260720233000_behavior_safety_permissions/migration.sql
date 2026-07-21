INSERT INTO "RolePermission" ("id", "role", "permission", "createdAt") VALUES
  ('rp_super_admin_view_bbs', 'SUPER_ADMIN', 'VIEW_BEHAVIOR_SAFETY', CURRENT_TIMESTAMP),
  ('rp_super_admin_record_bbs', 'SUPER_ADMIN', 'RECORD_BEHAVIOR_COACHING', CURRENT_TIMESTAMP),
  ('rp_super_admin_manage_bbs', 'SUPER_ADMIN', 'MANAGE_BEHAVIOR_SAFETY', CURRENT_TIMESTAMP),
  ('rp_org_admin_view_bbs', 'ORG_ADMIN', 'VIEW_BEHAVIOR_SAFETY', CURRENT_TIMESTAMP),
  ('rp_org_admin_record_bbs', 'ORG_ADMIN', 'RECORD_BEHAVIOR_COACHING', CURRENT_TIMESTAMP),
  ('rp_org_admin_manage_bbs', 'ORG_ADMIN', 'MANAGE_BEHAVIOR_SAFETY', CURRENT_TIMESTAMP),
  ('rp_ehs_manager_view_bbs', 'EHS_MANAGER', 'VIEW_BEHAVIOR_SAFETY', CURRENT_TIMESTAMP),
  ('rp_ehs_manager_record_bbs', 'EHS_MANAGER', 'RECORD_BEHAVIOR_COACHING', CURRENT_TIMESTAMP),
  ('rp_ehs_manager_manage_bbs', 'EHS_MANAGER', 'MANAGE_BEHAVIOR_SAFETY', CURRENT_TIMESTAMP),
  ('rp_supervisor_view_bbs', 'SUPERVISOR', 'VIEW_BEHAVIOR_SAFETY', CURRENT_TIMESTAMP),
  ('rp_supervisor_record_bbs', 'SUPERVISOR', 'RECORD_BEHAVIOR_COACHING', CURRENT_TIMESTAMP),
  ('rp_employee_view_bbs', 'EMPLOYEE', 'VIEW_BEHAVIOR_SAFETY', CURRENT_TIMESTAMP),
  ('rp_employee_record_bbs', 'EMPLOYEE', 'RECORD_BEHAVIOR_COACHING', CURRENT_TIMESTAMP),
  ('rp_auditor_view_bbs', 'AUDITOR', 'VIEW_BEHAVIOR_SAFETY', CURRENT_TIMESTAMP),
  ('rp_demo_view_bbs', 'DEMO_VIEWER', 'VIEW_BEHAVIOR_SAFETY', CURRENT_TIMESTAMP)
ON CONFLICT ("role", "permission") DO NOTHING;
