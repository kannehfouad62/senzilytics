CREATE TYPE "ResearchQuestionnaireLocalizationStatus" AS ENUM ('DRAFT', 'APPROVED', 'ARCHIVED');

CREATE TABLE "ResearchQuestionnaireLocalization" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "questionnaireId" TEXT NOT NULL,
    "formVersionId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "languageName" TEXT NOT NULL,
    "status" "ResearchQuestionnaireLocalizationStatus" NOT NULL DEFAULT 'DRAFT',
    "questionnaireName" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "consentStatement" TEXT,
    "instructions" TEXT,
    "fieldTranslations" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchQuestionnaireLocalization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResearchQuestionnaireLocalization_formVersionId_locale_key"
ON "ResearchQuestionnaireLocalization"("formVersionId", "locale");
CREATE INDEX "ResearchQuestionnaireLocalization_organizationId_status_locale_idx"
ON "ResearchQuestionnaireLocalization"("organizationId", "status", "locale");
CREATE INDEX "ResearchQuestionnaireLocalization_questionnaireId_status_idx"
ON "ResearchQuestionnaireLocalization"("questionnaireId", "status");

ALTER TABLE "ResearchQuestionnaireLocalization"
ADD CONSTRAINT "ResearchQuestionnaireLocalization_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchQuestionnaireLocalization"
ADD CONSTRAINT "ResearchQuestionnaireLocalization_questionnaireId_fkey"
FOREIGN KEY ("questionnaireId") REFERENCES "ResearchQuestionnaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchQuestionnaireLocalization"
ADD CONSTRAINT "ResearchQuestionnaireLocalization_formVersionId_fkey"
FOREIGN KEY ("formVersionId") REFERENCES "ConfigurableFormVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchQuestionnaireLocalization"
ADD CONSTRAINT "ResearchQuestionnaireLocalization_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResearchQuestionnaireLocalization"
ADD CONSTRAINT "ResearchQuestionnaireLocalization_approvedById_fkey"
FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ResearchPublicResponse" ADD COLUMN "locale" TEXT;
