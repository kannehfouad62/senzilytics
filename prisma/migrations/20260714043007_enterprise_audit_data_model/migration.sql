/*
  Warnings:

  - A unique constraint covering the columns `[responseId]` on the table `AuditFinding` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[auditFindingId]` on the table `CorrectiveAction` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "AuditType" AS ENUM ('INTERNAL', 'EXTERNAL', 'REGULATORY', 'COMPLIANCE', 'MANAGEMENT_SYSTEM', 'SUPPLIER', 'PROCESS', 'SAFETY', 'ENVIRONMENTAL', 'OTHER');

-- CreateEnum
CREATE TYPE "AuditTeamRole" AS ENUM ('LEAD_AUDITOR', 'AUDITOR', 'TECHNICAL_EXPERT', 'OBSERVER');

-- CreateEnum
CREATE TYPE "AuditQuestionType" AS ENUM ('YES_NO', 'COMPLIANCE', 'TEXT', 'NUMBER');

-- CreateEnum
CREATE TYPE "AuditResponseResult" AS ENUM ('NOT_ASSESSED', 'COMPLIANT', 'NON_COMPLIANT', 'NOT_APPLICABLE');

-- AlterTable
ALTER TABLE "Audit" ADD COLUMN     "checklistTemplateId" TEXT,
ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "leadAuditorId" TEXT,
ADD COLUMN     "overdueNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "reminderSentAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "type" "AuditType" NOT NULL DEFAULT 'INTERNAL';

-- AlterTable
ALTER TABLE "AuditFinding" ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "responseId" TEXT;

-- AlterTable
ALTER TABLE "CorrectiveAction" ADD COLUMN     "auditFindingId" TEXT;

-- CreateTable
CREATE TABLE "AuditTeamMember" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "AuditTeamRole" NOT NULL DEFAULT 'AUDITOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditChecklistTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "auditType" "AuditType" NOT NULL DEFAULT 'INTERNAL',
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditChecklistSection" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditChecklistSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditChecklistQuestion" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "guidance" TEXT,
    "questionType" "AuditQuestionType" NOT NULL DEFAULT 'COMPLIANCE',
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditChecklistQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditChecklistItem" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "templateQuestionId" TEXT,
    "sectionName" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "guidance" TEXT,
    "questionType" "AuditQuestionType" NOT NULL DEFAULT 'COMPLIANCE',
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditResponse" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "checklistItemId" TEXT NOT NULL,
    "answeredById" TEXT,
    "result" "AuditResponseResult" NOT NULL DEFAULT 'NOT_ASSESSED',
    "responseText" TEXT,
    "numericValue" DECIMAL(18,4),
    "booleanValue" BOOLEAN,
    "score" DECIMAL(8,2),
    "comments" TEXT,
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditTeamMember_userId_idx" ON "AuditTeamMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditTeamMember_auditId_userId_key" ON "AuditTeamMember"("auditId", "userId");

-- CreateIndex
CREATE INDEX "AuditChecklistTemplate_organizationId_auditType_isActive_idx" ON "AuditChecklistTemplate"("organizationId", "auditType", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AuditChecklistTemplate_organizationId_name_version_key" ON "AuditChecklistTemplate"("organizationId", "name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "AuditChecklistSection_templateId_sequence_key" ON "AuditChecklistSection"("templateId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "AuditChecklistQuestion_sectionId_sequence_key" ON "AuditChecklistQuestion"("sectionId", "sequence");

-- CreateIndex
CREATE INDEX "AuditChecklistItem_templateQuestionId_idx" ON "AuditChecklistItem"("templateQuestionId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditChecklistItem_auditId_sequence_key" ON "AuditChecklistItem"("auditId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "AuditResponse_checklistItemId_key" ON "AuditResponse"("checklistItemId");

-- CreateIndex
CREATE INDEX "AuditResponse_auditId_result_idx" ON "AuditResponse"("auditId", "result");

-- CreateIndex
CREATE INDEX "AuditResponse_answeredById_idx" ON "AuditResponse"("answeredById");

-- CreateIndex
CREATE INDEX "Audit_siteId_status_idx" ON "Audit"("siteId", "status");

-- CreateIndex
CREATE INDEX "Audit_leadAuditorId_idx" ON "Audit"("leadAuditorId");

-- CreateIndex
CREATE INDEX "Audit_status_dueDate_idx" ON "Audit"("status", "dueDate");

-- CreateIndex
CREATE INDEX "Audit_checklistTemplateId_idx" ON "Audit"("checklistTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditFinding_responseId_key" ON "AuditFinding"("responseId");

-- CreateIndex
CREATE INDEX "AuditFinding_auditId_status_idx" ON "AuditFinding"("auditId", "status");

-- CreateIndex
CREATE INDEX "AuditFinding_riskLevel_dueDate_idx" ON "AuditFinding"("riskLevel", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "CorrectiveAction_auditFindingId_key" ON "CorrectiveAction"("auditFindingId");

-- AddForeignKey
ALTER TABLE "CorrectiveAction" ADD CONSTRAINT "CorrectiveAction_auditFindingId_fkey" FOREIGN KEY ("auditFindingId") REFERENCES "AuditFinding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_leadAuditorId_fkey" FOREIGN KEY ("leadAuditorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_checklistTemplateId_fkey" FOREIGN KEY ("checklistTemplateId") REFERENCES "AuditChecklistTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditTeamMember" ADD CONSTRAINT "AuditTeamMember_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditTeamMember" ADD CONSTRAINT "AuditTeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditChecklistTemplate" ADD CONSTRAINT "AuditChecklistTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditChecklistSection" ADD CONSTRAINT "AuditChecklistSection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AuditChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditChecklistQuestion" ADD CONSTRAINT "AuditChecklistQuestion_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "AuditChecklistSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditChecklistItem" ADD CONSTRAINT "AuditChecklistItem_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditChecklistItem" ADD CONSTRAINT "AuditChecklistItem_templateQuestionId_fkey" FOREIGN KEY ("templateQuestionId") REFERENCES "AuditChecklistQuestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditResponse" ADD CONSTRAINT "AuditResponse_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditResponse" ADD CONSTRAINT "AuditResponse_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "AuditChecklistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditResponse" ADD CONSTRAINT "AuditResponse_answeredById_fkey" FOREIGN KEY ("answeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditFinding" ADD CONSTRAINT "AuditFinding_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "AuditResponse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
