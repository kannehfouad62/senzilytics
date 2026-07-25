import assert from "node:assert/strict";
import test from "node:test";
import {
  parseWorkflowOutcomeDefinitionInput,
  readWorkflowOutcomeConfiguration,
  workflowOutcomeRequiresApproval,
} from "../src/core/workflow/workflow-outcome-config";
import {
  RiskImpact,
  RiskLevel,
  RiskLikelihood,
  UserRole,
  WorkflowOutcomeEvent,
  WorkflowOutcomeType,
} from "@prisma/client";

const base = {
  name: "Generate follow-up",
  event: WorkflowOutcomeEvent.STEP_APPROVED,
  outcomeType: WorkflowOutcomeType.CREATE_TASK,
  title: "Complete follow-up",
  description: "Review the approved record.",
  assignedUserId: "",
  assignedRole: UserRole.EHS_MANAGER,
  dueInDays: "7",
  riskLevel: RiskLevel.MEDIUM,
  riskCategory: "SAFETY",
  likelihood: RiskLikelihood.POSSIBLE,
  impact: RiskImpact.MODERATE,
  siteId: "",
  departmentId: "",
  targetStatus: "COMPLETED",
  notificationType: "SYSTEM",
  sendEmail: false,
  requiresApproval: false,
};

test("generated workflow tasks accept a tenant role without forced approval", () => {
  const parsed = parseWorkflowOutcomeDefinitionInput(base);

  assert.equal(parsed.outcomeType, WorkflowOutcomeType.CREATE_TASK);
  assert.equal(parsed.requiresApproval, false);
  assert.deepEqual(parsed.configuration, {
    type: "CREATE_TASK",
    title: "Complete follow-up",
    description: "Review the approved record.",
    assignedRole: UserRole.EHS_MANAGER,
    dueInDays: 7,
  });
});

test("consequential workflow outcomes always require human approval", () => {
  for (const outcomeType of [
    WorkflowOutcomeType.CREATE_CORRECTIVE_ACTION,
    WorkflowOutcomeType.CREATE_RISK_DRAFT,
    WorkflowOutcomeType.CREATE_COMPLIANCE_TASK,
    WorkflowOutcomeType.UPDATE_SOURCE_STATUS,
    WorkflowOutcomeType.EMIT_WEBHOOK,
  ]) {
    assert.equal(workflowOutcomeRequiresApproval(outcomeType), true);
  }

  const parsed = parseWorkflowOutcomeDefinitionInput({
    ...base,
    outcomeType: WorkflowOutcomeType.CREATE_CORRECTIVE_ACTION,
    assignedUserId: "tenant-user-1",
    assignedRole: "",
    dueInDays: "30",
  });
  assert.equal(parsed.requiresApproval, true);
});

test("workflow outcome validation rejects missing owners and unsafe values", () => {
  assert.throws(
    () =>
      parseWorkflowOutcomeDefinitionInput({
        ...base,
        assignedRole: "",
      }),
    /Assign the generated task/,
  );
  assert.throws(
    () =>
      parseWorkflowOutcomeDefinitionInput({
        ...base,
        dueInDays: "366",
      }),
    /between 0 and 365/,
  );
  assert.throws(
    () =>
      parseWorkflowOutcomeDefinitionInput({
        ...base,
        outcomeType: WorkflowOutcomeType.SEND_NOTIFICATION,
        assignedUserId: "invalid user id",
      }),
    /valid tenant user/,
  );
});

test("stored outcome configuration is parsed before execution", () => {
  const configuration = readWorkflowOutcomeConfiguration(
    WorkflowOutcomeType.CREATE_TASK,
    {
      type: "ignored",
      title: "Inspect generated task",
      assignedRole: UserRole.AUDITOR,
      dueInDays: 2,
    },
  );

  assert.equal(configuration.type, "CREATE_TASK");
  assert.equal(configuration.title, "Inspect generated task");
  assert.equal(configuration.dueInDays, 2);
});
