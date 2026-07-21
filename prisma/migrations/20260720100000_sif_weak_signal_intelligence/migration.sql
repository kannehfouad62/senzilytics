ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'VIEW_SIF_INTELLIGENCE';
ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'MANAGE_CRITICAL_CONTROLS';
ALTER TYPE "ConfigurableFormModule" ADD VALUE IF NOT EXISTS 'SIF_ASSURANCE';
ALTER TYPE "DocumentEntityType" ADD VALUE IF NOT EXISTS 'SIF_ASSURANCE';

CREATE TYPE "SifExposureCategory" AS ENUM ('MOBILE_EQUIPMENT', 'WORK_AT_HEIGHT', 'ENERGY_ISOLATION', 'CONFINED_SPACE', 'LIFTING_OPERATIONS', 'FIRE_EXPLOSION', 'HAZARDOUS_MATERIALS', 'ELECTRICAL', 'EXCAVATION', 'LINE_OF_FIRE', 'PROCESS_SAFETY', 'OTHER');
CREATE TYPE "SifSignalSourceType" AS ENUM ('OBSERVATION', 'INCIDENT', 'AUDIT_FINDING', 'INSPECTION_FINDING', 'RISK', 'PERMIT_TO_WORK', 'CONTROL_VERIFICATION');
CREATE TYPE "SifSignalClassification" AS ENUM ('POTENTIAL_SIF', 'PRECURSOR', 'ROUTINE', 'DISMISSED');
CREATE TYPE "CriticalControlVerificationResult" AS ENUM ('EFFECTIVE', 'DEGRADED', 'FAILED', 'NOT_VERIFIED');

CREATE TABLE "CriticalControlStandard" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" "SifExposureCategory" NOT NULL,
  "description" TEXT,
  "performanceStandard" TEXT NOT NULL,
  "verificationPrompt" TEXT NOT NULL,
  "verificationFrequencyDays" INTEGER NOT NULL DEFAULT 30,
  "siteId" TEXT,
  "departmentId" TEXT,
  "ownerId" TEXT,
  "createdById" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "nextVerificationDueAt" TIMESTAMP(3) NOT NULL,
  "reminderSentAt" TIMESTAMP(3),
  "overdueNotifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CriticalControlStandard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CriticalControlVerification" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "controlId" TEXT NOT NULL,
  "verifiedById" TEXT NOT NULL,
  "verifiedAt" TIMESTAMP(3) NOT NULL,
  "nextDueAt" TIMESTAMP(3) NOT NULL,
  "result" "CriticalControlVerificationResult" NOT NULL,
  "evidenceReference" TEXT,
  "findings" TEXT,
  "immediateAction" TEXT,
  "correctiveActionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CriticalControlVerification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SifSignalReview" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "sourceType" "SifSignalSourceType" NOT NULL,
  "sourceId" TEXT NOT NULL,
  "classification" "SifSignalClassification" NOT NULL,
  "exposureCategory" "SifExposureCategory" NOT NULL,
  "potentialSeverity" "RiskLevel" NOT NULL,
  "rationale" TEXT NOT NULL,
  "controlFailureNotes" TEXT,
  "reviewedById" TEXT NOT NULL,
  "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SifSignalReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CriticalControlStandard_organizationId_code_key" ON "CriticalControlStandard"("organizationId", "code");
CREATE UNIQUE INDEX "CriticalControlStandard_organizationId_name_key" ON "CriticalControlStandard"("organizationId", "name");
CREATE INDEX "CriticalControlStandard_organizationId_category_isActive_idx" ON "CriticalControlStandard"("organizationId", "category", "isActive");
CREATE INDEX "CriticalControlStandard_organizationId_nextVerificationDueAt_idx" ON "CriticalControlStandard"("organizationId", "nextVerificationDueAt");
CREATE INDEX "CriticalControlStandard_siteId_departmentId_idx" ON "CriticalControlStandard"("siteId", "departmentId");
CREATE INDEX "CriticalControlStandard_ownerId_isActive_idx" ON "CriticalControlStandard"("ownerId", "isActive");
CREATE INDEX "CriticalControlVerification_organizationId_result_verifiedAt_idx" ON "CriticalControlVerification"("organizationId", "result", "verifiedAt");
CREATE INDEX "CriticalControlVerification_controlId_verifiedAt_idx" ON "CriticalControlVerification"("controlId", "verifiedAt");
CREATE INDEX "CriticalControlVerification_verifiedById_verifiedAt_idx" ON "CriticalControlVerification"("verifiedById", "verifiedAt");
CREATE INDEX "CriticalControlVerification_correctiveActionId_idx" ON "CriticalControlVerification"("correctiveActionId");
CREATE UNIQUE INDEX "SifSignalReview_organizationId_sourceType_sourceId_key" ON "SifSignalReview"("organizationId", "sourceType", "sourceId");
CREATE INDEX "SifSignalReview_organizationId_classification_reviewedAt_idx" ON "SifSignalReview"("organizationId", "classification", "reviewedAt");
CREATE INDEX "SifSignalReview_organizationId_exposureCategory_reviewedAt_idx" ON "SifSignalReview"("organizationId", "exposureCategory", "reviewedAt");
CREATE INDEX "SifSignalReview_reviewedById_reviewedAt_idx" ON "SifSignalReview"("reviewedById", "reviewedAt");

ALTER TABLE "CriticalControlStandard" ADD CONSTRAINT "CriticalControlStandard_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CriticalControlStandard" ADD CONSTRAINT "CriticalControlStandard_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CriticalControlStandard" ADD CONSTRAINT "CriticalControlStandard_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CriticalControlStandard" ADD CONSTRAINT "CriticalControlStandard_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CriticalControlStandard" ADD CONSTRAINT "CriticalControlStandard_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CriticalControlVerification" ADD CONSTRAINT "CriticalControlVerification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CriticalControlVerification" ADD CONSTRAINT "CriticalControlVerification_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "CriticalControlStandard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CriticalControlVerification" ADD CONSTRAINT "CriticalControlVerification_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CriticalControlVerification" ADD CONSTRAINT "CriticalControlVerification_correctiveActionId_fkey" FOREIGN KEY ("correctiveActionId") REFERENCES "CorrectiveAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SifSignalReview" ADD CONSTRAINT "SifSignalReview_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SifSignalReview" ADD CONSTRAINT "SifSignalReview_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
