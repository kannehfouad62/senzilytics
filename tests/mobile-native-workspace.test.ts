import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) =>
  readFile(new URL(path, import.meta.url), "utf8");

test("native operational workspaces do not expose web fallbacks", async () => {
  const [app, api, actions, auditServices, executive] = await Promise.all([
    read("../apps/mobile/App.tsx"),
    read("../apps/mobile/src/api.ts"),
    read("../apps/mobile/src/action-center.tsx"),
    read("../apps/mobile/src/audit-services.tsx"),
    read("../apps/mobile/src/executive-command.tsx"),
  ]);

  for (const source of [app, actions, auditServices, executive]) {
    assert.doesNotMatch(source, /onOpenPath/);
    assert.doesNotMatch(source, /Open full workspace/);
    assert.doesNotMatch(source, /Open workspace/);
  }
  assert.doesNotMatch(api, /mobileWebUrl/);
  assert.match(app, /Every operational\s+module opens inside the native Senzilytics app/);
  assert.match(auditServices, /View native engagement details/);
});

test("mobile sign out reports progress, clears protected cache, and confirms completion", async () => {
  const app = await read("../apps/mobile/App.tsx");

  assert.match(app, /setSigningOut\(true\)/);
  assert.match(app, /Signing out securely…/);
  assert.match(app, /await logoutMobileSession\(\)/);
  assert.match(app, /remoteRevokeFailed/);
  assert.match(app, /await clearWorkspaceCache\(ownerKey\)/);
  assert.match(app, /You have signed out securely/);
  assert.match(app, /blockingOverlay/);
});

test("offline collection contracts cover governed field-data families end to end", async () => {
  const [envelope, storage, server] = await Promise.all([
    read("../apps/mobile/src/offline-envelope.ts"),
    read("../apps/mobile/src/storage.ts"),
    read("../src/modules/mobile/offline-sync.service.ts"),
  ]);
  const representativeTypes = [
    "SAFETY_OBSERVATION",
    "INCIDENT",
    "INSPECTION_RESPONSE",
    "AUDIT_START",
    "AUDIT_RESPONSE",
    "RESEARCH_FIELDWORK_RESPONSE",
    "COMPLIANCE_COMPLETION",
    "MOC_STATUS",
    "PERMIT_STATUS",
    "ASSET_INSPECTION",
    "IH_SAMPLE",
    "ENVIRONMENTAL_DATA",
    "ESG_DATA",
    "BEHAVIOR_SESSION",
    "SIF_VERIFICATION",
    "CERTIFICATION_REVIEW_COMPLETE",
    "REGULATORY_IMPACT_ASSESSMENT",
  ];

  for (const type of representativeTypes) {
    assert.match(envelope, new RegExp(`"${type}"`), `${type} missing from device envelope`);
    assert.match(storage, new RegExp(`"${type}"`), `${type} missing from encrypted queue`);
    assert.match(server, new RegExp(`"${type}"`), `${type} missing from server synchronization`);
  }
  assert.match(storage, /owner_key = \?/);
  assert.match(server, /requiredOfflinePermission/);
  assert.match(server, /already_synced/);
});
