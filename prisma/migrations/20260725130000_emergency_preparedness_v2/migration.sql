ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'VIEW_EMERGENCY_PREPAREDNESS';
ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'MANAGE_EMERGENCY_PREPAREDNESS';
ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'RECORD_EMERGENCY_RESPONSE';
ALTER TYPE "ConfigurableFormModule" ADD VALUE IF NOT EXISTS 'EMERGENCY_PREPAREDNESS';
ALTER TYPE "DocumentEntityType" ADD VALUE IF NOT EXISTS 'EMERGENCY_PREPAREDNESS';

CREATE TYPE "EmergencyPlanType" AS ENUM ('ALL_HAZARDS', 'FIRE', 'MEDICAL', 'CHEMICAL_RELEASE', 'ENVIRONMENTAL_RELEASE', 'SEVERE_WEATHER', 'SECURITY', 'UTILITY_FAILURE', 'TRANSPORTATION', 'NATURAL_DISASTER', 'OTHER');
CREATE TYPE "EmergencyPlanStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'ACTIVE', 'REJECTED', 'ARCHIVED');
CREATE TYPE "EmergencyScenarioCategory" AS ENUM ('FIRE', 'MEDICAL', 'CHEMICAL_RELEASE', 'ENVIRONMENTAL_RELEASE', 'SEVERE_WEATHER', 'SECURITY', 'UTILITY_FAILURE', 'TRANSPORTATION', 'NATURAL_DISASTER', 'OTHER');
CREATE TYPE "EmergencyContactType" AS ENUM ('INTERNAL', 'FIRE_RESCUE', 'MEDICAL', 'POLICE', 'ENVIRONMENTAL_AGENCY', 'UTILITY', 'MUTUAL_AID', 'CONTRACTOR', 'OTHER');
CREATE TYPE "EmergencyDrillType" AS ENUM ('TABLETOP', 'FUNCTIONAL', 'EVACUATION', 'FULL_SCALE');
CREATE TYPE "EmergencyDrillStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "EmergencyDrillRating" AS ENUM ('EFFECTIVE', 'PARTIALLY_EFFECTIVE', 'INEFFECTIVE');
CREATE TYPE "EmergencyActivationStatus" AS ENUM ('ACTIVE', 'STABILIZED', 'STOOD_DOWN', 'REVIEWED');
CREATE TYPE "EmergencyImprovementStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'CANCELLED');

CREATE TABLE "EmergencyPlan" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "departmentId" TEXT,
  "ownerId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "submittedById" TEXT,
  "approvedById" TEXT,
  "previousVersionId" TEXT,
  "reference" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "title" TEXT NOT NULL,
  "type" "EmergencyPlanType" NOT NULL,
  "status" "EmergencyPlanStatus" NOT NULL DEFAULT 'DRAFT',
  "scope" TEXT NOT NULL,
  "purpose" TEXT,
  "hazardProfile" TEXT NOT NULL,
  "commandStructure" TEXT NOT NULL,
  "communicationProcedure" TEXT NOT NULL,
  "evacuationProcedure" TEXT NOT NULL,
  "shelterProcedure" TEXT,
  "accountabilityProcedure" TEXT NOT NULL,
  "medicalProcedure" TEXT,
  "externalCoordination" TEXT,
  "recoveryCriteria" TEXT NOT NULL,
  "effectiveAt" TIMESTAMP(3),
  "reviewDueAt" TIMESTAMP(3) NOT NULL,
  "submittedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "reviewReminderAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmergencyPlan_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmergencyPlan_version_check" CHECK ("version" > 0)
);

CREATE TABLE "EmergencyScenario" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "category" "EmergencyScenarioCategory" NOT NULL,
  "riskLevel" "RiskLevel" NOT NULL,
  "title" TEXT NOT NULL,
  "triggerCriteria" TEXT NOT NULL,
  "immediateActions" TEXT NOT NULL,
  "protectiveActions" TEXT NOT NULL,
  "evacuationAreas" TEXT,
  "musterPoints" TEXT,
  "shutdownSteps" TEXT,
  "requiredEquipment" TEXT,
  "specialAssistance" TEXT,
  "externalAgencies" TEXT,
  "evacuationRequired" BOOLEAN NOT NULL DEFAULT false,
  "shelterInPlace" BOOLEAN NOT NULL DEFAULT false,
  "sequence" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmergencyScenario_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmergencyScenario_sequence_check" CHECK ("sequence" >= 0)
);

