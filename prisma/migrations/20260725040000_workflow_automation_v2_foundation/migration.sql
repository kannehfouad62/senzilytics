CREATE TYPE "WorkflowTriggerEvent" AS ENUM (
  'RECORD_CREATED',
  'STATUS_CHANGED',
  'FORM_SUBMITTED'
);

CREATE TYPE "WorkflowAutomationEventStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'PROCESSED',
  'FAILED'
);

ALTER TABLE "WorkflowTemplate"
ADD COLUMN "triggerEvent" "WorkflowTriggerEvent" NOT NULL DEFAULT 'RECORD_CREATED',
ADD COLUMN "triggerConditions" JSONB;

ALTER TABLE "WorkflowInstance"
ADD COLUMN "triggerEvent" "WorkflowTriggerEvent" NOT NULL DEFAULT 'RECORD_CREATED',
ADD COLUMN "triggerContext" JSONB;

CREATE TABLE "WorkflowAutomationEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "entityType" "WorkflowEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "triggerEvent" "WorkflowTriggerEvent" NOT NULL,
  "context" JSONB,
  "initiatedById" TEXT,
  "status" "WorkflowAutomationEventStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "startedWorkflowCount" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "processedAt" TIMESTAMP(3),
  "dedupeKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkflowAutomationEvent_pkey" PRIMARY KEY ("id")
);

DROP INDEX IF EXISTS "WorkflowTemplate_organizationId_entityType_isActive_idx";

CREATE INDEX "WorkflowTemplate_organizationId_entityType_triggerEvent_isActive_idx"
ON "WorkflowTemplate"("organizationId", "entityType", "triggerEvent", "isActive");

CREATE INDEX "WorkflowInstance_templateId_entityType_entityId_idx"
ON "WorkflowInstance"("templateId", "entityType", "entityId");

CREATE INDEX "WorkflowInstance_organizationId_triggerEvent_createdAt_idx"
ON "WorkflowInstance"("organizationId", "triggerEvent", "createdAt");

CREATE UNIQUE INDEX "WorkflowAutomationEvent_organizationId_dedupeKey_key"
ON "WorkflowAutomationEvent"("organizationId", "dedupeKey");

CREATE INDEX "WorkflowAutomationEvent_status_createdAt_idx"
ON "WorkflowAutomationEvent"("status", "createdAt");

CREATE INDEX "WorkflowAutomationEvent_organizationId_status_createdAt_idx"
ON "WorkflowAutomationEvent"("organizationId", "status", "createdAt");

CREATE INDEX "WorkflowAutomationEvent_organizationId_entityType_entityId_idx"
ON "WorkflowAutomationEvent"("organizationId", "entityType", "entityId");

ALTER TABLE "WorkflowAutomationEvent"
ADD CONSTRAINT "WorkflowAutomationEvent_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowAutomationEvent"
ADD CONSTRAINT "WorkflowAutomationEvent_initiatedById_fkey"
FOREIGN KEY ("initiatedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
