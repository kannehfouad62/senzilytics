CREATE TABLE "IncidentParticipant" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "incidentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IncidentParticipant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IncidentParticipant_incidentId_userId_key" ON "IncidentParticipant"("incidentId", "userId");
CREATE INDEX "IncidentParticipant_organizationId_createdAt_idx" ON "IncidentParticipant"("organizationId", "createdAt");
CREATE INDEX "IncidentParticipant_userId_createdAt_idx" ON "IncidentParticipant"("userId", "createdAt");

ALTER TABLE "IncidentParticipant" ADD CONSTRAINT "IncidentParticipant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncidentParticipant" ADD CONSTRAINT "IncidentParticipant_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncidentParticipant" ADD CONSTRAINT "IncidentParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
