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


test("phase 4 governed workflow decisions are server-derived from decision-capable step types", async () => {
  const service = await mobileSource("src/modules/mobile/mobile-action-center.service.ts");
  for (const stepType of ["REVIEW", "APPROVAL", "VERIFICATION", "CLOSE"]) {
    assert.match(service, new RegExp(`WorkflowStepType\\.${stepType}`));
  }
  assert.match(service, /canDecide:/);
  assert.doesNotMatch(service, /WorkflowStepType\.TASK\s*\|\|/);

  const actionCenter = await mobileSource("apps/mobile/src/action-center.tsx");
  assert.match(actionCenter, /task\.canDecide/);
  assert.match(actionCenter, /does not require an approve\/reject decision/);

  const route = await mobileSource("src/app/api/mobile/workflow-decisions/route.ts");
  assert.match(route, /decisionStepTypes/);
  assert.match(route, /WorkflowStepType\.APPROVAL/);
  assert.match(route, /invalid_step/);
  assert.match(route, /does not accept an approve or reject decision/);
});

test("phase 4 mobile workflow decision endpoint still excludes skip and revalidates active tenant record", async () => {
  const route = await mobileSource("src/app/api/mobile/workflow-decisions/route.ts");
  assert.match(route, /z\.enum\(\[WorkflowDecision\.APPROVE, WorkflowDecision\.REJECT\]\)/);
  assert.doesNotMatch(route, /WorkflowDecision\.SKIP/);
  assert.match(route, /organizationId: organization\.id/);
  assert.match(route, /status: "IN_PROGRESS"/);
  assert.match(route, /status: "ACTIVE"/);
});


test("phase 4 native action center provides bounded client-side search and operational filters", async () => {
  const source = await mobileSource("apps/mobile/src/action-center.tsx");
  assert.match(source, /Search tasks, workflows, or record types/);
  assert.match(source, /Decision required/);
  assert.match(source, /visibleTasks/);
  assert.match(source, /Search CAPA, source, assignee, risk, or status/);
  assert.match(source, /statusFilter/);
  assert.match(source, /Any status/);
  assert.match(source, /Search notification title, message, or type/);
  assert.match(source, /visibleNotifications/);
  assert.match(source, /scope === "unread"/);
});

