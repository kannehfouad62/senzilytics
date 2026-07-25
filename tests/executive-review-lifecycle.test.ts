import assert from "node:assert/strict";
import test from "node:test";
import {
  ExecutiveReviewAgendaStatus,
  ExecutiveReviewDecisionStatus,
  ExecutiveReviewDecisionType,
  ExecutiveReviewFrequency,
  ExecutiveReviewStatus,
} from "@prisma/client";
import {
  assertExecutiveReviewTransition,
  calculateExecutiveReviewReadiness,
  executiveReviewApprovalIssues,
  executiveReviewCompletionIssues,
  executiveReviewScheduleIssues,
  nextExecutiveReviewDate,
} from "../src/modules/executive-review/executive-review-lifecycle";

test("management reviews enforce their controlled lifecycle", () => {
  assert.doesNotThrow(() =>
    assertExecutiveReviewTransition(
      ExecutiveReviewStatus.DRAFT,
      ExecutiveReviewStatus.SCHEDULED,
    ),
  );
  assert.doesNotThrow(() =>
    assertExecutiveReviewTransition(
      ExecutiveReviewStatus.COMPLETED,
      ExecutiveReviewStatus.APPROVED,
    ),
  );
  assert.throws(
    () =>
      assertExecutiveReviewTransition(
        ExecutiveReviewStatus.DRAFT,
        ExecutiveReviewStatus.PUBLISHED,
      ),
    /cannot move/,
  );
  assert.throws(
    () =>
      assertExecutiveReviewTransition(
        ExecutiveReviewStatus.COMPLETED,
        ExecutiveReviewStatus.PUBLISHED,
      ),
    /cannot move/,
  );
});

test("review scheduling requires valid dates, agenda, and participants", () => {
  const scheduledAt = new Date("2026-08-20T14:00:00.000Z");
  assert.deepEqual(
    executiveReviewScheduleIssues({
      periodStart: new Date("2026-04-01T00:00:00.000Z"),
      periodEnd: new Date("2026-06-30T23:59:59.000Z"),
      scheduledAt,
      agendaCount: 8,
      attendeeCount: 3,
    }),
    [],
  );
  const issues = executiveReviewScheduleIssues({
    periodStart: new Date("2026-07-01T00:00:00.000Z"),
    periodEnd: new Date("2026-09-30T23:59:59.000Z"),
    scheduledAt,
    agendaCount: 0,
    attendeeCount: 0,
  });
  assert.equal(issues.length, 3);
});

test("completion requires frozen evidence, attendance, outcomes, and narratives", () => {
  const complete = executiveReviewCompletionIssues({
    agendaStatuses: [
      ExecutiveReviewAgendaStatus.PRESENTED,
      ExecutiveReviewAgendaStatus.CLOSED,
    ],
    attendedCount: 2,
    hasSnapshot: true,
    dataQualityScore: 80,
    executiveSummary: "Leadership reviewed the full EHS performance record.",
    performanceConclusion:
      "Performance remains stable with targeted improvement priorities.",
    riskControlConclusion:
      "Critical risks and their control health were challenged.",
    complianceConclusion:
      "Legal obligations and regulatory changes were reviewed.",
    resourceAdequacy:
      "Resources are adequate subject to the approved investments.",
    decisionsSummary:
      "Owners, due dates, and expected outcomes were confirmed.",
    nextReviewAt: new Date("2027-01-15T00:00:00.000Z"),
    frequency: ExecutiveReviewFrequency.QUARTERLY,
    now: new Date("2026-07-25T00:00:00.000Z"),
  });
  assert.deepEqual(complete, []);

  const incomplete = executiveReviewCompletionIssues({
    agendaStatuses: [ExecutiveReviewAgendaStatus.PENDING],
    attendedCount: 0,
    hasSnapshot: false,
    dataQualityScore: 20,
    executiveSummary: "Short",
    performanceConclusion: null,
    riskControlConclusion: null,
    complianceConclusion: null,
    resourceAdequacy: null,
    decisionsSummary: null,
    nextReviewAt: null,
    frequency: ExecutiveReviewFrequency.ANNUAL,
    now: new Date("2026-07-25T00:00:00.000Z"),
  });
  assert.ok(incomplete.length >= 10);
});

test("required decisions must be governed before approval", () => {
  assert.equal(
    executiveReviewApprovalIssues([
      {
        type: ExecutiveReviewDecisionType.ACTION_REQUIRED,
        status: ExecutiveReviewDecisionStatus.OPEN,
        correctiveActionId: null,
      },
    ]).length,
    1,
  );
  assert.deepEqual(
    executiveReviewApprovalIssues([
      {
        type: ExecutiveReviewDecisionType.ACTION_REQUIRED,
        status: ExecutiveReviewDecisionStatus.ACTION_LINKED,
        correctiveActionId: "capa-1",
      },
      {
        type: ExecutiveReviewDecisionType.ACTION_REQUIRED,
        status: ExecutiveReviewDecisionStatus.IMPLEMENTED,
        correctiveActionId: null,
      },
    ]),
    [],
  );
});

test("readiness is bounded and reflects governed review evidence", () => {
  assert.equal(
    calculateExecutiveReviewReadiness({
      agendaCount: 8,
      concludedAgendaCount: 8,
      attendeeCount: 4,
      attendedCount: 4,
      hasSnapshot: true,
      dataQualityScore: 100,
      narrativesComplete: true,
      governedDecisionCount: 3,
      decisionCount: 3,
    }),
    100,
  );
  assert.equal(
    calculateExecutiveReviewReadiness({
      agendaCount: 0,
      concludedAgendaCount: 0,
      attendeeCount: 0,
      attendedCount: 0,
      hasSnapshot: false,
      dataQualityScore: null,
      narrativesComplete: false,
      governedDecisionCount: 0,
      decisionCount: 1,
    }),
    0,
  );
});

test("recurring review dates are deterministic", () => {
  const from = new Date("2026-01-31T12:00:00.000Z");
  assert.equal(
    nextExecutiveReviewDate(
      ExecutiveReviewFrequency.QUARTERLY,
      from,
    )?.toISOString(),
    "2026-04-30T12:00:00.000Z",
  );
  assert.equal(
    nextExecutiveReviewDate(ExecutiveReviewFrequency.AD_HOC, from),
    null,
  );
});
