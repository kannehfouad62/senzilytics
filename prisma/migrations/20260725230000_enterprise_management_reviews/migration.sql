-- CreateEnum
CREATE TYPE "ExecutiveReviewFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL', 'AD_HOC');
CREATE TYPE "ExecutiveReviewStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'APPROVED', 'PUBLISHED', 'CANCELLED', 'ARCHIVED');
CREATE TYPE "ExecutiveReviewAgendaStatus" AS ENUM ('PENDING', 'READY', 'PRESENTED', 'DEFERRED', 'CLOSED');
CREATE TYPE "ExecutiveReviewAttendanceRole" AS ENUM ('CHAIR', 'APPROVER', 'PRESENTER', 'ATTENDEE', 'OBSERVER');
CREATE TYPE "ExecutiveReviewDecisionType" AS ENUM ('ACTION_REQUIRED', 'ESCALATE', 'INVESTIGATE', 'RESOURCE_ALLOCATION', 'POLICY_CHANGE', 'ACCEPT_RISK', 'NOTE');
CREATE TYPE "ExecutiveReviewDecisionStatus" AS ENUM ('OPEN', 'ACTION_LINKED', 'IMPLEMENTED', 'CLOSED', 'CANCELLED');
CREATE TYPE "ExecutiveReviewConclusion" AS ENUM ('EFFECTIVE', 'EFFECTIVE_WITH_CONCERNS', 'NEEDS_IMPROVEMENT', 'CRITICAL_INTERVENTION');

-- AlterEnum
ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'VIEW_EXECUTIVE_REVIEWS';
ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'MANAGE_EXECUTIVE_REVIEWS';
ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'APPROVE_EXECUTIVE_REVIEWS';

-- CreateTable
CREATE TABLE "ExecutiveManagementReview" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "siteId" TEXT,
    "chairId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "completedById" TEXT,
    "approvedById" TEXT,
    "publishedById" TEXT,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "frequency" "ExecutiveReviewFrequency" NOT NULL,
    "status" "ExecutiveReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT NOT NULL,
    "objectives" TEXT NOT NULL,
    "sourceModules" TEXT[],
    "snapshotVersion" TEXT,
    "evidenceSnapshot" JSONB,
    "snapshotGeneratedAt" TIMESTAMP(3),
    "dataQualityScore" DOUBLE PRECISION,
    "executiveSummary" TEXT,
    "performanceConclusion" TEXT,
    "riskControlConclusion" TEXT,
    "complianceConclusion" TEXT,
    "resourceAdequacy" TEXT,
    "significantChanges" TEXT,
    "decisionsSummary" TEXT,
    "overallConclusion" "ExecutiveReviewConclusion",
    "nextReviewAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "overdueNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExecutiveManagementReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExecutiveReviewAgendaItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "ownerId" TEXT,
    "position" INTEGER NOT NULL,
    "topic" TEXT NOT NULL,
    "sourceModule" TEXT NOT NULL,
    "sourceHref" TEXT,
    "reviewPrompt" TEXT NOT NULL,
    "status" "ExecutiveReviewAgendaStatus" NOT NULL DEFAULT 'PENDING',
    "evidenceSnapshot" JSONB,
    "discussion" TEXT,
    "conclusion" TEXT,
    "presentedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExecutiveReviewAgendaItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExecutiveReviewAttendee" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ExecutiveReviewAttendanceRole" NOT NULL DEFAULT 'ATTENDEE',
    "attended" BOOLEAN NOT NULL DEFAULT false,
    "attendanceNote" TEXT,
    "attendedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExecutiveReviewAttendee_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExecutiveReviewDecision" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "agendaItemId" TEXT,
    "ownerId" TEXT,
    "closedById" TEXT,
    "correctiveActionId" TEXT,
    "type" "ExecutiveReviewDecisionType" NOT NULL,
    "status" "ExecutiveReviewDecisionStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "expectedOutcome" TEXT,
    "priority" "RiskLevel" NOT NULL DEFAULT 'MEDIUM',
    "dueAt" TIMESTAMP(3),
    "implementedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closureEvidence" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExecutiveReviewDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExecutiveManagementReview_organizationId_reference_key" ON "ExecutiveManagementReview"("organizationId", "reference");
CREATE INDEX "ExecutiveManagementReview_organizationId_status_scheduledAt_idx" ON "ExecutiveManagementReview"("organizationId", "status", "scheduledAt");
CREATE INDEX "ExecutiveManagementReview_organizationId_periodEnd_idx" ON "ExecutiveManagementReview"("organizationId", "periodEnd");
CREATE INDEX "ExecutiveManagementReview_siteId_status_idx" ON "ExecutiveManagementReview"("siteId", "status");
CREATE INDEX "ExecutiveManagementReview_chairId_status_idx" ON "ExecutiveManagementReview"("chairId", "status");
CREATE UNIQUE INDEX "ExecutiveReviewAgendaItem_reviewId_position_key" ON "ExecutiveReviewAgendaItem"("reviewId", "position");
CREATE INDEX "ExecutiveReviewAgendaItem_organizationId_status_idx" ON "ExecutiveReviewAgendaItem"("organizationId", "status");
CREATE INDEX "ExecutiveReviewAgendaItem_reviewId_status_idx" ON "ExecutiveReviewAgendaItem"("reviewId", "status");
CREATE INDEX "ExecutiveReviewAgendaItem_ownerId_status_idx" ON "ExecutiveReviewAgendaItem"("ownerId", "status");
CREATE UNIQUE INDEX "ExecutiveReviewAttendee_reviewId_userId_key" ON "ExecutiveReviewAttendee"("reviewId", "userId");
CREATE INDEX "ExecutiveReviewAttendee_organizationId_attended_idx" ON "ExecutiveReviewAttendee"("organizationId", "attended");
CREATE INDEX "ExecutiveReviewAttendee_userId_attended_idx" ON "ExecutiveReviewAttendee"("userId", "attended");
CREATE INDEX "ExecutiveReviewDecision_organizationId_status_dueAt_idx" ON "ExecutiveReviewDecision"("organizationId", "status", "dueAt");
CREATE INDEX "ExecutiveReviewDecision_reviewId_status_idx" ON "ExecutiveReviewDecision"("reviewId", "status");
CREATE INDEX "ExecutiveReviewDecision_agendaItemId_idx" ON "ExecutiveReviewDecision"("agendaItemId");
CREATE INDEX "ExecutiveReviewDecision_ownerId_status_idx" ON "ExecutiveReviewDecision"("ownerId", "status");
CREATE INDEX "ExecutiveReviewDecision_correctiveActionId_idx" ON "ExecutiveReviewDecision"("correctiveActionId");

