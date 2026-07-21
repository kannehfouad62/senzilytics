ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'VIEW_INDUSTRIAL_HYGIENE';
ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'MANAGE_INDUSTRIAL_HYGIENE';
ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'VIEW_OCCUPATIONAL_HEALTH';
ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'MANAGE_OCCUPATIONAL_HEALTH';

ALTER TYPE "ConfigurableFormModule" ADD VALUE IF NOT EXISTS 'INDUSTRIAL_HYGIENE';
ALTER TYPE "DocumentEntityType" ADD VALUE IF NOT EXISTS 'INDUSTRIAL_HYGIENE';

CREATE TYPE "HygieneAgentCategory" AS ENUM ('CHEMICAL', 'NOISE', 'BIOLOGICAL', 'ERGONOMIC', 'HEAT', 'COLD', 'VIBRATION', 'RADIATION', 'INDOOR_AIR_QUALITY', 'OTHER');
CREATE TYPE "ExposureAssessmentStatus" AS ENUM ('DRAFT', 'PLANNED', 'IN_PROGRESS', 'UNDER_REVIEW', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ExposureSampleType" AS ENUM ('PERSONAL', 'AREA', 'TASK', 'DIRECT_READING', 'WIPE');
CREATE TYPE "ExposureResultClassification" AS ENUM ('BELOW_DETECTION', 'BELOW_ACTION_LEVEL', 'AT_OR_ABOVE_ACTION_LEVEL', 'ABOVE_LIMIT', 'NOT_EVALUATED');
CREATE TYPE "SurveillanceProgramStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE "SurveillanceEnrollmentStatus" AS ENUM ('ENROLLED', 'DUE', 'COMPLETED', 'OVERDUE', 'REMOVED');
CREATE TYPE "FitnessOutcome" AS ENUM ('NOT_ASSESSED', 'CLEARED', 'CLEARED_WITH_RESTRICTIONS', 'TEMPORARILY_NOT_CLEARED');

CREATE TABLE "HygieneAgent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" "HygieneAgentCategory" NOT NULL,
  "casNumber" TEXT,
  "description" TEXT,
  "healthEffects" TEXT,
  "exposureRoutes" TEXT,
  "occupationalLimit" DOUBLE PRECISION,
  "actionLevel" DOUBLE PRECISION,
  "ceilingLimit" DOUBLE PRECISION,
  "unit" TEXT,
  "limitSource" TEXT,
  "samplingMethod" TEXT,
  "analyticalMethod" TEXT,
  "requiresSurveillance" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HygieneAgent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SimilarExposureGroup" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "departmentId" TEXT,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "description" TEXT,
  "jobRoles" TEXT,
  "tasks" TEXT,
  "locations" TEXT,
  "exposedHeadcount" INTEGER,
  "existingControls" TEXT,
  "requiredPpe" TEXT,
  "ownerId" TEXT,
  "reviewDueDate" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SimilarExposureGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SimilarExposureGroupAgent" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "notes" TEXT,
  CONSTRAINT "SimilarExposureGroupAgent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExposureAssessment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "ExposureAssessmentStatus" NOT NULL DEFAULT 'DRAFT',
  "groupId" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "departmentId" TEXT,
  "assessorId" TEXT,
  "scheduledAt" TIMESTAMP(3),
  "dueDate" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "scope" TEXT,
  "samplingPlan" TEXT,
  "observations" TEXT,
  "conclusions" TEXT,
  "recommendations" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExposureAssessment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExposureSample" (
  "id" TEXT NOT NULL,
  "assessmentId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "sampleType" "ExposureSampleType" NOT NULL,
  "sampleReference" TEXT,
  "sampledWorkerId" TEXT,
  "location" TEXT,
  "task" TEXT,
  "sampledAt" TIMESTAMP(3) NOT NULL,
  "durationMinutes" INTEGER,
  "resultValue" DOUBLE PRECISION,
  "reportingLimit" DOUBLE PRECISION,
  "occupationalLimit" DOUBLE PRECISION,
  "actionLevel" DOUBLE PRECISION,
  "unit" TEXT,
  "exposureRatio" DOUBLE PRECISION,
  "classification" "ExposureResultClassification" NOT NULL DEFAULT 'NOT_EVALUATED',
  "laboratory" TEXT,
  "analyticalMethod" TEXT,
  "analyzedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExposureSample_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MedicalSurveillanceProgram" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "SurveillanceProgramStatus" NOT NULL DEFAULT 'DRAFT',
  "regulatoryBasis" TEXT,
  "protocolReference" TEXT,
  "providerName" TEXT,
  "frequencyMonths" INTEGER NOT NULL DEFAULT 12,
  "leadDays" INTEGER NOT NULL DEFAULT 30,
  "agentId" TEXT,
  "groupId" TEXT,
  "responsibleUserId" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MedicalSurveillanceProgram_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MedicalSurveillanceEnrollment" (
  "id" TEXT NOT NULL,
  "programId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "SurveillanceEnrollmentStatus" NOT NULL DEFAULT 'ENROLLED',
  "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastCompletedAt" TIMESTAMP(3),
  "nextDueAt" TIMESTAMP(3) NOT NULL,
  "fitnessOutcome" "FitnessOutcome" NOT NULL DEFAULT 'NOT_ASSESSED',
  "workRestrictions" TEXT,
  "certificateReference" TEXT,
  "completedById" TEXT,
  "removedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MedicalSurveillanceEnrollment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HygieneAgent_organizationId_name_key" ON "HygieneAgent"("organizationId", "name");
CREATE INDEX "HygieneAgent_organizationId_category_isActive_idx" ON "HygieneAgent"("organizationId", "category", "isActive");
CREATE UNIQUE INDEX "SimilarExposureGroup_organizationId_name_key" ON "SimilarExposureGroup"("organizationId", "name");
CREATE UNIQUE INDEX "SimilarExposureGroup_organizationId_code_key" ON "SimilarExposureGroup"("organizationId", "code");
CREATE INDEX "SimilarExposureGroup_organizationId_isActive_reviewDueDate_idx" ON "SimilarExposureGroup"("organizationId", "isActive", "reviewDueDate");
CREATE INDEX "SimilarExposureGroup_siteId_departmentId_idx" ON "SimilarExposureGroup"("siteId", "departmentId");
CREATE UNIQUE INDEX "SimilarExposureGroupAgent_groupId_agentId_key" ON "SimilarExposureGroupAgent"("groupId", "agentId");
CREATE INDEX "SimilarExposureGroupAgent_agentId_idx" ON "SimilarExposureGroupAgent"("agentId");
CREATE UNIQUE INDEX "ExposureAssessment_organizationId_reference_key" ON "ExposureAssessment"("organizationId", "reference");
CREATE INDEX "ExposureAssessment_organizationId_status_dueDate_idx" ON "ExposureAssessment"("organizationId", "status", "dueDate");
CREATE INDEX "ExposureAssessment_groupId_scheduledAt_idx" ON "ExposureAssessment"("groupId", "scheduledAt");
CREATE INDEX "ExposureAssessment_assessorId_status_idx" ON "ExposureAssessment"("assessorId", "status");
CREATE UNIQUE INDEX "ExposureSample_assessmentId_sampleReference_key" ON "ExposureSample"("assessmentId", "sampleReference");
CREATE INDEX "ExposureSample_assessmentId_classification_idx" ON "ExposureSample"("assessmentId", "classification");
CREATE INDEX "ExposureSample_agentId_sampledAt_idx" ON "ExposureSample"("agentId", "sampledAt");
CREATE INDEX "ExposureSample_sampledWorkerId_idx" ON "ExposureSample"("sampledWorkerId");
CREATE UNIQUE INDEX "MedicalSurveillanceProgram_organizationId_name_key" ON "MedicalSurveillanceProgram"("organizationId", "name");
CREATE INDEX "MedicalSurveillanceProgram_organizationId_status_isActive_idx" ON "MedicalSurveillanceProgram"("organizationId", "status", "isActive");
CREATE INDEX "MedicalSurveillanceProgram_responsibleUserId_idx" ON "MedicalSurveillanceProgram"("responsibleUserId");
CREATE UNIQUE INDEX "MedicalSurveillanceEnrollment_programId_userId_key" ON "MedicalSurveillanceEnrollment"("programId", "userId");
CREATE INDEX "MedicalSurveillanceEnrollment_status_nextDueAt_idx" ON "MedicalSurveillanceEnrollment"("status", "nextDueAt");
CREATE INDEX "MedicalSurveillanceEnrollment_userId_status_idx" ON "MedicalSurveillanceEnrollment"("userId", "status");

ALTER TABLE "HygieneAgent" ADD CONSTRAINT "HygieneAgent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SimilarExposureGroup" ADD CONSTRAINT "SimilarExposureGroup_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SimilarExposureGroup" ADD CONSTRAINT "SimilarExposureGroup_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SimilarExposureGroup" ADD CONSTRAINT "SimilarExposureGroup_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SimilarExposureGroup" ADD CONSTRAINT "SimilarExposureGroup_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SimilarExposureGroupAgent" ADD CONSTRAINT "SimilarExposureGroupAgent_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "SimilarExposureGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SimilarExposureGroupAgent" ADD CONSTRAINT "SimilarExposureGroupAgent_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "HygieneAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExposureAssessment" ADD CONSTRAINT "ExposureAssessment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExposureAssessment" ADD CONSTRAINT "ExposureAssessment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "SimilarExposureGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExposureAssessment" ADD CONSTRAINT "ExposureAssessment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExposureAssessment" ADD CONSTRAINT "ExposureAssessment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExposureAssessment" ADD CONSTRAINT "ExposureAssessment_assessorId_fkey" FOREIGN KEY ("assessorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExposureSample" ADD CONSTRAINT "ExposureSample_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "ExposureAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExposureSample" ADD CONSTRAINT "ExposureSample_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "HygieneAgent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExposureSample" ADD CONSTRAINT "ExposureSample_sampledWorkerId_fkey" FOREIGN KEY ("sampledWorkerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExposureSample" ADD CONSTRAINT "ExposureSample_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MedicalSurveillanceProgram" ADD CONSTRAINT "MedicalSurveillanceProgram_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MedicalSurveillanceProgram" ADD CONSTRAINT "MedicalSurveillanceProgram_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "HygieneAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MedicalSurveillanceProgram" ADD CONSTRAINT "MedicalSurveillanceProgram_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "SimilarExposureGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MedicalSurveillanceProgram" ADD CONSTRAINT "MedicalSurveillanceProgram_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MedicalSurveillanceEnrollment" ADD CONSTRAINT "MedicalSurveillanceEnrollment_programId_fkey" FOREIGN KEY ("programId") REFERENCES "MedicalSurveillanceProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MedicalSurveillanceEnrollment" ADD CONSTRAINT "MedicalSurveillanceEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MedicalSurveillanceEnrollment" ADD CONSTRAINT "MedicalSurveillanceEnrollment_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
