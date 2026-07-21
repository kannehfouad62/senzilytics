INSERT INTO "RolePermission" ("id", "role", "permission", "createdAt") VALUES
  ('rp_org_admin_view_contractors', 'ORG_ADMIN', 'VIEW_CONTRACTORS', CURRENT_TIMESTAMP),
  ('rp_org_admin_manage_contractors', 'ORG_ADMIN', 'MANAGE_CONTRACTORS', CURRENT_TIMESTAMP),
  ('rp_org_admin_view_ptw', 'ORG_ADMIN', 'VIEW_PERMITS_TO_WORK', CURRENT_TIMESTAMP),
  ('rp_org_admin_manage_ptw', 'ORG_ADMIN', 'MANAGE_PERMITS_TO_WORK', CURRENT_TIMESTAMP),
  ('rp_ehs_manager_view_contractors', 'EHS_MANAGER', 'VIEW_CONTRACTORS', CURRENT_TIMESTAMP),
  ('rp_ehs_manager_manage_contractors', 'EHS_MANAGER', 'MANAGE_CONTRACTORS', CURRENT_TIMESTAMP),
  ('rp_ehs_manager_view_ptw', 'EHS_MANAGER', 'VIEW_PERMITS_TO_WORK', CURRENT_TIMESTAMP),
  ('rp_ehs_manager_manage_ptw', 'EHS_MANAGER', 'MANAGE_PERMITS_TO_WORK', CURRENT_TIMESTAMP),
  ('rp_supervisor_view_contractors', 'SUPERVISOR', 'VIEW_CONTRACTORS', CURRENT_TIMESTAMP),
  ('rp_supervisor_view_ptw', 'SUPERVISOR', 'VIEW_PERMITS_TO_WORK', CURRENT_TIMESTAMP),
  ('rp_supervisor_manage_ptw', 'SUPERVISOR', 'MANAGE_PERMITS_TO_WORK', CURRENT_TIMESTAMP),
  ('rp_employee_view_ptw', 'EMPLOYEE', 'VIEW_PERMITS_TO_WORK', CURRENT_TIMESTAMP),
  ('rp_auditor_view_contractors', 'AUDITOR', 'VIEW_CONTRACTORS', CURRENT_TIMESTAMP),
  ('rp_auditor_view_ptw', 'AUDITOR', 'VIEW_PERMITS_TO_WORK', CURRENT_TIMESTAMP),
  ('rp_demo_view_contractors', 'DEMO_VIEWER', 'VIEW_CONTRACTORS', CURRENT_TIMESTAMP),
  ('rp_demo_view_ptw', 'DEMO_VIEWER', 'VIEW_PERMITS_TO_WORK', CURRENT_TIMESTAMP)
ON CONFLICT ("role", "permission") DO NOTHING;
