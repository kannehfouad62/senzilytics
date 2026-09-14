CREATE TYPE "AuditExternalFindingReviewStatus" AS ENUM ('PENDING', 'ACCEPTED', 'CHANGES_REQUESTED', 'REJECTED', 'CONVERTED_TO_CAPA');

ALTER TABLE "AuditServiceExternalFindingResponse"
  ADD COLUMN "reviewStatus" "AuditExternalFindingReviewStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "reviewNotes" TEXT,
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "correctiveActionId" TEXT;

CREATE INDEX "AuditServiceExternalFindingResponse_reviewStatus_reviewedAt_idx" ON "AuditServiceExternalFindingResponse"("reviewStatus", "reviewedAt");
CREATE INDEX "AuditServiceExternalFindingResponse_reviewedById_idx" ON "AuditServiceExternalFindingResponse"("reviewedById");
CREATE INDEX "AuditServiceExternalFindingResponse_correctiveActionId_idx" ON "AuditServiceExternalFindingResponse"("correctiveActionId");

ALTER TABLE "AuditServiceExternalFindingResponse" ADD CONSTRAINT "AuditServiceExternalFindingResponse_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditServiceExternalFindingResponse" ADD CONSTRAINT "AuditServiceExternalFindingResponse_correctiveActionId_fkey" FOREIGN KEY ("correctiveActionId") REFERENCES "CorrectiveAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
