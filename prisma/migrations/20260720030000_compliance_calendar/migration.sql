CREATE TYPE "ComplianceCalendarTaskStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE "ComplianceCalendarOccurrenceStatus" AS ENUM ('UPCOMING', 'DUE', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED', 'REJECTED', 'OVERDUE', 'CANCELLED');
ALTER TYPE "ComplianceRecurrence" ADD VALUE IF NOT EXISTS 'DAILY';
ALTER TYPE "ComplianceRecurrence" ADD VALUE IF NOT EXISTS 'WEEKLY';

CREATE TABLE "ComplianceCalendarTask" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "siteId" TEXT NOT NULL, "departmentId" TEXT, "ownerId" TEXT NOT NULL, "escalationOwnerId" TEXT,
  "title" TEXT NOT NULL, "description" TEXT, "instructions" TEXT, "category" TEXT NOT NULL, "regulatoryReference" TEXT, "evidenceRequired" BOOLEAN NOT NULL DEFAULT false,
  "approvalRequired" BOOLEAN NOT NULL DEFAULT false, "recurrence" "ComplianceRecurrence" NOT NULL, "intervalValue" INTEGER NOT NULL DEFAULT 1, "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3), "dueTime" TEXT, "reminderDaysBefore" INTEGER NOT NULL DEFAULT 7, "escalationDaysAfter" INTEGER NOT NULL DEFAULT 1,
  "status" "ComplianceCalendarTaskStatus" NOT NULL DEFAULT 'ACTIVE', "nextOccurrenceAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "ComplianceCalendarTask_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ComplianceCalendarOccurrence" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "taskId" TEXT NOT NULL, "siteId" TEXT NOT NULL, "departmentId" TEXT, "assignedToId" TEXT NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL, "status" "ComplianceCalendarOccurrenceStatus" NOT NULL DEFAULT 'UPCOMING', "completionNotes" TEXT, "evidenceUrl" TEXT,
  "completedAt" TIMESTAMP(3), "completedById" TEXT, "reviewedAt" TIMESTAMP(3), "reviewedById" TEXT, "reviewNotes" TEXT, "reminderSentAt" TIMESTAMP(3),
  "escalatedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComplianceCalendarOccurrence_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ComplianceCalendarOccurrence_taskId_dueAt_key" ON "ComplianceCalendarOccurrence"("taskId", "dueAt");
CREATE INDEX "ComplianceCalendarTask_organizationId_status_nextOccurrenceAt_idx" ON "ComplianceCalendarTask"("organizationId", "status", "nextOccurrenceAt");
CREATE INDEX "ComplianceCalendarTask_siteId_departmentId_idx" ON "ComplianceCalendarTask"("siteId", "departmentId");
CREATE INDEX "ComplianceCalendarTask_ownerId_status_idx" ON "ComplianceCalendarTask"("ownerId", "status");
CREATE INDEX "ComplianceCalendarOccurrence_organizationId_status_dueAt_idx" ON "ComplianceCalendarOccurrence"("organizationId", "status", "dueAt");
CREATE INDEX "ComplianceCalendarOccurrence_assignedToId_status_dueAt_idx" ON "ComplianceCalendarOccurrence"("assignedToId", "status", "dueAt");
CREATE INDEX "ComplianceCalendarOccurrence_siteId_departmentId_dueAt_idx" ON "ComplianceCalendarOccurrence"("siteId", "departmentId", "dueAt");
ALTER TABLE "ComplianceCalendarTask" ADD CONSTRAINT "ComplianceCalendarTask_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ComplianceCalendarTask" ADD CONSTRAINT "ComplianceCalendarTask_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ComplianceCalendarTask" ADD CONSTRAINT "ComplianceCalendarTask_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ComplianceCalendarTask" ADD CONSTRAINT "ComplianceCalendarTask_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceCalendarTask" ADD CONSTRAINT "ComplianceCalendarTask_escalationOwnerId_fkey" FOREIGN KEY ("escalationOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ComplianceCalendarOccurrence" ADD CONSTRAINT "ComplianceCalendarOccurrence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ComplianceCalendarOccurrence" ADD CONSTRAINT "ComplianceCalendarOccurrence_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ComplianceCalendarTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ComplianceCalendarOccurrence" ADD CONSTRAINT "ComplianceCalendarOccurrence_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ComplianceCalendarOccurrence" ADD CONSTRAINT "ComplianceCalendarOccurrence_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ComplianceCalendarOccurrence" ADD CONSTRAINT "ComplianceCalendarOccurrence_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceCalendarOccurrence" ADD CONSTRAINT "ComplianceCalendarOccurrence_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ComplianceCalendarOccurrence" ADD CONSTRAINT "ComplianceCalendarOccurrence_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
