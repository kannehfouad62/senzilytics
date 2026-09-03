CREATE TYPE "ResearchReportStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "ResearchReport" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" "ResearchReportStatus" NOT NULL DEFAULT 'DRAFT',
  "executiveSummary" TEXT NOT NULL,
  "background" TEXT,
  "methodology" TEXT NOT NULL,
  "findings" TEXT NOT NULL,
  "discussion" TEXT,
  "conclusions" TEXT NOT NULL,
  "recommendations" TEXT NOT NULL,
  "limitations" TEXT NOT NULL,
  "analysisIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "evidenceSnapshot" JSONB NOT NULL,
  "snapshotGeneratedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "authorId" TEXT NOT NULL,
  "reviewerId" TEXT,
  "approvedById" TEXT,
  "publishedById" TEXT,
  "submittedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResearchReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResearchReport_organizationId_reference_version_key" ON "ResearchReport"("organizationId", "reference", "version");
CREATE INDEX "ResearchReport_organizationId_status_updatedAt_idx" ON "ResearchReport"("organizationId", "status", "updatedAt");
CREATE INDEX "ResearchReport_projectId_status_updatedAt_idx" ON "ResearchReport"("projectId", "status", "updatedAt");
CREATE INDEX "ResearchReport_authorId_status_idx" ON "ResearchReport"("authorId", "status");

ALTER TABLE "ResearchReport" ADD CONSTRAINT "ResearchReport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchReport" ADD CONSTRAINT "ResearchReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchReport" ADD CONSTRAINT "ResearchReport_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResearchReport" ADD CONSTRAINT "ResearchReport_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResearchReport" ADD CONSTRAINT "ResearchReport_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResearchReport" ADD CONSTRAINT "ResearchReport_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
