-- CreateEnum
CREATE TYPE "PredictiveSignalCategory" AS ENUM ('INCIDENT_TREND', 'AT_RISK_OBSERVATION_TREND', 'OVERDUE_ACTION_EXPOSURE', 'CRITICAL_CONTROL_WEAKNESS', 'AUDIT_FINDING_PRESSURE', 'TRAINING_COMPLIANCE_GAP');
CREATE TYPE "PredictiveSignalStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'MONITORING', 'RESOLVED', 'DISMISSED');
CREATE TYPE "PredictiveSignalDirection" AS ENUM ('IMPROVING', 'STABLE', 'DETERIORATING');
CREATE TYPE "PredictiveIntelligenceRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "PredictiveSignalReviewDecision" AS ENUM ('ACKNOWLEDGE', 'MONITOR', 'RESOLVE', 'DISMISS');

-- AlterEnum
ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'VIEW_PREDICTIVE_INTELLIGENCE';
ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'MANAGE_PREDICTIVE_INTELLIGENCE';

-- CreateTable
CREATE TABLE "PredictiveIntelligencePolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lookbackDays" INTEGER NOT NULL DEFAULT 90,
    "minimumEventCount" INTEGER NOT NULL DEFAULT 3,
    "deteriorationThresholdPercent" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "overdueActionThreshold" INTEGER NOT NULL DEFAULT 3,
    "controlFailureThreshold" INTEGER NOT NULL DEFAULT 2,
    "reviewCadenceDays" INTEGER NOT NULL DEFAULT 14,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PredictiveIntelligencePolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PredictiveIntelligenceRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "policyId" TEXT,
    "requestedById" TEXT,
    "status" "PredictiveIntelligenceRunStatus" NOT NULL DEFAULT 'RUNNING',
    "algorithmVersion" TEXT NOT NULL DEFAULT 'PRI-1.0',
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "comparisonStart" TIMESTAMP(3) NOT NULL,
    "comparisonEnd" TIMESTAMP(3) NOT NULL,
    "dataQualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sourceCounts" JSONB,
    "signalsDetected" INTEGER NOT NULL DEFAULT 0,
    "signalsRefreshed" INTEGER NOT NULL DEFAULT 0,
    "conditionsCleared" INTEGER NOT NULL DEFAULT 0,
    "failureReason" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PredictiveIntelligenceRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PredictiveSignal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "siteId" TEXT,
    "departmentId" TEXT,
    "ownerId" TEXT,
    "reviewerId" TEXT,
    "fingerprint" TEXT NOT NULL,
    "category" "PredictiveSignalCategory" NOT NULL,
    "severity" "RiskLevel" NOT NULL,
    "direction" "PredictiveSignalDirection" NOT NULL,
    "status" "PredictiveSignalStatus" NOT NULL DEFAULT 'OPEN',
    "conditionActive" BOOLEAN NOT NULL DEFAULT true,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "recommendedAction" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL,
    "baselineValue" DOUBLE PRECISION NOT NULL,
    "changePercent" DOUBLE PRECISION,
    "thresholdValue" DOUBLE PRECISION NOT NULL,
    "attentionScore" DOUBLE PRECISION NOT NULL,
    "dataQualityScore" DOUBLE PRECISION NOT NULL,
    "firstDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewDueAt" TIMESTAMP(3) NOT NULL,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PredictiveSignal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PredictiveSignalReview" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "signalId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "decision" "PredictiveSignalReviewDecision" NOT NULL,
    "rationale" TEXT NOT NULL,
    "statusBefore" "PredictiveSignalStatus" NOT NULL,
    "statusAfter" "PredictiveSignalStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PredictiveSignalReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PredictiveIntelligencePolicy_organizationId_key" ON "PredictiveIntelligencePolicy"("organizationId");
