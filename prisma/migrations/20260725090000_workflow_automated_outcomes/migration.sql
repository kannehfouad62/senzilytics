CREATE TYPE "WorkflowOutcomeEvent" AS ENUM (
  'STEP_APPROVED',
  'STEP_REJECTED',
  'WORKFLOW_COMPLETED',
  'STEP_ESCALATED'
);

CREATE TYPE "WorkflowOutcomeType" AS ENUM (
  'CREATE_TASK',
  'CREATE_CORRECTIVE_ACTION',
  'CREATE_RISK_DRAFT',
  'CREATE_COMPLIANCE_TASK',
  'SEND_NOTIFICATION',
  'UPDATE_SOURCE_STATUS',
  'EMIT_WEBHOOK'
);

CREATE TYPE "WorkflowOutcomeExecutionStatus" AS ENUM (
  'AWAITING_APPROVAL',
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'REJECTED'
);

CREATE TYPE "WorkflowGeneratedTaskStatus" AS ENUM (
  'OPEN',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED'
);

CREATE TABLE "WorkflowOutcomeDefinition" (
  "id" TEXT NOT NULL,
  "templateStepId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "event" "WorkflowOutcomeEvent" NOT NULL,
  "outcomeType" "WorkflowOutcomeType" NOT NULL,
  "configuration" JSONB NOT NULL,
  "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkflowOutcomeDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkflowOutcomeExecution" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "definitionId" TEXT NOT NULL,
  "workflowInstanceId" TEXT NOT NULL,
  "workflowInstanceStepId" TEXT,
  "event" "WorkflowOutcomeEvent" NOT NULL,
  "status" "WorkflowOutcomeExecutionStatus" NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "context" JSONB,
  "output" JSONB,
  "lastError" TEXT,
  "approvalRequestedAt" TIMESTAMP(3),
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "rejectedById" TEXT,
  "rejectedAt" TIMESTAMP(3),
  "reviewNotes" TEXT,
  "processedAt" TIMESTAMP(3),
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkflowOutcomeExecution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkflowGeneratedTask" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "outcomeExecutionId" TEXT NOT NULL,
  "sourceEntityType" "WorkflowEntityType" NOT NULL,
  "sourceEntityId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "assignedRole" "UserRole",
  "assignedUserId" TEXT,
  "status" "WorkflowGeneratedTaskStatus" NOT NULL DEFAULT 'OPEN',
  "dueAt" TIMESTAMP(3),
  "completedById" TEXT,
  "completedAt" TIMESTAMP(3),
  "completionNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkflowGeneratedTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkflowOutcomeDefinition_templateStepId_event_isActive_idx"
ON "WorkflowOutcomeDefinition"("templateStepId", "event", "isActive");

CREATE UNIQUE INDEX "WorkflowOutcomeExecution_organizationId_idempotencyKey_key"
ON "WorkflowOutcomeExecution"("organizationId", "idempotencyKey");

CREATE INDEX "WorkflowOutcomeExecution_status_createdAt_idx"
ON "WorkflowOutcomeExecution"("status", "createdAt");

CREATE INDEX "WorkflowOutcomeExecution_organizationId_status_createdAt_idx"
ON "WorkflowOutcomeExecution"("organizationId", "status", "createdAt");

CREATE INDEX "WorkflowOutcomeExecution_workflowInstanceId_event_idx"
ON "WorkflowOutcomeExecution"("workflowInstanceId", "event");

CREATE INDEX "WorkflowOutcomeExecution_definitionId_createdAt_idx"
ON "WorkflowOutcomeExecution"("definitionId", "createdAt");

CREATE UNIQUE INDEX "WorkflowGeneratedTask_outcomeExecutionId_key"
ON "WorkflowGeneratedTask"("outcomeExecutionId");

CREATE INDEX "WorkflowGeneratedTask_organizationId_status_dueAt_idx"
ON "WorkflowGeneratedTask"("organizationId", "status", "dueAt");

CREATE INDEX "WorkflowGeneratedTask_assignedUserId_status_dueAt_idx"
ON "WorkflowGeneratedTask"("assignedUserId", "status", "dueAt");

CREATE INDEX "WorkflowGeneratedTask_assignedRole_status_dueAt_idx"
ON "WorkflowGeneratedTask"("assignedRole", "status", "dueAt");

CREATE INDEX "WorkflowGeneratedTask_organizationId_sourceEntityType_sourceEntityId_idx"
ON "WorkflowGeneratedTask"("organizationId", "sourceEntityType", "sourceEntityId");

ALTER TABLE "WorkflowOutcomeDefinition"
ADD CONSTRAINT "WorkflowOutcomeDefinition_templateStepId_fkey"
FOREIGN KEY ("templateStepId") REFERENCES "WorkflowTemplateStep"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowOutcomeExecution"
ADD CONSTRAINT "WorkflowOutcomeExecution_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowOutcomeExecution"
ADD CONSTRAINT "WorkflowOutcomeExecution_definitionId_fkey"
FOREIGN KEY ("definitionId") REFERENCES "WorkflowOutcomeDefinition"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkflowOutcomeExecution"
ADD CONSTRAINT "WorkflowOutcomeExecution_workflowInstanceId_fkey"
FOREIGN KEY ("workflowInstanceId") REFERENCES "WorkflowInstance"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowOutcomeExecution"
ADD CONSTRAINT "WorkflowOutcomeExecution_workflowInstanceStepId_fkey"
FOREIGN KEY ("workflowInstanceStepId") REFERENCES "WorkflowInstanceStep"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkflowOutcomeExecution"
ADD CONSTRAINT "WorkflowOutcomeExecution_approvedById_fkey"
FOREIGN KEY ("approvedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkflowOutcomeExecution"
ADD CONSTRAINT "WorkflowOutcomeExecution_rejectedById_fkey"
FOREIGN KEY ("rejectedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkflowGeneratedTask"
ADD CONSTRAINT "WorkflowGeneratedTask_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowGeneratedTask"
ADD CONSTRAINT "WorkflowGeneratedTask_outcomeExecutionId_fkey"
FOREIGN KEY ("outcomeExecutionId") REFERENCES "WorkflowOutcomeExecution"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkflowGeneratedTask"
ADD CONSTRAINT "WorkflowGeneratedTask_assignedUserId_fkey"
FOREIGN KEY ("assignedUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkflowGeneratedTask"
ADD CONSTRAINT "WorkflowGeneratedTask_completedById_fkey"
FOREIGN KEY ("completedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
