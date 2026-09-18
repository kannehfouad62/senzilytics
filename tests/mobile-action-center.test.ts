import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  PermissionKey,
  Status,
  WorkflowEntityType,
} from "@prisma/client";
import {
  mobileCapaCapabilities,
  mobileCapaSource,
  mobileWorkflowEntityHref,
} from "../src/modules/mobile/mobile-action-center.service";

test("native CAPA capabilities preserve update and formal-close separation", () => {
  const updateOnly = mobileCapaCapabilities([PermissionKey.UPDATE_CAPA]);
  assert.equal(updateOnly.canView, true);
  assert.equal(updateOnly.canUpdate, true);
  assert.equal(updateOnly.canClose, false);
  assert.equal(updateOnly.allowedStatuses.includes(Status.IN_PROGRESS), true);
  assert.equal(updateOnly.allowedStatuses.includes(Status.COMPLETED), false);
  assert.equal(updateOnly.allowedStatuses.includes(Status.CLOSED), false);

  const closer = mobileCapaCapabilities([
    PermissionKey.UPDATE_CAPA,
    PermissionKey.CLOSE_CAPA,
  ]);
  assert.equal(closer.allowedStatuses.includes(Status.COMPLETED), true);
  assert.equal(closer.allowedStatuses.includes(Status.CLOSED), true);

  const reportingOnly = mobileCapaCapabilities([PermissionKey.VIEW_REPORTS]);
  assert.equal(reportingOnly.canView, true);
  assert.deepEqual(reportingOnly.allowedStatuses, []);
});

test("workflow inbox routes mobile users only to local tenant application paths", () => {
  assert.equal(
    mobileWorkflowEntityHref(WorkflowEntityType.INCIDENT, "incident-1"),
    "/incidents/incident-1"
  );
  assert.equal(
    mobileWorkflowEntityHref(WorkflowEntityType.CORRECTIVE_ACTION, "action-1"),
    "/actions/action-1"
  );
  assert.equal(
    mobileWorkflowEntityHref(WorkflowEntityType.TRAINING, "record-1"),
    "/training"
  );
});

const mobileSource = (path: string) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("native routing certifies assurance and environmental continuity", async () => {
  const routing = await mobileSource("apps/mobile/src/native-routing.ts");
  assert.match(routing, /case "behavior-safety"/);
  assert.match(routing, /ENVIRONMENTAL: `\/environmental\/\$\{entityId\}`/);
  assert.doesNotMatch(routing, /WebView|react-native-webview/);
});

test("mobile workflow decisions admit only explicit human approve or reject", async () => {
  const route = await mobileSource("src/app/api/mobile/workflow-decisions/route.ts");
  assert.match(
    route,
    /z\.enum\(\[WorkflowDecision\.APPROVE, WorkflowDecision\.REJECT\]\)/
  );
  assert.match(route, /authenticateMobileRequest\(request\)/);
  assert.match(route, /organizationId: organization\.id/);
  assert.match(route, /status: "IN_PROGRESS"/);
  assert.match(route, /decideWorkflowStep/);
});

test("native action continuity never imports a webview", async () => {
  const routing = await mobileSource("apps/mobile/src/native-routing.ts");
  assert.doesNotMatch(routing, /react-native-webview|<WebView/);
});

test("corrective-action source traceability prioritizes governed source records", () => {
  const source = mobileCapaSource({
    incident: { id: "incident-1", title: "Forklift near miss" },
    auditFinding: null,
    inspectionFinding: null,
    enterpriseAuditFindingLinks: [],
    criticalControlVerifications: [],
    certificationReviewActions: [],
    assetDefects: [],
    behaviorSessions: [],
    regulatoryChangeLinks: [],
  });
  assert.deepEqual(source, {
    type: "Incident",
    label: "Forklift near miss",
    href: "/incidents/incident-1",
  });
});


test("phase 4 exact-record routing preserves native hygiene ESG regulatory and executive identities", async () => {
  const routing = await mobileSource("apps/mobile/src/native-routing.ts");
  assert.match(routing, /case "industrial-hygiene"/);
  assert.match(routing, /tab: "hygieneHealth", view: "hygiene"/);
  assert.match(routing, /case "occupational-health"/);
  assert.match(routing, /tab: "hygieneHealth", view: "health"/);
  assert.match(routing, /case "esg"/);
  assert.match(routing, /tab: "esg"/);
  assert.match(routing, /case "regulatory"/);
  assert.match(routing, /tab: "regulatory"/);
  assert.match(routing, /case "intelligence"/);
  assert.match(routing, /tab: "executive", view: "ai"/);
});

test("phase 4 exact-record native screens accept routed record identity without web fallback", async () => {
  for (const path of [
    "apps/mobile/src/hygiene-health.tsx",
    "apps/mobile/src/esg.tsx",
    "apps/mobile/src/regulatory-intelligence.tsx",
    "apps/mobile/src/executive-command.tsx",
  ]) {
    const source = await mobileSource(path);
    assert.match(source, /initialRecordId/);
    assert.doesNotMatch(source, /react-native-webview|<WebView/);
  }
});


test("phase 4 priority native record details expose operational lifecycle context", async () => {
  const risk = await mobileSource("apps/mobile/src/risk-field.tsx");
  assert.match(risk, /Current:.*currentLikelihood/s);
  assert.match(risk, /Residual:.*residualLikelihood/s);
  assert.match(risk, /Last reviewed/);
  assert.match(risk, /control\.dueDate/);
  assert.match(risk, /jsa\.effectiveDate/);
  assert.match(risk, /jsa\.reviewDueDate/);

  const hygiene = await mobileSource("apps/mobile/src/hygiene-health.tsx");
  for (const label of ["Scheduled", "Due", "Started", "Completed", "Observations", "Conclusions", "Recommendations"]) {
    assert.match(hygiene, new RegExp(`label="${label}"`));
  }
  assert.match(hygiene, /label="Responsible"/);

  const esg = await mobileSource("apps/mobile/src/esg.tsx");
  assert.match(esg, /period\.approvedAt/);
  assert.match(esg, /period\.publishedAt/);
  assert.match(esg, /period\.missingMetricIds\.length/);
  assert.match(esg, /period\.missingFormDefinitionIds\.length/);

  const regulatory = await mobileSource("apps/mobile/src/regulatory-intelligence.tsx");
  assert.match(regulatory, /source\.lastReviewedAt/);
  assert.match(regulatory, /source\.changeCount/);
  assert.match(regulatory, /change\.detectedAt/);
  assert.match(regulatory, /change\.implementationSummary/);
  assert.match(regulatory, /change\.closeRationale/);
});
