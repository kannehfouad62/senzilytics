-- Research Questionnaire Studio extends the governed, versioned Form Studio.

CREATE TYPE "ResearchResponseIdentityMode" AS ENUM ('ANONYMOUS', 'IDENTIFIED', 'PSEUDONYMIZED');
ALTER TYPE "ConfigurableFormModule" ADD VALUE IF NOT EXISTS 'RESEARCH';

CREATE TABLE "ResearchQuestionnaire" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "formDefinitionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "targetAudience" TEXT,
  "identityMode" "ResearchResponseIdentityMode" NOT NULL DEFAULT 'PSEUDONYMIZED',
  "defaultLanguage" TEXT NOT NULL DEFAULT 'en',
  "consentStatement" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResearchQuestionnaire_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResearchQuestionnaire_formDefinitionId_key" ON "ResearchQuestionnaire"("formDefinitionId");
CREATE UNIQUE INDEX "ResearchQuestionnaire_projectId_name_key" ON "ResearchQuestionnaire"("projectId", "name");
CREATE INDEX "ResearchQuestionnaire_organizationId_isActive_idx" ON "ResearchQuestionnaire"("organizationId", "isActive");
CREATE INDEX "ResearchQuestionnaire_projectId_isActive_idx" ON "ResearchQuestionnaire"("projectId", "isActive");

ALTER TABLE "ResearchQuestionnaire" ADD CONSTRAINT "ResearchQuestionnaire_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchQuestionnaire" ADD CONSTRAINT "ResearchQuestionnaire_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchQuestionnaire" ADD CONSTRAINT "ResearchQuestionnaire_formDefinitionId_fkey" FOREIGN KEY ("formDefinitionId") REFERENCES "ConfigurableFormDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
