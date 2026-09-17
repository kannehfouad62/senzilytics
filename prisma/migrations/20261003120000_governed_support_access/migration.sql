CREATE TYPE "SupportAccessStatus" AS ENUM ('REQUESTED', 'APPROVED', 'ACTIVE', 'COMPLETED', 'DENIED', 'REVOKED', 'EXPIRED');

CREATE TABLE "SupportAccessGrant" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "approvedById" TEXT,
  "revokedById" TEXT,
  "reason" TEXT NOT NULL,
  "moduleKeys" TEXT[] NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "status" "SupportAccessStatus" NOT NULL DEFAULT 'REQUESTED',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "enteredAt" TIMESTAMP(3),
  "exitedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupportAccessGrant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportAccessGrant_organizationId_status_requestedAt_idx" ON "SupportAccessGrant"("organizationId", "status", "requestedAt");
CREATE INDEX "SupportAccessGrant_requestedById_status_expiresAt_idx" ON "SupportAccessGrant"("requestedById", "status", "expiresAt");
ALTER TABLE "SupportAccessGrant" ADD CONSTRAINT "SupportAccessGrant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportAccessGrant" ADD CONSTRAINT "SupportAccessGrant_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportAccessGrant" ADD CONSTRAINT "SupportAccessGrant_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportAccessGrant" ADD CONSTRAINT "SupportAccessGrant_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
