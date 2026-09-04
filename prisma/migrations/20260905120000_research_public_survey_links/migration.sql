CREATE TYPE "ResearchPublicLinkStatus" AS ENUM ('ACTIVE', 'PAUSED', 'REVOKED');

ALTER TABLE "ConfigurableFormSubmission"
ALTER COLUMN "submittedById" DROP NOT NULL;

CREATE TABLE "ResearchPublicSurveyLink" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "status" "ResearchPublicLinkStatus" NOT NULL DEFAULT 'ACTIVE',
  "maxResponses" INTEGER,
  "expiresAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "ResearchPublicSurveyLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResearchPublicResponse" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "publicLinkId" TEXT NOT NULL,
  "submissionId" TEXT,
  "participantName" TEXT,
  "participantEmail" TEXT,
  "pseudonymousReference" TEXT,
  "consentedAt" TIMESTAMP(3),
  "disposition" "ResearchResponseDisposition" NOT NULL DEFAULT 'INCLUDED',
  "qualityNotes" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResearchPublicResponse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResearchPublicSurveyLink_token_key" ON "ResearchPublicSurveyLink"("token");
CREATE INDEX "ResearchPublicSurveyLink_organizationId_status_createdAt_idx" ON "ResearchPublicSurveyLink"("organizationId", "status", "createdAt");
CREATE INDEX "ResearchPublicSurveyLink_collectionId_status_idx" ON "ResearchPublicSurveyLink"("collectionId", "status");
CREATE UNIQUE INDEX "ResearchPublicResponse_submissionId_key" ON "ResearchPublicResponse"("submissionId");
CREATE INDEX "ResearchPublicResponse_organizationId_submittedAt_idx" ON "ResearchPublicResponse"("organizationId", "submittedAt");
CREATE INDEX "ResearchPublicResponse_collectionId_submittedAt_idx" ON "ResearchPublicResponse"("collectionId", "submittedAt");
CREATE INDEX "ResearchPublicResponse_publicLinkId_submittedAt_idx" ON "ResearchPublicResponse"("publicLinkId", "submittedAt");
CREATE INDEX "ResearchPublicResponse_reviewedById_reviewedAt_idx" ON "ResearchPublicResponse"("reviewedById", "reviewedAt");

ALTER TABLE "ResearchPublicSurveyLink" ADD CONSTRAINT "ResearchPublicSurveyLink_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchPublicSurveyLink" ADD CONSTRAINT "ResearchPublicSurveyLink_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "ResearchCollectionWave"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchPublicSurveyLink" ADD CONSTRAINT "ResearchPublicSurveyLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResearchPublicResponse" ADD CONSTRAINT "ResearchPublicResponse_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchPublicResponse" ADD CONSTRAINT "ResearchPublicResponse_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "ResearchCollectionWave"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchPublicResponse" ADD CONSTRAINT "ResearchPublicResponse_publicLinkId_fkey" FOREIGN KEY ("publicLinkId") REFERENCES "ResearchPublicSurveyLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResearchPublicResponse" ADD CONSTRAINT "ResearchPublicResponse_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ConfigurableFormSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResearchPublicResponse" ADD CONSTRAINT "ResearchPublicResponse_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
