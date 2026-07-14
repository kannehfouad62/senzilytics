/*
  Warnings:

  - A unique constraint covering the columns `[inspectionFindingId]` on the table `CorrectiveAction` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[responseId]` on the table `InspectionFinding` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "InspectionType" AS ENUM ('ROUTINE', 'SAFETY', 'ENVIRONMENTAL', 'EQUIPMENT', 'FACILITY', 'VEHICLE', 'HOUSEKEEPING', 'REGULATORY', 'PRE_OPERATIONAL', 'OTHER');

-- CreateEnum
CREATE TYPE "InspectionTeamRole" AS ENUM ('LEAD_INSPECTOR', 'INSPECTOR', 'TECHNICAL_EXPERT', 'OBSERVER');

-- CreateEnum
CREATE TYPE "InspectionQuestionType" AS ENUM ('YES_NO', 'COMPLIANCE', 'TEXT', 'NUMBER', 'PHOTO');

-- CreateEnum
CREATE TYPE "InspectionResponseResult" AS ENUM ('NOT_ASSESSED', 'COMPLIANT', 'NON_COMPLIANT', 'NOT_APPLICABLE');

-- AlterTable
ALTER TABLE "CorrectiveAction" ADD COLUMN     "inspectionFindingId" TEXT;

-- AlterTable
ALTER TABLE "Inspection" ADD COLUMN     "checklistTemplateId" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "leadInspectorId" TEXT,
ADD COLUMN     "overdueNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "reminderSentAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "type" "InspectionType" NOT NULL DEFAULT 'ROUTINE';

-- AlterTable
ALTER TABLE "InspectionFinding" ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "responseId" TEXT;

-- CreateTable
CREATE TABLE "InspectionTeamMember" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "InspectionTeamRole" NOT NULL DEFAULT 'INSPECTOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspectionTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionChecklistTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "inspectionType" "InspectionType" NOT NULL DEFAULT 'ROUTINE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionChecklistSection" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionChecklistSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionChecklistQuestion" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "guidance" TEXT,
    "questionType" "InspectionQuestionType" NOT NULL DEFAULT 'COMPLIANCE',
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionChecklistQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionChecklistItem" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "templateQuestionId" TEXT,
    "sectionName" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "guidance" TEXT,
    "questionType" "InspectionQuestionType" NOT NULL DEFAULT 'COMPLIANCE',
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionResponse" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "checklistItemId" TEXT NOT NULL,
    "answeredById" TEXT,
    "result" "InspectionResponseResult" NOT NULL DEFAULT 'NOT_ASSESSED',
    "responseText" TEXT,
    "numericValue" DECIMAL(18,4),
    "booleanValue" BOOLEAN,
    "score" DECIMAL(8,2),
    "comments" TEXT,
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InspectionTeamMember_userId_idx" ON "InspectionTeamMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionTeamMember_inspectionId_userId_key" ON "InspectionTeamMember"("inspectionId", "userId");

-- CreateIndex
CREATE INDEX "InspectionChecklistTemplate_organizationId_inspectionType_i_idx" ON "InspectionChecklistTemplate"("organizationId", "inspectionType", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionChecklistTemplate_organizationId_name_version_key" ON "InspectionChecklistTemplate"("organizationId", "name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionChecklistSection_templateId_sequence_key" ON "InspectionChecklistSection"("templateId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionChecklistQuestion_sectionId_sequence_key" ON "InspectionChecklistQuestion"("sectionId", "sequence");

-- CreateIndex
CREATE INDEX "InspectionChecklistItem_templateQuestionId_idx" ON "InspectionChecklistItem"("templateQuestionId");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionChecklistItem_inspectionId_sequence_key" ON "InspectionChecklistItem"("inspectionId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionResponse_checklistItemId_key" ON "InspectionResponse"("checklistItemId");

-- CreateIndex
CREATE INDEX "InspectionResponse_inspectionId_result_idx" ON "InspectionResponse"("inspectionId", "result");

-- CreateIndex
CREATE INDEX "InspectionResponse_answeredById_idx" ON "InspectionResponse"("answeredById");

-- CreateIndex
CREATE UNIQUE INDEX "CorrectiveAction_inspectionFindingId_key" ON "CorrectiveAction"("inspectionFindingId");

-- CreateIndex
CREATE INDEX "Inspection_siteId_status_idx" ON "Inspection"("siteId", "status");

-- CreateIndex
CREATE INDEX "Inspection_leadInspectorId_idx" ON "Inspection"("leadInspectorId");

-- CreateIndex
CREATE INDEX "Inspection_status_dueDate_idx" ON "Inspection"("status", "dueDate");

-- CreateIndex
CREATE INDEX "Inspection_checklistTemplateId_idx" ON "Inspection"("checklistTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionFinding_responseId_key" ON "InspectionFinding"("responseId");

-- CreateIndex
CREATE INDEX "InspectionFinding_inspectionId_status_idx" ON "InspectionFinding"("inspectionId", "status");

-- CreateIndex
CREATE INDEX "InspectionFinding_riskLevel_dueDate_idx" ON "InspectionFinding"("riskLevel", "dueDate");

-- AddForeignKey
ALTER TABLE "CorrectiveAction" ADD CONSTRAINT "CorrectiveAction_inspectionFindingId_fkey" FOREIGN KEY ("inspectionFindingId") REFERENCES "InspectionFinding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_leadInspectorId_fkey" FOREIGN KEY ("leadInspectorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_checklistTemplateId_fkey" FOREIGN KEY ("checklistTemplateId") REFERENCES "InspectionChecklistTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionTeamMember" ADD CONSTRAINT "InspectionTeamMember_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionTeamMember" ADD CONSTRAINT "InspectionTeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionChecklistTemplate" ADD CONSTRAINT "InspectionChecklistTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionChecklistSection" ADD CONSTRAINT "InspectionChecklistSection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "InspectionChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionChecklistQuestion" ADD CONSTRAINT "InspectionChecklistQuestion_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "InspectionChecklistSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionChecklistItem" ADD CONSTRAINT "InspectionChecklistItem_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionChecklistItem" ADD CONSTRAINT "InspectionChecklistItem_templateQuestionId_fkey" FOREIGN KEY ("templateQuestionId") REFERENCES "InspectionChecklistQuestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionResponse" ADD CONSTRAINT "InspectionResponse_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionResponse" ADD CONSTRAINT "InspectionResponse_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "InspectionChecklistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionResponse" ADD CONSTRAINT "InspectionResponse_answeredById_fkey" FOREIGN KEY ("answeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionFinding" ADD CONSTRAINT "InspectionFinding_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "InspectionResponse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
