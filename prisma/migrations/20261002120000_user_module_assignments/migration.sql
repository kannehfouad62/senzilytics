ALTER TABLE "TenantInvitation" ADD COLUMN "moduleKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "UserModuleAssignment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "moduleKey" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "assignedById" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserModuleAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserModuleAssignment_userId_moduleKey_key" ON "UserModuleAssignment"("userId", "moduleKey");
CREATE INDEX "UserModuleAssignment_organizationId_userId_enabled_idx" ON "UserModuleAssignment"("organizationId", "userId", "enabled");
CREATE INDEX "UserModuleAssignment_assignedById_idx" ON "UserModuleAssignment"("assignedById");

ALTER TABLE "UserModuleAssignment" ADD CONSTRAINT "UserModuleAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserModuleAssignment" ADD CONSTRAINT "UserModuleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserModuleAssignment" ADD CONSTRAINT "UserModuleAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
