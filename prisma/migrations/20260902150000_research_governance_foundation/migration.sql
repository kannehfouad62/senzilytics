-- Research & Analytics Management — governed foundation

CREATE TYPE "ResearchClientStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "ResearchProjectStatus" AS ENUM ('DRAFT', 'PLANNING', 'IN_REVIEW', 'APPROVED', 'ACTIVE', 'DATA_COLLECTION', 'ANALYSIS', 'CLIENT_REVIEW', 'COMPLETED', 'ON_HOLD', 'CANCELLED', 'ARCHIVED');
CREATE TYPE "ResearchMethodology" AS ENUM ('QUANTITATIVE', 'QUALITATIVE', 'MIXED_METHODS', 'DESK_RESEARCH', 'EXPERIMENTAL', 'OTHER');
CREATE TYPE "ResearchDataClassification" AS ENUM ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED');
CREATE TYPE "ResearchTeamRole" AS ENUM ('PROJECT_MANAGER', 'PRINCIPAL_INVESTIGATOR', 'RESEARCHER', 'STATISTICIAN', 'DATA_SCIENTIST', 'DATA_MANAGER', 'ENUMERATOR', 'QUALITY_REVIEWER', 'CLIENT_REVIEWER', 'OBSERVER');
CREATE TYPE "ResearchMilestoneStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED');

ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'VIEW_RESEARCH';
ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'CREATE_RESEARCH_PROJECT';
ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'MANAGE_RESEARCH_PROJECTS';
ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'MANAGE_RESEARCH_CLIENTS';
ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'MANAGE_RESEARCH_TEAMS';
ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'DESIGN_RESEARCH_QUESTIONNAIRES';
ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'PUBLISH_RESEARCH_QUESTIONNAIRES';
ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'COLLECT_RESEARCH_DATA';
ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'MANAGE_RESEARCH_DATASETS';
ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'RUN_RESEARCH_ANALYSIS';
ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'PUBLISH_RESEARCH_DASHBOARDS';
ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'EXPORT_RESEARCH_OUTPUTS';
ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'APPROVE_RESEARCH_OUTPUTS';

CREATE TABLE "ResearchClient" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "legalName" TEXT,
  "code" TEXT,
  "industry" TEXT,
  "country" TEXT,
  "website" TEXT,
  "primaryContactName" TEXT,
  "primaryContactEmail" TEXT,
  "dataOwnerName" TEXT,
  "dataOwnerEmail" TEXT,
  "status" "ResearchClientStatus" NOT NULL DEFAULT 'ACTIVE',
  "dataClassification" "ResearchDataClassification" NOT NULL DEFAULT 'CONFIDENTIAL',
  "retentionDays" INTEGER,
  "contractualNotes" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResearchClient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResearchProject" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "clientId" TEXT,
  "reference" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "objectives" TEXT NOT NULL,
  "researchQuestions" TEXT NOT NULL,
  "hypotheses" TEXT,
  "methodology" "ResearchMethodology" NOT NULL,
  "targetPopulation" TEXT,
  "geographicScope" TEXT,
  "samplingStrategy" TEXT,
  "sampleTarget" INTEGER,
  "status" "ResearchProjectStatus" NOT NULL DEFAULT 'DRAFT',
  "dataClassification" "ResearchDataClassification" NOT NULL DEFAULT 'CONFIDENTIAL',
  "intendedUse" TEXT,
  "dataOwnershipStatement" TEXT,
  "confidentialityTerms" TEXT,
  "retentionDays" INTEGER,
  "ethicsApprovalRequired" BOOLEAN NOT NULL DEFAULT false,
  "ethicsApprovalReference" TEXT,
  "consentRequired" BOOLEAN NOT NULL DEFAULT false,
  "startDate" TIMESTAMP(3),
  "dueDate" TIMESTAMP(3),
  "projectManagerId" TEXT NOT NULL,
  "principalInvestigatorId" TEXT,
  "createdById" TEXT NOT NULL,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "activatedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResearchProject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResearchTeamMember" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "ResearchTeamRole" NOT NULL,
  "isLead" BOOLEAN NOT NULL DEFAULT false,
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResearchTeamMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResearchMilestone" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "ResearchMilestoneStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "dueDate" TIMESTAMP(3),
  "ownerId" TEXT,
  "completedById" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResearchMilestone_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResearchClient_organizationId_name_key" ON "ResearchClient"("organizationId", "name");
