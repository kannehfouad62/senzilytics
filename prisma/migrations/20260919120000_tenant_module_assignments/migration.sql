ALTER TYPE "IndustryCategory" ADD VALUE 'AUDIT_AND_ASSURANCE_SERVICES';
CREATE TYPE "TenantModuleAssignmentSource" AS ENUM ('INDUSTRY_DEFAULT','MANUAL');
CREATE TABLE "TenantModuleAssignment" ("id" TEXT NOT NULL,"organizationId" TEXT NOT NULL,"moduleKey" TEXT NOT NULL,"enabled" BOOLEAN NOT NULL DEFAULT true,"source" "TenantModuleAssignmentSource" NOT NULL DEFAULT 'MANUAL',"assignedById" TEXT,"assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "TenantModuleAssignment_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "TenantModuleAssignment_organizationId_moduleKey_key" ON "TenantModuleAssignment"("organizationId","moduleKey");
CREATE INDEX "TenantModuleAssignment_organizationId_enabled_idx" ON "TenantModuleAssignment"("organizationId","enabled");
CREATE INDEX "TenantModuleAssignment_assignedById_idx" ON "TenantModuleAssignment"("assignedById");
ALTER TABLE "TenantModuleAssignment" ADD CONSTRAINT "TenantModuleAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantModuleAssignment" ADD CONSTRAINT "TenantModuleAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
