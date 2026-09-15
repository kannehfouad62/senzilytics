import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PermissionKey, UserRole } from "@prisma/client";
import { getMobileModuleCatalog } from "../src/modules/mobile/mobile-module-catalog";

const user = {
  email: "auditor@example.com",
  role: UserRole.AUDITOR,
  isActive: true,
  isPlatformAdmin: false,
};

test("mobile audit services requires both audit permission and tenant entitlement", () => {
  const disabled = getMobileModuleCatalog({
    permissions: [PermissionKey.VIEW_AUDITS],
    auditServicesEnabled: false,
    user,
  });
  const enabled = getMobileModuleCatalog({
    permissions: [PermissionKey.VIEW_AUDITS],
    auditServicesEnabled: true,
    user,
  });
  const unauthorized = getMobileModuleCatalog({
    permissions: [],
    auditServicesEnabled: true,
    user,
  });

  assert.equal(disabled.some((module) => module.key === "audit-services"), false);
  assert.equal(unauthorized.some((module) => module.key === "audit-services"), false);
  assert.equal(enabled.find((module) => module.key === "audit-services")?.nativeCapability, "AUDIT_SERVICE_DELIVERY");
});

test("native audit-service delivery is tenant scoped assigned and online-governed", async () => {
  const [service, bootstrap, mobile, types] = await Promise.all([
    readFile(new URL("../src/modules/mobile/mobile-audit-service.service.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/mobile/bootstrap/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../apps/mobile/src/audit-services.tsx", import.meta.url), "utf8"),
    readFile(new URL("../apps/mobile/src/types.ts", import.meta.url), "utf8"),
  ]);

  assert.match(service, /organizationId: input\.organizationId/);
  assert.match(service, /organizationHasAuditServices\(input\.organizationId\)/);
  assert.match(service, /teamMembers: \{ some: \{ userId: input\.userId \} \}/);
  assert.match(service, /PermissionKey\.VIEW_AUDITS/);
  assert.match(bootstrap, /auditServicesEnabled: auditServices\.auditServiceCapabilities\.enabled/);
  assert.match(mobile, /External clients continue to use expiring passcode-protected links—not tenant accounts/);
  assert.match(mobile, /onlineOnlyWrites/);
  assert.match(types, /AUDIT_SERVICE_DELIVERY/);
  assert.doesNotMatch(service, /billing|invoice|payment|price|revenue/i);
});
