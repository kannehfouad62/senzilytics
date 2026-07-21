CREATE TYPE "CompetencyCategory" AS ENUM ('SAFETY', 'TECHNICAL', 'ENVIRONMENTAL', 'COMPLIANCE', 'EMERGENCY_RESPONSE', 'LEADERSHIP', 'QUALITY', 'OTHER');
CREATE TYPE "CompetencyProficiency" AS ENUM ('AWARENESS', 'WORKING', 'PRACTITIONER', 'ADVANCED', 'EXPERT');
CREATE TYPE "CompetencyAssessmentStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'EXPIRED');
CREATE TYPE "CompetencyEvidenceType" AS ENUM ('TRAINING', 'PRACTICAL_ASSESSMENT', 'EXPERIENCE', 'LICENSE', 'CERTIFICATION', 'SUPERVISOR_OBSERVATION', 'OTHER');

CREATE TABLE "CompetencyDefinition" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" "CompetencyCategory" NOT NULL,
  "validityMonths" INTEGER,
  "isCritical" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompetencyDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompetencyCourseLink" (
  "id" TEXT NOT NULL,
  "competencyId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "achievedLevel" "CompetencyProficiency" NOT NULL,
  "minimumScore" DOUBLE PRECISION,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompetencyCourseLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompetencyRequirement" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "competencyId" TEXT NOT NULL,
  "role" "UserRole",
  "jobTitle" TEXT,
  "siteId" TEXT,
  "departmentId" TEXT,
  "requiredLevel" "CompetencyProficiency" NOT NULL,
  "dueWithinDays" INTEGER NOT NULL DEFAULT 30,
  "isMandatory" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompetencyRequirement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompetencyAssessment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "competencyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "assessorId" TEXT NOT NULL,
  "status" "CompetencyAssessmentStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
  "assessedLevel" "CompetencyProficiency" NOT NULL,
  "assessedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "evidenceType" "CompetencyEvidenceType" NOT NULL,
  "evidenceReference" TEXT,
  "notes" TEXT,
  "sourceTrainingRecordId" TEXT,
  "verifiedById" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "reminderSentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompetencyAssessment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompetencyDefinition_organizationId_code_key" ON "CompetencyDefinition"("organizationId", "code");
CREATE UNIQUE INDEX "CompetencyDefinition_organizationId_name_key" ON "CompetencyDefinition"("organizationId", "name");
CREATE INDEX "CompetencyDefinition_organizationId_category_isActive_idx" ON "CompetencyDefinition"("organizationId", "category", "isActive");
CREATE UNIQUE INDEX "CompetencyCourseLink_competencyId_courseId_key" ON "CompetencyCourseLink"("competencyId", "courseId");
CREATE INDEX "CompetencyCourseLink_courseId_idx" ON "CompetencyCourseLink"("courseId");
CREATE INDEX "CompetencyRequirement_organizationId_isActive_idx" ON "CompetencyRequirement"("organizationId", "isActive");
CREATE INDEX "CompetencyRequirement_competencyId_requiredLevel_idx" ON "CompetencyRequirement"("competencyId", "requiredLevel");
CREATE INDEX "CompetencyRequirement_role_siteId_departmentId_idx" ON "CompetencyRequirement"("role", "siteId", "departmentId");
CREATE UNIQUE INDEX "CompetencyAssessment_sourceTrainingRecordId_competencyId_key" ON "CompetencyAssessment"("sourceTrainingRecordId", "competencyId");
CREATE INDEX "CompetencyAssessment_organizationId_status_expiresAt_idx" ON "CompetencyAssessment"("organizationId", "status", "expiresAt");
CREATE INDEX "CompetencyAssessment_userId_competencyId_status_idx" ON "CompetencyAssessment"("userId", "competencyId", "status");
CREATE INDEX "CompetencyAssessment_competencyId_assessedLevel_idx" ON "CompetencyAssessment"("competencyId", "assessedLevel");

ALTER TABLE "CompetencyDefinition" ADD CONSTRAINT "CompetencyDefinition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetencyDefinition" ADD CONSTRAINT "CompetencyDefinition_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompetencyCourseLink" ADD CONSTRAINT "CompetencyCourseLink_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "CompetencyDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetencyCourseLink" ADD CONSTRAINT "CompetencyCourseLink_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "TrainingCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetencyRequirement" ADD CONSTRAINT "CompetencyRequirement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetencyRequirement" ADD CONSTRAINT "CompetencyRequirement_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "CompetencyDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetencyRequirement" ADD CONSTRAINT "CompetencyRequirement_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetencyRequirement" ADD CONSTRAINT "CompetencyRequirement_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetencyAssessment" ADD CONSTRAINT "CompetencyAssessment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetencyAssessment" ADD CONSTRAINT "CompetencyAssessment_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "CompetencyDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetencyAssessment" ADD CONSTRAINT "CompetencyAssessment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetencyAssessment" ADD CONSTRAINT "CompetencyAssessment_assessorId_fkey" FOREIGN KEY ("assessorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompetencyAssessment" ADD CONSTRAINT "CompetencyAssessment_sourceTrainingRecordId_fkey" FOREIGN KEY ("sourceTrainingRecordId") REFERENCES "TrainingRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompetencyAssessment" ADD CONSTRAINT "CompetencyAssessment_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
