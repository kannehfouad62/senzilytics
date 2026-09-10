-- CreateEnum
CREATE TYPE "ResearchClientPortalAccessStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'REVOKED');

-- CreateTable
CREATE TABLE "ResearchClientPortalAccess" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ResearchClientPortalAccessStatus" NOT NULL DEFAULT 'ACTIVE',
    "grantedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "lastAccessedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ResearchClientPortalAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchClientPortalProjectAccess" (
    "id" TEXT NOT NULL,
    "accessId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResearchClientPortalProjectAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResearchClientPortalAccess_clientId_userId_key" ON "ResearchClientPortalAccess"("clientId", "userId");
CREATE INDEX "ResearchClientPortalAccess_organizationId_status_idx" ON "ResearchClientPortalAccess"("organizationId", "status");
CREATE INDEX "ResearchClientPortalAccess_userId_status_idx" ON "ResearchClientPortalAccess"("userId", "status");
CREATE INDEX "ResearchClientPortalAccess_grantedById_idx" ON "ResearchClientPortalAccess"("grantedById");
CREATE UNIQUE INDEX "ResearchClientPortalProjectAccess_accessId_projectId_key" ON "ResearchClientPortalProjectAccess"("accessId", "projectId");
CREATE INDEX "ResearchClientPortalProjectAccess_projectId_idx" ON "ResearchClientPortalProjectAccess"("projectId");
CREATE INDEX "ResearchClientPortalProjectAccess_grantedById_idx" ON "ResearchClientPortalProjectAccess"("grantedById");

ALTER TABLE "ResearchClientPortalAccess" ADD CONSTRAINT "ResearchClientPortalAccess_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchClientPortalAccess" ADD CONSTRAINT "ResearchClientPortalAccess_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ResearchClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchClientPortalAccess" ADD CONSTRAINT "ResearchClientPortalAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchClientPortalAccess" ADD CONSTRAINT "ResearchClientPortalAccess_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResearchClientPortalProjectAccess" ADD CONSTRAINT "ResearchClientPortalProjectAccess_accessId_fkey" FOREIGN KEY ("accessId") REFERENCES "ResearchClientPortalAccess"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchClientPortalProjectAccess" ADD CONSTRAINT "ResearchClientPortalProjectAccess_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchClientPortalProjectAccess" ADD CONSTRAINT "ResearchClientPortalProjectAccess_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
