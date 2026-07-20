CREATE TYPE "ConfigurableSubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'VOIDED');

CREATE TABLE "ConfigurableFormSubmission" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "definitionId" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "entityType" "ConfigurableFormModule" NOT NULL,
  "entityId" TEXT NOT NULL,
  "status" "ConfigurableSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
  "submittedById" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConfigurableFormSubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConfigurableFormAnswer" (
  "id" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "fieldId" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConfigurableFormAnswer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConfigurableFormSubmission_definitionId_entityType_entityId_key" ON "ConfigurableFormSubmission"("definitionId", "entityType", "entityId");
CREATE INDEX "ConfigurableFormSubmission_organizationId_entityType_entityId_idx" ON "ConfigurableFormSubmission"("organizationId", "entityType", "entityId");
CREATE INDEX "ConfigurableFormSubmission_submittedById_submittedAt_idx" ON "ConfigurableFormSubmission"("submittedById", "submittedAt");
CREATE UNIQUE INDEX "ConfigurableFormAnswer_submissionId_fieldId_key" ON "ConfigurableFormAnswer"("submissionId", "fieldId");
CREATE INDEX "ConfigurableFormAnswer_fieldId_idx" ON "ConfigurableFormAnswer"("fieldId");

ALTER TABLE "ConfigurableFormSubmission" ADD CONSTRAINT "ConfigurableFormSubmission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConfigurableFormSubmission" ADD CONSTRAINT "ConfigurableFormSubmission_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "ConfigurableFormDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConfigurableFormSubmission" ADD CONSTRAINT "ConfigurableFormSubmission_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ConfigurableFormVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConfigurableFormSubmission" ADD CONSTRAINT "ConfigurableFormSubmission_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConfigurableFormAnswer" ADD CONSTRAINT "ConfigurableFormAnswer_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ConfigurableFormSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConfigurableFormAnswer" ADD CONSTRAINT "ConfigurableFormAnswer_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "ConfigurableFormField"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
