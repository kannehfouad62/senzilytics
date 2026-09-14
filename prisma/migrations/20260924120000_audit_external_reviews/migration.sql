CREATE TYPE "AuditExternalDecisionType" AS ENUM ('ACKNOWLEDGED', 'APPROVED', 'DENIED');

ALTER TABLE "AuditServiceExternalAccess"
  ADD COLUMN "auditId" TEXT,
  ADD COLUMN "questionId" TEXT,
  ADD COLUMN "resourceSnapshot" JSONB;

CREATE TABLE "AuditServiceExternalDecision" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "accessId" TEXT NOT NULL,
  "decision" "AuditExternalDecisionType" NOT NULL,
  "comment" TEXT,
  "representativeName" TEXT NOT NULL,
  "representativeEmail" TEXT NOT NULL,
  "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditServiceExternalDecision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditServiceExternalComment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "accessId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "representativeName" TEXT NOT NULL,
  "representativeEmail" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditServiceExternalComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditServiceExternalAccess_auditId_idx" ON "AuditServiceExternalAccess"("auditId");
CREATE INDEX "AuditServiceExternalAccess_questionId_idx" ON "AuditServiceExternalAccess"("questionId");
CREATE UNIQUE INDEX "AuditServiceExternalDecision_accessId_key" ON "AuditServiceExternalDecision"("accessId");
CREATE INDEX "AuditServiceExternalDecision_organizationId_decision_decidedAt_idx" ON "AuditServiceExternalDecision"("organizationId", "decision", "decidedAt");
CREATE INDEX "AuditServiceExternalComment_organizationId_createdAt_idx" ON "AuditServiceExternalComment"("organizationId", "createdAt");
CREATE INDEX "AuditServiceExternalComment_accessId_createdAt_idx" ON "AuditServiceExternalComment"("accessId", "createdAt");

ALTER TABLE "AuditServiceExternalAccess" ADD CONSTRAINT "AuditServiceExternalAccess_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "EnterpriseAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditServiceExternalAccess" ADD CONSTRAINT "AuditServiceExternalAccess_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "EnterpriseAuditQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditServiceExternalDecision" ADD CONSTRAINT "AuditServiceExternalDecision_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditServiceExternalDecision" ADD CONSTRAINT "AuditServiceExternalDecision_accessId_fkey" FOREIGN KEY ("accessId") REFERENCES "AuditServiceExternalAccess"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditServiceExternalComment" ADD CONSTRAINT "AuditServiceExternalComment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditServiceExternalComment" ADD CONSTRAINT "AuditServiceExternalComment_accessId_fkey" FOREIGN KEY ("accessId") REFERENCES "AuditServiceExternalAccess"("id") ON DELETE CASCADE ON UPDATE CASCADE;
