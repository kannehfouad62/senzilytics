CREATE TYPE "ResearchScreeningOutcome" AS ENUM ('ELIGIBLE','DISQUALIFIED');
ALTER TYPE "ResearchSurveyInvitationStatus" ADD VALUE 'DISQUALIFIED';

ALTER TABLE "ResearchPublicSurveyLink"
  ADD COLUMN "screeningFieldId" TEXT,
  ADD COLUMN "screeningAllowedValues" JSONB,
  ADD COLUMN "disqualificationMessage" TEXT;

CREATE TABLE "ResearchSurveyScreeningRecord" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "publicLinkId" TEXT NOT NULL,
  "invitationId" TEXT,
  "accessTokenHash" TEXT NOT NULL,
  "fieldId" TEXT NOT NULL,
  "answer" JSONB NOT NULL,
  "outcome" "ResearchScreeningOutcome" NOT NULL,
  "screenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResearchSurveyScreeningRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResearchSurveyScreeningRecord_invitationId_key" ON "ResearchSurveyScreeningRecord"("invitationId");
CREATE UNIQUE INDEX "ResearchSurveyScreeningRecord_accessTokenHash_key" ON "ResearchSurveyScreeningRecord"("accessTokenHash");
CREATE INDEX "ResearchSurveyScreeningRecord_organizationId_outcome_screenedAt_idx" ON "ResearchSurveyScreeningRecord"("organizationId","outcome","screenedAt");
CREATE INDEX "ResearchSurveyScreeningRecord_publicLinkId_outcome_screenedAt_idx" ON "ResearchSurveyScreeningRecord"("publicLinkId","outcome","screenedAt");
CREATE INDEX "ResearchPublicSurveyLink_screeningFieldId_idx" ON "ResearchPublicSurveyLink"("screeningFieldId");

ALTER TABLE "ResearchPublicSurveyLink" ADD CONSTRAINT "ResearchPublicSurveyLink_screeningFieldId_fkey" FOREIGN KEY ("screeningFieldId") REFERENCES "ConfigurableFormField"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResearchSurveyScreeningRecord" ADD CONSTRAINT "ResearchSurveyScreeningRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchSurveyScreeningRecord" ADD CONSTRAINT "ResearchSurveyScreeningRecord_publicLinkId_fkey" FOREIGN KEY ("publicLinkId") REFERENCES "ResearchPublicSurveyLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchSurveyScreeningRecord" ADD CONSTRAINT "ResearchSurveyScreeningRecord_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "ResearchSurveyInvitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
