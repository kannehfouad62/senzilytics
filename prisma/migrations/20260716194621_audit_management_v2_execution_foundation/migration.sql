-- CreateEnum
CREATE TYPE "EnterpriseAuditStatus" AS ENUM ('DRAFT', 'PLANNED', 'SCHEDULED', 'IN_PROGRESS', 'PENDING_REVIEW', 'COMPLETED', 'OVERDUE', 'CANCELLED', 'CLOSED');

-- CreateEnum
CREATE TYPE "EnterpriseAuditSource" AS ENUM ('MANUAL', 'SCHEDULE', 'PROGRAM', 'FOLLOW_UP', 'AI_RECOMMENDATION', 'LEGACY_MIGRATION');

-- CreateEnum
CREATE TYPE "EnterpriseAuditTeamRole" AS ENUM ('LEAD_AUDITOR', 'AUDITOR', 'TECHNICAL_EXPERT', 'OBSERVER', 'TRAINEE', 'APPROVER');

-- CreateEnum
CREATE TYPE "EnterpriseAuditSectionStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'NOT_APPLICABLE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "EnterpriseAuditQuestionStatus" AS ENUM ('NOT_ASSESSED', 'IN_PROGRESS', 'ANSWERED', 'NOT_APPLICABLE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "EnterpriseAuditResponseResult" AS ENUM ('NOT_ASSESSED', 'PASS', 'FAIL', 'YES', 'NO', 'COMPLIANT', 'NON_COMPLIANT', 'PARTIALLY_COMPLIANT', 'NOT_APPLICABLE', 'OBSERVATION', 'INFORMATION_ONLY');

-- CreateEnum
CREATE TYPE "EnterpriseAuditEvidenceType" AS ENUM ('PHOTO', 'DOCUMENT', 'VIDEO', 'AUDIO', 'LINK', 'NOTE', 'MEASUREMENT', 'SIGNATURE', 'OTHER');

