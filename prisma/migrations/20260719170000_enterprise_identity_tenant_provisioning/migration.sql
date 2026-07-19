CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "IdentityProviderType" AS ENUM ('MICROSOFT_ENTRA', 'OKTA');
CREATE TYPE "TenantInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

ALTER TABLE "Organization" ADD COLUMN "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE', ADD COLUMN "allowedEmailDomains" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true, ADD COLUMN "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "invitedAt" TIMESTAMP(3), ADD COLUMN "activatedAt" TIMESTAMP(3), ADD COLUMN "lastLoginAt" TIMESTAMP(3);

CREATE TABLE "OrganizationIdentityProvider" ("id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "type" "IdentityProviderType" NOT NULL, "issuer" TEXT NOT NULL, "directoryId" TEXT, "emailDomain" TEXT, "isEnabled" BOOLEAN NOT NULL DEFAULT true, "enforceSso" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "OrganizationIdentityProvider_pkey" PRIMARY KEY ("id"));
CREATE TABLE "TenantInvitation" ("id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "email" TEXT NOT NULL, "name" TEXT NOT NULL, "role" "UserRole" NOT NULL, "departmentId" TEXT, "tokenHash" TEXT NOT NULL, "status" "TenantInvitationStatus" NOT NULL DEFAULT 'PENDING', "expiresAt" TIMESTAMP(3) NOT NULL, "invitedById" TEXT NOT NULL, "acceptedById" TEXT, "acceptedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "TenantInvitation_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "OrganizationIdentityProvider_type_issuer_key" ON "OrganizationIdentityProvider"("type", "issuer");
CREATE INDEX "OrganizationIdentityProvider_organizationId_type_isEnabled_idx" ON "OrganizationIdentityProvider"("organizationId", "type", "isEnabled");
CREATE UNIQUE INDEX "TenantInvitation_tokenHash_key" ON "TenantInvitation"("tokenHash");
CREATE INDEX "TenantInvitation_organizationId_status_expiresAt_idx" ON "TenantInvitation"("organizationId", "status", "expiresAt");
CREATE INDEX "TenantInvitation_email_status_idx" ON "TenantInvitation"("email", "status");
ALTER TABLE "OrganizationIdentityProvider" ADD CONSTRAINT "OrganizationIdentityProvider_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantInvitation" ADD CONSTRAINT "TenantInvitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantInvitation" ADD CONSTRAINT "TenantInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TenantInvitation" ADD CONSTRAINT "TenantInvitation_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
