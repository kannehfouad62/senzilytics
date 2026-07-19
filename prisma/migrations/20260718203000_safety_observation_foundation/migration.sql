ALTER TYPE "PermissionKey" ADD VALUE 'CREATE_OBSERVATION';
ALTER TYPE "PermissionKey" ADD VALUE 'VIEW_OBSERVATIONS';
ALTER TYPE "PermissionKey" ADD VALUE 'MANAGE_OBSERVATIONS';

CREATE TYPE "SafetyObservationType" AS ENUM ('UNSAFE_ACT', 'UNSAFE_CONDITION', 'POSITIVE_PRACTICE', 'ENVIRONMENTAL', 'QUALITY', 'OTHER');
CREATE TYPE "SafetyObservationStatus" AS ENUM ('REPORTED', 'UNDER_REVIEW', 'ACTION_REQUIRED', 'RESOLVED', 'CLOSED');

CREATE TABLE "SafetyObservation" (
  "id" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "type" "SafetyObservationType" NOT NULL,
  "status" "SafetyObservationStatus" NOT NULL DEFAULT 'REPORTED',
  "riskLevel" "RiskLevel" NOT NULL DEFAULT 'LOW',
  "location" TEXT,
  "observedAt" TIMESTAMP(3) NOT NULL,
  "immediateAction" TEXT,
  "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
  "reviewNotes" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "organizationId" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "departmentId" TEXT,
  "reportedById" TEXT NOT NULL,
  "assignedToId" TEXT,
  "incidentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SafetyObservation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SafetyObservation_organizationId_reference_key" ON "SafetyObservation"("organizationId", "reference");
CREATE INDEX "SafetyObservation_organizationId_status_idx" ON "SafetyObservation"("organizationId", "status");
CREATE INDEX "SafetyObservation_siteId_observedAt_idx" ON "SafetyObservation"("siteId", "observedAt");
CREATE INDEX "SafetyObservation_assignedToId_status_idx" ON "SafetyObservation"("assignedToId", "status");

ALTER TABLE "SafetyObservation" ADD CONSTRAINT "SafetyObservation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SafetyObservation" ADD CONSTRAINT "SafetyObservation_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SafetyObservation" ADD CONSTRAINT "SafetyObservation_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SafetyObservation" ADD CONSTRAINT "SafetyObservation_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SafetyObservation" ADD CONSTRAINT "SafetyObservation_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SafetyObservation" ADD CONSTRAINT "SafetyObservation_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;