CREATE UNIQUE INDEX "ResearchClient_organizationId_code_key" ON "ResearchClient"("organizationId", "code");
CREATE INDEX "ResearchClient_organizationId_status_idx" ON "ResearchClient"("organizationId", "status");
CREATE INDEX "ResearchClient_createdById_idx" ON "ResearchClient"("createdById");
CREATE UNIQUE INDEX "ResearchProject_organizationId_reference_key" ON "ResearchProject"("organizationId", "reference");
CREATE INDEX "ResearchProject_organizationId_status_dueDate_idx" ON "ResearchProject"("organizationId", "status", "dueDate");
CREATE INDEX "ResearchProject_organizationId_clientId_idx" ON "ResearchProject"("organizationId", "clientId");
CREATE INDEX "ResearchProject_projectManagerId_status_idx" ON "ResearchProject"("projectManagerId", "status");
CREATE INDEX "ResearchProject_principalInvestigatorId_idx" ON "ResearchProject"("principalInvestigatorId");
CREATE UNIQUE INDEX "ResearchTeamMember_projectId_userId_key" ON "ResearchTeamMember"("projectId", "userId");
CREATE INDEX "ResearchTeamMember_userId_role_idx" ON "ResearchTeamMember"("userId", "role");
CREATE INDEX "ResearchTeamMember_projectId_role_idx" ON "ResearchTeamMember"("projectId", "role");
CREATE INDEX "ResearchMilestone_organizationId_status_dueDate_idx" ON "ResearchMilestone"("organizationId", "status", "dueDate");
CREATE INDEX "ResearchMilestone_projectId_status_idx" ON "ResearchMilestone"("projectId", "status");
CREATE INDEX "ResearchMilestone_ownerId_status_idx" ON "ResearchMilestone"("ownerId", "status");

