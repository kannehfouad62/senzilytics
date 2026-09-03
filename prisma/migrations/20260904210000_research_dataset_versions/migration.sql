CREATE TYPE "ResearchDatasetVersionStatus" AS ENUM ('DRAFT','UNDER_REVIEW','APPROVED','SUPERSEDED');
CREATE TABLE "ResearchDatasetVersion" (
 "id" TEXT NOT NULL,"organizationId" TEXT NOT NULL,"datasetId" TEXT NOT NULL,"version" INTEGER NOT NULL,
 "status" "ResearchDatasetVersionStatus" NOT NULL DEFAULT 'DRAFT',"storagePath" TEXT NOT NULL,
 "rowCount" INTEGER NOT NULL,"columnCount" INTEGER NOT NULL,"transformationSnapshot" JSONB NOT NULL,
 "qualitySnapshot" JSONB NOT NULL,"createdById" TEXT NOT NULL,"reviewerId" TEXT,"approvedById" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"submittedAt" TIMESTAMP(3),"reviewedAt" TIMESTAMP(3),"approvedAt" TIMESTAMP(3),
 CONSTRAINT "ResearchDatasetVersion_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "ResearchDatasetVersion_datasetId_version_key" ON "ResearchDatasetVersion"("datasetId","version");
CREATE INDEX "ResearchDatasetVersion_organizationId_status_createdAt_idx" ON "ResearchDatasetVersion"("organizationId","status","createdAt");
CREATE INDEX "ResearchDatasetVersion_datasetId_status_version_idx" ON "ResearchDatasetVersion"("datasetId","status","version");
ALTER TABLE "ResearchDatasetVersion" ADD CONSTRAINT "ResearchDatasetVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchDatasetVersion" ADD CONSTRAINT "ResearchDatasetVersion_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "ResearchImportedDataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchDatasetVersion" ADD CONSTRAINT "ResearchDatasetVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResearchDatasetVersion" ADD CONSTRAINT "ResearchDatasetVersion_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResearchDatasetVersion" ADD CONSTRAINT "ResearchDatasetVersion_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
