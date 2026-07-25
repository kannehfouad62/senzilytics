-- CreateEnum
CREATE TYPE "ContinuityPlanType" AS ENUM ('ORGANIZATION', 'SITE', 'DEPARTMENT', 'PROCESS', 'TECHNOLOGY', 'SUPPLY_CHAIN', 'OTHER');

-- CreateEnum
CREATE TYPE "ContinuityPlanStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'ACTIVE', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ContinuityCriticality" AS ENUM ('TIER_0_CRITICAL', 'TIER_1_HIGH', 'TIER_2_MEDIUM', 'TIER_3_LOW');

-- CreateEnum
CREATE TYPE "ContinuityDependencyType" AS ENUM ('PEOPLE', 'FACILITY', 'TECHNOLOGY', 'DATA', 'SUPPLIER', 'UTILITY', 'EQUIPMENT', 'COMMUNICATION', 'TRANSPORTATION', 'OTHER');

-- CreateEnum
CREATE TYPE "ContinuityExerciseType" AS ENUM ('TABLETOP', 'CALL_TREE', 'FUNCTIONAL', 'FAILOVER', 'FULL_SCALE');

-- CreateEnum
CREATE TYPE "ContinuityExerciseStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ContinuityExerciseResult" AS ENUM ('MET_OBJECTIVES', 'PARTIALLY_MET', 'NOT_MET');

-- CreateEnum
CREATE TYPE "ContinuityDisruptionCategory" AS ENUM ('TECHNOLOGY', 'FACILITY', 'PEOPLE', 'SUPPLIER', 'UTILITY', 'CYBER', 'TRANSPORTATION', 'ENVIRONMENTAL', 'SECURITY', 'OTHER');

