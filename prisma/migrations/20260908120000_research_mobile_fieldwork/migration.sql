CREATE TYPE "ResearchFieldworkBackcheckStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "ResearchFieldworkResponse" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sampleUnitId" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "enumeratorId" TEXT NOT NULL,
    "deviceSubmissionId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "interviewStartedAt" TIMESTAMP(3) NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "synchronizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "locationAccuracyM" DOUBLE PRECISION,
    "disposition" "ResearchResponseDisposition" NOT NULL DEFAULT 'INCLUDED',
    "backcheckStatus" "ResearchFieldworkBackcheckStatus" NOT NULL DEFAULT 'PENDING',
    "backcheckedById" TEXT,
    "backcheckedAt" TIMESTAMP(3),
    "backcheckNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ResearchFieldworkResponse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResearchFieldworkResponse_sampleUnitId_key" ON "ResearchFieldworkResponse"("sampleUnitId");
CREATE UNIQUE INDEX "ResearchFieldworkResponse_submissionId_key" ON "ResearchFieldworkResponse"("submissionId");
CREATE UNIQUE INDEX "ResearchFieldworkResponse_deviceSubmissionId_key" ON "ResearchFieldworkResponse"("deviceSubmissionId");
CREATE INDEX "ResearchFieldworkResponse_organizationId_backcheckStatus_capturedAt_idx" ON "ResearchFieldworkResponse"("organizationId", "backcheckStatus", "capturedAt");
CREATE INDEX "ResearchFieldworkResponse_collectionId_capturedAt_idx" ON "ResearchFieldworkResponse"("collectionId", "capturedAt");
CREATE INDEX "ResearchFieldworkResponse_enumeratorId_capturedAt_idx" ON "ResearchFieldworkResponse"("enumeratorId", "capturedAt");

ALTER TABLE "ResearchFieldworkResponse" ADD CONSTRAINT "ResearchFieldworkResponse_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchFieldworkResponse" ADD CONSTRAINT "ResearchFieldworkResponse_sampleUnitId_fkey" FOREIGN KEY ("sampleUnitId") REFERENCES "ResearchSampleUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResearchFieldworkResponse" ADD CONSTRAINT "ResearchFieldworkResponse_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "ResearchCollectionWave"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResearchFieldworkResponse" ADD CONSTRAINT "ResearchFieldworkResponse_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ConfigurableFormSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResearchFieldworkResponse" ADD CONSTRAINT "ResearchFieldworkResponse_enumeratorId_fkey" FOREIGN KEY ("enumeratorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResearchFieldworkResponse" ADD CONSTRAINT "ResearchFieldworkResponse_backcheckedById_fkey" FOREIGN KEY ("backcheckedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
