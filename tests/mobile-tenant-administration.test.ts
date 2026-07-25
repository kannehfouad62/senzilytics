import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PermissionKey, UserRole } from "@prisma/client";
import {
  mobileTenantAdministrationActionSchema,
  mobileTenantAdministrationCapabilities,
} from "../src/modules/mobile/mobile-tenant-administration.service";
import { getMobileModuleCatalog } from "../src/modules/mobile/mobile-module-catalog";

const tenantAdministrator = {
  email: "administrator@example.com",
  role: UserRole.ORG_ADMIN,
  isActive: true,
  isPlatformAdmin: false,
};

test("native tenant administration capabilities remain independently permission-gated", () => {
  assert.deepEqual(
    mobileTenantAdministrationCapabilities([
      PermissionKey.VIEW_USERS,
      PermissionKey.VIEW_ACTIVITY_LOG,
    ]),
    {
      canManageOrganization: false,
      canViewConfigurationHealth: false,
      canViewIntegrationHealth: false,
      canViewUsers: true,
      canManageUsers: false,
      canManageWorkflows: false,
      canViewActivity: true,
    }
  );
  assert.deepEqual(
    mobileTenantAdministrationCapabilities([
      PermissionKey.MANAGE_ORGANIZATION,
      PermissionKey.MANAGE_USERS,
      PermissionKey.MANAGE_WORKFLOWS,
    ]),
    {
      canManageOrganization: true,
      canViewConfigurationHealth: true,
      canViewIntegrationHealth: false,
      canViewUsers: true,
      canManageUsers: true,
      canManageWorkflows: true,
      canViewActivity: false,
    }
  );
});

test("authorized administration modules open tenant-scoped native workspaces", () => {
  const modules = getMobileModuleCatalog({
    permissions: [
      PermissionKey.MANAGE_ORGANIZATION,
      PermissionKey.VIEW_USERS,
      PermissionKey.MANAGE_WORKFLOWS,
      PermissionKey.VIEW_ACTIVITY_LOG,
      PermissionKey.MANAGE_INTEGRATIONS,
    ],
    user: tenantAdministrator,
  });

  assert.equal(
    modules.find((module) => module.key === "organization")?.nativeCapability,
    "ORGANIZATION_ADMIN"
  );
  assert.equal(
    modules.find((module) => module.key === "users")?.nativeCapability,
    "USER_ADMIN"
  );
  assert.equal(
    modules.find((module) => module.key === "workflows")?.nativeCapability,
    "WORKFLOW_ADMIN"
  );
  assert.equal(
    modules.find((module) => module.key === "activity")?.nativeCapability,
    "ACTIVITY_AUDIT"
  );
  assert.equal(
    modules.find((module) => module.key === "form-studio")?.nativeCapability,
    "CONFIGURATION_HEALTH"
  );
  assert.equal(
    modules.find((module) => module.key === "integrations")?.nativeCapability,
    "CONFIGURATION_HEALTH"
  );
});

test("tenant administration accepts bounded tenant roles and rejects platform roles", () => {
  assert.equal(
    mobileTenantAdministrationActionSchema.safeParse({
      action: "INVITE_USER",
      name: "Ada Auditor",
      email: "ada@example.com",
      role: "AUDITOR",
      departmentId: null,
    }).success,
    true
  );
  assert.equal(
    mobileTenantAdministrationActionSchema.safeParse({
      action: "INVITE_USER",
      name: "Platform Admin",
      email: "platform@example.com",
      role: "SUPER_ADMIN",
    }).success,
    false
  );
  assert.equal(
    mobileTenantAdministrationActionSchema.safeParse({
      action: "CREATE_SITE",
      name: "x".repeat(101),
    }).success,
    false
  );
});

test("mobile administration routes revalidate auth and derive tenant identity server-side", async () => {
  const [route, service] = await Promise.all([
    readFile(
      new URL(
        "../src/app/api/mobile/tenant-administration/route.ts",
        import.meta.url
      ),
      "utf8"
    ),
    readFile(
      new URL(
        "../src/modules/mobile/mobile-tenant-administration.service.ts",
        import.meta.url
      ),
      "utf8"
    ),
  ]);

  assert.match(route, /authenticateMobileRequest\(request\)/);
  assert.match(route, /organizationId: organization\.id/);
  assert.match(route, /currentSessionId: session\.id/);
  assert.match(route, /cache-control": "private, no-store"/);
  assert.match(service, /organizationId: input\.organizationId/);
  assert.match(service, /site: \{ organizationId: input\.organizationId \}/);
  assert.doesNotMatch(service, /tokenHash:\s*true/);
  assert.doesNotMatch(service, /issuer:\s*true/);
  assert.doesNotMatch(service, /directoryId:\s*true/);
});

test("native administration cache removes slices after permission loss", async () => {
  const app = await readFile(
    new URL("../apps/mobile/App.tsx", import.meta.url),
    "utf8"
  );

  assert.match(app, /preserveTenantAdministrationSnapshot/);
  assert.match(
    app,
    /capabilities\.canManageOrganization[\s\S]*previous\.tenantOrganization/
  );
  assert.match(
    app,
    /capabilities\.canManageUsers[\s\S]*previous\.tenantMobileSessions/
  );
  assert.match(
    app,
    /capabilities\.canViewActivity[\s\S]*previous\.tenantActivityLogs/
  );
});
