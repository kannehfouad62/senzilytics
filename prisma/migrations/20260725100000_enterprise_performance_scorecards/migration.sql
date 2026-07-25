ALTER TYPE "PermissionKey" ADD VALUE 'VIEW_PERFORMANCE_SCORECARDS';
ALTER TYPE "PermissionKey" ADD VALUE 'MANAGE_PERFORMANCE_SCORECARDS';

CREATE TYPE "PerformanceIndicatorType" AS ENUM ('LEADING', 'LAGGING');
CREATE TYPE "PerformanceIndicatorDirection" AS ENUM ('HIGHER_IS_BETTER', 'LOWER_IS_BETTER');
CREATE TYPE "PerformanceIndicatorFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL');
CREATE TYPE "PerformanceIndicatorSource" AS ENUM ('MANUAL', 'SYSTEM');
CREATE TYPE "PerformanceSystemMetric" AS ENUM (
  'INCIDENT_COUNT',
  'HIGH_RISK_INCIDENT_COUNT',
  'OVERDUE_CORRECTIVE_ACTION_COUNT',
  'AUDIT_COMPLETION_RATE',
  'INSPECTION_COMPLETION_RATE',
  'TRAINING_COMPLETION_RATE',
  'OPEN_HIGH_RISK_COUNT',
  'SAFE_BEHAVIOR_RATE'
);
CREATE TYPE "PerformanceMeasurementStatus" AS ENUM ('DRAFT', 'APPROVED', 'REJECTED');

CREATE TABLE "PerformanceIndicatorDefinition" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL,
  "type" "PerformanceIndicatorType" NOT NULL,
  "direction" "PerformanceIndicatorDirection" NOT NULL,
  "unit" TEXT NOT NULL,
  "reportingFrequency" "PerformanceIndicatorFrequency" NOT NULL DEFAULT 'MONTHLY',
  "source" "PerformanceIndicatorSource" NOT NULL,
  "systemMetric" "PerformanceSystemMetric",
  "methodology" TEXT,
  "ownerId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PerformanceIndicatorDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PerformanceIndicatorTarget" (
  "id" TEXT NOT NULL,
  "indicatorId" TEXT NOT NULL,
  "scopeKey" TEXT NOT NULL,
  "siteId" TEXT,
  "departmentId" TEXT,
  "targetValue" DOUBLE PRECISION NOT NULL,
  "warningThreshold" DOUBLE PRECISION NOT NULL,
  "criticalThreshold" DOUBLE PRECISION NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "rationale" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PerformanceIndicatorTarget_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PerformanceIndicatorMeasurement" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "indicatorId" TEXT NOT NULL,
  "scopeKey" TEXT NOT NULL,
  "siteId" TEXT,
  "departmentId" TEXT,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "value" DOUBLE PRECISION NOT NULL,
  "status" "PerformanceMeasurementStatus" NOT NULL DEFAULT 'DRAFT',
  "evidenceSummary" TEXT,
  "notes" TEXT,
  "enteredById" TEXT NOT NULL,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PerformanceIndicatorMeasurement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PerformanceIndicatorDefinition_organizationId_code_key" ON "PerformanceIndicatorDefinition"("organizationId", "code");
CREATE INDEX "PerformanceIndicatorDefinition_organizationId_isActive_type_idx" ON "PerformanceIndicatorDefinition"("organizationId", "isActive", "type");
CREATE INDEX "PerformanceIndicatorDefinition_ownerId_isActive_idx" ON "PerformanceIndicatorDefinition"("ownerId", "isActive");
CREATE UNIQUE INDEX "PerformanceIndicatorTarget_indicatorId_scopeKey_effectiveFrom_key" ON "PerformanceIndicatorTarget"("indicatorId", "scopeKey", "effectiveFrom");
CREATE INDEX "PerformanceIndicatorTarget_indicatorId_scopeKey_effectiveFrom_effectiveTo_idx" ON "PerformanceIndicatorTarget"("indicatorId", "scopeKey", "effectiveFrom", "effectiveTo");
CREATE INDEX "PerformanceIndicatorTarget_siteId_effectiveFrom_idx" ON "PerformanceIndicatorTarget"("siteId", "effectiveFrom");
CREATE INDEX "PerformanceIndicatorTarget_departmentId_effectiveFrom_idx" ON "PerformanceIndicatorTarget"("departmentId", "effectiveFrom");
CREATE UNIQUE INDEX "PerformanceIndicatorMeasurement_indicatorId_scopeKey_periodStart_periodEnd_key" ON "PerformanceIndicatorMeasurement"("indicatorId", "scopeKey", "periodStart", "periodEnd");
CREATE INDEX "PerformanceIndicatorMeasurement_organizationId_status_periodEnd_idx" ON "PerformanceIndicatorMeasurement"("organizationId", "status", "periodEnd");
CREATE INDEX "PerformanceIndicatorMeasurement_indicatorId_scopeKey_periodEnd_status_idx" ON "PerformanceIndicatorMeasurement"("indicatorId", "scopeKey", "periodEnd", "status");
CREATE INDEX "PerformanceIndicatorMeasurement_siteId_periodEnd_status_idx" ON "PerformanceIndicatorMeasurement"("siteId", "periodEnd", "status");
CREATE INDEX "PerformanceIndicatorMeasurement_departmentId_periodEnd_status_idx" ON "PerformanceIndicatorMeasurement"("departmentId", "periodEnd", "status");

ALTER TABLE "PerformanceIndicatorDefinition" ADD CONSTRAINT "PerformanceIndicatorDefinition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PerformanceIndicatorDefinition" ADD CONSTRAINT "PerformanceIndicatorDefinition_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PerformanceIndicatorTarget" ADD CONSTRAINT "PerformanceIndicatorTarget_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "PerformanceIndicatorDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PerformanceIndicatorTarget" ADD CONSTRAINT "PerformanceIndicatorTarget_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PerformanceIndicatorTarget" ADD CONSTRAINT "PerformanceIndicatorTarget_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PerformanceIndicatorTarget" ADD CONSTRAINT "PerformanceIndicatorTarget_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PerformanceIndicatorMeasurement" ADD CONSTRAINT "PerformanceIndicatorMeasurement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PerformanceIndicatorMeasurement" ADD CONSTRAINT "PerformanceIndicatorMeasurement_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "PerformanceIndicatorDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PerformanceIndicatorMeasurement" ADD CONSTRAINT "PerformanceIndicatorMeasurement_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PerformanceIndicatorMeasurement" ADD CONSTRAINT "PerformanceIndicatorMeasurement_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PerformanceIndicatorMeasurement" ADD CONSTRAINT "PerformanceIndicatorMeasurement_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PerformanceIndicatorMeasurement" ADD CONSTRAINT "PerformanceIndicatorMeasurement_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
