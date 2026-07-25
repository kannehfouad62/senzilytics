CREATE TYPE "TenantOnboardingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'READY_FOR_REVIEW', 'LIVE');
CREATE TYPE "TenantOnboardingStepKey" AS ENUM ('DOMAIN_AND_AUTH', 'ORGANIZATION_STRUCTURE', 'SSO_CONFIGURATION', 'USER_ACCESS', 'GOVERNANCE_FOUNDATION', 'DATA_FOUNDATION', 'WORKFLOW_VALIDATION', 'MOBILE_READINESS', 'GO_LIVE_APPROVAL');
CREATE TYPE "TenantOnboardingStepStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'WAIVED');
CREATE TYPE "ScheduledJobRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

CREATE TABLE "TenantOnboardingPlan" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "status" "TenantOnboardingStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "targetGoLiveAt" TIMESTAMP(3),
  "customerOwnerId" TEXT,
  "platformOwnerName" TEXT,
  "platformOwnerEmail" TEXT,
  "tenantVisibleNotes" TEXT,
  "internalNotes" TEXT,
  "startedAt" TIMESTAMP(3),
  "readyForReviewAt" TIMESTAMP(3),
  "goLiveApprovedAt" TIMESTAMP(3),
  "goLiveApprovedById" TEXT,
  "liveAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TenantOnboardingPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TenantOnboardingStep" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "key" "TenantOnboardingStepKey" NOT NULL,
  "status" "TenantOnboardingStepStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "ownerId" TEXT,
  "dueAt" TIMESTAMP(3),
  "tenantNotes" TEXT,
  "blocker" TEXT,
  "completedAt" TIMESTAMP(3),
  "completedById" TEXT,
  "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TenantOnboardingStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScheduledJobRun" (
  "id" TEXT NOT NULL,
  "jobKey" TEXT NOT NULL,
  "status" "ScheduledJobRunStatus" NOT NULL DEFAULT 'RUNNING',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "durationMs" INTEGER,
  "summary" JSONB,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScheduledJobRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantOnboardingPlan_organizationId_key" ON "TenantOnboardingPlan"("organizationId");
CREATE INDEX "TenantOnboardingPlan_status_targetGoLiveAt_idx" ON "TenantOnboardingPlan"("status", "targetGoLiveAt");
CREATE UNIQUE INDEX "TenantOnboardingStep_planId_key_key" ON "TenantOnboardingStep"("planId", "key");
CREATE INDEX "TenantOnboardingStep_status_dueAt_idx" ON "TenantOnboardingStep"("status", "dueAt");
CREATE INDEX "TenantOnboardingStep_ownerId_status_idx" ON "TenantOnboardingStep"("ownerId", "status");
CREATE INDEX "ScheduledJobRun_jobKey_startedAt_idx" ON "ScheduledJobRun"("jobKey", "startedAt");
CREATE INDEX "ScheduledJobRun_status_startedAt_idx" ON "ScheduledJobRun"("status", "startedAt");

ALTER TABLE "TenantOnboardingPlan" ADD CONSTRAINT "TenantOnboardingPlan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantOnboardingPlan" ADD CONSTRAINT "TenantOnboardingPlan_customerOwnerId_fkey" FOREIGN KEY ("customerOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TenantOnboardingPlan" ADD CONSTRAINT "TenantOnboardingPlan_goLiveApprovedById_fkey" FOREIGN KEY ("goLiveApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TenantOnboardingStep" ADD CONSTRAINT "TenantOnboardingStep_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TenantOnboardingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantOnboardingStep" ADD CONSTRAINT "TenantOnboardingStep_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TenantOnboardingStep" ADD CONSTRAINT "TenantOnboardingStep_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TenantOnboardingStep" ADD CONSTRAINT "TenantOnboardingStep_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
