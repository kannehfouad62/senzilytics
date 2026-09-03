CREATE TYPE "ResearchAnalysisStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'ARCHIVED');

CREATE TABLE "ResearchAnalysis" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "xVariableKey" TEXT NOT NULL,
  "yVariableKey" TEXT,
  "filterVariableKey" TEXT,
  "filterValue" TEXT,
  "hypothesis" TEXT,
  "methodologyNotes" TEXT,
  "status" "ResearchAnalysisStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "datasetResponseCount" INTEGER NOT NULL,
  "resultSnapshot" JSONB NOT NULL,
  "analystId" TEXT NOT NULL,
  "reviewerId" TEXT,
  "submittedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResearchAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ResearchAnalysis_organizationId_status_updatedAt_idx" ON "ResearchAnalysis"("organizationId", "status", "updatedAt");
CREATE INDEX "ResearchAnalysis_collectionId_status_updatedAt_idx" ON "ResearchAnalysis"("collectionId", "status", "updatedAt");
CREATE INDEX "ResearchAnalysis_analystId_status_idx" ON "ResearchAnalysis"("analystId", "status");
CREATE INDEX "ResearchAnalysis_reviewerId_status_idx" ON "ResearchAnalysis"("reviewerId", "status");
CREATE UNIQUE INDEX "ResearchAnalysis_collectionId_title_version_key" ON "ResearchAnalysis"("collectionId", "title", "version");

ALTER TABLE "ResearchAnalysis" ADD CONSTRAINT "ResearchAnalysis_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchAnalysis" ADD CONSTRAINT "ResearchAnalysis_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "ResearchCollectionWave"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchAnalysis" ADD CONSTRAINT "ResearchAnalysis_analystId_fkey" FOREIGN KEY ("analystId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResearchAnalysis" ADD CONSTRAINT "ResearchAnalysis_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResearchAnalysis" ADD CONSTRAINT "ResearchAnalysis_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
