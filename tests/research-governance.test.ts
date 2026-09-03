import assert from "node:assert/strict";
import test from "node:test";
import { ResearchCollectionStatus, ResearchProjectStatus } from "@prisma/client";
import { assertResearchCollectionTransition, assertResearchProjectTransition, availableResearchCollectionStatuses, availableResearchProjectStatuses, normalizeResearchReference, researchProjectReadiness } from "../src/modules/research/research-governance";

test("research projects follow a controlled lifecycle", () => {
  assert.doesNotThrow(() => assertResearchProjectTransition(ResearchProjectStatus.DRAFT, ResearchProjectStatus.PLANNING));
  assert.doesNotThrow(() => assertResearchProjectTransition(ResearchProjectStatus.IN_REVIEW, ResearchProjectStatus.APPROVED));
  assert.throws(() => assertResearchProjectTransition(ResearchProjectStatus.DRAFT, ResearchProjectStatus.ACTIVE), /cannot move/);
  assert.throws(() => assertResearchProjectTransition(ResearchProjectStatus.COMPLETED, ResearchProjectStatus.DATA_COLLECTION), /cannot move/);
  assert.deepEqual(availableResearchProjectStatuses(ResearchProjectStatus.ARCHIVED), []);
});

test("research collection waves use a controlled lifecycle",()=>{
  assert.doesNotThrow(()=>assertResearchCollectionTransition(ResearchCollectionStatus.DRAFT,ResearchCollectionStatus.ACTIVE));
  assert.doesNotThrow(()=>assertResearchCollectionTransition(ResearchCollectionStatus.PAUSED,ResearchCollectionStatus.ACTIVE));
  assert.throws(()=>assertResearchCollectionTransition(ResearchCollectionStatus.CLOSED,ResearchCollectionStatus.ACTIVE),/cannot move/);
  assert.deepEqual(availableResearchCollectionStatuses(ResearchCollectionStatus.CANCELLED),[]);
});

test("research references are stable and safe", () => {
  assert.equal(normalizeResearchReference(" res 2026 / 001 "), "RES-2026-001");
  assert.throws(() => normalizeResearchReference("x"), /3 to 40/);
  assert.throws(() => normalizeResearchReference("a".repeat(41)), /3 to 40/);
});

test("research readiness requires ownership, team and controlled milestones", () => {
  const ready = researchProjectReadiness({ purpose: "Measure workforce safety culture and its drivers.", objectives: "Estimate indicators and identify improvement priorities.", researchQuestions: "Which factors predict reporting confidence?", methodology: "MIXED_METHODS", projectManagerId: "user-1", clientRequired: true, clientId: "client-1", dataOwnershipStatement: "The commissioning client owns approved project outputs.", ethicsApprovalRequired: true, ethicsApprovalReference: "IRB-2026-17", consentRequired: true, teamCount: 3, milestoneCount: 4 });
  assert.equal(ready.score, 100);
  assert.deepEqual(ready.blockers, []);
  const incomplete = researchProjectReadiness({ purpose: "Short", objectives: "Short", researchQuestions: "", methodology: "", projectManagerId: "", clientRequired: true, clientId: null, dataOwnershipStatement: null, ethicsApprovalRequired: true, ethicsApprovalReference: null, consentRequired: false, teamCount: 0, milestoneCount: 0 });
  assert.ok(incomplete.blockers.includes("Commissioning client"));
  assert.ok(incomplete.blockers.includes("Data ownership statement"));
  assert.ok(incomplete.blockers.includes("Research team"));
  assert.ok(incomplete.score < 30);
});
