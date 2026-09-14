CREATE TYPE "AuditExternalAccessScope" AS ENUM ('ENGAGEMENT', 'INFORMATION_REQUEST', 'AUDIT_REPORT', 'AUDIT_QUESTION');
CREATE TYPE "AuditExternalAccessStatus" AS ENUM ('ACTIVE', 'REVOKED');

CREATE TABLE "AuditServiceExternalAccess" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "engagementId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "informationRequestId" TEXT,
  "scope" "AuditExternalAccessScope" NOT NULL,
  "status" "AuditExternalAccessStatus" NOT NULL DEFAULT 'ACTIVE',
  "title" TEXT NOT NULL,
  "instructions" TEXT,
  "tokenHash" TEXT NOT NULL,
  "passcodeHash" TEXT NOT NULL,
  "sessionTokenHash" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "sessionExpiresAt" TIMESTAMP(3),
  "verifiedAt" TIMESTAMP(3),
  "lastAccessedAt" TIMESTAMP(3),
  "failedAttempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "lockedUntil" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuditServiceExternalAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuditServiceExternalAccess_tokenHash_key" ON "AuditServiceExternalAccess"("tokenHash");
CREATE UNIQUE INDEX "AuditServiceExternalAccess_sessionTokenHash_key" ON "AuditServiceExternalAccess"("sessionTokenHash");
CREATE INDEX "AuditServiceExternalAccess_organizationId_status_expiresAt_idx" ON "AuditServiceExternalAccess"("organizationId", "status", "expiresAt");
CREATE INDEX "AuditServiceExternalAccess_engagementId_status_idx" ON "AuditServiceExternalAccess"("engagementId", "status");
CREATE INDEX "AuditServiceExternalAccess_contactId_status_idx" ON "AuditServiceExternalAccess"("contactId", "status");
CREATE INDEX "AuditServiceExternalAccess_informationRequestId_idx" ON "AuditServiceExternalAccess"("informationRequestId");

ALTER TABLE "AuditServiceExternalAccess" ADD CONSTRAINT "AuditServiceExternalAccess_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditServiceExternalAccess" ADD CONSTRAINT "AuditServiceExternalAccess_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "AuditServiceEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditServiceExternalAccess" ADD CONSTRAINT "AuditServiceExternalAccess_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "AuditServiceClientContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditServiceExternalAccess" ADD CONSTRAINT "AuditServiceExternalAccess_informationRequestId_fkey" FOREIGN KEY ("informationRequestId") REFERENCES "AuditServiceInformationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
