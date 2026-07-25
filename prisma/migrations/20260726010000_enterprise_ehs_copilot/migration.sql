-- CreateEnum
CREATE TYPE "AiCopilotConversationStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "AiCopilotMessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "AiCopilotPolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "retentionDays" INTEGER NOT NULL DEFAULT 90,
    "maxTurnsPerConversation" INTEGER NOT NULL DEFAULT 20,
    "includeConversationHistory" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiCopilotPolicy_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AiCopilotPolicy_retentionDays_check" CHECK ("retentionDays" BETWEEN 30 AND 365),
    CONSTRAINT "AiCopilotPolicy_maxTurns_check" CHECK ("maxTurnsPerConversation" BETWEEN 5 AND 40)
);

CREATE TABLE "AiCopilotConversation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "AiCopilotConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "policyVersion" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retentionExpiresAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "purgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiCopilotConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiCopilotMessage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "AiCopilotMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "responsePayload" JSONB,
    "confidence" "AiIntelligenceConfidence",
    "confidenceRationale" TEXT,
    "limitations" TEXT,
    "model" TEXT,
    "providerResponseId" TEXT,
    "contextPolicy" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiCopilotMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiCopilotCitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "sourceType" "AiIntelligenceSourceType" NOT NULL,
    "module" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "reference" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiCopilotCitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiCopilotFeedback" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" "AiIntelligenceFeedbackRating" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiCopilotFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiCopilotPolicy_organizationId_key" ON "AiCopilotPolicy"("organizationId");
CREATE INDEX "AiCopilotPolicy_organizationId_enabled_idx" ON "AiCopilotPolicy"("organizationId", "enabled");
CREATE INDEX "AiCopilotConversation_owner_status_idx" ON "AiCopilotConversation"("organizationId", "userId", "status", "lastMessageAt");
CREATE INDEX "AiCopilotConversation_retention_idx" ON "AiCopilotConversation"("organizationId", "retentionExpiresAt", "purgedAt");
CREATE INDEX "AiCopilotMessage_organizationId_conversationId_createdAt_idx" ON "AiCopilotMessage"("organizationId", "conversationId", "createdAt");
CREATE INDEX "AiCopilotMessage_organizationId_role_createdAt_idx" ON "AiCopilotMessage"("organizationId", "role", "createdAt");
CREATE UNIQUE INDEX "AiCopilotCitation_messageId_sourceKey_key" ON "AiCopilotCitation"("messageId", "sourceKey");
CREATE INDEX "AiCopilotCitation_organizationId_module_entityType_entityId_idx" ON "AiCopilotCitation"("organizationId", "module", "entityType", "entityId");
CREATE UNIQUE INDEX "AiCopilotFeedback_messageId_userId_key" ON "AiCopilotFeedback"("messageId", "userId");
CREATE INDEX "AiCopilotFeedback_organizationId_rating_createdAt_idx" ON "AiCopilotFeedback"("organizationId", "rating", "createdAt");

-- AddForeignKey
ALTER TABLE "AiCopilotPolicy" ADD CONSTRAINT "AiCopilotPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiCopilotPolicy" ADD CONSTRAINT "AiCopilotPolicy_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiCopilotConversation" ADD CONSTRAINT "AiCopilotConversation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiCopilotConversation" ADD CONSTRAINT "AiCopilotConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiCopilotMessage" ADD CONSTRAINT "AiCopilotMessage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiCopilotMessage" ADD CONSTRAINT "AiCopilotMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiCopilotConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiCopilotCitation" ADD CONSTRAINT "AiCopilotCitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiCopilotCitation" ADD CONSTRAINT "AiCopilotCitation_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "AiCopilotMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiCopilotFeedback" ADD CONSTRAINT "AiCopilotFeedback_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiCopilotFeedback" ADD CONSTRAINT "AiCopilotFeedback_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "AiCopilotMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiCopilotFeedback" ADD CONSTRAINT "AiCopilotFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
