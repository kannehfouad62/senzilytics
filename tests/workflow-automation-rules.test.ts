import assert from "node:assert/strict";
import test from "node:test";
import {
  configurableFormWorkflowEntityType,
  parseWorkflowTriggerConditions,
  sanitizeWorkflowAutomationContext,
  workflowConditionsMatch,
} from "../src/core/workflow/workflow-automation-rules";
import {
  ConfigurableFormModule,
  WorkflowEntityType,
} from "@prisma/client";

test("workflow trigger conditions are parsed and validated", () => {
  assert.deepEqual(
    parseWorkflowTriggerConditions({
      fields: ["riskLevel", "status", ""],
      operators: ["IN", "EQUALS", ""],
      values: ["HIGH, CRITICAL", "OPEN", ""],
    }),
    [
      {
        field: "riskLevel",
        operator: "IN",
        value: "HIGH, CRITICAL",
      },
      {
        field: "status",
        operator: "EQUALS",
        value: "OPEN",
      },
    ],
  );
  assert.throws(
    () =>
      parseWorkflowTriggerConditions({
        fields: ["invalid field"],
        operators: ["EQUALS"],
        values: ["value"],
      }),
    /Trigger fields/,
  );
  assert.throws(
    () =>
      parseWorkflowTriggerConditions({
        fields: Array(6).fill("status"),
        operators: Array(6).fill("EQUALS"),
        values: Array(6).fill("OPEN"),
      }),
    /at most five/,
  );
});

test("workflow conditions match strings, lists, existence, and numbers", () => {
  const context = {
    status: "OPEN",
    riskLevel: "CRITICAL",
    score: 85,
    siteId: "site-1",
  };
  assert.equal(
    workflowConditionsMatch(
      [
        { field: "status", operator: "EQUALS", value: "open" },
        {
          field: "riskLevel",
          operator: "IN",
          value: "high, critical",
        },
        {
          field: "score",
          operator: "GREATER_THAN_OR_EQUAL",
          value: "80",
        },
        { field: "siteId", operator: "EXISTS", value: null },
      ],
      context,
    ),
    true,
  );
  assert.equal(
    workflowConditionsMatch(
      [{ field: "status", operator: "EQUALS", value: "CLOSED" }],
      context,
    ),
    false,
  );
  assert.equal(workflowConditionsMatch({ malformed: true }, context), false);
});

test("workflow context sanitization keeps only bounded scalar data", () => {
  const sanitized = sanitizeWorkflowAutomationContext({
    status: "OPEN",
    score: 4,
    approved: false,
    optional: null,
    nested: { unsafe: true },
    "bad key": "ignored",
    long: "a".repeat(600),
  });
  assert.deepEqual(
    {
      ...sanitized,
      long: undefined,
    },
    {
      status: "OPEN",
      score: 4,
      approved: false,
      optional: null,
      long: undefined,
    },
  );
  assert.equal(String(sanitized.long).length, 500);
  assert.equal("nested" in sanitized, false);
});

test("Form Studio modules map only to compatible workflow entities", () => {
  assert.equal(
    configurableFormWorkflowEntityType(ConfigurableFormModule.OBSERVATION),
    WorkflowEntityType.OBSERVATION,
  );
  assert.equal(
    configurableFormWorkflowEntityType(ConfigurableFormModule.CAPA),
    WorkflowEntityType.CORRECTIVE_ACTION,
  );
  assert.equal(
    configurableFormWorkflowEntityType(
      ConfigurableFormModule.REGULATORY_INTELLIGENCE,
    ),
    null,
  );
});
