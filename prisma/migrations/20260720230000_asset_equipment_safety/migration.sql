ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'VIEW_ASSETS';
ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'MANAGE_ASSETS';
ALTER TYPE "ConfigurableFormModule" ADD VALUE IF NOT EXISTS 'ASSET_SAFETY';
ALTER TYPE "DocumentEntityType" ADD VALUE IF NOT EXISTS 'ASSET_SAFETY';

CREATE TYPE "AssetType" AS ENUM ('MOBILE_EQUIPMENT', 'MACHINERY', 'PRESSURE_SYSTEM', 'LIFTING_EQUIPMENT', 'ELECTRICAL', 'FIRE_PROTECTION', 'ENVIRONMENTAL_CONTROL', 'EMERGENCY_EQUIPMENT', 'VEHICLE', 'TOOL', 'FACILITY_SYSTEM', 'OTHER');
CREATE TYPE "AssetStatus" AS ENUM ('ACTIVE', 'OUT_OF_SERVICE', 'UNDER_MAINTENANCE', 'QUARANTINED', 'RETIRED');
CREATE TYPE "AssetInspectionResult" AS ENUM ('SATISFACTORY', 'DEFECT_FOUND', 'OUT_OF_SERVICE', 'NOT_INSPECTED');
CREATE TYPE "AssetMaintenanceType" AS ENUM ('PREVENTIVE', 'CORRECTIVE', 'CALIBRATION', 'FUNCTION_TEST', 'STATUTORY', 'OTHER');
CREATE TYPE "AssetMaintenanceStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'OVERDUE');
CREATE TYPE "AssetDefectStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'REPAIR_PLANNED', 'REPAIRED', 'VERIFIED', 'CLOSED', 'DEFERRED');

CREATE TABLE "Asset" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "type" "AssetType" NOT NULL,
  "status" "AssetStatus" NOT NULL DEFAULT 'ACTIVE',
  "criticality" "RiskLevel" NOT NULL DEFAULT 'MEDIUM',
  "isSafetyCritical" BOOLEAN NOT NULL DEFAULT false,
  "manufacturer" TEXT,
  "modelNumber" TEXT,
  "serialNumber" TEXT,
  "siteId" TEXT NOT NULL,
  "departmentId" TEXT,
  "location" TEXT,
  "ownerId" TEXT,
  "createdById" TEXT NOT NULL,
  "commissionedAt" TIMESTAMP(3),
  "inspectionIntervalDays" INTEGER NOT NULL DEFAULT 30,
  "lastInspectionAt" TIMESTAMP(3),
  "nextInspectionDueAt" TIMESTAMP(3) NOT NULL,
  "maintenanceIntervalDays" INTEGER NOT NULL DEFAULT 90,
  "lastMaintenanceAt" TIMESTAMP(3),
  "nextMaintenanceDueAt" TIMESTAMP(3) NOT NULL,
  "permitRequired" BOOLEAN NOT NULL DEFAULT false,
  "inspectionReminderAt" TIMESTAMP(3),
  "inspectionOverdueAt" TIMESTAMP(3),
  "maintenanceReminderAt" TIMESTAMP(3),
  "maintenanceOverdueAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssetInspection" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "inspectedById" TEXT NOT NULL,
  "inspectedAt" TIMESTAMP(3) NOT NULL,
  "result" "AssetInspectionResult" NOT NULL,
  "conditionScore" INTEGER,
  "evidenceReference" TEXT,
  "observations" TEXT,
  "immediateAction" TEXT,
  "nextInspectionDueAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssetInspection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssetMaintenanceRecord" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "defectId" TEXT,
  "type" "AssetMaintenanceType" NOT NULL,
  "status" "AssetMaintenanceStatus" NOT NULL DEFAULT 'SCHEDULED',
  "title" TEXT NOT NULL,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "technicianId" TEXT,
  "serviceProvider" TEXT,
  "workOrderReference" TEXT,
  "workSummary" TEXT,
  "evidenceReference" TEXT,
  "downtimeHours" DECIMAL(10,2),
  "nextMaintenanceDueAt" TIMESTAMP(3),
  "reminderSentAt" TIMESTAMP(3),
  "overdueNotifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssetMaintenanceRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssetDefect" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "sourceInspectionId" TEXT,
  "reference" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "severity" "RiskLevel" NOT NULL,
  "status" "AssetDefectStatus" NOT NULL DEFAULT 'OPEN',
  "reportedById" TEXT NOT NULL,
  "ownerId" TEXT,
  "dueDate" TIMESTAMP(3),
  "immediateControls" TEXT,
  "repairPlan" TEXT,
  "verificationEvidence" TEXT,
  "verifiedById" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "correctiveActionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssetDefect_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Asset_organizationId_reference_key" ON "Asset"("organizationId", "reference");
