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
      PermissionKey.VIEW_RISKS,
      PermissionKey.VIEW_MOC,
      PermissionKey.MANAGE_MOC,
      PermissionKey.VIEW_PERMITS_TO_WORK,
      PermissionKey.MANAGE_PERMITS_TO_WORK,
      PermissionKey.VIEW_ASSETS,
      PermissionKey.MANAGE_ASSETS,
      PermissionKey.VIEW_CONTRACTORS,
      PermissionKey.MANAGE_CONTRACTORS,
      PermissionKey.UPDATE_CAPA,
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
  assert.equal(modules.find((module) => module.key === "corrective-actions")?.nativeCapability, "CAPA_EXECUTION");
  assert.equal(modules.find((module) => module.key === "tasks")?.nativeCapability, "ACTION_CENTER");
  assert.equal(modules.find((module) => module.key === "risks")?.nativeCapability, "RISK_FIELD");
  assert.equal(modules.find((module) => module.key === "jsa")?.nativeCapability, "JSA_FIELD");
  assert.equal(modules.find((module) => module.key === "moc")?.nativeCapability, "MOC_EXECUTION");
  assert.equal(modules.find((module) => module.key === "permits")?.nativeCapability, "PERMIT_TO_WORK_EXECUTION");
  assert.equal(modules.find((module) => module.key === "assets")?.nativeCapability, "ASSET_FIELD");
  assert.equal(modules.find((module) => module.key === "contractors")?.nativeCapability, "CONTRACTOR_FIELD");

  const governance = getMobileModuleCatalog({
    permissions: [
      PermissionKey.VIEW_COMPLIANCE,
      PermissionKey.VIEW_TRAINING,
    ],
    user: {
      email: "employee@example.com",
      role: UserRole.EMPLOYEE,
      isActive: true,
      isPlatformAdmin: false,
    },
  });
  assert.equal(
    governance.find((module) => module.key === "compliance-calendar")
      ?.nativeCapability,
    "COMPLIANCE_CALENDAR"
  );
  assert.equal(
    governance.find((module) => module.key === "training")?.nativeCapability,
    "TRAINING_ASSIGNMENTS"
  );

  const readOnly = getMobileModuleCatalog({
    permissions: [
      PermissionKey.VIEW_INCIDENT,
      PermissionKey.VIEW_INSPECTIONS,
      PermissionKey.VIEW_AUDITS,
      PermissionKey.VIEW_ASSETS,
      PermissionKey.VIEW_CONTRACTORS,
    ],
    user: {
      email: "viewer@example.com",
      role: UserRole.AUDITOR,
      isActive: true,
      isPlatformAdmin: false,
    },
  });
  assert.equal(readOnly.find((module) => module.key === "tasks")?.nativeCapability, "ACTION_CENTER");
  assert.equal(readOnly.find((module) => module.key === "incidents")?.nativeCapability, undefined);
  assert.equal(readOnly.find((module) => module.key === "inspections")?.nativeCapability, undefined);
  assert.equal(readOnly.find((module) => module.key === "audits")?.nativeCapability, undefined);
  assert.equal(readOnly.find((module) => module.key === "assets")?.nativeCapability, "ASSET_FIELD");
  assert.equal(readOnly.find((module) => module.key === "contractors")?.nativeCapability, "CONTRACTOR_FIELD");
});
