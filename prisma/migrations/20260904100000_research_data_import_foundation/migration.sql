CREATE TYPE "ResearchImportStatus" AS ENUM ('UPLOADED', 'PROFILED', 'MAPPED', 'REJECTED');
CREATE TYPE "ResearchVariableDataType" AS ENUM ('TEXT', 'NUMBER', 'BOOLEAN', 'DATE');
CREATE TYPE "ResearchMeasurementLevel" AS ENUM ('NOMINAL', 'ORDINAL', 'INTERVAL', 'RATIO');

CREATE TABLE "ResearchImportedDataset" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "projectId" TEXT NOT NULL,
  "name" TEXT NOT NULL, "status" "ResearchImportStatus" NOT NULL DEFAULT 'UPLOADED',
  "sourceFileName" TEXT NOT NULL, "sourceBlobPath" TEXT NOT NULL, "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL, "rowCount" INTEGER NOT NULL DEFAULT 0,
  "columnCount" INTEGER NOT NULL DEFAULT 0, "previewSnapshot" JSONB,
  "profileErrors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], "importedById" TEXT NOT NULL,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "profiledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResearchImportedDataset_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ResearchDataVariable" (
  "id" TEXT NOT NULL, "datasetId" TEXT NOT NULL, "sourceColumn" TEXT NOT NULL,
  "key" TEXT NOT NULL, "label" TEXT NOT NULL, "dataType" "ResearchVariableDataType" NOT NULL,
  "measurementLevel" "ResearchMeasurementLevel" NOT NULL, "unit" TEXT,
  "missingValues" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], "position" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResearchDataVariable_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ResearchImportedDataset_projectId_name_key" ON "ResearchImportedDataset"("projectId", "name");
CREATE INDEX "ResearchImportedDataset_organizationId_status_updatedAt_idx" ON "ResearchImportedDataset"("organizationId", "status", "updatedAt");
CREATE INDEX "ResearchImportedDataset_projectId_status_idx" ON "ResearchImportedDataset"("projectId", "status");
CREATE UNIQUE INDEX "ResearchDataVariable_datasetId_sourceColumn_key" ON "ResearchDataVariable"("datasetId", "sourceColumn");
CREATE UNIQUE INDEX "ResearchDataVariable_datasetId_key_key" ON "ResearchDataVariable"("datasetId", "key");
CREATE INDEX "ResearchDataVariable_datasetId_position_idx" ON "ResearchDataVariable"("datasetId", "position");
ALTER TABLE "ResearchImportedDataset" ADD CONSTRAINT "ResearchImportedDataset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchImportedDataset" ADD CONSTRAINT "ResearchImportedDataset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchImportedDataset" ADD CONSTRAINT "ResearchImportedDataset_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResearchDataVariable" ADD CONSTRAINT "ResearchDataVariable_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "ResearchImportedDataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
