ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'VIEW_CONTRACTORS';
ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'MANAGE_CONTRACTORS';
ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'VIEW_PERMITS_TO_WORK';
ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'MANAGE_PERMITS_TO_WORK';

ALTER TYPE "DocumentEntityType" ADD VALUE IF NOT EXISTS 'CONTRACTOR';
ALTER TYPE "DocumentEntityType" ADD VALUE IF NOT EXISTS 'PERMIT_TO_WORK';

ALTER TYPE "ConfigurableFormModule" ADD VALUE IF NOT EXISTS 'CONTRACTOR';
ALTER TYPE "ConfigurableFormModule" ADD VALUE IF NOT EXISTS 'PERMIT_TO_WORK';

CREATE TYPE "ContractorStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'SUSPENDED', 'EXPIRED', 'INACTIVE');
CREATE TYPE "ContractorWorkerStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'INACTIVE');
CREATE TYPE "PermitToWorkType" AS ENUM ('HOT_WORK', 'CONFINED_SPACE', 'ELECTRICAL_ENERGIZED', 'ELECTRICAL_ISOLATION', 'WORK_AT_HEIGHT', 'EXCAVATION', 'LIFTING_OPERATION', 'LINE_BREAKING', 'HAZARDOUS_CHEMICAL', 'GENERAL');
CREATE TYPE "PermitToWorkStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'CLOSED', 'REJECTED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "PermitGasTestResult" AS ENUM ('PASS', 'FAIL');