ALTER TABLE "ResearchClient" ADD CONSTRAINT "ResearchClient_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchClient" ADD CONSTRAINT "ResearchClient_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResearchProject" ADD CONSTRAINT "ResearchProject_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchProject" ADD CONSTRAINT "ResearchProject_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ResearchClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResearchProject" ADD CONSTRAINT "ResearchProject_projectManagerId_fkey" FOREIGN KEY ("projectManagerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResearchProject" ADD CONSTRAINT "ResearchProject_principalInvestigatorId_fkey" FOREIGN KEY ("principalInvestigatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResearchProject" ADD CONSTRAINT "ResearchProject_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResearchProject" ADD CONSTRAINT "ResearchProject_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResearchTeamMember" ADD CONSTRAINT "ResearchTeamMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchTeamMember" ADD CONSTRAINT "ResearchTeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchMilestone" ADD CONSTRAINT "ResearchMilestone_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchMilestone" ADD CONSTRAINT "ResearchMilestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchMilestone" ADD CONSTRAINT "ResearchMilestone_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResearchMilestone" ADD CONSTRAINT "ResearchMilestone_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "RolePermission" ("id", "role", "permission", "createdAt")
SELECT 'rp_research_' || lower(role_value) || '_' || lower(permission_value), role_value::"UserRole", permission_value::"PermissionKey", CURRENT_TIMESTAMP
FROM (VALUES
  ('SUPER_ADMIN', 'VIEW_RESEARCH'), ('SUPER_ADMIN', 'CREATE_RESEARCH_PROJECT'), ('SUPER_ADMIN', 'MANAGE_RESEARCH_PROJECTS'), ('SUPER_ADMIN', 'MANAGE_RESEARCH_CLIENTS'), ('SUPER_ADMIN', 'MANAGE_RESEARCH_TEAMS'), ('SUPER_ADMIN', 'DESIGN_RESEARCH_QUESTIONNAIRES'), ('SUPER_ADMIN', 'PUBLISH_RESEARCH_QUESTIONNAIRES'), ('SUPER_ADMIN', 'COLLECT_RESEARCH_DATA'), ('SUPER_ADMIN', 'MANAGE_RESEARCH_DATASETS'), ('SUPER_ADMIN', 'RUN_RESEARCH_ANALYSIS'), ('SUPER_ADMIN', 'PUBLISH_RESEARCH_DASHBOARDS'), ('SUPER_ADMIN', 'EXPORT_RESEARCH_OUTPUTS'), ('SUPER_ADMIN', 'APPROVE_RESEARCH_OUTPUTS'),
  ('ORG_ADMIN', 'VIEW_RESEARCH'), ('ORG_ADMIN', 'CREATE_RESEARCH_PROJECT'), ('ORG_ADMIN', 'MANAGE_RESEARCH_PROJECTS'), ('ORG_ADMIN', 'MANAGE_RESEARCH_CLIENTS'), ('ORG_ADMIN', 'MANAGE_RESEARCH_TEAMS'), ('ORG_ADMIN', 'DESIGN_RESEARCH_QUESTIONNAIRES'), ('ORG_ADMIN', 'PUBLISH_RESEARCH_QUESTIONNAIRES'), ('ORG_ADMIN', 'COLLECT_RESEARCH_DATA'), ('ORG_ADMIN', 'MANAGE_RESEARCH_DATASETS'), ('ORG_ADMIN', 'RUN_RESEARCH_ANALYSIS'), ('ORG_ADMIN', 'PUBLISH_RESEARCH_DASHBOARDS'), ('ORG_ADMIN', 'EXPORT_RESEARCH_OUTPUTS'), ('ORG_ADMIN', 'APPROVE_RESEARCH_OUTPUTS'),
  ('EHS_MANAGER', 'VIEW_RESEARCH'), ('EHS_MANAGER', 'CREATE_RESEARCH_PROJECT'), ('EHS_MANAGER', 'MANAGE_RESEARCH_PROJECTS'), ('EHS_MANAGER', 'MANAGE_RESEARCH_CLIENTS'), ('EHS_MANAGER', 'MANAGE_RESEARCH_TEAMS'), ('EHS_MANAGER', 'DESIGN_RESEARCH_QUESTIONNAIRES'), ('EHS_MANAGER', 'PUBLISH_RESEARCH_QUESTIONNAIRES'), ('EHS_MANAGER', 'COLLECT_RESEARCH_DATA'), ('EHS_MANAGER', 'MANAGE_RESEARCH_DATASETS'), ('EHS_MANAGER', 'RUN_RESEARCH_ANALYSIS'), ('EHS_MANAGER', 'PUBLISH_RESEARCH_DASHBOARDS'), ('EHS_MANAGER', 'EXPORT_RESEARCH_OUTPUTS'), ('EHS_MANAGER', 'APPROVE_RESEARCH_OUTPUTS'),
  ('SUPERVISOR', 'VIEW_RESEARCH'), ('SUPERVISOR', 'CREATE_RESEARCH_PROJECT'), ('SUPERVISOR', 'MANAGE_RESEARCH_PROJECTS'), ('SUPERVISOR', 'MANAGE_RESEARCH_TEAMS'), ('SUPERVISOR', 'DESIGN_RESEARCH_QUESTIONNAIRES'), ('SUPERVISOR', 'COLLECT_RESEARCH_DATA'), ('SUPERVISOR', 'RUN_RESEARCH_ANALYSIS'),
  ('EMPLOYEE', 'VIEW_RESEARCH'), ('EMPLOYEE', 'COLLECT_RESEARCH_DATA'),
  ('AUDITOR', 'VIEW_RESEARCH'), ('AUDITOR', 'RUN_RESEARCH_ANALYSIS'), ('AUDITOR', 'EXPORT_RESEARCH_OUTPUTS'),
  ('DEMO_VIEWER', 'VIEW_RESEARCH')
) AS grants(role_value, permission_value)
ON CONFLICT ("role", "permission") DO NOTHING;
