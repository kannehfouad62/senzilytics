CREATE TYPE "AiIntelligenceUseCase" AS ENUM ('DAILY_BRIEFING', 'EXECUTIVE_RISK', 'AUDIT_FOCUS', 'REGULATORY_IMPACT', 'CONTROL_EFFECTIVENESS', 'CUSTOM_QUERY');
CREATE TYPE "AiIntelligenceStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');
CREATE TYPE "AiIntelligenceConfidence" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "AiIntelligenceSourceType" AS ENUM ('PORTFOLIO_METRIC', 'ASSURANCE_SIGNAL');
CREATE TYPE "AiIntelligenceFeedbackRating" AS ENUM ('HELPFUL', 'NOT_HELPFUL');

CREATE TABLE "AiIntelligenceAnalysis" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "useCase" "AiIntelligenceUseCase" NOT NULL,
  "title" TEXT NOT NULL,
  "question" TEXT,
  "status" "AiIntelligenceStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "executiveSummary" TEXT NOT NULL,
  "responsePayload" JSONB NOT NULL,
  "inputScope" JSONB NOT NULL,
  "confidence" "AiIntelligenceConfidence" NOT NULL,
  "confidenceRationale" TEXT NOT NULL,
  "limitations" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "providerResponseId" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiIntelligenceAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiIntelligenceSource" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "analysisId" TEXT NOT NULL,
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
  CONSTRAINT "AiIntelligenceSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiIntelligenceFeedback" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "analysisId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "rating" "AiIntelligenceFeedbackRating" NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiIntelligenceFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiIntelligenceAnalysis_organizationId_status_createdAt_idx" ON "AiIntelligenceAnalysis"("organizationId", "status", "createdAt");
CREATE INDEX "AiIntelligenceAnalysis_organizationId_useCase_createdAt_idx" ON "AiIntelligenceAnalysis"("organizationId", "useCase", "createdAt");
CREATE INDEX "AiIntelligenceAnalysis_requestedById_createdAt_idx" ON "AiIntelligenceAnalysis"("requestedById", "createdAt");
CREATE UNIQUE INDEX "AiIntelligenceSource_analysisId_sourceKey_key" ON "AiIntelligenceSource"("analysisId", "sourceKey");
CREATE INDEX "AiIntelligenceSource_organizationId_module_entityType_entityId_idx" ON "AiIntelligenceSource"("organizationId", "module", "entityType", "entityId");
CREATE UNIQUE INDEX "AiIntelligenceFeedback_analysisId_userId_key" ON "AiIntelligenceFeedback"("analysisId", "userId");
CREATE INDEX "AiIntelligenceFeedback_organizationId_rating_createdAt_idx" ON "AiIntelligenceFeedback"("organizationId", "rating", "createdAt");

ALTER TABLE "AiIntelligenceAnalysis" ADD CONSTRAINT "AiIntelligenceAnalysis_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiIntelligenceAnalysis" ADD CONSTRAINT "AiIntelligenceAnalysis_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiIntelligenceAnalysis" ADD CONSTRAINT "AiIntelligenceAnalysis_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiIntelligenceSource" ADD CONSTRAINT "AiIntelligenceSource_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiIntelligenceSource" ADD CONSTRAINT "AiIntelligenceSource_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "AiIntelligenceAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiIntelligenceFeedback" ADD CONSTRAINT "AiIntelligenceFeedback_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiIntelligenceFeedback" ADD CONSTRAINT "AiIntelligenceFeedback_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "AiIntelligenceAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiIntelligenceFeedback" ADD CONSTRAINT "AiIntelligenceFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
