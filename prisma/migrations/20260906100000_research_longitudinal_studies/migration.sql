CREATE TYPE "ResearchLongitudinalStudyStatus" AS ENUM ('DRAFT','ACTIVE','PAUSED','COMPLETED','CANCELLED');
CREATE TYPE "ResearchLongitudinalWaveType" AS ENUM ('BASELINE','MIDLINE','ENDLINE','FOLLOW_UP','CUSTOM');
CREATE TYPE "ResearchLongitudinalParticipantStatus" AS ENUM ('ENROLLED','WITHDRAWN','COMPLETED','LOST_TO_FOLLOW_UP');

CREATE TABLE "ResearchLongitudinalStudy" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "questionnaireId" TEXT NOT NULL,
  "panelId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "recontactStatement" TEXT NOT NULL,
  "plannedWaveCount" INTEGER NOT NULL,
  "retentionTargetPercent" INTEGER NOT NULL DEFAULT 80,
  "status" "ResearchLongitudinalStudyStatus" NOT NULL DEFAULT 'DRAFT',
  "createdById" TEXT NOT NULL,
  "activatedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResearchLongitudinalStudy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResearchLongitudinalWave" (
  "id" TEXT NOT NULL,
  "studyId" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "type" "ResearchLongitudinalWaveType" NOT NULL,
  "scheduledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResearchLongitudinalWave_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResearchLongitudinalParticipant" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "studyId" TEXT NOT NULL,
  "panelMemberId" TEXT NOT NULL,
  "subjectCode" TEXT NOT NULL,
  "status" "ResearchLongitudinalParticipantStatus" NOT NULL DEFAULT 'ENROLLED',
  "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastContactAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "withdrawnAt" TIMESTAMP(3),
  "attritionReason" TEXT,
  CONSTRAINT "ResearchLongitudinalParticipant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResearchLongitudinalStudy_organizationId_title_key" ON "ResearchLongitudinalStudy"("organizationId","title");
CREATE INDEX "ResearchLongitudinalStudy_organizationId_status_createdAt_idx" ON "ResearchLongitudinalStudy"("organizationId","status","createdAt");
CREATE INDEX "ResearchLongitudinalStudy_projectId_status_idx" ON "ResearchLongitudinalStudy"("projectId","status");
CREATE INDEX "ResearchLongitudinalStudy_panelId_status_idx" ON "ResearchLongitudinalStudy"("panelId","status");
CREATE UNIQUE INDEX "ResearchLongitudinalWave_collectionId_key" ON "ResearchLongitudinalWave"("collectionId");
CREATE UNIQUE INDEX "ResearchLongitudinalWave_studyId_sequence_key" ON "ResearchLongitudinalWave"("studyId","sequence");
CREATE INDEX "ResearchLongitudinalWave_studyId_scheduledAt_idx" ON "ResearchLongitudinalWave"("studyId","scheduledAt");
CREATE UNIQUE INDEX "ResearchLongitudinalParticipant_studyId_panelMemberId_key" ON "ResearchLongitudinalParticipant"("studyId","panelMemberId");
CREATE UNIQUE INDEX "ResearchLongitudinalParticipant_studyId_subjectCode_key" ON "ResearchLongitudinalParticipant"("studyId","subjectCode");
CREATE INDEX "ResearchLongitudinalParticipant_organizationId_status_enrolledAt_idx" ON "ResearchLongitudinalParticipant"("organizationId","status","enrolledAt");
CREATE INDEX "ResearchLongitudinalParticipant_studyId_status_idx" ON "ResearchLongitudinalParticipant"("studyId","status");

ALTER TABLE "ResearchLongitudinalStudy" ADD CONSTRAINT "ResearchLongitudinalStudy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchLongitudinalStudy" ADD CONSTRAINT "ResearchLongitudinalStudy_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchLongitudinalStudy" ADD CONSTRAINT "ResearchLongitudinalStudy_questionnaireId_fkey" FOREIGN KEY ("questionnaireId") REFERENCES "ResearchQuestionnaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResearchLongitudinalStudy" ADD CONSTRAINT "ResearchLongitudinalStudy_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "ResearchPanel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResearchLongitudinalStudy" ADD CONSTRAINT "ResearchLongitudinalStudy_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResearchLongitudinalWave" ADD CONSTRAINT "ResearchLongitudinalWave_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "ResearchLongitudinalStudy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchLongitudinalWave" ADD CONSTRAINT "ResearchLongitudinalWave_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "ResearchCollectionWave"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResearchLongitudinalParticipant" ADD CONSTRAINT "ResearchLongitudinalParticipant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchLongitudinalParticipant" ADD CONSTRAINT "ResearchLongitudinalParticipant_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "ResearchLongitudinalStudy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchLongitudinalParticipant" ADD CONSTRAINT "ResearchLongitudinalParticipant_panelMemberId_fkey" FOREIGN KEY ("panelMemberId") REFERENCES "ResearchPanelMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
