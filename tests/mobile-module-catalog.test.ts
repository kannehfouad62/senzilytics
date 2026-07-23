import assert from "node:assert/strict";
import test from "node:test";
import { PermissionKey, UserRole } from "@prisma/client";
import { getMobileModuleCatalog } from "../src/modules/mobile/mobile-module-catalog";

test("mobile module catalog exposes only role-authorized workspaces", () => {
  const modules = getMobileModuleCatalog({
    permissions: [
      PermissionKey.CREATE_OBSERVATION,
      PermissionKey.VIEW_OBSERVATIONS,
      PermissionKey.VIEW_TRAINING,
    ],
    user: {
      email: "worker@example.com",
      role: UserRole.EMPLOYEE,
      isActive: true,
      isPlatformAdmin: false,
    },
  });

  assert.deepEqual(
    modules.map((module) => module.key),
    ["tasks", "observations", "training"],
  );
  assert.equal(modules.some((module) => module.key === "users"), false);
  assert.equal(modules.some((module) => module.key === "tenant-provisioning"), false);
});

test("tenant provisioning remains restricted to approved Senzilytics platform administrators", () => {
  const permissions = Object.values(PermissionKey);
  const approved = getMobileModuleCatalog({
    permissions,
    user: {
      email: "admin@senzilytics.com",
      role: UserRole.SUPER_ADMIN,
      isActive: true,
      isPlatformAdmin: true,
    },
  });
  const unapproved = getMobileModuleCatalog({
    permissions,
    user: {
      email: "admin@tenant.example",
      role: UserRole.SUPER_ADMIN,
      isActive: true,
      isPlatformAdmin: true,
    },
  });

  assert.equal(approved.some((module) => module.key === "tenant-provisioning"), true);
  assert.equal(unapproved.some((module) => module.key === "tenant-provisioning"), false);
});

test("every mobile module uses a local application path", () => {
  const modules = getMobileModuleCatalog({
    permissions: Object.values(PermissionKey),
    user: {
      email: "admin@senzilytics.com",
      role: UserRole.SUPER_ADMIN,
      isActive: true,
      isPlatformAdmin: true,
    },
  });

  assert.ok(modules.length > 30);
  assert.equal(modules.every((module) => module.href.startsWith("/") && !module.href.startsWith("//") && !module.href.includes("..")), true);
});

test("native field capabilities require their write permissions", () => {
  const modules = getMobileModuleCatalog({
    permissions: [
      PermissionKey.VIEW_INCIDENT,
      PermissionKey.CREATE_INCIDENT,
      PermissionKey.VIEW_INSPECTIONS,
      PermissionKey.MANAGE_INSPECTIONS,
      PermissionKey.VIEW_AUDITS,
      PermissionKey.MANAGE_AUDITS,
    ],
    user: {
      email: "ehs@example.com",
      role: UserRole.EHS_MANAGER,
      isActive: true,
      isPlatformAdmin: false,
    },
  });

  assert.equal(modules.find((module) => module.key === "incidents")?.nativeCapability, "INCIDENT_CAPTURE");
  assert.equal(modules.find((module) => module.key === "inspections")?.nativeCapability, "INSPECTION_EXECUTION");
  assert.equal(modules.find((module) => module.key === "audits")?.nativeCapability, "AUDIT_EXECUTION");

  const readOnly = getMobileModuleCatalog({
    permissions: [PermissionKey.VIEW_INCIDENT, PermissionKey.VIEW_INSPECTIONS, PermissionKey.VIEW_AUDITS],
    user: {
      email: "viewer@example.com",
      role: UserRole.AUDITOR,
      isActive: true,
      isPlatformAdmin: false,
    },
  });
  assert.equal(readOnly.some((module) => module.nativeCapability), false);
});
