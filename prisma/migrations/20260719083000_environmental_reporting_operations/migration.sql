CREATE TYPE "EnvironmentalReportingFrequency" AS ENUM ('MONTHLY','QUARTERLY','SEMIANNUAL','ANNUAL');
ALTER TABLE "EnvironmentalMetricDefinition" ADD COLUMN "reportingFrequency" "EnvironmentalReportingFrequency" NOT NULL DEFAULT 'MONTHLY';
ALTER TABLE "EnvironmentalMetricDefinition" ADD COLUMN "missingDataNotifiedAt" TIMESTAMP(3);
CREATE TABLE "EnvironmentalDataRevision" ("id" TEXT NOT NULL,"dataPointId" TEXT NOT NULL,"value" DOUBLE PRECISION NOT NULL,"normalizedValue" DOUBLE PRECISION NOT NULL,"quality" "EnvironmentalDataQuality" NOT NULL,"status" "EnvironmentalDataStatus" NOT NULL,"evidenceSummary" TEXT,"notes" TEXT,"reason" TEXT NOT NULL,"changedById" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "EnvironmentalDataRevision_pkey" PRIMARY KEY ("id"));
CREATE INDEX "EnvironmentalDataRevision_dataPointId_createdAt_idx" ON "EnvironmentalDataRevision"("dataPointId","createdAt");
CREATE INDEX "EnvironmentalDataRevision_changedById_idx" ON "EnvironmentalDataRevision"("changedById");
ALTER TABLE "EnvironmentalDataRevision" ADD CONSTRAINT "EnvironmentalDataRevision_dataPointId_fkey" FOREIGN KEY ("dataPointId") REFERENCES "EnvironmentalDataPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnvironmentalDataRevision" ADD CONSTRAINT "EnvironmentalDataRevision_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
