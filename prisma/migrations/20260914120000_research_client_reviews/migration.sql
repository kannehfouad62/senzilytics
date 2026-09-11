CREATE TYPE "ResearchClientReviewArtifactType" AS ENUM ('QUESTIONNAIRE', 'SAMPLING_DESIGN', 'DASHBOARD', 'REPORT');
CREATE TYPE "ResearchClientReviewStatus" AS ENUM ('PENDING_REVIEW', 'REVISION_REQUESTED', 'APPROVED', 'ACCEPTED', 'WITHDRAWN');

CREATE TABLE "ResearchClientReviewRequest" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "artifactType" "ResearchClientReviewArtifactType" NOT NULL,
  "artifactId" TEXT NOT NULL,
  "artifactTitle" TEXT NOT NULL,
  "status" "ResearchClientReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "instructions" TEXT,
  "requestedById" TEXT NOT NULL,
  "decidedById" TEXT,
  "dueAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResearchClientReviewRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResearchClientReviewComment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResearchClientReviewComment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResearchClientReviewRequest_projectId_artifactType_artifactId_key" ON "ResearchClientReviewRequest"("projectId", "artifactType", "artifactId");
CREATE INDEX "ResearchClientReviewRequest_organizationId_status_dueAt_idx" ON "ResearchClientReviewRequest"("organizationId", "status", "dueAt");
CREATE INDEX "ResearchClientReviewRequest_projectId_status_idx" ON "ResearchClientReviewRequest"("projectId", "status");
CREATE INDEX "ResearchClientReviewRequest_requestedById_idx" ON "ResearchClientReviewRequest"("requestedById");
CREATE INDEX "ResearchClientReviewRequest_decidedById_idx" ON "ResearchClientReviewRequest"("decidedById");
CREATE INDEX "ResearchClientReviewComment_organizationId_createdAt_idx" ON "ResearchClientReviewComment"("organizationId", "createdAt");
CREATE INDEX "ResearchClientReviewComment_requestId_createdAt_idx" ON "ResearchClientReviewComment"("requestId", "createdAt");
CREATE INDEX "ResearchClientReviewComment_userId_idx" ON "ResearchClientReviewComment"("userId");

ALTER TABLE "ResearchClientReviewRequest" ADD CONSTRAINT "ResearchClientReviewRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchClientReviewRequest" ADD CONSTRAINT "ResearchClientReviewRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchClientReviewRequest" ADD CONSTRAINT "ResearchClientReviewRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResearchClientReviewRequest" ADD CONSTRAINT "ResearchClientReviewRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResearchClientReviewComment" ADD CONSTRAINT "ResearchClientReviewComment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchClientReviewComment" ADD CONSTRAINT "ResearchClientReviewComment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ResearchClientReviewRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchClientReviewComment" ADD CONSTRAINT "ResearchClientReviewComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
