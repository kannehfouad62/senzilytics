ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'VIEW_BEHAVIOR_SAFETY';
ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'RECORD_BEHAVIOR_COACHING';
ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'MANAGE_BEHAVIOR_SAFETY';
ALTER TYPE "ConfigurableFormModule" ADD VALUE IF NOT EXISTS 'BEHAVIOR_SAFETY';
ALTER TYPE "DocumentEntityType" ADD VALUE IF NOT EXISTS 'BEHAVIOR_SAFETY';

CREATE TYPE "BehaviorProgramStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE "BehaviorObservationOutcome" AS ENUM ('SAFE', 'AT_RISK', 'NOT_OBSERVED');
CREATE TYPE "BehaviorCoachingType" AS ENUM ('POSITIVE_REINFORCEMENT', 'CORRECTIVE_COACHING', 'PEER_DISCUSSION', 'STOP_WORK');
CREATE TYPE "BehaviorFollowUpStatus" AS ENUM ('NOT_REQUIRED', 'OPEN', 'IN_PROGRESS', 'COMPLETED');
CREATE TYPE "BehaviorRecognitionStatus" AS ENUM ('NOMINATED', 'APPROVED', 'DECLINED');

CREATE TABLE "BehaviorSafetyProgram" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "objective" TEXT,
  "status" "BehaviorProgramStatus" NOT NULL DEFAULT 'DRAFT',
  "siteId" TEXT,
  "departmentId" TEXT,
  "ownerId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "targetSessionsPerMonth" INTEGER NOT NULL DEFAULT 10,
  "effectiveFrom" TIMESTAMP(3),
  "effectiveTo" TIMESTAMP(3),
  "nextReviewAt" TIMESTAMP(3),
  "reviewReminderAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BehaviorSafetyProgram_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BehaviorDefinition" (
  "id" TEXT NOT NULL,
  "programId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" "SifExposureCategory" NOT NULL,
  "prompt" TEXT NOT NULL,
  "safeDescription" TEXT NOT NULL,
  "atRiskDescription" TEXT NOT NULL,
  "isCritical" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sequence" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BehaviorDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BehaviorCoachingSession" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "programId" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "departmentId" TEXT,
  "observerId" TEXT NOT NULL,
  "participantId" TEXT,
  "isParticipantAnonymous" BOOLEAN NOT NULL DEFAULT false,
  "workGroup" TEXT,
  "observedAt" TIMESTAMP(3) NOT NULL,
  "location" TEXT,
  "coachingType" "BehaviorCoachingType" NOT NULL,
  "overallOutcome" "BehaviorObservationOutcome" NOT NULL,
  "safeCount" INTEGER NOT NULL DEFAULT 0,
  "atRiskCount" INTEGER NOT NULL DEFAULT 0,
  "criticalAtRiskCount" INTEGER NOT NULL DEFAULT 0,
  "discussionSummary" TEXT,
  "workerCommitment" TEXT,
  "immediateAction" TEXT,
  "followUpStatus" "BehaviorFollowUpStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
  "followUpOwnerId" TEXT,
  "followUpDueAt" TIMESTAMP(3),
  "followUpReminderAt" TIMESTAMP(3),
  "followUpCompletedAt" TIMESTAMP(3),
  "safetyObservationId" TEXT,
  "correctiveActionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BehaviorCoachingSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BehaviorObservationResult" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "behaviorId" TEXT NOT NULL,
  "outcome" "BehaviorObservationOutcome" NOT NULL,
  "note" TEXT,
  "immediateAction" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BehaviorObservationResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BehaviorRecognition" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "sessionId" TEXT,
  "nominatedUserId" TEXT NOT NULL,
  "nominatedById" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "BehaviorRecognitionStatus" NOT NULL DEFAULT 'NOMINATED',
  "approvedById" TEXT,
  "awardedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BehaviorRecognition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BehaviorSafetyProgram_organizationId_code_key" ON "BehaviorSafetyProgram"("organizationId", "code");
CREATE UNIQUE INDEX "BehaviorSafetyProgram_organizationId_name_key" ON "BehaviorSafetyProgram"("organizationId", "name");
CREATE INDEX "BehaviorSafetyProgram_organizationId_status_nextReviewAt_idx" ON "BehaviorSafetyProgram"("organizationId", "status", "nextReviewAt");
CREATE INDEX "BehaviorSafetyProgram_siteId_departmentId_status_idx" ON "BehaviorSafetyProgram"("siteId", "departmentId", "status");
CREATE INDEX "BehaviorSafetyProgram_ownerId_status_idx" ON "BehaviorSafetyProgram"("ownerId", "status");
CREATE UNIQUE INDEX "BehaviorDefinition_programId_code_key" ON "BehaviorDefinition"("programId", "code");
CREATE INDEX "BehaviorDefinition_programId_isActive_sequence_idx" ON "BehaviorDefinition"("programId", "isActive", "sequence");
CREATE INDEX "BehaviorDefinition_category_isCritical_idx" ON "BehaviorDefinition"("category", "isCritical");
CREATE UNIQUE INDEX "BehaviorCoachingSession_safetyObservationId_key" ON "BehaviorCoachingSession"("safetyObservationId");
CREATE UNIQUE INDEX "BehaviorCoachingSession_organizationId_reference_key" ON "BehaviorCoachingSession"("organizationId", "reference");
CREATE INDEX "BehaviorCoachingSession_organizationId_observedAt_overallOutcome_idx" ON "BehaviorCoachingSession"("organizationId", "observedAt", "overallOutcome");
CREATE INDEX "BehaviorCoachingSession_programId_observedAt_idx" ON "BehaviorCoachingSession"("programId", "observedAt");
CREATE INDEX "BehaviorCoachingSession_siteId_departmentId_observedAt_idx" ON "BehaviorCoachingSession"("siteId", "departmentId", "observedAt");
CREATE INDEX "BehaviorCoachingSession_observerId_observedAt_idx" ON "BehaviorCoachingSession"("observerId", "observedAt");
CREATE INDEX "BehaviorCoachingSession_participantId_observedAt_idx" ON "BehaviorCoachingSession"("participantId", "observedAt");
CREATE INDEX "BehaviorCoachingSession_followUpOwnerId_followUpStatus_followUpDueAt_idx" ON "BehaviorCoachingSession"("followUpOwnerId", "followUpStatus", "followUpDueAt");
CREATE INDEX "BehaviorCoachingSession_correctiveActionId_idx" ON "BehaviorCoachingSession"("correctiveActionId");
CREATE UNIQUE INDEX "BehaviorObservationResult_sessionId_behaviorId_key" ON "BehaviorObservationResult"("sessionId", "behaviorId");
CREATE INDEX "BehaviorObservationResult_behaviorId_outcome_createdAt_idx" ON "BehaviorObservationResult"("behaviorId", "outcome", "createdAt");
CREATE INDEX "BehaviorRecognition_organizationId_status_createdAt_idx" ON "BehaviorRecognition"("organizationId", "status", "createdAt");
CREATE INDEX "BehaviorRecognition_nominatedUserId_status_createdAt_idx" ON "BehaviorRecognition"("nominatedUserId", "status", "createdAt");
CREATE UNIQUE INDEX "BehaviorRecognition_sessionId_key" ON "BehaviorRecognition"("sessionId");

ALTER TABLE "BehaviorSafetyProgram" ADD CONSTRAINT "BehaviorSafetyProgram_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BehaviorSafetyProgram" ADD CONSTRAINT "BehaviorSafetyProgram_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BehaviorSafetyProgram" ADD CONSTRAINT "BehaviorSafetyProgram_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BehaviorSafetyProgram" ADD CONSTRAINT "BehaviorSafetyProgram_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BehaviorSafetyProgram" ADD CONSTRAINT "BehaviorSafetyProgram_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BehaviorDefinition" ADD CONSTRAINT "BehaviorDefinition_programId_fkey" FOREIGN KEY ("programId") REFERENCES "BehaviorSafetyProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BehaviorCoachingSession" ADD CONSTRAINT "BehaviorCoachingSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BehaviorCoachingSession" ADD CONSTRAINT "BehaviorCoachingSession_programId_fkey" FOREIGN KEY ("programId") REFERENCES "BehaviorSafetyProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BehaviorCoachingSession" ADD CONSTRAINT "BehaviorCoachingSession_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BehaviorCoachingSession" ADD CONSTRAINT "BehaviorCoachingSession_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BehaviorCoachingSession" ADD CONSTRAINT "BehaviorCoachingSession_observerId_fkey" FOREIGN KEY ("observerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BehaviorCoachingSession" ADD CONSTRAINT "BehaviorCoachingSession_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BehaviorCoachingSession" ADD CONSTRAINT "BehaviorCoachingSession_followUpOwnerId_fkey" FOREIGN KEY ("followUpOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BehaviorCoachingSession" ADD CONSTRAINT "BehaviorCoachingSession_safetyObservationId_fkey" FOREIGN KEY ("safetyObservationId") REFERENCES "SafetyObservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BehaviorCoachingSession" ADD CONSTRAINT "BehaviorCoachingSession_correctiveActionId_fkey" FOREIGN KEY ("correctiveActionId") REFERENCES "CorrectiveAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BehaviorObservationResult" ADD CONSTRAINT "BehaviorObservationResult_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "BehaviorCoachingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BehaviorObservationResult" ADD CONSTRAINT "BehaviorObservationResult_behaviorId_fkey" FOREIGN KEY ("behaviorId") REFERENCES "BehaviorDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BehaviorRecognition" ADD CONSTRAINT "BehaviorRecognition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BehaviorRecognition" ADD CONSTRAINT "BehaviorRecognition_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "BehaviorCoachingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BehaviorRecognition" ADD CONSTRAINT "BehaviorRecognition_nominatedUserId_fkey" FOREIGN KEY ("nominatedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BehaviorRecognition" ADD CONSTRAINT "BehaviorRecognition_nominatedById_fkey" FOREIGN KEY ("nominatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BehaviorRecognition" ADD CONSTRAINT "BehaviorRecognition_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
