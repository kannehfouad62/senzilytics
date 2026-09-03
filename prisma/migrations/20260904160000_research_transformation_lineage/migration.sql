CREATE TYPE "ResearchTransformationType" AS ENUM ('REPLACE_MISSING', 'RECODE_VALUE', 'DERIVE_NUMERIC', 'FILTER_VALUE', 'REMOVE_DUPLICATES', 'FLAG_OUTLIERS');
CREATE TABLE "ResearchDataTransformation" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "datasetId" TEXT NOT NULL,
  "type" "ResearchTransformationType" NOT NULL, "sourceVariableKey" TEXT,
  "secondaryVariableKey" TEXT, "outputVariableKey" TEXT, "parameters" JSONB NOT NULL,
  "rationale" TEXT NOT NULL, "position" INTEGER NOT NULL, "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResearchDataTransformation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ResearchDataTransformation_datasetId_position_key" ON "ResearchDataTransformation"("datasetId", "position");
CREATE INDEX "ResearchDataTransformation_organizationId_createdAt_idx" ON "ResearchDataTransformation"("organizationId", "createdAt");
CREATE INDEX "ResearchDataTransformation_datasetId_createdAt_idx" ON "ResearchDataTransformation"("datasetId", "createdAt");
ALTER TABLE "ResearchDataTransformation" ADD CONSTRAINT "ResearchDataTransformation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchDataTransformation" ADD CONSTRAINT "ResearchDataTransformation_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "ResearchImportedDataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchDataTransformation" ADD CONSTRAINT "ResearchDataTransformation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
