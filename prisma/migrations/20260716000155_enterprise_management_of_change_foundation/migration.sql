-- CreateEnum
CREATE TYPE "MocStatus" AS ENUM ('DRAFT', 'TECHNICAL_REVIEW', 'RISK_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'IMPLEMENTATION', 'VERIFICATION', 'CLOSED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MocChangeType" AS ENUM ('PROCESS', 'EQUIPMENT', 'CHEMICAL', 'SOFTWARE', 'FACILITY', 'ORGANIZATIONAL', 'PROCEDURE', 'MATERIAL', 'TECHNOLOGY', 'OTHER');

-- CreateEnum
CREATE TYPE "MocChangeDuration" AS ENUM ('TEMPORARY', 'PERMANENT', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "MocPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "MocApprovalRole" AS ENUM ('OPERATIONS', 'EHS', 'ENGINEERING', 'QUALITY', 'MAINTENANCE', 'INFORMATION_TECHNOLOGY', 'SITE_MANAGEMENT', 'EXECUTIVE', 'OTHER');

-- CreateEnum
CREATE TYPE "MocApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'NOT_REQUIRED');

-- CreateEnum
CREATE TYPE "MocTaskType" AS ENUM ('IMPLEMENTATION', 'VERIFICATION', 'TRAINING', 'INSPECTION', 'DOCUMENTATION', 'COMPLIANCE', 'COMMUNICATION', 'OTHER');

-- CreateEnum
CREATE TYPE "MocTaskStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "DocumentEntityType" ADD VALUE 'MOC';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PermissionKey" ADD VALUE 'VIEW_MOC';
ALTER TYPE "PermissionKey" ADD VALUE 'MANAGE_MOC';

-- CreateTable
CREATE TABLE "ManagementOfChange" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "businessJustification" TEXT NOT NULL,
    "changeType" "MocChangeType" NOT NULL,
    "changeDuration" "MocChangeDuration" NOT NULL,
    "priority" "MocPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "MocStatus" NOT NULL DEFAULT 'DRAFT',
    "emergencyJustification" TEXT,
    "temporaryExpirationDate" TIMESTAMP(3),
    "affectedProcess" TEXT,
    "affectedEquipment" TEXT,
    "affectedSystems" TEXT,
    "affectedMaterials" TEXT,
    "operationalImpact" TEXT,
    "regulatoryImpact" TEXT,
    "environmentalImpact" TEXT,
    "safetyImpact" TEXT,
    "qualityImpact" TEXT,
    "initialLikelihood" "RiskLikelihood" NOT NULL,
    "initialImpact" "RiskImpact" NOT NULL,
    "initialScore" INTEGER NOT NULL,
    "initialRiskLevel" "RiskLevel" NOT NULL,
    "residualLikelihood" "RiskLikelihood" NOT NULL,
    "residualImpact" "RiskImpact" NOT NULL,
    "residualScore" INTEGER NOT NULL,
    "residualRiskLevel" "RiskLevel" NOT NULL,
    "proposedStartDate" TIMESTAMP(3),
    "plannedCompletionDate" TIMESTAMP(3),
    "actualStartDate" TIMESTAMP(3),
    "implementedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "organizationId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "departmentId" TEXT,
    "requestorId" TEXT NOT NULL,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagementOfChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MocApproval" (
    "id" TEXT NOT NULL,
    "role" "MocApprovalRole" NOT NULL,
    "status" "MocApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "sequence" INTEGER NOT NULL,
    "comments" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "mocId" TEXT NOT NULL,
    "approverId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MocApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MocTask" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "taskType" "MocTaskType" NOT NULL,
    "status" "MocTaskStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "sequence" INTEGER,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "dueDate" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "evidenceNote" TEXT,
    "mocId" TEXT NOT NULL,
    "assignedToId" TEXT,
    "verifiedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MocTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MocRiskLink" (
    "id" TEXT NOT NULL,
    "relationshipNote" TEXT,
    "mocId" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MocRiskLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManagementOfChange_organizationId_status_idx" ON "ManagementOfChange"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ManagementOfChange_organizationId_changeType_idx" ON "ManagementOfChange"("organizationId", "changeType");

-- CreateIndex
CREATE INDEX "ManagementOfChange_siteId_status_idx" ON "ManagementOfChange"("siteId", "status");

-- CreateIndex
CREATE INDEX "ManagementOfChange_departmentId_idx" ON "ManagementOfChange"("departmentId");

-- CreateIndex
CREATE INDEX "ManagementOfChange_requestorId_idx" ON "ManagementOfChange"("requestorId");

-- CreateIndex
CREATE INDEX "ManagementOfChange_ownerId_idx" ON "ManagementOfChange"("ownerId");

-- CreateIndex
CREATE INDEX "ManagementOfChange_priority_status_idx" ON "ManagementOfChange"("priority", "status");

-- CreateIndex
CREATE INDEX "ManagementOfChange_residualRiskLevel_status_idx" ON "ManagementOfChange"("residualRiskLevel", "status");

-- CreateIndex
CREATE INDEX "ManagementOfChange_plannedCompletionDate_status_idx" ON "ManagementOfChange"("plannedCompletionDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ManagementOfChange_organizationId_reference_key" ON "ManagementOfChange"("organizationId", "reference");

-- CreateIndex
CREATE INDEX "MocApproval_mocId_status_idx" ON "MocApproval"("mocId", "status");

-- CreateIndex
CREATE INDEX "MocApproval_approverId_idx" ON "MocApproval"("approverId");

-- CreateIndex
CREATE UNIQUE INDEX "MocApproval_mocId_role_sequence_key" ON "MocApproval"("mocId", "role", "sequence");

-- CreateIndex
CREATE INDEX "MocTask_mocId_status_idx" ON "MocTask"("mocId", "status");

-- CreateIndex
CREATE INDEX "MocTask_mocId_taskType_idx" ON "MocTask"("mocId", "taskType");

-- CreateIndex
CREATE INDEX "MocTask_assignedToId_idx" ON "MocTask"("assignedToId");

-- CreateIndex
CREATE INDEX "MocTask_dueDate_status_idx" ON "MocTask"("dueDate", "status");

-- CreateIndex
CREATE INDEX "MocRiskLink_riskId_idx" ON "MocRiskLink"("riskId");

-- CreateIndex
CREATE UNIQUE INDEX "MocRiskLink_mocId_riskId_key" ON "MocRiskLink"("mocId", "riskId");

-- AddForeignKey
ALTER TABLE "ManagementOfChange" ADD CONSTRAINT "ManagementOfChange_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementOfChange" ADD CONSTRAINT "ManagementOfChange_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementOfChange" ADD CONSTRAINT "ManagementOfChange_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementOfChange" ADD CONSTRAINT "ManagementOfChange_requestorId_fkey" FOREIGN KEY ("requestorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementOfChange" ADD CONSTRAINT "ManagementOfChange_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MocApproval" ADD CONSTRAINT "MocApproval_mocId_fkey" FOREIGN KEY ("mocId") REFERENCES "ManagementOfChange"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MocApproval" ADD CONSTRAINT "MocApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MocTask" ADD CONSTRAINT "MocTask_mocId_fkey" FOREIGN KEY ("mocId") REFERENCES "ManagementOfChange"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MocTask" ADD CONSTRAINT "MocTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MocTask" ADD CONSTRAINT "MocTask_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MocRiskLink" ADD CONSTRAINT "MocRiskLink_mocId_fkey" FOREIGN KEY ("mocId") REFERENCES "ManagementOfChange"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MocRiskLink" ADD CONSTRAINT "MocRiskLink_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
