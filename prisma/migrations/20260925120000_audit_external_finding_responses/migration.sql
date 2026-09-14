ALTER TYPE "AuditExternalAccessScope" ADD VALUE 'AUDIT_FINDING';

ALTER TABLE "AuditServiceExternalAccess" ADD COLUMN "findingId" TEXT;

CREATE TYPE "AuditExternalFindingPosition" AS ENUM ('ACKNOWLEDGED', 'DISPUTED', 'REMEDIATION_PROPOSED');

CREATE TABLE "AuditServiceExternalFindingResponse" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "accessId" TEXT NOT NULL,
  "position" "AuditExternalFindingPosition" NOT NULL,
  "response" TEXT NOT NULL,
  "proposedRootCause" TEXT,
  "immediateCorrection" TEXT,
  "remediationPlan" TEXT,
  "targetDate" TIMESTAMP(3),
  "representativeName" TEXT NOT NULL,
  "representativeEmail" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditServiceExternalFindingResponse_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditServiceExternalAccess_findingId_idx" ON "AuditServiceExternalAccess"("findingId");
CREATE UNIQUE INDEX "AuditServiceExternalFindingResponse_accessId_key" ON "AuditServiceExternalFindingResponse"("accessId");
CREATE INDEX "AuditServiceExternalFindingResponse_organizationId_position_submittedAt_idx" ON "AuditServiceExternalFindingResponse"("organizationId", "position", "submittedAt");

ALTER TABLE "AuditServiceExternalAccess" ADD CONSTRAINT "AuditServiceExternalAccess_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "EnterpriseAuditFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditServiceExternalFindingResponse" ADD CONSTRAINT "AuditServiceExternalFindingResponse_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditServiceExternalFindingResponse" ADD CONSTRAINT "AuditServiceExternalFindingResponse_accessId_fkey" FOREIGN KEY ("accessId") REFERENCES "AuditServiceExternalAccess"("id") ON DELETE CASCADE ON UPDATE CASCADE;
