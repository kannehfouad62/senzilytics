CREATE TYPE "ResearchDashboardStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'ARCHIVED');

CREATE TABLE "ResearchVisualizationDashboard" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "ResearchDashboardStatus" NOT NULL DEFAULT 'DRAFT',
  "layoutDefinition" JSONB NOT NULL,
  "branding" JSONB NOT NULL,
  "createdById" TEXT NOT NULL,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResearchVisualizationDashboard_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResearchVisualizationDashboard_projectId_title_key" ON "ResearchVisualizationDashboard"("projectId", "title");
CREATE INDEX "ResearchVisualizationDashboard_organizationId_status_updatedAt_idx" ON "ResearchVisualizationDashboard"("organizationId", "status", "updatedAt");
CREATE INDEX "ResearchVisualizationDashboard_projectId_status_idx" ON "ResearchVisualizationDashboard"("projectId", "status");
CREATE INDEX "ResearchVisualizationDashboard_createdById_idx" ON "ResearchVisualizationDashboard"("createdById");

ALTER TABLE "ResearchVisualizationDashboard" ADD CONSTRAINT "ResearchVisualizationDashboard_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchVisualizationDashboard" ADD CONSTRAINT "ResearchVisualizationDashboard_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchVisualizationDashboard" ADD CONSTRAINT "ResearchVisualizationDashboard_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResearchVisualizationDashboard" ADD CONSTRAINT "ResearchVisualizationDashboard_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
