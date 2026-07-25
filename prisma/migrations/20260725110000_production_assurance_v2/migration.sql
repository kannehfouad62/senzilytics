CREATE TYPE "ProductionReadinessReviewStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED');
CREATE TYPE "ProductionReadinessControlStatus" AS ENUM ('NOT_ASSESSED', 'PASS', 'CONDITIONAL', 'FAIL', 'NOT_APPLICABLE');
CREATE TYPE "ProductionReadinessControlKey" AS ENUM ('TENANT_ISOLATION', 'ROLE_ACCESS_REVIEW', 'AUTHENTICATION_RECOVERY', 'SSO_VALIDATION', 'DOCUMENT_SECURITY', 'SCHEDULED_PROCESSING', 'NOTIFICATION_DELIVERY', 'DATA_QUALITY', 'BACKUP_RESTORE', 'DISASTER_RECOVERY', 'MOBILE_RELEASE', 'SUPPORT_ESCALATION');

CREATE TABLE "ProductionReadinessReview" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "ProductionReadinessReviewStatus" NOT NULL DEFAULT 'DRAFT',
  "targetReviewAt" TIMESTAMP(3),
  "executiveSummary" TEXT,
  "submissionNotes" TEXT,
  "reviewNotes" TEXT,
  "createdById" TEXT NOT NULL,
  "submittedById" TEXT,
  "submittedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductionReadinessReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductionReadinessControl" (
  "id" TEXT NOT NULL,
  "reviewId" TEXT NOT NULL,
  "key" "ProductionReadinessControlKey" NOT NULL,
  "status" "ProductionReadinessControlStatus" NOT NULL DEFAULT 'NOT_ASSESSED',
  "ownerId" TEXT,
  "dueAt" TIMESTAMP(3),
  "testMethod" TEXT,
  "evidenceSummary" TEXT,
  "resultNotes" TEXT,
  "evidenceUrl" TEXT,
  "testedAt" TIMESTAMP(3),
  "testedById" TEXT,
  "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductionReadinessControl_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductionReadinessReview_organizationId_version_key" ON "ProductionReadinessReview"("organizationId", "version");
CREATE INDEX "ProductionReadinessReview_organizationId_status_updatedAt_idx" ON "ProductionReadinessReview"("organizationId", "status", "updatedAt");
CREATE INDEX "ProductionReadinessReview_status_targetReviewAt_idx" ON "ProductionReadinessReview"("status", "targetReviewAt");
CREATE UNIQUE INDEX "ProductionReadinessControl_reviewId_key_key" ON "ProductionReadinessControl"("reviewId", "key");
CREATE INDEX "ProductionReadinessControl_status_dueAt_idx" ON "ProductionReadinessControl"("status", "dueAt");
CREATE INDEX "ProductionReadinessControl_ownerId_status_idx" ON "ProductionReadinessControl"("ownerId", "status");

ALTER TABLE "ProductionReadinessReview" ADD CONSTRAINT "ProductionReadinessReview_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionReadinessReview" ADD CONSTRAINT "ProductionReadinessReview_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionReadinessReview" ADD CONSTRAINT "ProductionReadinessReview_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductionReadinessReview" ADD CONSTRAINT "ProductionReadinessReview_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductionReadinessControl" ADD CONSTRAINT "ProductionReadinessControl_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "ProductionReadinessReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionReadinessControl" ADD CONSTRAINT "ProductionReadinessControl_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductionReadinessControl" ADD CONSTRAINT "ProductionReadinessControl_testedById_fkey" FOREIGN KEY ("testedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductionReadinessControl" ADD CONSTRAINT "ProductionReadinessControl_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
