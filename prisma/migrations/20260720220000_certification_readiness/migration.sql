ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'VIEW_CERTIFICATION_READINESS';
ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'MANAGE_CERTIFICATION_READINESS';
ALTER TYPE "ConfigurableFormModule" ADD VALUE IF NOT EXISTS 'CERTIFICATION_READINESS';
ALTER TYPE "DocumentEntityType" ADD VALUE IF NOT EXISTS 'CERTIFICATION_READINESS';

CREATE TYPE "CertificationManagementReviewStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'APPROVED', 'CANCELLED');
CREATE TYPE "ManagementSystemConclusion" AS ENUM ('EFFECTIVE', 'NEEDS_IMPROVEMENT', 'NOT_EFFECTIVE');

CREATE TABLE "CertificationManagementReview" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "programId" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" "CertificationManagementReviewStatus" NOT NULL DEFAULT 'PLANNED',
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "chairId" TEXT NOT NULL,
  "attendees" TEXT,
  "auditResultsSummary" TEXT,
  "complianceStatusSummary" TEXT,
  "objectivesPerformance" TEXT,
  "stakeholderFeedback" TEXT,
  "changesInContext" TEXT,
  "risksAndOpportunities" TEXT,
  "resourceAdequacy" TEXT,
  "decisions" TEXT,
  "improvementOpportunities" TEXT,
  "conclusion" "ManagementSystemConclusion",
  "readinessScore" INTEGER,
  "readinessSnapshot" JSONB,
  "nextReviewAt" TIMESTAMP(3),
  "completedById" TEXT,
  "completedAt" TIMESTAMP(3),
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "reminderSentAt" TIMESTAMP(3),
  "overdueNotifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CertificationManagementReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CertificationReviewActionLink" (
  "id" TEXT NOT NULL,
  "reviewId" TEXT NOT NULL,
  "correctiveActionId" TEXT NOT NULL,
  "agendaTopic" TEXT,
  "decision" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CertificationReviewActionLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CertificationManagementReview_organizationId_reference_key" ON "CertificationManagementReview"("organizationId", "reference");
CREATE INDEX "CertificationManagementReview_organizationId_status_scheduledAt_idx" ON "CertificationManagementReview"("organizationId", "status", "scheduledAt");
CREATE INDEX "CertificationManagementReview_programId_scheduledAt_idx" ON "CertificationManagementReview"("programId", "scheduledAt");
CREATE INDEX "CertificationManagementReview_chairId_scheduledAt_idx" ON "CertificationManagementReview"("chairId", "scheduledAt");
CREATE INDEX "CertificationManagementReview_nextReviewAt_idx" ON "CertificationManagementReview"("nextReviewAt");
CREATE UNIQUE INDEX "CertificationReviewActionLink_correctiveActionId_key" ON "CertificationReviewActionLink"("correctiveActionId");
CREATE INDEX "CertificationReviewActionLink_reviewId_idx" ON "CertificationReviewActionLink"("reviewId");

ALTER TABLE "CertificationManagementReview" ADD CONSTRAINT "CertificationManagementReview_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CertificationManagementReview" ADD CONSTRAINT "CertificationManagementReview_programId_fkey" FOREIGN KEY ("programId") REFERENCES "AuditProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CertificationManagementReview" ADD CONSTRAINT "CertificationManagementReview_chairId_fkey" FOREIGN KEY ("chairId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CertificationManagementReview" ADD CONSTRAINT "CertificationManagementReview_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CertificationManagementReview" ADD CONSTRAINT "CertificationManagementReview_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CertificationManagementReview" ADD CONSTRAINT "CertificationManagementReview_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CertificationReviewActionLink" ADD CONSTRAINT "CertificationReviewActionLink_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "CertificationManagementReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CertificationReviewActionLink" ADD CONSTRAINT "CertificationReviewActionLink_correctiveActionId_fkey" FOREIGN KEY ("correctiveActionId") REFERENCES "CorrectiveAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
