import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  PermissionKey,
  SubscriptionPlan,
  UserRole,
} from "@prisma/client";
import {
  mobileComplianceDocumentActionSchema,
  mobileComplianceDocumentCapabilities,
} from "../src/modules/mobile/mobile-compliance-documents.service";
import { getMobileModuleCatalog } from "../src/modules/mobile/mobile-module-catalog";

const tenantUser = {
  email: "compliance@example.com",
  role: UserRole.EHS_MANAGER,
  isActive: true,
  isPlatformAdmin: false,
};

test("native compliance and document capabilities preserve independent permission and plan gates", () => {
  assert.deepEqual(
    mobileComplianceDocumentCapabilities({
      permissions: [PermissionKey.VIEW_COMPLIANCE],
      subscriptionPlan: SubscriptionPlan.PREMIUM,
    }),
    {
      canViewCompliance: true,
      canManageCompliance: false,
      canManageDocuments: false,
      canUploadDocuments: false,
    }
  );

  assert.deepEqual(
    mobileComplianceDocumentCapabilities({
      permissions: [
        PermissionKey.VIEW_COMPLIANCE,
        PermissionKey.MANAGE_COMPLIANCE,
        PermissionKey.MANAGE_DOCUMENTS,
      ],
      subscriptionPlan: SubscriptionPlan.PREMIUM,
    }),
    {
      canViewCompliance: true,
      canManageCompliance: true,
      canManageDocuments: true,
      canUploadDocuments: true,
    }
  );

  assert.equal(
    mobileComplianceDocumentCapabilities({
      permissions: [PermissionKey.MANAGE_DOCUMENTS],
      subscriptionPlan: SubscriptionPlan.ESSENTIAL,
    }).canUploadDocuments,
    false
  );
});

test("authorized compliance and document modules open their native workspaces", () => {
  const modules = getMobileModuleCatalog({
    permissions: [
      PermissionKey.VIEW_COMPLIANCE,
      PermissionKey.MANAGE_DOCUMENTS,
    ],
    user: tenantUser,
  });

  assert.equal(
    modules.find((module) => module.key === "compliance")
      ?.nativeCapability,
    "COMPLIANCE_REGISTER"
  );
  assert.equal(
    modules.find((module) => module.key === "documents")
      ?.nativeCapability,
    "CONTROLLED_DOCUMENTS"
  );
});

test("mobile compliance and document actions accept only bounded governed contracts", () => {
  assert.equal(
    mobileComplianceDocumentActionSchema.safeParse({
      action: "EVALUATE_OBLIGATION",
      complianceItemId: "obligation-1",
      isCompliant: false,
      findings: "Permit condition evidence was not available.",
      evidenceSummary: "Reviewed the controlled permit register.",
    }).success,
    true
  );
  assert.equal(
    mobileComplianceDocumentActionSchema.safeParse({
      action: "ARCHIVE_DOCUMENT",
      documentId: "document-1",
    }).success,
    true
  );
  assert.equal(
    mobileComplianceDocumentActionSchema.safeParse({
      action: "EVALUATE_OBLIGATION",
      complianceItemId: "obligation-1",
      isCompliant: true,
      evidenceSummary: "x".repeat(5_001),
    }).success,
    false
  );
});

test("controlled document file access revalidates mobile auth, permission, and tenant ownership", async () => {
  const route = await readFile(
    new URL(
      "../src/app/api/mobile/documents/[id]/file/route.ts",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(route, /authenticateMobileRequest\(request\)/);
  assert.match(route, /PermissionKey\.MANAGE_DOCUMENTS/);
  assert.match(route, /organizationId: organization\.id/);
  assert.match(route, /status: \{ not: DocumentStatus\.DELETED \}/);
  assert.match(route, /Cache-Control": "private, no-store"/);
});

test("mobile document upload is private, plan-gated, and idempotent by storage path", async () => {
  const [route, client] = await Promise.all([
    readFile(
      new URL(
        "../src/app/api/mobile/documents/upload/route.ts",
        import.meta.url
      ),
      "utf8"
    ),
    readFile(
      new URL("../apps/mobile/src/blob-upload.ts", import.meta.url),
      "utf8"
    ),
  ]);

  assert.match(route, /PermissionKey\.MANAGE_DOCUMENTS/);
  assert.match(route, /"DOCUMENT_UPLOAD"/);
  assert.match(client, /"x-vercel-blob-access": "private"/);
  assert.match(route, /storageKey: blob\.pathname/);
  assert.match(route, /findFirst\(\{[\s\S]*storageKey: blob\.pathname/);
});

test("offline controlled documents remain encrypted, owner-scoped, and cleared after permission loss", async () => {
  const [storage, app] = await Promise.all([
    readFile(
      new URL("../apps/mobile/src/storage.ts", import.meta.url),
      "utf8"
    ),
    readFile(new URL("../apps/mobile/App.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(storage, /PRAGMA key/);
  assert.match(storage, /CREATE TABLE IF NOT EXISTS mobile_document_cache/);
  assert.match(
    storage,
    /DELETE FROM mobile_document_cache WHERE owner_key = \?/
  );
  assert.match(
    app,
    /!next\.complianceDocumentCapabilities\.canManageDocuments/
  );
  assert.match(app, /clearCachedControlledDocuments\(nextOwner\)/);
});
