INSERT INTO "RolePermission" ("id", "role", "permission", "createdAt")
VALUES
  ('obs-perm-super-create', 'SUPER_ADMIN', 'CREATE_OBSERVATION', CURRENT_TIMESTAMP),
  ('obs-perm-super-view', 'SUPER_ADMIN', 'VIEW_OBSERVATIONS', CURRENT_TIMESTAMP),
  ('obs-perm-super-manage', 'SUPER_ADMIN', 'MANAGE_OBSERVATIONS', CURRENT_TIMESTAMP),
  ('obs-perm-org-create', 'ORG_ADMIN', 'CREATE_OBSERVATION', CURRENT_TIMESTAMP),
  ('obs-perm-org-view', 'ORG_ADMIN', 'VIEW_OBSERVATIONS', CURRENT_TIMESTAMP),
  ('obs-perm-org-manage', 'ORG_ADMIN', 'MANAGE_OBSERVATIONS', CURRENT_TIMESTAMP),
  ('obs-perm-ehs-create', 'EHS_MANAGER', 'CREATE_OBSERVATION', CURRENT_TIMESTAMP),
  ('obs-perm-ehs-view', 'EHS_MANAGER', 'VIEW_OBSERVATIONS', CURRENT_TIMESTAMP),
  ('obs-perm-ehs-manage', 'EHS_MANAGER', 'MANAGE_OBSERVATIONS', CURRENT_TIMESTAMP),
  ('obs-perm-supervisor-create', 'SUPERVISOR', 'CREATE_OBSERVATION', CURRENT_TIMESTAMP),
  ('obs-perm-supervisor-view', 'SUPERVISOR', 'VIEW_OBSERVATIONS', CURRENT_TIMESTAMP),
  ('obs-perm-supervisor-manage', 'SUPERVISOR', 'MANAGE_OBSERVATIONS', CURRENT_TIMESTAMP),
  ('obs-perm-employee-create', 'EMPLOYEE', 'CREATE_OBSERVATION', CURRENT_TIMESTAMP),
  ('obs-perm-employee-view', 'EMPLOYEE', 'VIEW_OBSERVATIONS', CURRENT_TIMESTAMP),
  ('obs-perm-auditor-view', 'AUDITOR', 'VIEW_OBSERVATIONS', CURRENT_TIMESTAMP)
ON CONFLICT ("role", "permission") DO NOTHING;
