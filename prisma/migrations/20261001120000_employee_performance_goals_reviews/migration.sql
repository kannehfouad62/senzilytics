ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'MANAGE_EMPLOYEE_PERFORMANCE';
CREATE TYPE "EmployeePerformanceGoalStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "EmployeePerformanceReviewStatus" AS ENUM ('DRAFT', 'SHARED', 'CONTEXT_REQUESTED', 'ACKNOWLEDGED', 'CLOSED');

CREATE TABLE "EmployeePerformanceGoal" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "createdById" TEXT NOT NULL,
  "title" TEXT NOT NULL, "description" TEXT, "metric" TEXT NOT NULL, "unit" TEXT NOT NULL,
  "targetValue" DOUBLE PRECISION NOT NULL, "currentValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "dueAt" TIMESTAMP(3) NOT NULL, "status" "EmployeePerformanceGoalStatus" NOT NULL DEFAULT 'ACTIVE',
  "completedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeePerformanceGoal_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "EmployeePerformanceReview" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "reviewerId" TEXT NOT NULL, "closedById" TEXT,
  "periodStart" TIMESTAMP(3) NOT NULL, "periodEnd" TIMESTAMP(3) NOT NULL,
  "status" "EmployeePerformanceReviewStatus" NOT NULL DEFAULT 'DRAFT', "evidenceSnapshot" JSONB NOT NULL,
  "managerNarrative" TEXT NOT NULL, "strengths" TEXT, "supportNeeds" TEXT, "employeeComment" TEXT, "managerResponse" TEXT,
  "sharedAt" TIMESTAMP(3), "respondedAt" TIMESTAMP(3), "acknowledgedAt" TIMESTAMP(3), "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeePerformanceReview_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EmployeePerformanceGoal_organizationId_status_dueAt_idx" ON "EmployeePerformanceGoal"("organizationId", "status", "dueAt");
CREATE INDEX "EmployeePerformanceGoal_employeeId_status_dueAt_idx" ON "EmployeePerformanceGoal"("employeeId", "status", "dueAt");
CREATE INDEX "EmployeePerformanceReview_organizationId_status_periodEnd_idx" ON "EmployeePerformanceReview"("organizationId", "status", "periodEnd");
CREATE INDEX "EmployeePerformanceReview_employeeId_status_periodEnd_idx" ON "EmployeePerformanceReview"("employeeId", "status", "periodEnd");
CREATE INDEX "EmployeePerformanceReview_reviewerId_status_idx" ON "EmployeePerformanceReview"("reviewerId", "status");
ALTER TABLE "EmployeePerformanceGoal" ADD CONSTRAINT "EmployeePerformanceGoal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeePerformanceGoal" ADD CONSTRAINT "EmployeePerformanceGoal_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeePerformanceGoal" ADD CONSTRAINT "EmployeePerformanceGoal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeePerformanceReview" ADD CONSTRAINT "EmployeePerformanceReview_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeePerformanceReview" ADD CONSTRAINT "EmployeePerformanceReview_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeePerformanceReview" ADD CONSTRAINT "EmployeePerformanceReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeePerformanceReview" ADD CONSTRAINT "EmployeePerformanceReview_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "RolePermission" ("id", "role", "permission", "createdAt") VALUES
  ('rp_super_admin_manage_employee_performance', 'SUPER_ADMIN', 'MANAGE_EMPLOYEE_PERFORMANCE', CURRENT_TIMESTAMP),
  ('rp_org_admin_manage_employee_performance', 'ORG_ADMIN', 'MANAGE_EMPLOYEE_PERFORMANCE', CURRENT_TIMESTAMP),
  ('rp_ehs_manager_manage_employee_performance', 'EHS_MANAGER', 'MANAGE_EMPLOYEE_PERFORMANCE', CURRENT_TIMESTAMP),
  ('rp_supervisor_manage_employee_performance', 'SUPERVISOR', 'MANAGE_EMPLOYEE_PERFORMANCE', CURRENT_TIMESTAMP)
ON CONFLICT ("role", "permission") DO NOTHING;
