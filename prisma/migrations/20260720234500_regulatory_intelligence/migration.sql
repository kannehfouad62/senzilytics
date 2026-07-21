ALTER TYPE "ConfigurableFormModule" ADD VALUE IF NOT EXISTS 'REGULATORY_INTELLIGENCE';
ALTER TYPE "DocumentEntityType" ADD VALUE IF NOT EXISTS 'REGULATORY_CHANGE';

CREATE TYPE "RegulatorySourceType" AS ENUM ('GOVERNMENT_REGULATOR', 'STANDARDS_BODY', 'INDUSTRY_BODY', 'CONTRACTUAL', 'INTERNAL', 'OTHER');
CREATE TYPE "RegulatorySourceStatus" AS ENUM ('ACTIVE', 'PAUSED', 'RETIRED');
CREATE TYPE "RegulatoryChangeType" AS ENUM ('NEW_REQUIREMENT', 'AMENDMENT', 'REPEAL', 'GUIDANCE', 'ENFORCEMENT_ALERT', 'STANDARD_UPDATE', 'OTHER');
CREATE TYPE "RegulatoryChangeStatus" AS ENUM ('DETECTED', 'UNDER_REVIEW', 'IMPACT_ASSESSMENT', 'ACTION_REQUIRED', 'IMPLEMENTED', 'NOT_APPLICABLE', 'CLOSED');
CREATE TYPE "RegulatoryAssessmentStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');
CREATE TYPE "RegulatoryImpactDecision" AS ENUM ('APPLICABLE', 'NOT_APPLICABLE');
CREATE TYPE "RegulatoryObligationRelationship" AS ENUM ('CREATED', 'UPDATED', 'AFFECTED');

ALTER TABLE "ComplianceItem" ADD COLUMN "regulatorySourceId" TEXT;

