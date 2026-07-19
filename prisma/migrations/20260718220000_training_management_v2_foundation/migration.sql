CREATE TABLE "TrainingCourse" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "code" TEXT NOT NULL,
  "name" TEXT NOT NULL, "description" TEXT, "provider" TEXT, "validityMonths" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TrainingCourse_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TrainingRequirement" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "courseId" TEXT NOT NULL,
  "role" "UserRole", "siteId" TEXT, "departmentId" TEXT,
  "dueWithinDays" INTEGER NOT NULL DEFAULT 30, "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TrainingRequirement_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "TrainingRecord" ADD COLUMN "courseId" TEXT;
ALTER TABLE "TrainingRecord" ADD COLUMN "assignedById" TEXT;
ALTER TABLE "TrainingRecord" ADD COLUMN "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "TrainingRecord" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "TrainingRecord" ADD COLUMN "provider" TEXT;
ALTER TABLE "TrainingRecord" ADD COLUMN "certificateNumber" TEXT;
ALTER TABLE "TrainingRecord" ADD COLUMN "score" DOUBLE PRECISION;
ALTER TABLE "TrainingRecord" ADD COLUMN "notes" TEXT;
CREATE UNIQUE INDEX "TrainingCourse_organizationId_code_key" ON "TrainingCourse"("organizationId", "code");
CREATE INDEX "TrainingCourse_organizationId_isActive_idx" ON "TrainingCourse"("organizationId", "isActive");
CREATE INDEX "TrainingRequirement_organizationId_isActive_idx" ON "TrainingRequirement"("organizationId", "isActive");
CREATE INDEX "TrainingRequirement_courseId_idx" ON "TrainingRequirement"("courseId");
CREATE INDEX "TrainingRecord_courseId_status_idx" ON "TrainingRecord"("courseId", "status");
CREATE INDEX "TrainingRecord_userId_dueDate_idx" ON "TrainingRecord"("userId", "dueDate");
CREATE INDEX "TrainingRecord_expiresAt_idx" ON "TrainingRecord"("expiresAt");
ALTER TABLE "TrainingCourse" ADD CONSTRAINT "TrainingCourse_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingCourse" ADD CONSTRAINT "TrainingCourse_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TrainingRequirement" ADD CONSTRAINT "TrainingRequirement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingRequirement" ADD CONSTRAINT "TrainingRequirement_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "TrainingCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingRequirement" ADD CONSTRAINT "TrainingRequirement_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingRequirement" ADD CONSTRAINT "TrainingRequirement_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingRecord" ADD CONSTRAINT "TrainingRecord_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "TrainingCourse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TrainingRecord" ADD CONSTRAINT "TrainingRecord_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
