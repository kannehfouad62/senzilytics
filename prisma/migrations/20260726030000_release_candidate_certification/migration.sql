CREATE TYPE "PlatformReleaseStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'PILOT_ACTIVE', 'RELEASED', 'REJECTED', 'ROLLED_BACK');
CREATE TYPE "PlatformReleaseCheckStatus" AS ENUM ('NOT_RUN', 'PASS', 'FAIL', 'NOT_APPLICABLE');
CREATE TYPE "PlatformReleaseCheckKey" AS ENUM ('CODE_QUALITY', 'DATABASE_MIGRATION', 'SECURITY_ACCESS', 'TENANT_ISOLATION', 'AUTHENTICATION_RECOVERY', 'CRITICAL_WORKFLOWS', 'MOBILE_COMPATIBILITY', 'OPERATIONS_RECOVERY');
CREATE TYPE "PlatformReleasePilotStatus" AS ENUM ('PLANNED', 'ACTIVE', 'PASSED', 'FAILED', 'ROLLED_BACK');

CREATE TABLE "PlatformRelease" (
  "id" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "commitSha" TEXT NOT NULL,
  "deploymentUrl" TEXT NOT NULL,
  "status" "PlatformReleaseStatus" NOT NULL DEFAULT 'DRAFT',
  "releaseNotes" TEXT,
  "riskSummary" TEXT,
  "rollbackPlan" TEXT,
  "targetCertificationAt" TIMESTAMP(3),
  "submissionNotes" TEXT,
  "reviewNotes" TEXT,
  "createdById" TEXT NOT NULL,
  "submittedById" TEXT,
  "submittedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "pilotStartedAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  "rolledBackAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformRelease_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformReleaseCheck" (
  "id" TEXT NOT NULL,
  "releaseId" TEXT NOT NULL,
  "key" "PlatformReleaseCheckKey" NOT NULL,
  "status" "PlatformReleaseCheckStatus" NOT NULL DEFAULT 'NOT_RUN',
  "testMethod" TEXT,
  "evidenceSummary" TEXT,
  "resultNotes" TEXT,
  "evidenceUrl" TEXT,
  "testedAt" TIMESTAMP(3),
  "testedById" TEXT,
  "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformReleaseCheck_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformReleasePilot" (
  "id" TEXT NOT NULL,
  "releaseId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "status" "PlatformReleasePilotStatus" NOT NULL DEFAULT 'PLANNED',
  "plannedStartAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "exitCriteria" TEXT NOT NULL,
  "resultSummary" TEXT,
  "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformReleasePilot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformRelease_version_key" ON "PlatformRelease"("version");
CREATE UNIQUE INDEX "PlatformRelease_commitSha_key" ON "PlatformRelease"("commitSha");
CREATE INDEX "PlatformRelease_status_targetCertificationAt_idx" ON "PlatformRelease"("status", "targetCertificationAt");
CREATE INDEX "PlatformRelease_createdAt_idx" ON "PlatformRelease"("createdAt");
CREATE UNIQUE INDEX "PlatformReleaseCheck_releaseId_key_key" ON "PlatformReleaseCheck"("releaseId", "key");
CREATE INDEX "PlatformReleaseCheck_status_testedAt_idx" ON "PlatformReleaseCheck"("status", "testedAt");
CREATE UNIQUE INDEX "PlatformReleasePilot_releaseId_organizationId_key" ON "PlatformReleasePilot"("releaseId", "organizationId");
CREATE INDEX "PlatformReleasePilot_organizationId_status_idx" ON "PlatformReleasePilot"("organizationId", "status");
CREATE INDEX "PlatformReleasePilot_status_plannedStartAt_idx" ON "PlatformReleasePilot"("status", "plannedStartAt");

ALTER TABLE "PlatformRelease" ADD CONSTRAINT "PlatformRelease_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlatformRelease" ADD CONSTRAINT "PlatformRelease_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlatformRelease" ADD CONSTRAINT "PlatformRelease_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlatformReleaseCheck" ADD CONSTRAINT "PlatformReleaseCheck_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "PlatformRelease"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformReleaseCheck" ADD CONSTRAINT "PlatformReleaseCheck_testedById_fkey" FOREIGN KEY ("testedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlatformReleaseCheck" ADD CONSTRAINT "PlatformReleaseCheck_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlatformReleasePilot" ADD CONSTRAINT "PlatformReleasePilot_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "PlatformRelease"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformReleasePilot" ADD CONSTRAINT "PlatformReleasePilot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlatformReleasePilot" ADD CONSTRAINT "PlatformReleasePilot_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