CREATE TABLE "EmergencyContact" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "type" "EmergencyContactType" NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT,
  "organizationName" TEXT,
  "phone" TEXT NOT NULL,
  "alternatePhone" TEXT,
  "email" TEXT,
  "availability" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmergencyContact_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmergencyContact_priority_check" CHECK ("priority" >= 0)
);

CREATE TABLE "EmergencyDrill" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "scenarioId" TEXT,
  "leadId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "reviewedById" TEXT,
  "reference" TEXT NOT NULL,
  "type" "EmergencyDrillType" NOT NULL,
  "status" "EmergencyDrillStatus" NOT NULL DEFAULT 'PLANNED',
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "objectives" TEXT NOT NULL,
  "scope" TEXT,
  "expectedParticipants" INTEGER NOT NULL DEFAULT 0,
  "actualParticipants" INTEGER,
  "notificationMethod" TEXT,
  "alarmActivationSeconds" INTEGER,
  "evacuationSeconds" INTEGER,
  "accountabilitySeconds" INTEGER,
  "rating" "EmergencyDrillRating",
  "strengths" TEXT,
  "gaps" TEXT,
  "observerNotes" TEXT,
  "afterActionSummary" TEXT,
  "cancelledReason" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reminderSentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmergencyDrill_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmergencyDrill_participant_counts_check" CHECK ("expectedParticipants" >= 0 AND ("actualParticipants" IS NULL OR "actualParticipants" >= 0)),
  CONSTRAINT "EmergencyDrill_response_times_check" CHECK (("alarmActivationSeconds" IS NULL OR "alarmActivationSeconds" >= 0) AND ("evacuationSeconds" IS NULL OR "evacuationSeconds" >= 0) AND ("accountabilitySeconds" IS NULL OR "accountabilitySeconds" >= 0))
);

CREATE TABLE "EmergencyActivation" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "scenarioId" TEXT,
  "declaredById" TEXT NOT NULL,
  "incidentCommanderId" TEXT NOT NULL,
  "stoodDownById" TEXT,
  "reviewedById" TEXT,
  "reference" TEXT NOT NULL,
  "status" "EmergencyActivationStatus" NOT NULL DEFAULT 'ACTIVE',
  "severity" "RiskLevel" NOT NULL,
  "location" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "declaredAt" TIMESTAMP(3) NOT NULL,
  "notificationMethod" TEXT NOT NULL,
  "protectiveActions" TEXT NOT NULL,
  "externalAgenciesNotified" TEXT,
  "peopleAtRisk" INTEGER NOT NULL DEFAULT 0,
  "injuriesReported" INTEGER NOT NULL DEFAULT 0,
  "missingPersons" INTEGER NOT NULL DEFAULT 0,
  "stabilizedAt" TIMESTAMP(3),
  "stoodDownAt" TIMESTAMP(3),
  "stoodDownRationale" TEXT,
  "afterActionDueAt" TIMESTAMP(3) NOT NULL,
  "reviewedAt" TIMESTAMP(3),
  "afterActionSummary" TEXT,
  "lessonsLearned" TEXT,
  "reminderSentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmergencyActivation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmergencyActivation_counts_check" CHECK ("peopleAtRisk" >= 0 AND "injuriesReported" >= 0 AND "missingPersons" >= 0)
);

CREATE TABLE "EmergencyImprovement" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "drillId" TEXT,
  "activationId" TEXT,
  "ownerId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "verifiedById" TEXT,
  "correctiveActionId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "priority" "RiskLevel" NOT NULL,
  "status" "EmergencyImprovementStatus" NOT NULL DEFAULT 'OPEN',
  "dueAt" TIMESTAMP(3) NOT NULL,
  "completionEvidence" TEXT,
  "verificationNotes" TEXT,
  "completedAt" TIMESTAMP(3),
  "verifiedAt" TIMESTAMP(3),
  "reminderSentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmergencyImprovement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmergencyPlan_previousVersionId_key" ON "EmergencyPlan"("previousVersionId");
