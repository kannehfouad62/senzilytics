CREATE TYPE "AuditServiceClientStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'ARCHIVED');
CREATE TYPE "AuditServiceEngagementKind" AS ENUM ('INTERNAL', 'EXTERNAL');
CREATE TYPE "AuditServiceEngagementStatus" AS ENUM ('DRAFT', 'PLANNING', 'READY', 'IN_PROGRESS', 'UNDER_REVIEW', 'COMPLETED', 'CANCELLED');
CREATE TYPE "AuditServiceEngagementTeamRole" AS ENUM ('ENGAGEMENT_MANAGER', 'LEAD_AUDITOR', 'AUDITOR', 'TECHNICAL_EXPERT', 'INDEPENDENT_REVIEWER', 'OBSERVER');

CREATE TABLE "AuditServiceClient" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "legalName" TEXT,
  "industry" TEXT,
  "country" TEXT,
  "address" TEXT,
  "website" TEXT,
  "notes" TEXT,
  "status" "AuditServiceClientStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuditServiceClient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditServiceClientContact" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "jobTitle" TEXT,
  "phone" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "isAuthorizedRepresentative" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuditServiceClientContact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditServiceEngagement" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "clientId" TEXT,
  "reference" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "kind" "AuditServiceEngagementKind" NOT NULL,
  "status" "AuditServiceEngagementStatus" NOT NULL DEFAULT 'DRAFT',
  "purpose" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "objectives" TEXT,
  "criteria" TEXT,
  "externalContractReference" TEXT,
  "ownerId" TEXT,
  "managerId" TEXT,
  "leadAuditorId" TEXT,
  "plannedStartDate" TIMESTAMP(3),
  "plannedEndDate" TIMESTAMP(3),
  "dueDate" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "cancellationReason" TEXT,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuditServiceEngagement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditServiceEngagementTeamMember" (
  "id" TEXT NOT NULL,
  "engagementId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "AuditServiceEngagementTeamRole" NOT NULL DEFAULT 'AUDITOR',
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt" TIMESTAMP(3),
  "declinedAt" TIMESTAMP(3),
  CONSTRAINT "AuditServiceEngagementTeamMember_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "EnterpriseAudit" ADD COLUMN "engagementId" TEXT;

CREATE UNIQUE INDEX "AuditServiceClient_organizationId_reference_key" ON "AuditServiceClient"("organizationId", "reference");
CREATE INDEX "AuditServiceClient_organizationId_status_name_idx" ON "AuditServiceClient"("organizationId", "status", "name");
CREATE INDEX "AuditServiceClient_createdById_idx" ON "AuditServiceClient"("createdById");
CREATE INDEX "AuditServiceClient_updatedById_idx" ON "AuditServiceClient"("updatedById");
CREATE UNIQUE INDEX "AuditServiceClientContact_clientId_email_key" ON "AuditServiceClientContact"("clientId", "email");
CREATE INDEX "AuditServiceClientContact_clientId_isActive_idx" ON "AuditServiceClientContact"("clientId", "isActive");
CREATE INDEX "AuditServiceClientContact_clientId_isAuthorizedRepresentative_idx" ON "AuditServiceClientContact"("clientId", "isAuthorizedRepresentative");
CREATE UNIQUE INDEX "AuditServiceEngagement_organizationId_reference_key" ON "AuditServiceEngagement"("organizationId", "reference");
CREATE INDEX "AuditServiceEngagement_organizationId_kind_status_idx" ON "AuditServiceEngagement"("organizationId", "kind", "status");
CREATE INDEX "AuditServiceEngagement_clientId_status_idx" ON "AuditServiceEngagement"("clientId", "status");
CREATE INDEX "AuditServiceEngagement_ownerId_idx" ON "AuditServiceEngagement"("ownerId");
CREATE INDEX "AuditServiceEngagement_managerId_idx" ON "AuditServiceEngagement"("managerId");
CREATE INDEX "AuditServiceEngagement_leadAuditorId_idx" ON "AuditServiceEngagement"("leadAuditorId");
CREATE INDEX "AuditServiceEngagement_dueDate_status_idx" ON "AuditServiceEngagement"("dueDate", "status");
CREATE UNIQUE INDEX "AuditServiceEngagementTeamMember_engagementId_userId_key" ON "AuditServiceEngagementTeamMember"("engagementId", "userId");
CREATE INDEX "AuditServiceEngagementTeamMember_userId_idx" ON "AuditServiceEngagementTeamMember"("userId");
CREATE INDEX "AuditServiceEngagementTeamMember_engagementId_role_idx" ON "AuditServiceEngagementTeamMember"("engagementId", "role");
CREATE INDEX "EnterpriseAudit_engagementId_idx" ON "EnterpriseAudit"("engagementId");

ALTER TABLE "AuditServiceClient" ADD CONSTRAINT "AuditServiceClient_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditServiceClient" ADD CONSTRAINT "AuditServiceClient_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditServiceClient" ADD CONSTRAINT "AuditServiceClient_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditServiceClientContact" ADD CONSTRAINT "AuditServiceClientContact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "AuditServiceClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditServiceEngagement" ADD CONSTRAINT "AuditServiceEngagement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditServiceEngagement" ADD CONSTRAINT "AuditServiceEngagement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "AuditServiceClient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditServiceEngagement" ADD CONSTRAINT "AuditServiceEngagement_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditServiceEngagement" ADD CONSTRAINT "AuditServiceEngagement_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditServiceEngagement" ADD CONSTRAINT "AuditServiceEngagement_leadAuditorId_fkey" FOREIGN KEY ("leadAuditorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditServiceEngagement" ADD CONSTRAINT "AuditServiceEngagement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditServiceEngagement" ADD CONSTRAINT "AuditServiceEngagement_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditServiceEngagementTeamMember" ADD CONSTRAINT "AuditServiceEngagementTeamMember_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "AuditServiceEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditServiceEngagementTeamMember" ADD CONSTRAINT "AuditServiceEngagementTeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnterpriseAudit" ADD CONSTRAINT "EnterpriseAudit_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "AuditServiceEngagement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
