ALTER TYPE "PermissionKey" ADD VALUE 'VIEW_OWN_EMPLOYEE_PERFORMANCE';
ALTER TYPE "PermissionKey" ADD VALUE 'VIEW_EMPLOYEE_PERFORMANCE';

INSERT INTO "RolePermission" ("id", "role", "permission", "createdAt") VALUES
  ('rp_super_admin_view_own_employee_performance', 'SUPER_ADMIN', 'VIEW_OWN_EMPLOYEE_PERFORMANCE', CURRENT_TIMESTAMP),
  ('rp_super_admin_view_employee_performance', 'SUPER_ADMIN', 'VIEW_EMPLOYEE_PERFORMANCE', CURRENT_TIMESTAMP),
  ('rp_org_admin_view_own_employee_performance', 'ORG_ADMIN', 'VIEW_OWN_EMPLOYEE_PERFORMANCE', CURRENT_TIMESTAMP),
  ('rp_org_admin_view_employee_performance', 'ORG_ADMIN', 'VIEW_EMPLOYEE_PERFORMANCE', CURRENT_TIMESTAMP),
  ('rp_ehs_manager_view_own_employee_performance', 'EHS_MANAGER', 'VIEW_OWN_EMPLOYEE_PERFORMANCE', CURRENT_TIMESTAMP),
  ('rp_ehs_manager_view_employee_performance', 'EHS_MANAGER', 'VIEW_EMPLOYEE_PERFORMANCE', CURRENT_TIMESTAMP),
  ('rp_supervisor_view_own_employee_performance', 'SUPERVISOR', 'VIEW_OWN_EMPLOYEE_PERFORMANCE', CURRENT_TIMESTAMP),
  ('rp_supervisor_view_employee_performance', 'SUPERVISOR', 'VIEW_EMPLOYEE_PERFORMANCE', CURRENT_TIMESTAMP),
  ('rp_employee_view_own_employee_performance', 'EMPLOYEE', 'VIEW_OWN_EMPLOYEE_PERFORMANCE', CURRENT_TIMESTAMP),
  ('rp_auditor_view_own_employee_performance', 'AUDITOR', 'VIEW_OWN_EMPLOYEE_PERFORMANCE', CURRENT_TIMESTAMP),
  ('rp_demo_view_own_employee_performance', 'DEMO_VIEWER', 'VIEW_OWN_EMPLOYEE_PERFORMANCE', CURRENT_TIMESTAMP)
ON CONFLICT ("role", "permission") DO NOTHING;