CREATE UNIQUE INDEX "EmergencyPlan_organizationId_reference_version_key" ON "EmergencyPlan"("organizationId", "reference", "version");
CREATE INDEX "EmergencyPlan_organizationId_status_reviewDueAt_idx" ON "EmergencyPlan"("organizationId", "status", "reviewDueAt");
CREATE INDEX "EmergencyPlan_siteId_status_idx" ON "EmergencyPlan"("siteId", "status");
CREATE INDEX "EmergencyPlan_ownerId_status_idx" ON "EmergencyPlan"("ownerId", "status");
CREATE UNIQUE INDEX "EmergencyScenario_planId_title_key" ON "EmergencyScenario"("planId", "title");
CREATE INDEX "EmergencyScenario_planId_isActive_sequence_idx" ON "EmergencyScenario"("planId", "isActive", "sequence");
CREATE UNIQUE INDEX "EmergencyContact_planId_name_phone_key" ON "EmergencyContact"("planId", "name", "phone");
CREATE INDEX "EmergencyContact_organizationId_type_isActive_idx" ON "EmergencyContact"("organizationId", "type", "isActive");
CREATE INDEX "EmergencyContact_planId_priority_idx" ON "EmergencyContact"("planId", "priority");
CREATE UNIQUE INDEX "EmergencyDrill_organizationId_reference_key" ON "EmergencyDrill"("organizationId", "reference");
CREATE INDEX "EmergencyDrill_organizationId_status_scheduledAt_idx" ON "EmergencyDrill"("organizationId", "status", "scheduledAt");
CREATE INDEX "EmergencyDrill_planId_scheduledAt_idx" ON "EmergencyDrill"("planId", "scheduledAt");
CREATE INDEX "EmergencyDrill_leadId_status_idx" ON "EmergencyDrill"("leadId", "status");
CREATE UNIQUE INDEX "EmergencyActivation_organizationId_reference_key" ON "EmergencyActivation"("organizationId", "reference");
CREATE INDEX "EmergencyActivation_organizationId_status_declaredAt_idx" ON "EmergencyActivation"("organizationId", "status", "declaredAt");
CREATE INDEX "EmergencyActivation_planId_declaredAt_idx" ON "EmergencyActivation"("planId", "declaredAt");
CREATE INDEX "EmergencyActivation_incidentCommanderId_status_idx" ON "EmergencyActivation"("incidentCommanderId", "status");
CREATE INDEX "EmergencyActivation_organizationId_afterActionDueAt_status_idx" ON "EmergencyActivation"("organizationId", "afterActionDueAt", "status");
CREATE UNIQUE INDEX "EmergencyImprovement_correctiveActionId_key" ON "EmergencyImprovement"("correctiveActionId");
CREATE INDEX "EmergencyImprovement_organizationId_status_dueAt_idx" ON "EmergencyImprovement"("organizationId", "status", "dueAt");
CREATE INDEX "EmergencyImprovement_planId_status_idx" ON "EmergencyImprovement"("planId", "status");
CREATE INDEX "EmergencyImprovement_drillId_status_idx" ON "EmergencyImprovement"("drillId", "status");
CREATE INDEX "EmergencyImprovement_activationId_status_idx" ON "EmergencyImprovement"("activationId", "status");
CREATE INDEX "EmergencyImprovement_ownerId_status_idx" ON "EmergencyImprovement"("ownerId", "status");

