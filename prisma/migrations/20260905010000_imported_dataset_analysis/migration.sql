ALTER TABLE "ResearchAnalysis" ALTER COLUMN "collectionId" DROP NOT NULL;
ALTER TABLE "ResearchAnalysis" ADD COLUMN "datasetVersionId" TEXT;
CREATE INDEX "ResearchAnalysis_datasetVersionId_status_updatedAt_idx" ON "ResearchAnalysis"("datasetVersionId", "status", "updatedAt");
CREATE UNIQUE INDEX "ResearchAnalysis_datasetVersionId_title_version_key" ON "ResearchAnalysis"("datasetVersionId", "title", "version");
ALTER TABLE "ResearchAnalysis" ADD CONSTRAINT "ResearchAnalysis_datasetVersionId_fkey" FOREIGN KEY ("datasetVersionId") REFERENCES "ResearchDatasetVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchAnalysis" ADD CONSTRAINT "ResearchAnalysis_source_check" CHECK (("collectionId" IS NOT NULL)::int + ("datasetVersionId" IS NOT NULL)::int = 1);