test("phase 4 action center filtering never expands beyond authorized bootstrap collections", async () => {
  const source = await mobileSource("apps/mobile/src/action-center.tsx");
  assert.match(source, /workspace\.tasks\.filter/);
  assert.match(source, /actions\.filter/);
  assert.match(source, /workspace\.notifications\.filter/);
  assert.doesNotMatch(source, /fetch\(|axios|\/api\/.*search/);
});

test("phase 4 certification preserves exact-record native continuity across priority workspaces", async () => {
  const routing = await mobileSource("apps/mobile/src/native-routing.ts");
  const app = await mobileSource("apps/mobile/App.tsx");
  for (const route of ["industrial-hygiene", "occupational-health", "esg", "regulatory", "intelligence"]) {
    assert.match(routing, new RegExp(`case "${route}"`));
  }
  for (const screen of ["HygieneHealthScreen", "EsgScreen", "RegulatoryIntelligenceScreen", "ExecutiveCommandScreen"]) {
    assert.match(app, new RegExp(`<${screen}[^>]*initialRecordId=`, "s"));
  }
});

test("phase 4 certification preserves operational detail context in priority native records", async () => {
  const risk = await mobileSource("apps/mobile/src/risk-field.tsx");
  assert.match(risk, /risk\.currentLikelihood/);
  assert.match(risk, /risk\.residualLikelihood/);
  assert.match(risk, /risk\.lastReviewedAt/);
  assert.match(risk, /jsa\.reviewDueDate/);

  const hygiene = await mobileSource("apps/mobile/src/hygiene-health.tsx");
  assert.match(hygiene, /assessment\.observations/);
  assert.match(hygiene, /assessment\.conclusions/);
  assert.match(hygiene, /assessment\.recommendations/);
  assert.match(hygiene, /program\.responsibleUser\.name/);

  const esg = await mobileSource("apps/mobile/src/esg.tsx");
  assert.match(esg, /period\.approvedAt/);
  assert.match(esg, /period\.publishedAt/);

  const regulatory = await mobileSource("apps/mobile/src/regulatory-intelligence.tsx");
  assert.match(regulatory, /source\.lastReviewedAt/);
  assert.match(regulatory, /change\.implementationSummary/);
  assert.match(regulatory, /change\.closeRationale/);
});

test("phase 4 certification keeps consequential workflow decisions server-derived and fail-closed", async () => {
  const service = await mobileSource("src/modules/mobile/mobile-action-center.service.ts");
  const route = await mobileSource("src/app/api/mobile/workflow-decisions/route.ts");
  const ui = await mobileSource("apps/mobile/src/action-center.tsx");

  assert.match(service, /canDecide:/);
  for (const stepType of ["REVIEW", "APPROVAL", "VERIFICATION", "CLOSE"]) {
    assert.match(service, new RegExp(`WorkflowStepType\\.${stepType}`));
  }
  assert.match(ui, /task\.canDecide/);
  assert.match(route, /decisionStepTypes/);
  assert.match(route, /invalid_step/);
  assert.match(route, /z\.enum\(\[WorkflowDecision\.APPROVE, WorkflowDecision\.REJECT\]\)/);
  assert.doesNotMatch(route, /WorkflowDecision\.SKIP/);
});

test("phase 4 certification keeps action-center search inside authorized bootstrap collections", async () => {
  const ui = await mobileSource("apps/mobile/src/action-center.tsx");
  assert.match(ui, /workspace\.tasks\.filter/);
  assert.match(ui, /actions\.filter/);
  assert.match(ui, /workspace\.notifications\.filter/);
  assert.match(ui, /Decision required/);
  assert.match(ui, /statusFilter/);
  assert.match(ui, /scope === "unread"/);
  assert.doesNotMatch(ui, /fetch\(|axios|\/api\/.*search/);
});

test("phase 4 certification retains module-native governed action families", async () => {
  const expected = new Map([
    ["apps/mobile/src/risk-field.tsx", ["queueRiskReview", "queueJsaAcknowledgment"]],
    ["apps/mobile/src/moc-permits.tsx", ["queueMocApprovalDecision", "queuePermitGasTest", "queuePermitStatus"]],
    ["apps/mobile/src/assets-contractors.tsx", ["queueAssetInspection", "queueAssetDefect", "queueContractorStatus"]],
    ["apps/mobile/src/hygiene-health.tsx", ["queueHygieneSample", "queueSurveillanceCompletion", "queueSurveillanceProgramStatus"]],
    ["apps/mobile/src/chemical-environmental.tsx", ["queueChemicalEvidence", "queueEnvironmentalReview", "queueEnvironmentalEvidence"]],
    ["apps/mobile/src/esg.tsx", ["queueEsgDisclosureStatus", "queueEsgEvidence", "queueEsgInitiativeStatus"]],
    ["apps/mobile/src/behavior-assurance.tsx", ["queueSifVerification", "queueCertificationReviewComplete", "queueCertificationReviewApprove"]],
    ["apps/mobile/src/regulatory-intelligence.tsx", ["queueRegulatoryImpactAssessment", "queueRegulatoryImplementation", "queueRegulatoryChangeClose"]],
  ]);
  for (const [path, actions] of expected) {
    const source = await mobileSource(path);
    for (const action of actions) assert.match(source, new RegExp(`${action}\\(`));
  }
});

test("phase 4 certification keeps priority operational workspaces native without WebView fallback", async () => {
  for (const path of [
    "apps/mobile/src/action-center.tsx",
    "apps/mobile/src/risk-field.tsx",
    "apps/mobile/src/moc-permits.tsx",
    "apps/mobile/src/assets-contractors.tsx",
    "apps/mobile/src/hygiene-health.tsx",
    "apps/mobile/src/chemical-environmental.tsx",
    "apps/mobile/src/esg.tsx",
    "apps/mobile/src/behavior-assurance.tsx",
    "apps/mobile/src/regulatory-intelligence.tsx",
    "apps/mobile/src/executive-command.tsx",
  ]) {
    const source = await mobileSource(path);
    assert.doesNotMatch(source, /react-native-webview|<WebView/);
  }
});


test("phase 5 mobile register scalability uses one bounded server contract", async () => {
  const limits = await mobileSource("src/modules/mobile/mobile-register-limits.ts");
  for (const key of [
    "actionCenterTasks", "actionCenterCorrectiveActions", "riskRecords", "jsaRecords",
    "mocRecords", "permitRecords", "assetRecords", "contractorRecords",
    "hygieneAssessments", "surveillancePrograms", "chemicalRecords",
    "environmentalDefinitions", "environmentalTargets", "esgPeriods", "esgDefinitions",
    "esgTargets", "esgInitiatives", "behaviorPrograms", "regulatorySources", "regulatoryChanges",
  ]) {
    assert.match(limits, new RegExp(`${key}: \\d+`));
  }
  assert.match(limits, /hasMore: returned >= limit/);

  const bootstrap = await mobileSource("src/app/api/mobile/bootstrap/route.ts");
  assert.match(bootstrap, /mobileRegisterLimits: MOBILE_REGISTER_LIMITS/);

  const types = await mobileSource("apps/mobile/src/types.ts");
  assert.match(types, /mobileRegisterLimits: MobileRegisterLimits/);
});

test("phase 5 action center task window is sourced from the shared register limit", async () => {
  const service = await mobileSource("src/modules/mobile/mobile-action-center.service.ts");
  assert.match(service, /MOBILE_REGISTER_LIMITS\.actionCenterTasks/);
});


test("phase 5 priority operational registers use shared deterministic server windows", async () => {
  const expectations = new Map([
    ["src/modules/mobile/mobile-risk-field.service.ts", ["riskRecords", "jsaRecords"]],
    ["src/modules/mobile/mobile-moc-permit.service.ts", ["mocRecords", "permitRecords"]],
    ["src/modules/mobile/mobile-asset-contractor.service.ts", ["assetRecords", "contractorRecords"]],
    ["src/modules/mobile/mobile-hygiene-health.service.ts", ["hygieneAssessments", "surveillancePrograms"]],
  ]);
  for (const [path, keys] of expectations) {
    const source = await mobileSource(path);
    for (const key of keys) {
      assert.match(source, new RegExp(`MOBILE_REGISTER_LIMITS\\.${key}`));
      assert.match(source, new RegExp(`mobileRegisterWindow\\("${key}"`));
    }
  }
});

test("phase 5 bootstrap exposes priority register window metadata to the native client", async () => {
  const bootstrap = await mobileSource("src/app/api/mobile/bootstrap/route.ts");
  for (const property of [
    "riskRegisterWindows",
    "mocPermitRegisterWindows",
    "assetContractorRegisterWindows",
    "hygieneHealthRegisterWindows",
  ]) {
    assert.match(bootstrap, new RegExp(`${property}:`));
  }
  const types = await mobileSource("apps/mobile/src/types.ts");
  assert.match(types, /export type MobileRegisterWindow/);
  assert.match(types, /hasMore: boolean/);
});


test("phase 5 governance and assurance registers use shared server windows", async () => {
  const expected = new Map([
    ["src/modules/mobile/mobile-chemical-environmental.service.ts", ["chemicalRecords", "environmentalDefinitions", "environmentalTargets"]],
    ["src/modules/mobile/mobile-esg.service.ts", ["esgPeriods", "esgDefinitions", "esgTargets", "esgInitiatives"]],
    ["src/modules/mobile/mobile-behavior-assurance.service.ts", ["behaviorPrograms"]],
    ["src/modules/mobile/mobile-regulatory-intelligence.service.ts", ["regulatorySources", "regulatoryChanges"]],
  ]);
  for (const [path, keys] of expected) {
    const source = await mobileSource(path);
    for (const key of keys) {
      assert.match(source, new RegExp(`MOBILE_REGISTER_LIMITS\\.${key}`));
      assert.match(source, new RegExp(`mobileRegisterWindow\\("${key}"`));
    }
  }
});

test("phase 5 bootstrap exposes governance register windows without widening authorization", async () => {
  const bootstrap = await mobileSource("src/app/api/mobile/bootstrap/route.ts");
  for (const property of ["chemicalEnvironmentalRegisterWindows", "esgRegisterWindows", "behaviorAssuranceRegisterWindows", "regulatoryRegisterWindows"]) {
    assert.match(bootstrap, new RegExp(`${property}:`));
  }
  const regulatory = await mobileSource("src/modules/mobile/mobile-regulatory-intelligence.service.ts");
  assert.match(regulatory, /if \(!capabilities\.canView\)/);
  assert.match(regulatory, /sources: \[\]/);
  assert.match(regulatory, /changes: \[\]/);
});


test("phase 5 continuation cursors are register-bound opaque and bounded", async () => {
  const cursor = await mobileSource("src/modules/mobile/mobile-register-cursor.ts");
  assert.match(cursor, /toString\("base64url"\)/);
  assert.match(cursor, /raw\.length > 512/);
  assert.match(cursor, /parsed\.register !== register/);
  assert.match(cursor, /records\.slice\(0, limit\)/);
  assert.match(cursor, /records\.length > limit/);
});

test("phase 5 priority continuation endpoint reauthenticates and admits only named registers", async () => {
  const route = await mobileSource("src/app/api/mobile/registers/[register]/route.ts");
  assert.match(route, /authenticateMobileRequest\(request\)/);
  assert.match(route, /getMobileAssignedPermissions\(user\.role\)/);
  assert.match(route, /REGISTER_KEYS/);
  assert.match(route, /invalid_cursor/);
  assert.match(route, /organizationId: organization\.id/);
  assert.doesNotMatch(route, /organizationId.*searchParams|organizationId.*params/);
});

test("phase 5 priority register continuation uses unique record cursors and bounded lookahead", async () => {
  const expected = new Map([
    ["src/modules/mobile/mobile-risk-field.service.ts", ["riskCursor", "jsaCursor"]],
    ["src/modules/mobile/mobile-moc-permit.service.ts", ["mocCursor", "permitCursor"]],
    ["src/modules/mobile/mobile-asset-contractor.service.ts", ["assetCursor", "contractorCursor"]],
    ["src/modules/mobile/mobile-hygiene-health.service.ts", ["assessmentCursor", "programCursor"]],
  ]);
  for (const [path, cursors] of expected) {
    const source = await mobileSource(path);
    for (const cursor of cursors) {
      assert.match(source, new RegExp(`input\\.${cursor}`));
      assert.match(source, new RegExp(`cursor: \\{ id: input\\.${cursor} \\}`));
    }
  }
});
