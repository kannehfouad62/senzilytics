ALTER TYPE "DocumentEntityType" ADD VALUE 'SAFETY_OBSERVATION';

CREATE TABLE "ConfigurableFormFileAnswer" (
  "id" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "fieldId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConfigurableFormFileAnswer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConfigurableFormFileAnswer_documentId_key" ON "ConfigurableFormFileAnswer"("documentId");
CREATE UNIQUE INDEX "ConfigurableFormFileAnswer_submissionId_fieldId_key" ON "ConfigurableFormFileAnswer"("submissionId", "fieldId");
CREATE INDEX "ConfigurableFormFileAnswer_fieldId_idx" ON "ConfigurableFormFileAnswer"("fieldId");

ALTER TABLE "ConfigurableFormFileAnswer" ADD CONSTRAINT "ConfigurableFormFileAnswer_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ConfigurableFormSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConfigurableFormFileAnswer" ADD CONSTRAINT "ConfigurableFormFileAnswer_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "ConfigurableFormField"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConfigurableFormFileAnswer" ADD CONSTRAINT "ConfigurableFormFileAnswer_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
