CREATE TYPE "ResearchResponseIntegrityStatus" AS ENUM ('CLEAR','REVIEW','REJECTED');

ALTER TABLE "ResearchPublicSurveyLink"
  ADD COLUMN "allowSaveResume" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "randomizeQuestions" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "minimumCompletionSeconds" INTEGER;

ALTER TABLE "ResearchPublicResponse"
  ADD COLUMN "completionSeconds" INTEGER,
  ADD COLUMN "integrityStatus" "ResearchResponseIntegrityStatus" NOT NULL DEFAULT 'CLEAR',
  ADD COLUMN "integrityFlags" JSONB,
  ADD COLUMN "resumedSessionId" TEXT;

CREATE TABLE "ResearchPublicSurveySession" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "publicLinkId" TEXT NOT NULL,
  "invitationId" TEXT,
  "resumeTokenHash" TEXT NOT NULL,
  "formVersionId" TEXT NOT NULL,
  "answers" JSONB NOT NULL,
  "identity" JSONB,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResearchPublicSurveySession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResearchPublicResponse_resumedSessionId_key" ON "ResearchPublicResponse"("resumedSessionId");
CREATE UNIQUE INDEX "ResearchPublicSurveySession_resumeTokenHash_key" ON "ResearchPublicSurveySession"("resumeTokenHash");
CREATE INDEX "ResearchPublicSurveySession_organizationId_expiresAt_idx" ON "ResearchPublicSurveySession"("organizationId","expiresAt");
CREATE INDEX "ResearchPublicSurveySession_publicLinkId_completedAt_expiresAt_idx" ON "ResearchPublicSurveySession"("publicLinkId","completedAt","expiresAt");
CREATE INDEX "ResearchPublicSurveySession_invitationId_idx" ON "ResearchPublicSurveySession"("invitationId");
CREATE INDEX "ResearchPublicResponse_integrityStatus_submittedAt_idx" ON "ResearchPublicResponse"("integrityStatus","submittedAt");

ALTER TABLE "ResearchPublicSurveySession" ADD CONSTRAINT "ResearchPublicSurveySession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchPublicSurveySession" ADD CONSTRAINT "ResearchPublicSurveySession_publicLinkId_fkey" FOREIGN KEY ("publicLinkId") REFERENCES "ResearchPublicSurveyLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchPublicSurveySession" ADD CONSTRAINT "ResearchPublicSurveySession_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "ResearchSurveyInvitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchPublicSurveySession" ADD CONSTRAINT "ResearchPublicSurveySession_formVersionId_fkey" FOREIGN KEY ("formVersionId") REFERENCES "ConfigurableFormVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResearchPublicResponse" ADD CONSTRAINT "ResearchPublicResponse_resumedSessionId_fkey" FOREIGN KEY ("resumedSessionId") REFERENCES "ResearchPublicSurveySession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
