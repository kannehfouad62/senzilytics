import assert from "node:assert/strict";
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
