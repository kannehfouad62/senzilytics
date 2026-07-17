-- CreateEnum
CREATE TYPE "EnterpriseAuditProgramStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EnterpriseAuditFrequency" AS ENUM ('ONE_TIME', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "EnterpriseAuditRiskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "EnterpriseAuditScheduleStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "EnterpriseAuditProtocolStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EnterpriseAuditQuestionResponseType" AS ENUM ('PASS_FAIL', 'YES_NO', 'NUMERIC', 'FREE_TEXT', 'OBSERVATION', 'MULTIPLE_CHOICE', 'RATING', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "EnterpriseAuditFindingTrigger" AS ENUM ('NEVER', 'ON_FAIL', 'ON_NO', 'BELOW_THRESHOLD', 'ABOVE_THRESHOLD', 'SELECTED_OPTIONS', 'MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "EnterpriseAuditSeverity" AS ENUM ('OBSERVATION', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "EnterpriseAuditScheduleTeamRole" AS ENUM ('LEAD_AUDITOR', 'AUDITOR', 'TECHNICAL_EXPERT', 'OBSERVER', 'TRAINEE');

-- CreateTable
CREATE TABLE "AuditProgram" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "code" TEXT,
    "standardName" TEXT,
    "standardVersion" TEXT,
    "framework" TEXT,
    "objectives" TEXT,
    "scope" TEXT,
    "status" "EnterpriseAuditProgramStatus" NOT NULL DEFAULT 'DRAFT',
    "frequency" "EnterpriseAuditFrequency" NOT NULL,
    "riskPriority" "EnterpriseAuditRiskPriority" NOT NULL DEFAULT 'MEDIUM',
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "ownerId" TEXT,
    "defaultProtocolId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditProgramSite" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditProgramSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditProgramDepartment" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditProgramDepartment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditSchedule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "EnterpriseAuditScheduleStatus" NOT NULL DEFAULT 'ACTIVE',
    "frequency" "EnterpriseAuditFrequency" NOT NULL,
    "intervalValue" INTEGER NOT NULL DEFAULT 1,
    "recurrenceRule" JSONB,
    "timezone" TEXT NOT NULL DEFAULT 'America/Chicago',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "generateDaysBefore" INTEGER NOT NULL DEFAULT 30,
    "dueDaysAfter" INTEGER NOT NULL DEFAULT 14,
    "siteId" TEXT NOT NULL,
    "departmentId" TEXT,
    "leadAuditorId" TEXT,
    "protocolId" TEXT,
    "autoGenerate" BOOLEAN NOT NULL DEFAULT true,
    "requireTeam" BOOLEAN NOT NULL DEFAULT false,
    "requireLeadAuditor" BOOLEAN NOT NULL DEFAULT true,
    "lastGenerationKey" TEXT,
    "generationCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditScheduleTeamMember" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "EnterpriseAuditScheduleTeamRole" NOT NULL DEFAULT 'AUDITOR',
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditScheduleTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditProtocol" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "code" TEXT,
    "standardName" TEXT,
    "standardVersion" TEXT,
    "framework" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "EnterpriseAuditProtocolStatus" NOT NULL DEFAULT 'DRAFT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "previousVersionId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditProtocol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditProtocolSection" (
    "id" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "guidance" TEXT,
    "standardRef" TEXT,
    "sequence" INTEGER NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditProtocolSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditProtocolQuestion" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "description" TEXT,
    "guidance" TEXT,
    "standardClause" TEXT,
    "regulatoryRef" TEXT,
    "responseType" "EnterpriseAuditQuestionResponseType" NOT NULL,
    "sequence" INTEGER NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "allowNotApplicable" BOOLEAN NOT NULL DEFAULT true,
    "requireComment" BOOLEAN NOT NULL DEFAULT false,
    "requireEvidence" BOOLEAN NOT NULL DEFAULT false,
    "requirePhoto" BOOLEAN NOT NULL DEFAULT false,
    "minimumNumericValue" DECIMAL(18,4),
    "maximumNumericValue" DECIMAL(18,4),
    "minimumPassingScore" DECIMAL(8,2),
    "maximumScore" DECIMAL(8,2),
    "findingTrigger" "EnterpriseAuditFindingTrigger" NOT NULL DEFAULT 'MANUAL_REVIEW',
    "defaultSeverity" "EnterpriseAuditSeverity",
    "automaticallyCreateFinding" BOOLEAN NOT NULL DEFAULT false,
    "automaticallySuggestCapa" BOOLEAN NOT NULL DEFAULT false,
    "automaticallySuggestRisk" BOOLEAN NOT NULL DEFAULT false,
    "findingTitleTemplate" TEXT,
    "findingDescriptionTemplate" TEXT,
    "aiGuidance" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditProtocolQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditQuestionOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "sequence" INTEGER NOT NULL,
    "scoreValue" DECIMAL(8,2),
    "isPassing" BOOLEAN,
    "triggersFinding" BOOLEAN NOT NULL DEFAULT false,
    "findingSeverity" "EnterpriseAuditSeverity",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditQuestionOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditProgram_organizationId_status_isActive_idx" ON "AuditProgram"("organizationId", "status", "isActive");

-- CreateIndex
CREATE INDEX "AuditProgram_organizationId_riskPriority_idx" ON "AuditProgram"("organizationId", "riskPriority");

-- CreateIndex
CREATE INDEX "AuditProgram_ownerId_idx" ON "AuditProgram"("ownerId");

-- CreateIndex
CREATE INDEX "AuditProgram_defaultProtocolId_idx" ON "AuditProgram"("defaultProtocolId");

-- CreateIndex
CREATE INDEX "AuditProgram_effectiveFrom_effectiveTo_idx" ON "AuditProgram"("effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "AuditProgram_organizationId_name_key" ON "AuditProgram"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "AuditProgram_organizationId_code_key" ON "AuditProgram"("organizationId", "code");

-- CreateIndex
CREATE INDEX "AuditProgramSite_siteId_idx" ON "AuditProgramSite"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditProgramSite_programId_siteId_key" ON "AuditProgramSite"("programId", "siteId");

-- CreateIndex
CREATE INDEX "AuditProgramDepartment_departmentId_idx" ON "AuditProgramDepartment"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditProgramDepartment_programId_departmentId_key" ON "AuditProgramDepartment"("programId", "departmentId");

-- CreateIndex
CREATE INDEX "AuditSchedule_organizationId_status_autoGenerate_idx" ON "AuditSchedule"("organizationId", "status", "autoGenerate");

-- CreateIndex
CREATE INDEX "AuditSchedule_programId_idx" ON "AuditSchedule"("programId");

-- CreateIndex
CREATE INDEX "AuditSchedule_siteId_idx" ON "AuditSchedule"("siteId");

-- CreateIndex
CREATE INDEX "AuditSchedule_departmentId_idx" ON "AuditSchedule"("departmentId");

-- CreateIndex
CREATE INDEX "AuditSchedule_leadAuditorId_idx" ON "AuditSchedule"("leadAuditorId");

-- CreateIndex
CREATE INDEX "AuditSchedule_protocolId_idx" ON "AuditSchedule"("protocolId");

-- CreateIndex
CREATE INDEX "AuditSchedule_nextRunAt_status_autoGenerate_idx" ON "AuditSchedule"("nextRunAt", "status", "autoGenerate");

-- CreateIndex
CREATE INDEX "AuditSchedule_startDate_endDate_idx" ON "AuditSchedule"("startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "AuditSchedule_organizationId_name_key" ON "AuditSchedule"("organizationId", "name");

-- CreateIndex
CREATE INDEX "AuditScheduleTeamMember_userId_idx" ON "AuditScheduleTeamMember"("userId");

-- CreateIndex
CREATE INDEX "AuditScheduleTeamMember_scheduleId_role_idx" ON "AuditScheduleTeamMember"("scheduleId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "AuditScheduleTeamMember_scheduleId_userId_key" ON "AuditScheduleTeamMember"("scheduleId", "userId");

-- CreateIndex
CREATE INDEX "AuditProtocol_organizationId_status_isActive_idx" ON "AuditProtocol"("organizationId", "status", "isActive");

-- CreateIndex
CREATE INDEX "AuditProtocol_previousVersionId_idx" ON "AuditProtocol"("previousVersionId");

-- CreateIndex
CREATE INDEX "AuditProtocol_effectiveFrom_effectiveTo_idx" ON "AuditProtocol"("effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "AuditProtocol_organizationId_name_version_key" ON "AuditProtocol"("organizationId", "name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "AuditProtocol_organizationId_code_version_key" ON "AuditProtocol"("organizationId", "code", "version");

-- CreateIndex
CREATE INDEX "AuditProtocolSection_protocolId_isActive_idx" ON "AuditProtocolSection"("protocolId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AuditProtocolSection_protocolId_sequence_key" ON "AuditProtocolSection"("protocolId", "sequence");

-- CreateIndex
CREATE INDEX "AuditProtocolQuestion_sectionId_isActive_idx" ON "AuditProtocolQuestion"("sectionId", "isActive");

-- CreateIndex
CREATE INDEX "AuditProtocolQuestion_responseType_idx" ON "AuditProtocolQuestion"("responseType");

-- CreateIndex
CREATE INDEX "AuditProtocolQuestion_findingTrigger_automaticallyCreateFin_idx" ON "AuditProtocolQuestion"("findingTrigger", "automaticallyCreateFinding");

-- CreateIndex
CREATE UNIQUE INDEX "AuditProtocolQuestion_sectionId_sequence_key" ON "AuditProtocolQuestion"("sectionId", "sequence");

-- CreateIndex
CREATE INDEX "AuditQuestionOption_questionId_isActive_idx" ON "AuditQuestionOption"("questionId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AuditQuestionOption_questionId_value_key" ON "AuditQuestionOption"("questionId", "value");

-- CreateIndex
CREATE UNIQUE INDEX "AuditQuestionOption_questionId_sequence_key" ON "AuditQuestionOption"("questionId", "sequence");

-- AddForeignKey
ALTER TABLE "AuditProgram" ADD CONSTRAINT "AuditProgram_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditProgram" ADD CONSTRAINT "AuditProgram_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditProgram" ADD CONSTRAINT "AuditProgram_defaultProtocolId_fkey" FOREIGN KEY ("defaultProtocolId") REFERENCES "AuditProtocol"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditProgramSite" ADD CONSTRAINT "AuditProgramSite_programId_fkey" FOREIGN KEY ("programId") REFERENCES "AuditProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditProgramSite" ADD CONSTRAINT "AuditProgramSite_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditProgramDepartment" ADD CONSTRAINT "AuditProgramDepartment_programId_fkey" FOREIGN KEY ("programId") REFERENCES "AuditProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditProgramDepartment" ADD CONSTRAINT "AuditProgramDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditSchedule" ADD CONSTRAINT "AuditSchedule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditSchedule" ADD CONSTRAINT "AuditSchedule_programId_fkey" FOREIGN KEY ("programId") REFERENCES "AuditProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditSchedule" ADD CONSTRAINT "AuditSchedule_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditSchedule" ADD CONSTRAINT "AuditSchedule_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditSchedule" ADD CONSTRAINT "AuditSchedule_leadAuditorId_fkey" FOREIGN KEY ("leadAuditorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditSchedule" ADD CONSTRAINT "AuditSchedule_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "AuditProtocol"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditSchedule" ADD CONSTRAINT "AuditSchedule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditSchedule" ADD CONSTRAINT "AuditSchedule_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditScheduleTeamMember" ADD CONSTRAINT "AuditScheduleTeamMember_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "AuditSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditScheduleTeamMember" ADD CONSTRAINT "AuditScheduleTeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditProtocol" ADD CONSTRAINT "AuditProtocol_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditProtocol" ADD CONSTRAINT "AuditProtocol_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "AuditProtocol"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditProtocol" ADD CONSTRAINT "AuditProtocol_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditProtocol" ADD CONSTRAINT "AuditProtocol_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditProtocolSection" ADD CONSTRAINT "AuditProtocolSection_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "AuditProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditProtocolQuestion" ADD CONSTRAINT "AuditProtocolQuestion_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "AuditProtocolSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditQuestionOption" ADD CONSTRAINT "AuditQuestionOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "AuditProtocolQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
