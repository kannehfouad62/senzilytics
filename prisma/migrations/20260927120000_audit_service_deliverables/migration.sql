CREATE TYPE "AuditServiceDeliverableType" AS ENUM ('DRAFT_REPORT', 'FINAL_REPORT', 'MANAGEMENT_LETTER', 'EXECUTIVE_SUMMARY', 'EVIDENCE_INDEX', 'OTHER');
CREATE TYPE "AuditServiceDeliverableStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'RELEASED', 'WITHDRAWN');

CREATE TABLE "AuditServiceDeliverable" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "engagementId" TEXT NOT NULL,
  "sourceAuditId" TEXT, "previousVersionId" TEXT, "reference" TEXT NOT NULL,
  "type" "AuditServiceDeliverableType" NOT NULL, "title" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1, "status" "AuditServiceDeliverableStatus" NOT NULL DEFAULT 'DRAFT',
  "summary" TEXT NOT NULL, "contentSnapshot" JSONB NOT NULL, "changeNote" TEXT,
  "createdById" TEXT NOT NULL, "reviewedById" TEXT, "approvedById" TEXT, "releasedById" TEXT,
  "submittedAt" TIMESTAMP(3), "reviewedAt" TIMESTAMP(3), "approvedAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3), "withdrawnAt" TIMESTAMP(3), "reviewNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuditServiceDeliverable_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AuditServiceDeliverable_engagementId_reference_version_key" ON "AuditServiceDeliverable"("engagementId", "reference", "version");
CREATE INDEX "AuditServiceDeliverable_organizationId_status_updatedAt_idx" ON "AuditServiceDeliverable"("organizationId", "status", "updatedAt");
CREATE INDEX "AuditServiceDeliverable_engagementId_type_status_idx" ON "AuditServiceDeliverable"("engagementId", "type", "status");
CREATE INDEX "AuditServiceDeliverable_sourceAuditId_idx" ON "AuditServiceDeliverable"("sourceAuditId");
CREATE INDEX "AuditServiceDeliverable_previousVersionId_idx" ON "AuditServiceDeliverable"("previousVersionId");
ALTER TABLE "AuditServiceDeliverable" ADD CONSTRAINT "AuditServiceDeliverable_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditServiceDeliverable" ADD CONSTRAINT "AuditServiceDeliverable_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "AuditServiceEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditServiceDeliverable" ADD CONSTRAINT "AuditServiceDeliverable_sourceAuditId_fkey" FOREIGN KEY ("sourceAuditId") REFERENCES "EnterpriseAudit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditServiceDeliverable" ADD CONSTRAINT "AuditServiceDeliverable_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "AuditServiceDeliverable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditServiceDeliverable" ADD CONSTRAINT "AuditServiceDeliverable_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditServiceDeliverable" ADD CONSTRAINT "AuditServiceDeliverable_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditServiceDeliverable" ADD CONSTRAINT "AuditServiceDeliverable_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditServiceDeliverable" ADD CONSTRAINT "AuditServiceDeliverable_releasedById_fkey" FOREIGN KEY ("releasedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