-- AddForeignKey
ALTER TABLE "ExecutiveManagementReview" ADD CONSTRAINT "ExecutiveManagementReview_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExecutiveManagementReview" ADD CONSTRAINT "ExecutiveManagementReview_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExecutiveManagementReview" ADD CONSTRAINT "ExecutiveManagementReview_chairId_fkey" FOREIGN KEY ("chairId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExecutiveManagementReview" ADD CONSTRAINT "ExecutiveManagementReview_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExecutiveManagementReview" ADD CONSTRAINT "ExecutiveManagementReview_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExecutiveManagementReview" ADD CONSTRAINT "ExecutiveManagementReview_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExecutiveManagementReview" ADD CONSTRAINT "ExecutiveManagementReview_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExecutiveReviewAgendaItem" ADD CONSTRAINT "ExecutiveReviewAgendaItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExecutiveReviewAgendaItem" ADD CONSTRAINT "ExecutiveReviewAgendaItem_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "ExecutiveManagementReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExecutiveReviewAgendaItem" ADD CONSTRAINT "ExecutiveReviewAgendaItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExecutiveReviewAttendee" ADD CONSTRAINT "ExecutiveReviewAttendee_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExecutiveReviewAttendee" ADD CONSTRAINT "ExecutiveReviewAttendee_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "ExecutiveManagementReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExecutiveReviewAttendee" ADD CONSTRAINT "ExecutiveReviewAttendee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExecutiveReviewDecision" ADD CONSTRAINT "ExecutiveReviewDecision_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExecutiveReviewDecision" ADD CONSTRAINT "ExecutiveReviewDecision_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "ExecutiveManagementReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExecutiveReviewDecision" ADD CONSTRAINT "ExecutiveReviewDecision_agendaItemId_fkey" FOREIGN KEY ("agendaItemId") REFERENCES "ExecutiveReviewAgendaItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExecutiveReviewDecision" ADD CONSTRAINT "ExecutiveReviewDecision_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExecutiveReviewDecision" ADD CONSTRAINT "ExecutiveReviewDecision_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExecutiveReviewDecision" ADD CONSTRAINT "ExecutiveReviewDecision_correctiveActionId_fkey" FOREIGN KEY ("correctiveActionId") REFERENCES "CorrectiveAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Grant role defaults
INSERT INTO "RolePermission" ("id", "role", "permission", "createdAt") VALUES
  ('rp_super_admin_view_exec_reviews', 'SUPER_ADMIN', 'VIEW_EXECUTIVE_REVIEWS', CURRENT_TIMESTAMP),
  ('rp_super_admin_manage_exec_reviews', 'SUPER_ADMIN', 'MANAGE_EXECUTIVE_REVIEWS', CURRENT_TIMESTAMP),
  ('rp_super_admin_approve_exec_reviews', 'SUPER_ADMIN', 'APPROVE_EXECUTIVE_REVIEWS', CURRENT_TIMESTAMP),
  ('rp_org_admin_view_exec_reviews', 'ORG_ADMIN', 'VIEW_EXECUTIVE_REVIEWS', CURRENT_TIMESTAMP),
  ('rp_org_admin_manage_exec_reviews', 'ORG_ADMIN', 'MANAGE_EXECUTIVE_REVIEWS', CURRENT_TIMESTAMP),
  ('rp_org_admin_approve_exec_reviews', 'ORG_ADMIN', 'APPROVE_EXECUTIVE_REVIEWS', CURRENT_TIMESTAMP),
  ('rp_ehs_manager_view_exec_reviews', 'EHS_MANAGER', 'VIEW_EXECUTIVE_REVIEWS', CURRENT_TIMESTAMP),
  ('rp_ehs_manager_manage_exec_reviews', 'EHS_MANAGER', 'MANAGE_EXECUTIVE_REVIEWS', CURRENT_TIMESTAMP),
  ('rp_supervisor_view_exec_reviews', 'SUPERVISOR', 'VIEW_EXECUTIVE_REVIEWS', CURRENT_TIMESTAMP),
  ('rp_auditor_view_exec_reviews', 'AUDITOR', 'VIEW_EXECUTIVE_REVIEWS', CURRENT_TIMESTAMP),
  ('rp_demo_view_exec_reviews', 'DEMO_VIEWER', 'VIEW_EXECUTIVE_REVIEWS', CURRENT_TIMESTAMP)
ON CONFLICT ("role", "permission") DO NOTHING;
