CREATE TYPE "ResearchDatasetStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'LOCKED', 'APPROVED');
CREATE TYPE "ResearchResponseDisposition" AS ENUM ('INCLUDED', 'FLAGGED', 'EXCLUDED');

ALTER TABLE "ResearchCollectionWave"
  ADD COLUMN "datasetStatus" "ResearchDatasetStatus" NOT NULL DEFAULT 'OPEN',
  ADD COLUMN "datasetOwnerId" TEXT,
  ADD COLUMN "datasetLockedById" TEXT,
  ADD COLUMN "datasetLockedAt" TIMESTAMP(3),
  ADD COLUMN "datasetApprovedById" TEXT,
  ADD COLUMN "datasetApprovedAt" TIMESTAMP(3);

ALTER TABLE "ResearchQuestionnaireAssignment"
  ADD COLUMN "disposition" "ResearchResponseDisposition" NOT NULL DEFAULT 'INCLUDED',
  ADD COLUMN "qualityNotes" TEXT,
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3);

CREATE INDEX "ResearchCollectionWave_organizationId_datasetStatus_updatedAt_idx" ON "ResearchCollectionWave"("organizationId", "datasetStatus", "updatedAt");
CREATE INDEX "ResearchCollectionWave_datasetOwnerId_datasetStatus_idx" ON "ResearchCollectionWave"("datasetOwnerId", "datasetStatus");
CREATE INDEX "ResearchQuestionnaireAssignment_collectionId_disposition_completedAt_idx" ON "ResearchQuestionnaireAssignment"("collectionId", "disposition", "completedAt");
CREATE INDEX "ResearchQuestionnaireAssignment_reviewedById_reviewedAt_idx" ON "ResearchQuestionnaireAssignment"("reviewedById", "reviewedAt");

ALTER TABLE "ResearchCollectionWave" ADD CONSTRAINT "ResearchCollectionWave_datasetOwnerId_fkey" FOREIGN KEY ("datasetOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResearchCollectionWave" ADD CONSTRAINT "ResearchCollectionWave_datasetLockedById_fkey" FOREIGN KEY ("datasetLockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResearchCollectionWave" ADD CONSTRAINT "ResearchCollectionWave_datasetApprovedById_fkey" FOREIGN KEY ("datasetApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResearchQuestionnaireAssignment" ADD CONSTRAINT "ResearchQuestionnaireAssignment_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
