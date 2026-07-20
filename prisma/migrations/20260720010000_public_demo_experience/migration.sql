ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'DEMO_VIEWER';

ALTER TABLE "Organization"
ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "User"
ADD COLUMN "demoExpiresAt" TIMESTAMP(3);

CREATE TABLE "DemoLead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workEmail" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "jobTitle" TEXT,
    "consentedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "DemoLead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DemoLead_userId_key" ON "DemoLead"("userId");
CREATE INDEX "DemoLead_workEmail_createdAt_idx" ON "DemoLead"("workEmail", "createdAt");
CREATE INDEX "DemoLead_organizationId_expiresAt_idx" ON "DemoLead"("organizationId", "expiresAt");

ALTER TABLE "DemoLead"
ADD CONSTRAINT "DemoLead_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DemoLead"
ADD CONSTRAINT "DemoLead_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