CREATE TABLE "RegulatorySource" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "authority" TEXT NOT NULL,
  "type" "RegulatorySourceType" NOT NULL,
  "jurisdiction" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "description" TEXT,
  "ownerId" TEXT NOT NULL,
  "status" "RegulatorySourceStatus" NOT NULL DEFAULT 'ACTIVE',
  "reviewCadenceDays" INTEGER NOT NULL DEFAULT 90,
  "lastReviewedAt" TIMESTAMP(3),
  "lastReviewedById" TEXT,
  "nextReviewAt" TIMESTAMP(3) NOT NULL,
  "reviewReminderAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RegulatorySource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RegulatoryChange" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "type" "RegulatoryChangeType" NOT NULL,
  "status" "RegulatoryChangeStatus" NOT NULL DEFAULT 'DETECTED',
  "significance" "RiskLevel" NOT NULL DEFAULT 'MEDIUM',
  "sourceUrl" TEXT NOT NULL,
  "citation" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3),
  "effectiveAt" TIMESTAMP(3),
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assessmentDueAt" TIMESTAMP(3) NOT NULL,
  "ownerId" TEXT NOT NULL,
  "detectedById" TEXT NOT NULL,
  "assessmentReminderAt" TIMESTAMP(3),
  "effectiveReminderAt" TIMESTAMP(3),
  "implementedAt" TIMESTAMP(3),
  "implementedById" TEXT,
  "implementationSummary" TEXT,
  "closedAt" TIMESTAMP(3),
  "closeRationale" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RegulatoryChange_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RegulatoryImpactAssessment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "changeId" TEXT NOT NULL,
  "assessorId" TEXT NOT NULL,
  "status" "RegulatoryAssessmentStatus" NOT NULL DEFAULT 'SUBMITTED',
  "decision" "RegulatoryImpactDecision" NOT NULL,
  "applicabilityRationale" TEXT NOT NULL,
  "impactSummary" TEXT,
  "gapSummary" TEXT,
  "requiredActions" TEXT,
  "implementationDueAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RegulatoryImpactAssessment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RegulatoryChangeObligationLink" (
  "id" TEXT NOT NULL,
  "changeId" TEXT NOT NULL,
  "complianceItemId" TEXT NOT NULL,
  "relationship" "RegulatoryObligationRelationship" NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatoryChangeObligationLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RegulatoryChangeActionLink" (
  "id" TEXT NOT NULL,
  "changeId" TEXT NOT NULL,
  "correctiveActionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatoryChangeActionLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RegulatorySource_organizationId_code_key" ON "RegulatorySource"("organizationId", "code");
CREATE UNIQUE INDEX "RegulatorySource_organizationId_name_key" ON "RegulatorySource"("organizationId", "name");
CREATE INDEX "RegulatorySource_organizationId_status_nextReviewAt_idx" ON "RegulatorySource"("organizationId", "status", "nextReviewAt");
CREATE INDEX "RegulatorySource_ownerId_status_idx" ON "RegulatorySource"("ownerId", "status");
CREATE UNIQUE INDEX "RegulatoryChange_organizationId_reference_key" ON "RegulatoryChange"("organizationId", "reference");
CREATE INDEX "RegulatoryChange_organizationId_status_significance_idx" ON "RegulatoryChange"("organizationId", "status", "significance");
CREATE INDEX "RegulatoryChange_sourceId_publishedAt_idx" ON "RegulatoryChange"("sourceId", "publishedAt");
CREATE INDEX "RegulatoryChange_ownerId_status_assessmentDueAt_idx" ON "RegulatoryChange"("ownerId", "status", "assessmentDueAt");
CREATE INDEX "RegulatoryChange_implementedById_implementedAt_idx" ON "RegulatoryChange"("implementedById", "implementedAt");
CREATE INDEX "RegulatoryChange_effectiveAt_status_idx" ON "RegulatoryChange"("effectiveAt", "status");
CREATE INDEX "RegulatoryImpactAssessment_organizationId_status_submittedAt_idx" ON "RegulatoryImpactAssessment"("organizationId", "status", "submittedAt");
CREATE INDEX "RegulatoryImpactAssessment_changeId_status_submittedAt_idx" ON "RegulatoryImpactAssessment"("changeId", "status", "submittedAt");
CREATE INDEX "RegulatoryImpactAssessment_assessorId_status_idx" ON "RegulatoryImpactAssessment"("assessorId", "status");
CREATE UNIQUE INDEX "RegulatoryChangeObligationLink_changeId_complianceItemId_key" ON "RegulatoryChangeObligationLink"("changeId", "complianceItemId");
CREATE INDEX "RegulatoryChangeObligationLink_complianceItemId_idx" ON "RegulatoryChangeObligationLink"("complianceItemId");
CREATE UNIQUE INDEX "RegulatoryChangeActionLink_changeId_correctiveActionId_key" ON "RegulatoryChangeActionLink"("changeId", "correctiveActionId");
CREATE INDEX "RegulatoryChangeActionLink_correctiveActionId_idx" ON "RegulatoryChangeActionLink"("correctiveActionId");
CREATE INDEX "ComplianceItem_regulatorySourceId_status_idx" ON "ComplianceItem"("regulatorySourceId", "status");

ALTER TABLE "RegulatorySource" ADD CONSTRAINT "RegulatorySource_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RegulatorySource" ADD CONSTRAINT "RegulatorySource_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegulatorySource" ADD CONSTRAINT "RegulatorySource_lastReviewedById_fkey" FOREIGN KEY ("lastReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RegulatoryChange" ADD CONSTRAINT "RegulatoryChange_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RegulatoryChange" ADD CONSTRAINT "RegulatoryChange_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "RegulatorySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegulatoryChange" ADD CONSTRAINT "RegulatoryChange_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegulatoryChange" ADD CONSTRAINT "RegulatoryChange_detectedById_fkey" FOREIGN KEY ("detectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegulatoryChange" ADD CONSTRAINT "RegulatoryChange_implementedById_fkey" FOREIGN KEY ("implementedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RegulatoryImpactAssessment" ADD CONSTRAINT "RegulatoryImpactAssessment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RegulatoryImpactAssessment" ADD CONSTRAINT "RegulatoryImpactAssessment_changeId_fkey" FOREIGN KEY ("changeId") REFERENCES "RegulatoryChange"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RegulatoryImpactAssessment" ADD CONSTRAINT "RegulatoryImpactAssessment_assessorId_fkey" FOREIGN KEY ("assessorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegulatoryImpactAssessment" ADD CONSTRAINT "RegulatoryImpactAssessment_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RegulatoryChangeObligationLink" ADD CONSTRAINT "RegulatoryChangeObligationLink_changeId_fkey" FOREIGN KEY ("changeId") REFERENCES "RegulatoryChange"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RegulatoryChangeObligationLink" ADD CONSTRAINT "RegulatoryChangeObligationLink_complianceItemId_fkey" FOREIGN KEY ("complianceItemId") REFERENCES "ComplianceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RegulatoryChangeActionLink" ADD CONSTRAINT "RegulatoryChangeActionLink_changeId_fkey" FOREIGN KEY ("changeId") REFERENCES "RegulatoryChange"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RegulatoryChangeActionLink" ADD CONSTRAINT "RegulatoryChangeActionLink_correctiveActionId_fkey" FOREIGN KEY ("correctiveActionId") REFERENCES "CorrectiveAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ComplianceItem" ADD CONSTRAINT "ComplianceItem_regulatorySourceId_fkey" FOREIGN KEY ("regulatorySourceId") REFERENCES "RegulatorySource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
