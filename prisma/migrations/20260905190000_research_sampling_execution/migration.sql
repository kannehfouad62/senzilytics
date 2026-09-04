CREATE TYPE "ResearchSamplingFrameStatus" AS ENUM ('VALIDATED', 'ARCHIVED', 'REJECTED');
CREATE TYPE "ResearchSamplingExecutionStatus" AS ENUM ('GENERATED', 'UNDER_REVIEW', 'APPROVED', 'ACTIVE', 'CLOSED', 'ARCHIVED', 'CANCELLED');
CREATE TYPE "ResearchSampleUnitStatus" AS ENUM ('SELECTED', 'RESERVE', 'ASSIGNED', 'CONTACTED', 'INELIGIBLE', 'REFUSED', 'PARTIAL', 'COMPLETED', 'REPLACED', 'WITHDRAWN');

CREATE TABLE "ResearchSamplingFrame" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "samplingDesignId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "status" "ResearchSamplingFrameStatus" NOT NULL DEFAULT 'VALIDATED',
  "sourceFileName" TEXT NOT NULL,
  "sourceBlobPath" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "rowCount" INTEGER NOT NULL,
  "identifierColumn" TEXT NOT NULL,
  "strataColumn" TEXT,
  "clusterColumn" TEXT,
  "headerSnapshot" JSONB NOT NULL,
  "validationSnapshot" JSONB NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "ResearchSamplingFrame_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResearchSamplingExecution" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "samplingDesignId" TEXT NOT NULL,
  "samplingFrameId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "ResearchSamplingExecutionStatus" NOT NULL DEFAULT 'GENERATED',
  "seed" TEXT NOT NULL,
  "targetSampleSize" INTEGER NOT NULL,
  "reserveSampleSize" INTEGER NOT NULL DEFAULT 0,
  "selectedSampleSize" INTEGER NOT NULL,
  "algorithmSnapshot" JSONB NOT NULL,
  "designSnapshot" JSONB NOT NULL,
  "generatedById" TEXT NOT NULL,
  "approvedById" TEXT,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submittedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "activatedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "ResearchSamplingExecution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResearchSampleUnit" (
  "id" TEXT NOT NULL,
  "executionId" TEXT NOT NULL,
  "unitReference" TEXT NOT NULL,
  "frameRowNumber" INTEGER NOT NULL,
  "stratum" TEXT,
  "cluster" TEXT,
  "selectionOrder" INTEGER NOT NULL,
  "inclusionProbability" DOUBLE PRECISION,
  "baseWeight" DOUBLE PRECISION,
  "isReserve" BOOLEAN NOT NULL DEFAULT false,
  "status" "ResearchSampleUnitStatus" NOT NULL DEFAULT 'SELECTED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResearchSampleUnit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResearchSamplingFrame_samplingDesignId_version_key" ON "ResearchSamplingFrame"("samplingDesignId", "version");
CREATE INDEX "ResearchSamplingFrame_organizationId_status_createdAt_idx" ON "ResearchSamplingFrame"("organizationId", "status", "createdAt");
CREATE INDEX "ResearchSamplingFrame_projectId_status_version_idx" ON "ResearchSamplingFrame"("projectId", "status", "version");
CREATE UNIQUE INDEX "ResearchSamplingExecution_samplingDesignId_version_key" ON "ResearchSamplingExecution"("samplingDesignId", "version");
CREATE INDEX "ResearchSamplingExecution_organizationId_status_generatedAt_idx" ON "ResearchSamplingExecution"("organizationId", "status", "generatedAt");
CREATE INDEX "ResearchSamplingExecution_projectId_status_version_idx" ON "ResearchSamplingExecution"("projectId", "status", "version");
CREATE INDEX "ResearchSamplingExecution_samplingFrameId_status_idx" ON "ResearchSamplingExecution"("samplingFrameId", "status");
CREATE UNIQUE INDEX "ResearchSampleUnit_executionId_unitReference_key" ON "ResearchSampleUnit"("executionId", "unitReference");
CREATE UNIQUE INDEX "ResearchSampleUnit_executionId_selectionOrder_key" ON "ResearchSampleUnit"("executionId", "selectionOrder");
CREATE INDEX "ResearchSampleUnit_executionId_status_isReserve_idx" ON "ResearchSampleUnit"("executionId", "status", "isReserve");
CREATE INDEX "ResearchSampleUnit_executionId_stratum_idx" ON "ResearchSampleUnit"("executionId", "stratum");
CREATE INDEX "ResearchSampleUnit_executionId_cluster_idx" ON "ResearchSampleUnit"("executionId", "cluster");

ALTER TABLE "ResearchSamplingFrame" ADD CONSTRAINT "ResearchSamplingFrame_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchSamplingFrame" ADD CONSTRAINT "ResearchSamplingFrame_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchSamplingFrame" ADD CONSTRAINT "ResearchSamplingFrame_samplingDesignId_fkey" FOREIGN KEY ("samplingDesignId") REFERENCES "ResearchSamplingDesign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResearchSamplingFrame" ADD CONSTRAINT "ResearchSamplingFrame_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResearchSamplingExecution" ADD CONSTRAINT "ResearchSamplingExecution_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchSamplingExecution" ADD CONSTRAINT "ResearchSamplingExecution_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchSamplingExecution" ADD CONSTRAINT "ResearchSamplingExecution_samplingDesignId_fkey" FOREIGN KEY ("samplingDesignId") REFERENCES "ResearchSamplingDesign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResearchSamplingExecution" ADD CONSTRAINT "ResearchSamplingExecution_samplingFrameId_fkey" FOREIGN KEY ("samplingFrameId") REFERENCES "ResearchSamplingFrame"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResearchSamplingExecution" ADD CONSTRAINT "ResearchSamplingExecution_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResearchSamplingExecution" ADD CONSTRAINT "ResearchSamplingExecution_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResearchSampleUnit" ADD CONSTRAINT "ResearchSampleUnit_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "ResearchSamplingExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