CREATE TABLE "Contractor" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "legalName" TEXT,
  "registrationNumber" TEXT,
  "taxIdentifier" TEXT,
  "primaryContactName" TEXT,
  "primaryContactEmail" TEXT,
  "primaryContactPhone" TEXT,
  "services" TEXT,
  "safetyProgramSummary" TEXT,
  "insuranceProvider" TEXT,
  "insurancePolicyNumber" TEXT,
  "insuranceExpiresAt" TIMESTAMP(3),
  "status" "ContractorStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
  "safetyRating" DOUBLE PRECISION,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "suspensionReason" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Contractor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContractorSite" (
  "id" TEXT NOT NULL,
  "contractorId" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "notes" TEXT,
  CONSTRAINT "ContractorSite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContractorWorker" (
  "id" TEXT NOT NULL,
  "contractorId" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "employeeNumber" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "jobTitle" TEXT,
  "status" "ContractorWorkerStatus" NOT NULL DEFAULT 'PENDING',
  "inductionCompletedAt" TIMESTAMP(3),
  "inductionExpiresAt" TIMESTAMP(3),
  "medicalExpiresAt" TIMESTAMP(3),
  "competencySummary" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContractorWorker_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PermitToWork" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "type" "PermitToWorkType" NOT NULL,
  "status" "PermitToWorkStatus" NOT NULL DEFAULT 'DRAFT',
  "siteId" TEXT NOT NULL,
  "departmentId" TEXT,
  "contractorId" TEXT,
  "requestedById" TEXT NOT NULL,
  "issuedById" TEXT,
  "approvedById" TEXT,
  "closedById" TEXT,
  "responsiblePerson" TEXT NOT NULL,
  "exactLocation" TEXT NOT NULL,
  "workOrderReference" TEXT,
  "plannedStartAt" TIMESTAMP(3) NOT NULL,
  "plannedEndAt" TIMESTAMP(3) NOT NULL,
  "hazardsSummary" TEXT NOT NULL,
  "controlsSummary" TEXT NOT NULL,
  "requiredPpe" TEXT,
  "isolationDetails" TEXT,
  "emergencyPlan" TEXT,
  "gasTestingRequired" BOOLEAN NOT NULL DEFAULT false,
  "approvedAt" TIMESTAMP(3),
  "activatedAt" TIMESTAMP(3),
  "suspendedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "closeoutNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PermitToWork_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PermitToWorkControl" (
  "id" TEXT NOT NULL,
  "permitId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "isVerified" BOOLEAN NOT NULL DEFAULT false,
  "verifiedById" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PermitToWorkControl_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PermitToWorkGasTest" (
  "id" TEXT NOT NULL,
  "permitId" TEXT NOT NULL,
  "performedById" TEXT NOT NULL,
  "testedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "oxygenPercent" DOUBLE PRECISION,
  "lelPercent" DOUBLE PRECISION,
  "h2sPpm" DOUBLE PRECISION,
  "coPpm" DOUBLE PRECISION,
  "result" "PermitGasTestResult" NOT NULL,
  "notes" TEXT,
  CONSTRAINT "PermitToWorkGasTest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PermitToWorkWorker" (
  "id" TEXT NOT NULL,
  "permitId" TEXT NOT NULL,
  "workerId" TEXT NOT NULL,
  "role" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PermitToWorkWorker_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PermitToWorkHistory" (
  "id" TEXT NOT NULL,
  "permitId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "fromStatus" "PermitToWorkStatus",
  "toStatus" "PermitToWorkStatus" NOT NULL,
  "comments" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PermitToWorkHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Contractor_organizationId_name_key" ON "Contractor"("organizationId", "name");
CREATE INDEX "Contractor_organizationId_status_idx" ON "Contractor"("organizationId", "status");
CREATE INDEX "Contractor_insuranceExpiresAt_idx" ON "Contractor"("insuranceExpiresAt");
CREATE UNIQUE INDEX "ContractorSite_contractorId_siteId_key" ON "ContractorSite"("contractorId", "siteId");
CREATE INDEX "ContractorSite_siteId_expiresAt_idx" ON "ContractorSite"("siteId", "expiresAt");
CREATE UNIQUE INDEX "ContractorWorker_contractorId_employeeNumber_key" ON "ContractorWorker"("contractorId", "employeeNumber");
CREATE INDEX "ContractorWorker_contractorId_status_idx" ON "ContractorWorker"("contractorId", "status");
CREATE INDEX "ContractorWorker_inductionExpiresAt_idx" ON "ContractorWorker"("inductionExpiresAt");
CREATE UNIQUE INDEX "PermitToWork_organizationId_reference_key" ON "PermitToWork"("organizationId", "reference");
CREATE INDEX "PermitToWork_organizationId_status_plannedStartAt_idx" ON "PermitToWork"("organizationId", "status", "plannedStartAt");
CREATE INDEX "PermitToWork_siteId_plannedStartAt_plannedEndAt_idx" ON "PermitToWork"("siteId", "plannedStartAt", "plannedEndAt");
CREATE INDEX "PermitToWork_contractorId_status_idx" ON "PermitToWork"("contractorId", "status");
CREATE INDEX "PermitToWorkControl_permitId_isVerified_idx" ON "PermitToWorkControl"("permitId", "isVerified");
CREATE INDEX "PermitToWorkGasTest_permitId_testedAt_idx" ON "PermitToWorkGasTest"("permitId", "testedAt");
CREATE UNIQUE INDEX "PermitToWorkWorker_permitId_workerId_key" ON "PermitToWorkWorker"("permitId", "workerId");
CREATE INDEX "PermitToWorkWorker_workerId_idx" ON "PermitToWorkWorker"("workerId");
CREATE INDEX "PermitToWorkHistory_permitId_createdAt_idx" ON "PermitToWorkHistory"("permitId", "createdAt");

ALTER TABLE "Contractor" ADD CONSTRAINT "Contractor_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Contractor" ADD CONSTRAINT "Contractor_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContractorSite" ADD CONSTRAINT "ContractorSite_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContractorSite" ADD CONSTRAINT "ContractorSite_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContractorWorker" ADD CONSTRAINT "ContractorWorker_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PermitToWork" ADD CONSTRAINT "PermitToWork_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PermitToWork" ADD CONSTRAINT "PermitToWork_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PermitToWork" ADD CONSTRAINT "PermitToWork_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PermitToWork" ADD CONSTRAINT "PermitToWork_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PermitToWork" ADD CONSTRAINT "PermitToWork_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PermitToWork" ADD CONSTRAINT "PermitToWork_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PermitToWork" ADD CONSTRAINT "PermitToWork_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PermitToWork" ADD CONSTRAINT "PermitToWork_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PermitToWorkControl" ADD CONSTRAINT "PermitToWorkControl_permitId_fkey" FOREIGN KEY ("permitId") REFERENCES "PermitToWork"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PermitToWorkControl" ADD CONSTRAINT "PermitToWorkControl_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PermitToWorkGasTest" ADD CONSTRAINT "PermitToWorkGasTest_permitId_fkey" FOREIGN KEY ("permitId") REFERENCES "PermitToWork"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PermitToWorkGasTest" ADD CONSTRAINT "PermitToWorkGasTest_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PermitToWorkWorker" ADD CONSTRAINT "PermitToWorkWorker_permitId_fkey" FOREIGN KEY ("permitId") REFERENCES "PermitToWork"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PermitToWorkWorker" ADD CONSTRAINT "PermitToWorkWorker_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "ContractorWorker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PermitToWorkHistory" ADD CONSTRAINT "PermitToWorkHistory_permitId_fkey" FOREIGN KEY ("permitId") REFERENCES "PermitToWork"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PermitToWorkHistory" ADD CONSTRAINT "PermitToWorkHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