CREATE INDEX "PredictiveIntelligencePolicy_isActive_nextRunAt_idx" ON "PredictiveIntelligencePolicy"("isActive", "nextRunAt");
CREATE INDEX "PredictiveIntelligenceRun_organizationId_createdAt_idx" ON "PredictiveIntelligenceRun"("organizationId", "createdAt");
CREATE INDEX "PredictiveIntelligenceRun_organizationId_status_idx" ON "PredictiveIntelligenceRun"("organizationId", "status");
CREATE UNIQUE INDEX "PredictiveSignal_organizationId_fingerprint_key" ON "PredictiveSignal"("organizationId", "fingerprint");
CREATE INDEX "PredictiveSignal_organizationId_conditionActive_severity_idx" ON "PredictiveSignal"("organizationId", "conditionActive", "severity");
CREATE INDEX "PredictiveSignal_organizationId_status_reviewDueAt_idx" ON "PredictiveSignal"("organizationId", "status", "reviewDueAt");
CREATE INDEX "PredictiveSignal_siteId_conditionActive_idx" ON "PredictiveSignal"("siteId", "conditionActive");
CREATE INDEX "PredictiveSignal_ownerId_status_idx" ON "PredictiveSignal"("ownerId", "status");
CREATE INDEX "PredictiveSignalReview_organizationId_createdAt_idx" ON "PredictiveSignalReview"("organizationId", "createdAt");
CREATE INDEX "PredictiveSignalReview_signalId_createdAt_idx" ON "PredictiveSignalReview"("signalId", "createdAt");
CREATE INDEX "PredictiveSignalReview_reviewerId_createdAt_idx" ON "PredictiveSignalReview"("reviewerId", "createdAt");

-- AddForeignKey
ALTER TABLE "PredictiveIntelligencePolicy" ADD CONSTRAINT "PredictiveIntelligencePolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PredictiveIntelligenceRun" ADD CONSTRAINT "PredictiveIntelligenceRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PredictiveIntelligenceRun" ADD CONSTRAINT "PredictiveIntelligenceRun_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "PredictiveIntelligencePolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PredictiveIntelligenceRun" ADD CONSTRAINT "PredictiveIntelligenceRun_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PredictiveSignal" ADD CONSTRAINT "PredictiveSignal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PredictiveSignal" ADD CONSTRAINT "PredictiveSignal_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PredictiveIntelligenceRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PredictiveSignal" ADD CONSTRAINT "PredictiveSignal_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PredictiveSignal" ADD CONSTRAINT "PredictiveSignal_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PredictiveSignal" ADD CONSTRAINT "PredictiveSignal_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PredictiveSignal" ADD CONSTRAINT "PredictiveSignal_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PredictiveSignalReview" ADD CONSTRAINT "PredictiveSignalReview_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PredictiveSignalReview" ADD CONSTRAINT "PredictiveSignalReview_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "PredictiveSignal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PredictiveSignalReview" ADD CONSTRAINT "PredictiveSignalReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Grant role defaults
INSERT INTO "RolePermission" ("id", "role", "permission", "createdAt") VALUES
  ('rp_super_admin_view_predictive', 'SUPER_ADMIN', 'VIEW_PREDICTIVE_INTELLIGENCE', CURRENT_TIMESTAMP),
  ('rp_super_admin_manage_predictive', 'SUPER_ADMIN', 'MANAGE_PREDICTIVE_INTELLIGENCE', CURRENT_TIMESTAMP),
  ('rp_org_admin_view_predictive', 'ORG_ADMIN', 'VIEW_PREDICTIVE_INTELLIGENCE', CURRENT_TIMESTAMP),
  ('rp_org_admin_manage_predictive', 'ORG_ADMIN', 'MANAGE_PREDICTIVE_INTELLIGENCE', CURRENT_TIMESTAMP),
  ('rp_ehs_manager_view_predictive', 'EHS_MANAGER', 'VIEW_PREDICTIVE_INTELLIGENCE', CURRENT_TIMESTAMP),
  ('rp_ehs_manager_manage_predictive', 'EHS_MANAGER', 'MANAGE_PREDICTIVE_INTELLIGENCE', CURRENT_TIMESTAMP),
  ('rp_supervisor_view_predictive', 'SUPERVISOR', 'VIEW_PREDICTIVE_INTELLIGENCE', CURRENT_TIMESTAMP),
  ('rp_auditor_view_predictive', 'AUDITOR', 'VIEW_PREDICTIVE_INTELLIGENCE', CURRENT_TIMESTAMP),
  ('rp_demo_view_predictive', 'DEMO_VIEWER', 'VIEW_PREDICTIVE_INTELLIGENCE', CURRENT_TIMESTAMP)
ON CONFLICT ("role", "permission") DO NOTHING;