ALTER TABLE "EmergencyPlan" ADD CONSTRAINT "EmergencyPlan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmergencyPlan" ADD CONSTRAINT "EmergencyPlan_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmergencyPlan" ADD CONSTRAINT "EmergencyPlan_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmergencyPlan" ADD CONSTRAINT "EmergencyPlan_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmergencyPlan" ADD CONSTRAINT "EmergencyPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmergencyPlan" ADD CONSTRAINT "EmergencyPlan_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmergencyPlan" ADD CONSTRAINT "EmergencyPlan_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmergencyPlan" ADD CONSTRAINT "EmergencyPlan_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "EmergencyPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmergencyScenario" ADD CONSTRAINT "EmergencyScenario_planId_fkey" FOREIGN KEY ("planId") REFERENCES "EmergencyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmergencyContact" ADD CONSTRAINT "EmergencyContact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmergencyContact" ADD CONSTRAINT "EmergencyContact_planId_fkey" FOREIGN KEY ("planId") REFERENCES "EmergencyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmergencyDrill" ADD CONSTRAINT "EmergencyDrill_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmergencyDrill" ADD CONSTRAINT "EmergencyDrill_planId_fkey" FOREIGN KEY ("planId") REFERENCES "EmergencyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmergencyDrill" ADD CONSTRAINT "EmergencyDrill_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "EmergencyScenario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmergencyDrill" ADD CONSTRAINT "EmergencyDrill_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmergencyDrill" ADD CONSTRAINT "EmergencyDrill_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmergencyDrill" ADD CONSTRAINT "EmergencyDrill_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmergencyActivation" ADD CONSTRAINT "EmergencyActivation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmergencyActivation" ADD CONSTRAINT "EmergencyActivation_planId_fkey" FOREIGN KEY ("planId") REFERENCES "EmergencyPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmergencyActivation" ADD CONSTRAINT "EmergencyActivation_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "EmergencyScenario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmergencyActivation" ADD CONSTRAINT "EmergencyActivation_declaredById_fkey" FOREIGN KEY ("declaredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmergencyActivation" ADD CONSTRAINT "EmergencyActivation_incidentCommanderId_fkey" FOREIGN KEY ("incidentCommanderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmergencyActivation" ADD CONSTRAINT "EmergencyActivation_stoodDownById_fkey" FOREIGN KEY ("stoodDownById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmergencyActivation" ADD CONSTRAINT "EmergencyActivation_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmergencyImprovement" ADD CONSTRAINT "EmergencyImprovement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmergencyImprovement" ADD CONSTRAINT "EmergencyImprovement_planId_fkey" FOREIGN KEY ("planId") REFERENCES "EmergencyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmergencyImprovement" ADD CONSTRAINT "EmergencyImprovement_drillId_fkey" FOREIGN KEY ("drillId") REFERENCES "EmergencyDrill"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmergencyImprovement" ADD CONSTRAINT "EmergencyImprovement_activationId_fkey" FOREIGN KEY ("activationId") REFERENCES "EmergencyActivation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmergencyImprovement" ADD CONSTRAINT "EmergencyImprovement_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmergencyImprovement" ADD CONSTRAINT "EmergencyImprovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmergencyImprovement" ADD CONSTRAINT "EmergencyImprovement_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmergencyImprovement" ADD CONSTRAINT "EmergencyImprovement_correctiveActionId_fkey" FOREIGN KEY ("correctiveActionId") REFERENCES "CorrectiveAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "RolePermission" ("id", "role", "permission", "createdAt") VALUES
  ('rp_super_admin_view_emergency', 'SUPER_ADMIN', 'VIEW_EMERGENCY_PREPAREDNESS', CURRENT_TIMESTAMP),
  ('rp_super_admin_manage_emergency', 'SUPER_ADMIN', 'MANAGE_EMERGENCY_PREPAREDNESS', CURRENT_TIMESTAMP),
  ('rp_super_admin_record_emergency', 'SUPER_ADMIN', 'RECORD_EMERGENCY_RESPONSE', CURRENT_TIMESTAMP),
  ('rp_org_admin_view_emergency', 'ORG_ADMIN', 'VIEW_EMERGENCY_PREPAREDNESS', CURRENT_TIMESTAMP),
  ('rp_org_admin_manage_emergency', 'ORG_ADMIN', 'MANAGE_EMERGENCY_PREPAREDNESS', CURRENT_TIMESTAMP),
  ('rp_org_admin_record_emergency', 'ORG_ADMIN', 'RECORD_EMERGENCY_RESPONSE', CURRENT_TIMESTAMP),
  ('rp_ehs_manager_view_emergency', 'EHS_MANAGER', 'VIEW_EMERGENCY_PREPAREDNESS', CURRENT_TIMESTAMP),
  ('rp_ehs_manager_manage_emergency', 'EHS_MANAGER', 'MANAGE_EMERGENCY_PREPAREDNESS', CURRENT_TIMESTAMP),
  ('rp_ehs_manager_record_emergency', 'EHS_MANAGER', 'RECORD_EMERGENCY_RESPONSE', CURRENT_TIMESTAMP),
  ('rp_supervisor_view_emergency', 'SUPERVISOR', 'VIEW_EMERGENCY_PREPAREDNESS', CURRENT_TIMESTAMP),
  ('rp_supervisor_record_emergency', 'SUPERVISOR', 'RECORD_EMERGENCY_RESPONSE', CURRENT_TIMESTAMP),
  ('rp_employee_view_emergency', 'EMPLOYEE', 'VIEW_EMERGENCY_PREPAREDNESS', CURRENT_TIMESTAMP),
  ('rp_auditor_view_emergency', 'AUDITOR', 'VIEW_EMERGENCY_PREPAREDNESS', CURRENT_TIMESTAMP),
  ('rp_demo_view_emergency', 'DEMO_VIEWER', 'VIEW_EMERGENCY_PREPAREDNESS', CURRENT_TIMESTAMP)
ON CONFLICT ("role", "permission") DO NOTHING;
