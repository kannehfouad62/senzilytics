-- CreateEnum
CREATE TYPE "RiskStatus" AS ENUM ('DRAFT', 'ACTIVE', 'UNDER_REVIEW', 'TREATMENT_REQUIRED', 'ACCEPTED', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RiskCategory" AS ENUM ('SAFETY', 'ENVIRONMENTAL', 'OCCUPATIONAL_HEALTH', 'OPERATIONAL', 'COMPLIANCE', 'SECURITY', 'QUALITY', 'STRATEGIC', 'REPUTATIONAL', 'FINANCIAL', 'TECHNOLOGY', 'OTHER');

-- CreateEnum
CREATE TYPE "RiskLikelihood" AS ENUM ('RARE', 'UNLIKELY', 'POSSIBLE', 'LIKELY', 'ALMOST_CERTAIN');

-- CreateEnum
CREATE TYPE "RiskImpact" AS ENUM ('INSIGNIFICANT', 'MINOR', 'MODERATE', 'MAJOR', 'CATASTROPHIC');

-- CreateEnum
CREATE TYPE "RiskReviewFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL', 'BIENNIAL', 'AD_HOC');

-- CreateEnum
CREATE TYPE "RiskControlType" AS ENUM ('EXISTING', 'PLANNED');

-- CreateEnum
CREATE TYPE "RiskControlHierarchy" AS ENUM ('ELIMINATION', 'SUBSTITUTION', 'ENGINEERING', 'ADMINISTRATIVE', 'TRAINING', 'PPE', 'MONITORING', 'OTHER');

-- CreateEnum
CREATE TYPE "RiskControlEffectiveness" AS ENUM ('INEFFECTIVE', 'WEAK', 'PARTIALLY_EFFECTIVE', 'EFFECTIVE', 'HIGHLY_EFFECTIVE', 'NOT_ASSESSED');

-- CreateEnum
CREATE TYPE "RiskLinkedEntityType" AS ENUM ('INCIDENT', 'INVESTIGATION', 'CORRECTIVE_ACTION', 'AUDIT', 'AUDIT_FINDING', 'INSPECTION', 'INSPECTION_FINDING', 'COMPLIANCE', 'WORKFLOW', 'DOCUMENT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentEntityType" ADD VALUE 'RISK';
ALTER TYPE "DocumentEntityType" ADD VALUE 'RISK_CONTROL';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PermissionKey" ADD VALUE 'VIEW_RISKS';
ALTER TYPE "PermissionKey" ADD VALUE 'MANAGE_RISKS';

-- AlterEnum
ALTER TYPE "WorkflowEntityType" ADD VALUE 'RISK';

-- CreateTable
CREATE TABLE "Risk" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "RiskCategory" NOT NULL,
    "hazardType" TEXT,
    "process" TEXT,
    "status" "RiskStatus" NOT NULL DEFAULT 'DRAFT',
    "organizationId" TEXT NOT NULL,
    "siteId" TEXT,
    "departmentId" TEXT,
    "ownerId" TEXT,
    "initialLikelihood" "RiskLikelihood" NOT NULL,
    "initialImpact" "RiskImpact" NOT NULL,
    "initialScore" INTEGER NOT NULL,
    "initialRiskLevel" "RiskLevel" NOT NULL,
    "currentLikelihood" "RiskLikelihood" NOT NULL,
    "currentImpact" "RiskImpact" NOT NULL,
    "currentScore" INTEGER NOT NULL,
    "currentRiskLevel" "RiskLevel" NOT NULL,
    "residualLikelihood" "RiskLikelihood" NOT NULL,
    "residualImpact" "RiskImpact" NOT NULL,
    "residualScore" INTEGER NOT NULL,
    "residualRiskLevel" "RiskLevel" NOT NULL,
    "reviewFrequency" "RiskReviewFrequency" NOT NULL DEFAULT 'ANNUAL',
    "lastReviewedAt" TIMESTAMP(3),
    "nextReviewDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Risk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskControl" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "controlType" "RiskControlType" NOT NULL,
    "hierarchy" "RiskControlHierarchy" NOT NULL,
    "effectiveness" "RiskControlEffectiveness" NOT NULL DEFAULT 'NOT_ASSESSED',
    "status" "Status" NOT NULL DEFAULT 'OPEN',
    "ownerId" TEXT,
    "dueDate" TIMESTAMP(3),
    "implementedAt" TIMESTAMP(3),
    "verificationDate" TIMESTAMP(3),
    "verificationMethod" TEXT,
    "verificationResult" TEXT,
    "riskId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskReview" (
    "id" TEXT NOT NULL,
    "reviewDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "likelihood" "RiskLikelihood" NOT NULL,
    "impact" "RiskImpact" NOT NULL,
    "score" INTEGER NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "controlEffectiveness" "RiskControlEffectiveness",
    "trend" TEXT,
    "nextReviewDate" TIMESTAMP(3),
    "riskId" TEXT NOT NULL,
    "completedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskLink" (
    "id" TEXT NOT NULL,
    "entityType" "RiskLinkedEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "label" TEXT,
    "riskId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Risk_organizationId_status_idx" ON "Risk"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Risk_organizationId_category_idx" ON "Risk"("organizationId", "category");

-- CreateIndex
CREATE INDEX "Risk_siteId_status_idx" ON "Risk"("siteId", "status");

-- CreateIndex
CREATE INDEX "Risk_departmentId_idx" ON "Risk"("departmentId");

-- CreateIndex
CREATE INDEX "Risk_ownerId_idx" ON "Risk"("ownerId");

-- CreateIndex
CREATE INDEX "Risk_currentRiskLevel_nextReviewDate_idx" ON "Risk"("currentRiskLevel", "nextReviewDate");

-- CreateIndex
CREATE INDEX "Risk_residualRiskLevel_nextReviewDate_idx" ON "Risk"("residualRiskLevel", "nextReviewDate");

-- CreateIndex
CREATE UNIQUE INDEX "Risk_organizationId_reference_key" ON "Risk"("organizationId", "reference");

-- CreateIndex
CREATE INDEX "RiskControl_riskId_controlType_idx" ON "RiskControl"("riskId", "controlType");

-- CreateIndex
CREATE INDEX "RiskControl_riskId_status_idx" ON "RiskControl"("riskId", "status");

-- CreateIndex
CREATE INDEX "RiskControl_ownerId_idx" ON "RiskControl"("ownerId");

-- CreateIndex
CREATE INDEX "RiskControl_effectiveness_idx" ON "RiskControl"("effectiveness");

-- CreateIndex
CREATE INDEX "RiskControl_dueDate_idx" ON "RiskControl"("dueDate");

-- CreateIndex
CREATE INDEX "RiskReview_riskId_reviewDate_idx" ON "RiskReview"("riskId", "reviewDate");

-- CreateIndex
CREATE INDEX "RiskReview_completedById_idx" ON "RiskReview"("completedById");

-- CreateIndex
CREATE INDEX "RiskReview_riskLevel_idx" ON "RiskReview"("riskLevel");

-- CreateIndex
CREATE INDEX "RiskLink_entityType_entityId_idx" ON "RiskLink"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskLink_riskId_entityType_entityId_key" ON "RiskLink"("riskId", "entityType", "entityId");

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskControl" ADD CONSTRAINT "RiskControl_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskControl" ADD CONSTRAINT "RiskControl_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskReview" ADD CONSTRAINT "RiskReview_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskReview" ADD CONSTRAINT "RiskReview_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskLink" ADD CONSTRAINT "RiskLink_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