CREATE UNIQUE INDEX "Asset_organizationId_serialNumber_key" ON "Asset"("organizationId", "serialNumber");
CREATE INDEX "Asset_organizationId_status_criticality_idx" ON "Asset"("organizationId", "status", "criticality");
CREATE INDEX "Asset_siteId_departmentId_status_idx" ON "Asset"("siteId", "departmentId", "status");
CREATE INDEX "Asset_ownerId_status_idx" ON "Asset"("ownerId", "status");
CREATE INDEX "Asset_organizationId_nextInspectionDueAt_idx" ON "Asset"("organizationId", "nextInspectionDueAt");
CREATE INDEX "Asset_organizationId_nextMaintenanceDueAt_idx" ON "Asset"("organizationId", "nextMaintenanceDueAt");
CREATE INDEX "AssetInspection_organizationId_result_inspectedAt_idx" ON "AssetInspection"("organizationId", "result", "inspectedAt");
CREATE INDEX "AssetInspection_assetId_inspectedAt_idx" ON "AssetInspection"("assetId", "inspectedAt");
CREATE INDEX "AssetInspection_inspectedById_inspectedAt_idx" ON "AssetInspection"("inspectedById", "inspectedAt");
CREATE INDEX "AssetMaintenanceRecord_organizationId_status_dueAt_idx" ON "AssetMaintenanceRecord"("organizationId", "status", "dueAt");
CREATE INDEX "AssetMaintenanceRecord_assetId_scheduledAt_idx" ON "AssetMaintenanceRecord"("assetId", "scheduledAt");
CREATE INDEX "AssetMaintenanceRecord_technicianId_status_dueAt_idx" ON "AssetMaintenanceRecord"("technicianId", "status", "dueAt");
CREATE INDEX "AssetMaintenanceRecord_defectId_idx" ON "AssetMaintenanceRecord"("defectId");
CREATE UNIQUE INDEX "AssetDefect_correctiveActionId_key" ON "AssetDefect"("correctiveActionId");
CREATE UNIQUE INDEX "AssetDefect_organizationId_reference_key" ON "AssetDefect"("organizationId", "reference");
CREATE INDEX "AssetDefect_organizationId_status_severity_idx" ON "AssetDefect"("organizationId", "status", "severity");
CREATE INDEX "AssetDefect_assetId_status_idx" ON "AssetDefect"("assetId", "status");
CREATE INDEX "AssetDefect_ownerId_status_dueDate_idx" ON "AssetDefect"("ownerId", "status", "dueDate");
CREATE INDEX "AssetDefect_sourceInspectionId_idx" ON "AssetDefect"("sourceInspectionId");

ALTER TABLE "Asset" ADD CONSTRAINT "Asset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssetInspection" ADD CONSTRAINT "AssetInspection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssetInspection" ADD CONSTRAINT "AssetInspection_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssetInspection" ADD CONSTRAINT "AssetInspection_inspectedById_fkey" FOREIGN KEY ("inspectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssetMaintenanceRecord" ADD CONSTRAINT "AssetMaintenanceRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssetMaintenanceRecord" ADD CONSTRAINT "AssetMaintenanceRecord_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssetMaintenanceRecord" ADD CONSTRAINT "AssetMaintenanceRecord_defectId_fkey" FOREIGN KEY ("defectId") REFERENCES "AssetDefect"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssetMaintenanceRecord" ADD CONSTRAINT "AssetMaintenanceRecord_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssetDefect" ADD CONSTRAINT "AssetDefect_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssetDefect" ADD CONSTRAINT "AssetDefect_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssetDefect" ADD CONSTRAINT "AssetDefect_sourceInspectionId_fkey" FOREIGN KEY ("sourceInspectionId") REFERENCES "AssetInspection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssetDefect" ADD CONSTRAINT "AssetDefect_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssetDefect" ADD CONSTRAINT "AssetDefect_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssetDefect" ADD CONSTRAINT "AssetDefect_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssetDefect" ADD CONSTRAINT "AssetDefect_correctiveActionId_fkey" FOREIGN KEY ("correctiveActionId") REFERENCES "CorrectiveAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