-- CreateEnum
CREATE TYPE "EnterpriseAuditFindingStatus" AS ENUM ('DRAFT', 'OPEN', 'UNDER_REVIEW', 'ACTION_REQUIRED', 'IN_PROGRESS', 'PENDING_VERIFICATION', 'VERIFIED', 'CLOSED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EnterpriseAuditFindingCategory" AS ENUM ('SAFETY', 'ENVIRONMENTAL', 'QUALITY', 'OPERATIONAL', 'REGULATORY', 'SECURITY', 'TECHNOLOGY', 'TRAINING', 'DOCUMENTATION', 'MAINTENANCE', 'HUMAN_FACTORS', 'MANAGEMENT_SYSTEM', 'POSITIVE_PRACTICE', 'OTHER');

-- CreateEnum
CREATE TYPE "EnterpriseAuditFindingType" AS ENUM ('NONCONFORMITY', 'MAJOR_NONCONFORMITY', 'MINOR_NONCONFORMITY', 'OBSERVATION', 'OPPORTUNITY_FOR_IMPROVEMENT', 'POSITIVE_PRACTICE');

-- CreateEnum
CREATE TYPE "EnterpriseAuditVerificationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'REOPENED');

-- CreateEnum
CREATE TYPE "EnterpriseAuditLinkStatus" AS ENUM ('PROPOSED', 'APPROVED', 'CREATED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EnterpriseAuditHistoryAction" AS ENUM ('CREATED', 'UPDATED', 'STATUS_CHANGED', 'ASSIGNED', 'STARTED', 'RESPONSE_RECORDED', 'EVIDENCE_ADDED', 'FINDING_CREATED', 'FINDING_UPDATED', 'CAPA_LINKED', 'RISK_LINKED', 'SUBMITTED_FOR_REVIEW', 'COMPLETED', 'VERIFIED', 'CLOSED', 'REOPENED', 'CANCELLED', 'AI_ANALYSIS_GENERATED', 'OTHER');

-- CreateTable
CREATE TABLE "EnterpriseAudit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "objectives" TEXT,
    "scope" TEXT,
    "criteria" TEXT,
    "source" "EnterpriseAuditSource" NOT NULL DEFAULT 'MANUAL',
    "status" "EnterpriseAuditStatus" NOT NULL DEFAULT 'DRAFT',
    "auditType" "AuditType" NOT NULL DEFAULT 'INTERNAL',
    "programId" TEXT,
    "scheduleId" TEXT,
    "protocolId" TEXT,
    "siteId" TEXT NOT NULL,
    "departmentId" TEXT,
    "leadAuditorId" TEXT,
    "ownerId" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "totalQuestionCount" INTEGER NOT NULL DEFAULT 0,
    "answeredQuestionCount" INTEGER NOT NULL DEFAULT 0,
    "compliantQuestionCount" INTEGER NOT NULL DEFAULT 0,
    "failedQuestionCount" INTEGER NOT NULL DEFAULT 0,
    "notApplicableCount" INTEGER NOT NULL DEFAULT 0,
    "maximumPossibleScore" DECIMAL(12,2),
    "achievedScore" DECIMAL(12,2),
    "scorePercentage" DECIMAL(8,2),
    "findingCount" INTEGER NOT NULL DEFAULT 0,
    "openFindingCount" INTEGER NOT NULL DEFAULT 0,
    "highRiskFindingCount" INTEGER NOT NULL DEFAULT 0,
    "overallRiskLevel" "EnterpriseAuditSeverity",
    "overallOpinion" TEXT,
    "executiveSummary" TEXT,
    "positivePractices" TEXT,
    "majorConcerns" TEXT,
    "recommendations" TEXT,
    "reminderSentAt" TIMESTAMP(3),
    "overdueNotifiedAt" TIMESTAMP(3),
    "generatedByScheduleKey" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnterpriseAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnterpriseAuditTeamMember" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "EnterpriseAuditTeamRole" NOT NULL DEFAULT 'AUDITOR',
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "canEdit" BOOLEAN NOT NULL DEFAULT true,
    "canReview" BOOLEAN NOT NULL DEFAULT false,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnterpriseAuditTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnterpriseAuditSection" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "sourceProtocolSectionId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "guidance" TEXT,
    "standardRef" TEXT,
    "sequence" INTEGER NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "status" "EnterpriseAuditSectionStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "totalQuestionCount" INTEGER NOT NULL DEFAULT 0,
    "answeredQuestionCount" INTEGER NOT NULL DEFAULT 0,
    "failedQuestionCount" INTEGER NOT NULL DEFAULT 0,
    "maximumPossibleScore" DECIMAL(12,2),
    "achievedScore" DECIMAL(12,2),
    "scorePercentage" DECIMAL(8,2),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnterpriseAuditSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnterpriseAuditQuestion" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "sourceProtocolQuestionId" TEXT,
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
    "status" "EnterpriseAuditQuestionStatus" NOT NULL DEFAULT 'NOT_ASSESSED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnterpriseAuditQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnterpriseAuditQuestionOptionSnapshot" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "sourceOptionId" TEXT,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "sequence" INTEGER NOT NULL,
    "scoreValue" DECIMAL(8,2),
    "isPassing" BOOLEAN,
    "triggersFinding" BOOLEAN NOT NULL DEFAULT false,
    "findingSeverity" "EnterpriseAuditSeverity",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnterpriseAuditQuestionOptionSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnterpriseAuditResponse" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answeredById" TEXT,
    "result" "EnterpriseAuditResponseResult" NOT NULL DEFAULT 'NOT_ASSESSED',
    "responseText" TEXT,
    "numericValue" DECIMAL(18,4),
    "booleanValue" BOOLEAN,
    "selectedOptionValues" JSONB,
    "comments" TEXT,
    "scoreAwarded" DECIMAL(8,2),
    "maximumScore" DECIMAL(8,2),
    "isCompliant" BOOLEAN,
    "requiresFollowUp" BOOLEAN NOT NULL DEFAULT false,
    "answeredAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnterpriseAuditResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnterpriseAuditEvidence" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "questionId" TEXT,
    "responseId" TEXT,
    "findingId" TEXT,
    "evidenceType" "EnterpriseAuditEvidenceType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileName" TEXT,
    "fileUrl" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "externalUrl" TEXT,
    "capturedAt" TIMESTAMP(3),
    "capturedById" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnterpriseAuditEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnterpriseAuditFinding" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "questionId" TEXT,
    "responseId" TEXT,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "findingType" "EnterpriseAuditFindingType" NOT NULL DEFAULT 'NONCONFORMITY',
    "category" "EnterpriseAuditFindingCategory" NOT NULL DEFAULT 'OTHER',
    "severity" "EnterpriseAuditSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "EnterpriseAuditFindingStatus" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "objectiveEvidence" TEXT,
    "standardClause" TEXT,
    "regulatoryRef" TEXT,
    "immediateCorrection" TEXT,
    "containmentAction" TEXT,
    "rootCause" TEXT,
    "rootCauseCategory" TEXT,
    "ownerId" TEXT,
    "dueDate" TIMESTAMP(3),
    "isRepeatFinding" BOOLEAN NOT NULL DEFAULT false,
    "previousFindingReference" TEXT,
    "recurrenceCount" INTEGER NOT NULL DEFAULT 0,
    "requiresCapa" BOOLEAN NOT NULL DEFAULT false,
    "requiresRiskReview" BOOLEAN NOT NULL DEFAULT false,
    "capaSuggestedAt" TIMESTAMP(3),
    "riskSuggestedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "reopenedAt" TIMESTAMP(3),
    "closureSummary" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnterpriseAuditFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnterpriseAuditFindingEvidence" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "relationshipNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnterpriseAuditFindingEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnterpriseAuditFindingVerification" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "status" "EnterpriseAuditVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedById" TEXT,
    "verificationMethod" TEXT,
    "verificationEvidence" TEXT,
    "comments" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnterpriseAuditFindingVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnterpriseAuditFindingActionLink" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "correctiveActionId" TEXT,
    "status" "EnterpriseAuditLinkStatus" NOT NULL DEFAULT 'PROPOSED',
    "recommendationTitle" TEXT,
    "recommendationDescription" TEXT,
    "suggestedOwnerId" TEXT,
    "suggestedDueDate" TIMESTAMP(3),
    "rationale" TEXT,
    "createdById" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnterpriseAuditFindingActionLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnterpriseAuditFindingRiskLink" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "riskId" TEXT,
    "status" "EnterpriseAuditLinkStatus" NOT NULL DEFAULT 'PROPOSED',
    "proposedRiskTitle" TEXT,
    "proposedRiskDescription" TEXT,
    "proposedHazard" TEXT,
    "proposedConsequence" TEXT,
    "proposedLikelihood" "RiskLikelihood",
    "proposedImpact" "RiskImpact",
    "rationale" TEXT,
    "createdById" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnterpriseAuditFindingRiskLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnterpriseAuditHistory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "userId" TEXT,
    "action" "EnterpriseAuditHistoryAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "previousValue" JSONB,
    "newValue" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnterpriseAuditHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnterpriseAuditFindingHistory" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "userId" TEXT,
    "action" "EnterpriseAuditHistoryAction" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "previousValue" JSONB,
    "newValue" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnterpriseAuditFindingHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EnterpriseAudit_organizationId_status_idx" ON "EnterpriseAudit"("organizationId", "status");

-- CreateIndex
CREATE INDEX "EnterpriseAudit_organizationId_auditType_status_idx" ON "EnterpriseAudit"("organizationId", "auditType", "status");

-- CreateIndex
CREATE INDEX "EnterpriseAudit_programId_idx" ON "EnterpriseAudit"("programId");

-- CreateIndex
CREATE INDEX "EnterpriseAudit_scheduleId_idx" ON "EnterpriseAudit"("scheduleId");

-- CreateIndex
CREATE INDEX "EnterpriseAudit_protocolId_idx" ON "EnterpriseAudit"("protocolId");

-- CreateIndex
CREATE INDEX "EnterpriseAudit_siteId_status_idx" ON "EnterpriseAudit"("siteId", "status");

-- CreateIndex
CREATE INDEX "EnterpriseAudit_departmentId_status_idx" ON "EnterpriseAudit"("departmentId", "status");

-- CreateIndex
CREATE INDEX "EnterpriseAudit_leadAuditorId_idx" ON "EnterpriseAudit"("leadAuditorId");

-- CreateIndex
CREATE INDEX "EnterpriseAudit_ownerId_idx" ON "EnterpriseAudit"("ownerId");

-- CreateIndex
CREATE INDEX "EnterpriseAudit_scheduledAt_idx" ON "EnterpriseAudit"("scheduledAt");

-- CreateIndex
CREATE INDEX "EnterpriseAudit_dueDate_status_idx" ON "EnterpriseAudit"("dueDate", "status");

-- CreateIndex
CREATE INDEX "EnterpriseAudit_completedAt_idx" ON "EnterpriseAudit"("completedAt");

-- CreateIndex
CREATE INDEX "EnterpriseAudit_overallRiskLevel_idx" ON "EnterpriseAudit"("overallRiskLevel");

-- CreateIndex
CREATE UNIQUE INDEX "EnterpriseAudit_organizationId_reference_key" ON "EnterpriseAudit"("organizationId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "EnterpriseAudit_scheduleId_generatedByScheduleKey_key" ON "EnterpriseAudit"("scheduleId", "generatedByScheduleKey");

-- CreateIndex
CREATE INDEX "EnterpriseAuditTeamMember_userId_idx" ON "EnterpriseAuditTeamMember"("userId");

-- CreateIndex
CREATE INDEX "EnterpriseAuditTeamMember_auditId_role_idx" ON "EnterpriseAuditTeamMember"("auditId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "EnterpriseAuditTeamMember_auditId_userId_key" ON "EnterpriseAuditTeamMember"("auditId", "userId");

-- CreateIndex
CREATE INDEX "EnterpriseAuditSection_auditId_status_idx" ON "EnterpriseAuditSection"("auditId", "status");

-- CreateIndex
CREATE INDEX "EnterpriseAuditSection_sourceProtocolSectionId_idx" ON "EnterpriseAuditSection"("sourceProtocolSectionId");

-- CreateIndex
CREATE UNIQUE INDEX "EnterpriseAuditSection_auditId_sequence_key" ON "EnterpriseAuditSection"("auditId", "sequence");

-- CreateIndex
CREATE INDEX "EnterpriseAuditQuestion_auditId_status_idx" ON "EnterpriseAuditQuestion"("auditId", "status");

-- CreateIndex
CREATE INDEX "EnterpriseAuditQuestion_sourceProtocolQuestionId_idx" ON "EnterpriseAuditQuestion"("sourceProtocolQuestionId");

-- CreateIndex
CREATE INDEX "EnterpriseAuditQuestion_responseType_idx" ON "EnterpriseAuditQuestion"("responseType");

-- CreateIndex
CREATE INDEX "EnterpriseAuditQuestion_findingTrigger_idx" ON "EnterpriseAuditQuestion"("findingTrigger");

-- CreateIndex
CREATE UNIQUE INDEX "EnterpriseAuditQuestion_sectionId_sequence_key" ON "EnterpriseAuditQuestion"("sectionId", "sequence");

-- CreateIndex
CREATE INDEX "EnterpriseAuditQuestionOptionSnapshot_sourceOptionId_idx" ON "EnterpriseAuditQuestionOptionSnapshot"("sourceOptionId");

-- CreateIndex
CREATE UNIQUE INDEX "EnterpriseAuditQuestionOptionSnapshot_questionId_value_key" ON "EnterpriseAuditQuestionOptionSnapshot"("questionId", "value");

-- CreateIndex
CREATE UNIQUE INDEX "EnterpriseAuditQuestionOptionSnapshot_questionId_sequence_key" ON "EnterpriseAuditQuestionOptionSnapshot"("questionId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "EnterpriseAuditResponse_questionId_key" ON "EnterpriseAuditResponse"("questionId");

-- CreateIndex
CREATE INDEX "EnterpriseAuditResponse_auditId_result_idx" ON "EnterpriseAuditResponse"("auditId", "result");

-- CreateIndex
CREATE INDEX "EnterpriseAuditResponse_answeredById_idx" ON "EnterpriseAuditResponse"("answeredById");

-- CreateIndex
CREATE INDEX "EnterpriseAuditResponse_reviewedById_idx" ON "EnterpriseAuditResponse"("reviewedById");

-- CreateIndex
CREATE INDEX "EnterpriseAuditResponse_isCompliant_idx" ON "EnterpriseAuditResponse"("isCompliant");

-- CreateIndex
CREATE INDEX "EnterpriseAuditResponse_requiresFollowUp_idx" ON "EnterpriseAuditResponse"("requiresFollowUp");

-- CreateIndex
CREATE INDEX "EnterpriseAuditEvidence_organizationId_evidenceType_idx" ON "EnterpriseAuditEvidence"("organizationId", "evidenceType");

-- CreateIndex
CREATE INDEX "EnterpriseAuditEvidence_auditId_idx" ON "EnterpriseAuditEvidence"("auditId");

-- CreateIndex
CREATE INDEX "EnterpriseAuditEvidence_questionId_idx" ON "EnterpriseAuditEvidence"("questionId");

-- CreateIndex
CREATE INDEX "EnterpriseAuditEvidence_responseId_idx" ON "EnterpriseAuditEvidence"("responseId");

-- CreateIndex
CREATE INDEX "EnterpriseAuditEvidence_findingId_idx" ON "EnterpriseAuditEvidence"("findingId");

-- CreateIndex
CREATE INDEX "EnterpriseAuditEvidence_capturedById_idx" ON "EnterpriseAuditEvidence"("capturedById");

-- CreateIndex
CREATE INDEX "EnterpriseAuditFinding_organizationId_status_idx" ON "EnterpriseAuditFinding"("organizationId", "status");

-- CreateIndex
CREATE INDEX "EnterpriseAuditFinding_auditId_status_idx" ON "EnterpriseAuditFinding"("auditId", "status");

-- CreateIndex
CREATE INDEX "EnterpriseAuditFinding_questionId_idx" ON "EnterpriseAuditFinding"("questionId");

-- CreateIndex
CREATE INDEX "EnterpriseAuditFinding_responseId_idx" ON "EnterpriseAuditFinding"("responseId");

-- CreateIndex
CREATE INDEX "EnterpriseAuditFinding_ownerId_status_idx" ON "EnterpriseAuditFinding"("ownerId", "status");

-- CreateIndex
CREATE INDEX "EnterpriseAuditFinding_severity_dueDate_idx" ON "EnterpriseAuditFinding"("severity", "dueDate");

-- CreateIndex
CREATE INDEX "EnterpriseAuditFinding_category_idx" ON "EnterpriseAuditFinding"("category");

-- CreateIndex
CREATE INDEX "EnterpriseAuditFinding_isRepeatFinding_idx" ON "EnterpriseAuditFinding"("isRepeatFinding");

-- CreateIndex
CREATE INDEX "EnterpriseAuditFinding_requiresCapa_requiresRiskReview_idx" ON "EnterpriseAuditFinding"("requiresCapa", "requiresRiskReview");

-- CreateIndex
CREATE UNIQUE INDEX "EnterpriseAuditFinding_organizationId_reference_key" ON "EnterpriseAuditFinding"("organizationId", "reference");

-- CreateIndex
CREATE INDEX "EnterpriseAuditFindingEvidence_evidenceId_idx" ON "EnterpriseAuditFindingEvidence"("evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "EnterpriseAuditFindingEvidence_findingId_evidenceId_key" ON "EnterpriseAuditFindingEvidence"("findingId", "evidenceId");

-- CreateIndex
CREATE INDEX "EnterpriseAuditFindingVerification_findingId_status_idx" ON "EnterpriseAuditFindingVerification"("findingId", "status");

-- CreateIndex
CREATE INDEX "EnterpriseAuditFindingVerification_verifiedById_idx" ON "EnterpriseAuditFindingVerification"("verifiedById");

-- CreateIndex
CREATE INDEX "EnterpriseAuditFindingActionLink_correctiveActionId_idx" ON "EnterpriseAuditFindingActionLink"("correctiveActionId");

-- CreateIndex
CREATE INDEX "EnterpriseAuditFindingActionLink_status_idx" ON "EnterpriseAuditFindingActionLink"("status");

-- CreateIndex
CREATE INDEX "EnterpriseAuditFindingActionLink_suggestedOwnerId_idx" ON "EnterpriseAuditFindingActionLink"("suggestedOwnerId");

-- CreateIndex
CREATE UNIQUE INDEX "EnterpriseAuditFindingActionLink_findingId_correctiveAction_key" ON "EnterpriseAuditFindingActionLink"("findingId", "correctiveActionId");

-- CreateIndex
CREATE INDEX "EnterpriseAuditFindingRiskLink_riskId_idx" ON "EnterpriseAuditFindingRiskLink"("riskId");

-- CreateIndex
CREATE INDEX "EnterpriseAuditFindingRiskLink_status_idx" ON "EnterpriseAuditFindingRiskLink"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EnterpriseAuditFindingRiskLink_findingId_riskId_key" ON "EnterpriseAuditFindingRiskLink"("findingId", "riskId");

-- CreateIndex
CREATE INDEX "EnterpriseAuditHistory_organizationId_createdAt_idx" ON "EnterpriseAuditHistory"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "EnterpriseAuditHistory_auditId_createdAt_idx" ON "EnterpriseAuditHistory"("auditId", "createdAt");

-- CreateIndex
CREATE INDEX "EnterpriseAuditHistory_entityType_entityId_idx" ON "EnterpriseAuditHistory"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "EnterpriseAuditHistory_userId_idx" ON "EnterpriseAuditHistory"("userId");

-- CreateIndex
CREATE INDEX "EnterpriseAuditHistory_action_idx" ON "EnterpriseAuditHistory"("action");

-- CreateIndex
CREATE INDEX "EnterpriseAuditFindingHistory_findingId_createdAt_idx" ON "EnterpriseAuditFindingHistory"("findingId", "createdAt");

-- CreateIndex
CREATE INDEX "EnterpriseAuditFindingHistory_userId_idx" ON "EnterpriseAuditFindingHistory"("userId");

-- CreateIndex
CREATE INDEX "EnterpriseAuditFindingHistory_action_idx" ON "EnterpriseAuditFindingHistory"("action");

-- AddForeignKey
ALTER TABLE "EnterpriseAudit" ADD CONSTRAINT "EnterpriseAudit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAudit" ADD CONSTRAINT "EnterpriseAudit_programId_fkey" FOREIGN KEY ("programId") REFERENCES "AuditProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAudit" ADD CONSTRAINT "EnterpriseAudit_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "AuditSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAudit" ADD CONSTRAINT "EnterpriseAudit_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "AuditProtocol"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAudit" ADD CONSTRAINT "EnterpriseAudit_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAudit" ADD CONSTRAINT "EnterpriseAudit_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAudit" ADD CONSTRAINT "EnterpriseAudit_leadAuditorId_fkey" FOREIGN KEY ("leadAuditorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAudit" ADD CONSTRAINT "EnterpriseAudit_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAudit" ADD CONSTRAINT "EnterpriseAudit_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAudit" ADD CONSTRAINT "EnterpriseAudit_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAuditTeamMember" ADD CONSTRAINT "EnterpriseAuditTeamMember_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "EnterpriseAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAuditTeamMember" ADD CONSTRAINT "EnterpriseAuditTeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAuditSection" ADD CONSTRAINT "EnterpriseAuditSection_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "EnterpriseAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAuditSection" ADD CONSTRAINT "EnterpriseAuditSection_sourceProtocolSectionId_fkey" FOREIGN KEY ("sourceProtocolSectionId") REFERENCES "AuditProtocolSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAuditQuestion" ADD CONSTRAINT "EnterpriseAuditQuestion_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "EnterpriseAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAuditQuestion" ADD CONSTRAINT "EnterpriseAuditQuestion_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "EnterpriseAuditSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAuditQuestion" ADD CONSTRAINT "EnterpriseAuditQuestion_sourceProtocolQuestionId_fkey" FOREIGN KEY ("sourceProtocolQuestionId") REFERENCES "AuditProtocolQuestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAuditQuestionOptionSnapshot" ADD CONSTRAINT "EnterpriseAuditQuestionOptionSnapshot_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "EnterpriseAuditQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAuditQuestionOptionSnapshot" ADD CONSTRAINT "EnterpriseAuditQuestionOptionSnapshot_sourceOptionId_fkey" FOREIGN KEY ("sourceOptionId") REFERENCES "AuditQuestionOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAuditResponse" ADD CONSTRAINT "EnterpriseAuditResponse_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "EnterpriseAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAuditResponse" ADD CONSTRAINT "EnterpriseAuditResponse_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "EnterpriseAuditQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAuditResponse" ADD CONSTRAINT "EnterpriseAuditResponse_answeredById_fkey" FOREIGN KEY ("answeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAuditResponse" ADD CONSTRAINT "EnterpriseAuditResponse_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAuditEvidence" ADD CONSTRAINT "EnterpriseAuditEvidence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAuditEvidence" ADD CONSTRAINT "EnterpriseAuditEvidence_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "EnterpriseAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAuditEvidence" ADD CONSTRAINT "EnterpriseAuditEvidence_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "EnterpriseAuditQuestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAuditEvidence" ADD CONSTRAINT "EnterpriseAuditEvidence_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "EnterpriseAuditResponse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAuditEvidence" ADD CONSTRAINT "EnterpriseAuditEvidence_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "EnterpriseAuditFinding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAuditEvidence" ADD CONSTRAINT "EnterpriseAuditEvidence_capturedById_fkey" FOREIGN KEY ("capturedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAuditFinding" ADD CONSTRAINT "EnterpriseAuditFinding_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAuditFinding" ADD CONSTRAINT "EnterpriseAuditFinding_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "EnterpriseAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAuditFinding" ADD CONSTRAINT "EnterpriseAuditFinding_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "EnterpriseAuditQuestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAuditFinding" ADD CONSTRAINT "EnterpriseAuditFinding_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "EnterpriseAuditResponse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAuditFinding" ADD CONSTRAINT "EnterpriseAuditFinding_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAuditFinding" ADD CONSTRAINT "EnterpriseAuditFinding_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAuditFinding" ADD CONSTRAINT "EnterpriseAuditFinding_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAuditFindingEvidence" ADD CONSTRAINT "EnterpriseAuditFindingEvidence_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "EnterpriseAuditFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAuditFindingEvidence" ADD CONSTRAINT "EnterpriseAuditFindingEvidence_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "EnterpriseAuditEvidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAuditFindingVerification" ADD CONSTRAINT "EnterpriseAuditFindingVerification_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "EnterpriseAuditFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAuditFindingVerification" ADD CONSTRAINT "EnterpriseAuditFindingVerification_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAuditFindingActionLink" ADD CONSTRAINT "EnterpriseAuditFindingActionLink_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "EnterpriseAuditFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAuditFindingActionLink" ADD CONSTRAINT "EnterpriseAuditFindingActionLink_correctiveActionId_fkey" FOREIGN KEY ("correctiveActionId") REFERENCES "CorrectiveAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAuditFindingActionLink" ADD CONSTRAINT "EnterpriseAuditFindingActionLink_suggestedOwnerId_fkey" FOREIGN KEY ("suggestedOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAuditFindingActionLink" ADD CONSTRAINT "EnterpriseAuditFindingActionLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAuditFindingActionLink" ADD CONSTRAINT "EnterpriseAuditFindingActionLink_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAuditFindingRiskLink" ADD CONSTRAINT "EnterpriseAuditFindingRiskLink_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "EnterpriseAuditFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAuditFindingRiskLink" ADD CONSTRAINT "EnterpriseAuditFindingRiskLink_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAuditFindingRiskLink" ADD CONSTRAINT "EnterpriseAuditFindingRiskLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAuditFindingRiskLink" ADD CONSTRAINT "EnterpriseAuditFindingRiskLink_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAuditHistory" ADD CONSTRAINT "EnterpriseAuditHistory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAuditHistory" ADD CONSTRAINT "EnterpriseAuditHistory_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "EnterpriseAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAuditHistory" ADD CONSTRAINT "EnterpriseAuditHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAuditFindingHistory" ADD CONSTRAINT "EnterpriseAuditFindingHistory_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "EnterpriseAuditFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseAuditFindingHistory" ADD CONSTRAINT "EnterpriseAuditFindingHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
