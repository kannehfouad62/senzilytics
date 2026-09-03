CREATE TYPE "ResearchCollectionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED', 'CANCELLED');
CREATE TYPE "ResearchAssignmentStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'REVOKED');

CREATE TABLE "ResearchCollectionWave" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "questionnaireId" TEXT NOT NULL,
  "formVersionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "ResearchCollectionStatus" NOT NULL DEFAULT 'DRAFT',
  "opensAt" TIMESTAMP(3),
  "closesAt" TIMESTAMP(3),
  "assignmentDueAt" TIMESTAMP(3),
  "targetResponseCount" INTEGER,
  "instructions" TEXT,
  "createdById" TEXT NOT NULL,
  "activatedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResearchCollectionWave_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResearchQuestionnaireAssignment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "respondentId" TEXT NOT NULL,
  "assignedById" TEXT NOT NULL,
  "status" "ResearchAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
  "dueAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "submissionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResearchQuestionnaireAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResearchCollectionWave_questionnaireId_name_key" ON "ResearchCollectionWave"("questionnaireId", "name");
CREATE INDEX "ResearchCollectionWave_organizationId_status_closesAt_idx" ON "ResearchCollectionWave"("organizationId", "status", "closesAt");
CREATE INDEX "ResearchCollectionWave_projectId_status_idx" ON "ResearchCollectionWave"("projectId", "status");
CREATE INDEX "ResearchCollectionWave_formVersionId_idx" ON "ResearchCollectionWave"("formVersionId");
CREATE UNIQUE INDEX "ResearchQuestionnaireAssignment_submissionId_key" ON "ResearchQuestionnaireAssignment"("submissionId");
CREATE UNIQUE INDEX "ResearchQuestionnaireAssignment_collectionId_respondentId_key" ON "ResearchQuestionnaireAssignment"("collectionId", "respondentId");
CREATE INDEX "ResearchQuestionnaireAssignment_organizationId_status_dueAt_idx" ON "ResearchQuestionnaireAssignment"("organizationId", "status", "dueAt");
CREATE INDEX "ResearchQuestionnaireAssignment_respondentId_status_dueAt_idx" ON "ResearchQuestionnaireAssignment"("respondentId", "status", "dueAt");

ALTER TABLE "ResearchCollectionWave" ADD CONSTRAINT "ResearchCollectionWave_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchCollectionWave" ADD CONSTRAINT "ResearchCollectionWave_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchCollectionWave" ADD CONSTRAINT "ResearchCollectionWave_questionnaireId_fkey" FOREIGN KEY ("questionnaireId") REFERENCES "ResearchQuestionnaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResearchCollectionWave" ADD CONSTRAINT "ResearchCollectionWave_formVersionId_fkey" FOREIGN KEY ("formVersionId") REFERENCES "ConfigurableFormVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResearchCollectionWave" ADD CONSTRAINT "ResearchCollectionWave_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResearchQuestionnaireAssignment" ADD CONSTRAINT "ResearchQuestionnaireAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchQuestionnaireAssignment" ADD CONSTRAINT "ResearchQuestionnaireAssignment_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "ResearchCollectionWave"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchQuestionnaireAssignment" ADD CONSTRAINT "ResearchQuestionnaireAssignment_respondentId_fkey" FOREIGN KEY ("respondentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchQuestionnaireAssignment" ADD CONSTRAINT "ResearchQuestionnaireAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResearchQuestionnaireAssignment" ADD CONSTRAINT "ResearchQuestionnaireAssignment_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ConfigurableFormSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