-- CreateEnum
CREATE TYPE "ContinuityActivationStatus" AS ENUM ('ACTIVE', 'RECOVERING', 'RESTORED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ContinuityImprovementStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'VIEW_BUSINESS_CONTINUITY';
ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'MANAGE_BUSINESS_CONTINUITY';
ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'RECORD_CONTINUITY_EVENT';

-- AlterEnum
ALTER TYPE "ConfigurableFormModule" ADD VALUE IF NOT EXISTS 'BUSINESS_CONTINUITY';

-- AlterEnum
ALTER TYPE "DocumentEntityType" ADD VALUE IF NOT EXISTS 'BUSINESS_CONTINUITY';

-- CreateTable
CREATE TABLE "BusinessContinuityPlan" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "siteId" TEXT,
    "departmentId" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "submittedById" TEXT,
    "approvedById" TEXT,
    "previousVersionId" TEXT,
    "reference" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "type" "ContinuityPlanType" NOT NULL,
    "status" "ContinuityPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "scope" TEXT NOT NULL,
    "criticalActivitiesSummary" TEXT NOT NULL,
    "activationCriteria" TEXT NOT NULL,
    "governanceStructure" TEXT NOT NULL,
    "communicationStrategy" TEXT NOT NULL,
    "alternateWorkStrategy" TEXT NOT NULL,
    "technologyRecoveryStrategy" TEXT NOT NULL,
    "supplierContinuityStrategy" TEXT,
    "manualWorkarounds" TEXT NOT NULL,
    "recoveryPriorities" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3),
    "reviewDueAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "reviewReminderAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessContinuityPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessImpactAnalysis" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "processName" TEXT NOT NULL,
    "criticality" "ContinuityCriticality" NOT NULL,
    "description" TEXT NOT NULL,
    "maximumTolerableDowntimeHours" INTEGER NOT NULL,
    "recoveryTimeObjectiveHours" INTEGER NOT NULL,
    "recoveryPointObjectiveHours" INTEGER NOT NULL,
    "minimumStaff" INTEGER NOT NULL DEFAULT 1,
    "peakPeriods" TEXT,
    "operationalImpact" TEXT NOT NULL,
    "financialImpact" TEXT,
    "legalRegulatoryImpact" TEXT,
    "customerStakeholderImpact" TEXT,
    "minimumResources" TEXT NOT NULL,
    "vitalRecords" TEXT,
    "recoveryStrategy" TEXT NOT NULL,
    "workaroundProcedure" TEXT NOT NULL,
    "reviewDueAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "reviewReminderAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessImpactAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContinuityDependency" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "type" "ContinuityDependencyType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "provider" TEXT,
    "contactDetails" TEXT,
    "recoveryLeadTimeHours" INTEGER,
    "fallbackArrangement" TEXT NOT NULL,
    "isSinglePointFailure" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContinuityDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContinuityExercise" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "analysisId" TEXT,
    "leadId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reference" TEXT NOT NULL,
    "type" "ContinuityExerciseType" NOT NULL,
    "status" "ContinuityExerciseStatus" NOT NULL DEFAULT 'PLANNED',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "objectives" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "expectedParticipants" INTEGER NOT NULL DEFAULT 1,
    "actualParticipants" INTEGER,
    "targetRecoveryTimeHours" INTEGER,
    "actualRecoveryTimeHours" INTEGER,
    "targetRecoveryPointHours" INTEGER,
    "actualRecoveryPointHours" INTEGER,
    "result" "ContinuityExerciseResult",
    "strengths" TEXT,
    "gaps" TEXT,
    "afterActionSummary" TEXT,
    "cancelledReason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContinuityExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContinuityActivation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "emergencyActivationId" TEXT,
    "declaredById" TEXT NOT NULL,
    "coordinatorId" TEXT NOT NULL,
    "restoredById" TEXT,
    "closedById" TEXT,
    "reference" TEXT NOT NULL,
    "category" "ContinuityDisruptionCategory" NOT NULL,
    "severity" "RiskLevel" NOT NULL,
    "status" "ContinuityActivationStatus" NOT NULL DEFAULT 'ACTIVE',
    "title" TEXT NOT NULL,
    "location" TEXT,
    "disruptionSummary" TEXT NOT NULL,
    "impactedProcesses" TEXT NOT NULL,
    "activationRationale" TEXT NOT NULL,
    "recoveryActions" TEXT NOT NULL,
    "stakeholderCommunication" TEXT NOT NULL,
    "workaroundStatus" TEXT,
    "declaredAt" TIMESTAMP(3) NOT NULL,
    "expectedRecoveryAt" TIMESTAMP(3) NOT NULL,
    "restoredAt" TIMESTAMP(3),
    "restorationEvidence" TEXT,
    "closedAt" TIMESTAMP(3),
    "closureSummary" TEXT,
    "afterActionDueAt" TIMESTAMP(3) NOT NULL,
    "lessonsLearned" TEXT,
    "estimatedDowntimeHours" INTEGER,
    "actualDowntimeHours" INTEGER,
    "reminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContinuityActivation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContinuityImprovement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "exerciseId" TEXT,
    "activationId" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "verifiedById" TEXT,
    "correctiveActionId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "RiskLevel" NOT NULL,
    "status" "ContinuityImprovementStatus" NOT NULL DEFAULT 'OPEN',
    "dueAt" TIMESTAMP(3) NOT NULL,
    "completionEvidence" TEXT,
    "verificationNotes" TEXT,
    "completedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContinuityImprovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessContinuityPlan_previousVersionId_key" ON "BusinessContinuityPlan"("previousVersionId");

-- CreateIndex
CREATE INDEX "BusinessContinuityPlan_organizationId_status_reviewDueAt_idx" ON "BusinessContinuityPlan"("organizationId", "status", "reviewDueAt");

-- CreateIndex
CREATE INDEX "BusinessContinuityPlan_siteId_status_idx" ON "BusinessContinuityPlan"("siteId", "status");

-- CreateIndex
CREATE INDEX "BusinessContinuityPlan_ownerId_status_idx" ON "BusinessContinuityPlan"("ownerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessContinuityPlan_organizationId_reference_version_key" ON "BusinessContinuityPlan"("organizationId", "reference", "version");

-- CreateIndex
CREATE INDEX "BusinessImpactAnalysis_organizationId_criticality_reviewDue_idx" ON "BusinessImpactAnalysis"("organizationId", "criticality", "reviewDueAt");

-- CreateIndex
CREATE INDEX "BusinessImpactAnalysis_planId_isActive_idx" ON "BusinessImpactAnalysis"("planId", "isActive");

-- CreateIndex
CREATE INDEX "BusinessImpactAnalysis_ownerId_reviewDueAt_idx" ON "BusinessImpactAnalysis"("ownerId", "reviewDueAt");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessImpactAnalysis_organizationId_reference_key" ON "BusinessImpactAnalysis"("organizationId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessImpactAnalysis_planId_processName_key" ON "BusinessImpactAnalysis"("planId", "processName");

-- CreateIndex
CREATE INDEX "ContinuityDependency_organizationId_type_isSinglePointFailu_idx" ON "ContinuityDependency"("organizationId", "type", "isSinglePointFailure");

-- CreateIndex
CREATE INDEX "ContinuityDependency_analysisId_isActive_idx" ON "ContinuityDependency"("analysisId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ContinuityDependency_analysisId_type_name_key" ON "ContinuityDependency"("analysisId", "type", "name");

-- CreateIndex
CREATE INDEX "ContinuityExercise_organizationId_status_scheduledAt_idx" ON "ContinuityExercise"("organizationId", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "ContinuityExercise_planId_scheduledAt_idx" ON "ContinuityExercise"("planId", "scheduledAt");

-- CreateIndex
CREATE INDEX "ContinuityExercise_analysisId_scheduledAt_idx" ON "ContinuityExercise"("analysisId", "scheduledAt");

-- CreateIndex
CREATE INDEX "ContinuityExercise_leadId_status_idx" ON "ContinuityExercise"("leadId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ContinuityExercise_organizationId_reference_key" ON "ContinuityExercise"("organizationId", "reference");

-- CreateIndex
CREATE INDEX "ContinuityActivation_organizationId_status_declaredAt_idx" ON "ContinuityActivation"("organizationId", "status", "declaredAt");

-- CreateIndex
CREATE INDEX "ContinuityActivation_planId_declaredAt_idx" ON "ContinuityActivation"("planId", "declaredAt");

-- CreateIndex
CREATE INDEX "ContinuityActivation_coordinatorId_status_idx" ON "ContinuityActivation"("coordinatorId", "status");

-- CreateIndex
CREATE INDEX "ContinuityActivation_organizationId_afterActionDueAt_status_idx" ON "ContinuityActivation"("organizationId", "afterActionDueAt", "status");

-- CreateIndex
CREATE INDEX "ContinuityActivation_emergencyActivationId_idx" ON "ContinuityActivation"("emergencyActivationId");

-- CreateIndex
CREATE UNIQUE INDEX "ContinuityActivation_organizationId_reference_key" ON "ContinuityActivation"("organizationId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "ContinuityImprovement_correctiveActionId_key" ON "ContinuityImprovement"("correctiveActionId");

-- CreateIndex
CREATE INDEX "ContinuityImprovement_organizationId_status_dueAt_idx" ON "ContinuityImprovement"("organizationId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "ContinuityImprovement_planId_status_idx" ON "ContinuityImprovement"("planId", "status");

-- CreateIndex
CREATE INDEX "ContinuityImprovement_exerciseId_status_idx" ON "ContinuityImprovement"("exerciseId", "status");

-- CreateIndex
CREATE INDEX "ContinuityImprovement_activationId_status_idx" ON "ContinuityImprovement"("activationId", "status");

-- CreateIndex
CREATE INDEX "ContinuityImprovement_ownerId_status_idx" ON "ContinuityImprovement"("ownerId", "status");

-- AddForeignKey
ALTER TABLE "BusinessContinuityPlan" ADD CONSTRAINT "BusinessContinuityPlan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessContinuityPlan" ADD CONSTRAINT "BusinessContinuityPlan_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessContinuityPlan" ADD CONSTRAINT "BusinessContinuityPlan_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessContinuityPlan" ADD CONSTRAINT "BusinessContinuityPlan_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessContinuityPlan" ADD CONSTRAINT "BusinessContinuityPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessContinuityPlan" ADD CONSTRAINT "BusinessContinuityPlan_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessContinuityPlan" ADD CONSTRAINT "BusinessContinuityPlan_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessContinuityPlan" ADD CONSTRAINT "BusinessContinuityPlan_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "BusinessContinuityPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessImpactAnalysis" ADD CONSTRAINT "BusinessImpactAnalysis_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessImpactAnalysis" ADD CONSTRAINT "BusinessImpactAnalysis_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BusinessContinuityPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessImpactAnalysis" ADD CONSTRAINT "BusinessImpactAnalysis_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityDependency" ADD CONSTRAINT "ContinuityDependency_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityDependency" ADD CONSTRAINT "ContinuityDependency_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "BusinessImpactAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityExercise" ADD CONSTRAINT "ContinuityExercise_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityExercise" ADD CONSTRAINT "ContinuityExercise_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BusinessContinuityPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityExercise" ADD CONSTRAINT "ContinuityExercise_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "BusinessImpactAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityExercise" ADD CONSTRAINT "ContinuityExercise_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityExercise" ADD CONSTRAINT "ContinuityExercise_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityExercise" ADD CONSTRAINT "ContinuityExercise_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityActivation" ADD CONSTRAINT "ContinuityActivation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityActivation" ADD CONSTRAINT "ContinuityActivation_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BusinessContinuityPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityActivation" ADD CONSTRAINT "ContinuityActivation_emergencyActivationId_fkey" FOREIGN KEY ("emergencyActivationId") REFERENCES "EmergencyActivation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityActivation" ADD CONSTRAINT "ContinuityActivation_declaredById_fkey" FOREIGN KEY ("declaredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityActivation" ADD CONSTRAINT "ContinuityActivation_coordinatorId_fkey" FOREIGN KEY ("coordinatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityActivation" ADD CONSTRAINT "ContinuityActivation_restoredById_fkey" FOREIGN KEY ("restoredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityActivation" ADD CONSTRAINT "ContinuityActivation_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityImprovement" ADD CONSTRAINT "ContinuityImprovement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityImprovement" ADD CONSTRAINT "ContinuityImprovement_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BusinessContinuityPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityImprovement" ADD CONSTRAINT "ContinuityImprovement_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "ContinuityExercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityImprovement" ADD CONSTRAINT "ContinuityImprovement_activationId_fkey" FOREIGN KEY ("activationId") REFERENCES "ContinuityActivation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityImprovement" ADD CONSTRAINT "ContinuityImprovement_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityImprovement" ADD CONSTRAINT "ContinuityImprovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityImprovement" ADD CONSTRAINT "ContinuityImprovement_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityImprovement" ADD CONSTRAINT "ContinuityImprovement_correctiveActionId_fkey" FOREIGN KEY ("correctiveActionId") REFERENCES "CorrectiveAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BusinessContinuityPlan"
  ADD CONSTRAINT "BusinessContinuityPlan_version_check" CHECK ("version" > 0);

ALTER TABLE "BusinessImpactAnalysis"
  ADD CONSTRAINT "BusinessImpactAnalysis_recovery_objectives_check"
  CHECK (
    "maximumTolerableDowntimeHours" > 0
    AND "recoveryTimeObjectiveHours" >= 0
    AND "recoveryTimeObjectiveHours" <= "maximumTolerableDowntimeHours"
    AND "recoveryPointObjectiveHours" >= 0
    AND "recoveryPointObjectiveHours" <= "recoveryTimeObjectiveHours"
    AND "minimumStaff" >= 1
  );

ALTER TABLE "ContinuityDependency"
  ADD CONSTRAINT "ContinuityDependency_recoveryLeadTimeHours_check"
  CHECK ("recoveryLeadTimeHours" IS NULL OR "recoveryLeadTimeHours" >= 0);

ALTER TABLE "ContinuityExercise"
  ADD CONSTRAINT "ContinuityExercise_metrics_check"
  CHECK (
    "expectedParticipants" >= 1
    AND ("actualParticipants" IS NULL OR "actualParticipants" >= 0)
    AND ("targetRecoveryTimeHours" IS NULL OR "targetRecoveryTimeHours" >= 0)
    AND ("actualRecoveryTimeHours" IS NULL OR "actualRecoveryTimeHours" >= 0)
    AND ("targetRecoveryPointHours" IS NULL OR "targetRecoveryPointHours" >= 0)
    AND ("actualRecoveryPointHours" IS NULL OR "actualRecoveryPointHours" >= 0)
  );

ALTER TABLE "ContinuityActivation"
  ADD CONSTRAINT "ContinuityActivation_downtime_check"
  CHECK (
    ("estimatedDowntimeHours" IS NULL OR "estimatedDowntimeHours" >= 0)
    AND ("actualDowntimeHours" IS NULL OR "actualDowntimeHours" >= 0)
  );

INSERT INTO "RolePermission" ("id", "role", "permission", "createdAt") VALUES
  ('rp_super_admin_view_continuity', 'SUPER_ADMIN', 'VIEW_BUSINESS_CONTINUITY', CURRENT_TIMESTAMP),
  ('rp_super_admin_manage_continuity', 'SUPER_ADMIN', 'MANAGE_BUSINESS_CONTINUITY', CURRENT_TIMESTAMP),
  ('rp_super_admin_record_continuity', 'SUPER_ADMIN', 'RECORD_CONTINUITY_EVENT', CURRENT_TIMESTAMP),
  ('rp_org_admin_view_continuity', 'ORG_ADMIN', 'VIEW_BUSINESS_CONTINUITY', CURRENT_TIMESTAMP),
  ('rp_org_admin_manage_continuity', 'ORG_ADMIN', 'MANAGE_BUSINESS_CONTINUITY', CURRENT_TIMESTAMP),
  ('rp_org_admin_record_continuity', 'ORG_ADMIN', 'RECORD_CONTINUITY_EVENT', CURRENT_TIMESTAMP),
  ('rp_ehs_manager_view_continuity', 'EHS_MANAGER', 'VIEW_BUSINESS_CONTINUITY', CURRENT_TIMESTAMP),
  ('rp_ehs_manager_manage_continuity', 'EHS_MANAGER', 'MANAGE_BUSINESS_CONTINUITY', CURRENT_TIMESTAMP),
  ('rp_ehs_manager_record_continuity', 'EHS_MANAGER', 'RECORD_CONTINUITY_EVENT', CURRENT_TIMESTAMP),
  ('rp_supervisor_view_continuity', 'SUPERVISOR', 'VIEW_BUSINESS_CONTINUITY', CURRENT_TIMESTAMP),
  ('rp_supervisor_record_continuity', 'SUPERVISOR', 'RECORD_CONTINUITY_EVENT', CURRENT_TIMESTAMP),
  ('rp_employee_view_continuity', 'EMPLOYEE', 'VIEW_BUSINESS_CONTINUITY', CURRENT_TIMESTAMP),
  ('rp_auditor_view_continuity', 'AUDITOR', 'VIEW_BUSINESS_CONTINUITY', CURRENT_TIMESTAMP),
  ('rp_demo_view_continuity', 'DEMO_VIEWER', 'VIEW_BUSINESS_CONTINUITY', CURRENT_TIMESTAMP)
ON CONFLICT ("role", "permission") DO NOTHING;
