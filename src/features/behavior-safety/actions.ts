"use server";

import type { FormActionState } from "@/core/actions/action-state";
import { getCurrentUserPermissions, requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  addBehaviorDefinitionService,
  changeBehaviorProgramStatusService,
  createBehaviorProgramService,
  createCapaFromBehaviorSessionService,
  nominateBehaviorRecognitionService,
  recordBehaviorCoachingSessionService,
  recordBehaviorProgramReviewService,
  reviewBehaviorRecognitionService,
  updateBehaviorFollowUpService,
} from "@/modules/behavior-safety/behavior-safety.service";
import { preparePublishedFormSubmissions } from "@/modules/forms/runtime-form.service";
import {
  BehaviorCoachingType,
  BehaviorFollowUpStatus,
  BehaviorObservationOutcome,
  BehaviorProgramStatus,
  BehaviorRecognitionStatus,
  ConfigurableFormModule,
  PermissionKey,
  SifExposureCategory,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const text = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const required = (data: FormData, key: string) => { const value = text(data, key); if (!value) throw new Error(`${key} is required.`); return value; };
const optional = (data: FormData, key: string) => text(data, key) || null;
const date = (data: FormData, key: string, requiredValue = false) => { const raw = optional(data, key); if (!raw) { if (requiredValue) throw new Error(`${key} is required.`); return null; } const value = new Date(raw); if (Number.isNaN(value.getTime())) throw new Error(`${key} must be a valid date.`); return value; };
const integer = (data: FormData, key: string, fallback = 0) => { const value = Number(optional(data, key) ?? fallback); if (!Number.isInteger(value)) throw new Error(`${key} must be a whole number.`); return value; };
const enumValue = <T extends Record<string, string>>(values: T, value: string, message: string) => { if (!Object.values(values).includes(value)) throw new Error(message); return value as T[keyof T]; };
const fail = (cause: unknown, fallback: string): FormActionState => ({ status: "ERROR", message: cause instanceof Error ? cause.message : fallback });
const refresh = (programId?: string, sessionId?: string) => { revalidatePath("/behavior-safety"); revalidatePath("/behavior-safety/dashboard"); if (programId) revalidatePath(`/behavior-safety/programs/${programId}`); if (sessionId) revalidatePath(`/behavior-safety/sessions/${sessionId}`); };

export async function createBehaviorProgram(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_BEHAVIOR_SAFETY); const { organizationId, user } = await getCurrentUserTenant(); let id = "";
  try { const program = await createBehaviorProgramService({ organizationId, userId: user.id, code: required(data, "code"), name: required(data, "name"), description: optional(data, "description"), objective: optional(data, "objective"), siteId: optional(data, "siteId"), departmentId: optional(data, "departmentId"), ownerId: required(data, "ownerId"), targetSessionsPerMonth: integer(data, "targetSessionsPerMonth", 10), effectiveFrom: date(data, "effectiveFrom"), effectiveTo: date(data, "effectiveTo"), nextReviewAt: date(data, "nextReviewAt") }); id = program.id; }
  catch (cause) { return fail(cause, "The behavior-safety program could not be created."); }
  redirect(`/behavior-safety/programs/${id}`);
}

export async function addBehaviorDefinition(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_BEHAVIOR_SAFETY); const { organizationId, user } = await getCurrentUserTenant(); const programId = required(data, "programId");
  try { await addBehaviorDefinitionService({ organizationId, userId: user.id, programId, code: required(data, "code"), title: required(data, "title"), category: enumValue(SifExposureCategory, required(data, "category"), "Select a valid exposure category."), prompt: required(data, "prompt"), safeDescription: required(data, "safeDescription"), atRiskDescription: required(data, "atRiskDescription"), isCritical: data.get("isCritical") === "on", sequence: integer(data, "sequence", 0) }); }
  catch (cause) { return fail(cause, "The behavior definition could not be added."); }
  refresh(programId); return { status: "SUCCESS", message: "Behavior definition added." };
}

export async function changeBehaviorProgramStatus(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_BEHAVIOR_SAFETY); const { organizationId, user } = await getCurrentUserTenant(); const programId = required(data, "programId");
  try { await changeBehaviorProgramStatusService({ organizationId, userId: user.id, programId, status: enumValue(BehaviorProgramStatus, required(data, "status"), "Select a valid program status."), reason: required(data, "reason") }); }
  catch (cause) { return fail(cause, "The program status could not be changed."); }
  refresh(programId); return { status: "SUCCESS", message: "Program status updated." };
}

export async function recordBehaviorProgramReview(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_BEHAVIOR_SAFETY); const { organizationId, user } = await getCurrentUserTenant(); const programId = required(data, "programId");
  try { await recordBehaviorProgramReviewService({ organizationId, userId: user.id, programId, reviewNotes: required(data, "reviewNotes"), nextReviewAt: date(data, "nextReviewAt", true)! }); }
  catch (cause) { return fail(cause, "The program review could not be recorded."); }
  refresh(programId); return { status: "SUCCESS", message: "Program review recorded." };
}

export async function recordBehaviorCoachingSession(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.RECORD_BEHAVIOR_COACHING); const { organizationId, user } = await getCurrentUserTenant(); let id = "";
  try {
    const behaviorIds = data.getAll("behaviorIds").map(String).filter(Boolean);
    const results = behaviorIds.map(behaviorId => ({ behaviorId, outcome: enumValue(BehaviorObservationOutcome, required(data, `outcome_${behaviorId}`), "Select a valid outcome for every behavior."), note: optional(data, `note_${behaviorId}`), immediateAction: optional(data, `action_${behaviorId}`) }));
    const customSubmissions = await preparePublishedFormSubmissions({ organizationId, module: ConfigurableFormModule.BEHAVIOR_SAFETY, data });
    const session = await recordBehaviorCoachingSessionService({ organizationId, userId: user.id, programId: required(data, "programId"), siteId: required(data, "siteId"), departmentId: optional(data, "departmentId"), participantId: optional(data, "participantId"), isParticipantAnonymous: data.get("isParticipantAnonymous") === "on", workGroup: optional(data, "workGroup"), observedAt: date(data, "observedAt", true)!, location: optional(data, "location"), coachingType: enumValue(BehaviorCoachingType, required(data, "coachingType"), "Select a valid coaching type."), discussionSummary: optional(data, "discussionSummary"), workerCommitment: optional(data, "workerCommitment"), immediateAction: optional(data, "immediateAction"), followUpOwnerId: optional(data, "followUpOwnerId"), followUpDueAt: date(data, "followUpDueAt"), createSafetyObservation: data.get("createSafetyObservation") === "on", customSubmissions, results });
    id = session.id;
  } catch (cause) { return fail(cause, "The coaching session could not be recorded."); }
  redirect(`/behavior-safety/sessions/${id}`);
}

export async function updateBehaviorFollowUp(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.RECORD_BEHAVIOR_COACHING); const [{ organizationId, user }, permissions] = await Promise.all([getCurrentUserTenant(), getCurrentUserPermissions()]); const sessionId = required(data, "sessionId");
  try { await updateBehaviorFollowUpService({ organizationId, userId: user.id, canManage: permissions.includes(PermissionKey.MANAGE_BEHAVIOR_SAFETY), sessionId, status: enumValue(BehaviorFollowUpStatus, required(data, "status"), "Select a valid follow-up status."), note: required(data, "note") }); }
  catch (cause) { return fail(cause, "The follow-up could not be updated."); }
  refresh(undefined, sessionId); return { status: "SUCCESS", message: "Follow-up updated." };
}

export async function createBehaviorSessionCapa(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_BEHAVIOR_SAFETY); await requirePermission(PermissionKey.CREATE_CAPA); const { organizationId, user } = await getCurrentUserTenant(); const sessionId = required(data, "sessionId");
  try { await createCapaFromBehaviorSessionService({ organizationId, userId: user.id, sessionId, title: required(data, "title"), description: optional(data, "description"), assignedToId: required(data, "assignedToId"), dueDate: date(data, "dueDate", true)! }); }
  catch (cause) { return fail(cause, "The corrective action could not be created."); }
  refresh(undefined, sessionId); revalidatePath("/actions"); revalidatePath("/capa"); return { status: "SUCCESS", message: "Corrective action created and linked." };
}

export async function nominateBehaviorRecognition(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.RECORD_BEHAVIOR_COACHING); const { organizationId, user } = await getCurrentUserTenant(); const sessionId = required(data, "sessionId");
  try { await nominateBehaviorRecognitionService({ organizationId, userId: user.id, sessionId, nominatedUserId: required(data, "nominatedUserId"), reason: required(data, "reason") }); }
  catch (cause) { return fail(cause, "Recognition could not be nominated."); }
  refresh(undefined, sessionId); return { status: "SUCCESS", message: "Recognition nomination submitted." };
}

export async function reviewBehaviorRecognition(_state: FormActionState, data: FormData): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_BEHAVIOR_SAFETY); const { organizationId, user } = await getCurrentUserTenant(); const sessionId = required(data, "sessionId");
  try { await reviewBehaviorRecognitionService({ organizationId, userId: user.id, recognitionId: required(data, "recognitionId"), status: enumValue(BehaviorRecognitionStatus, required(data, "status"), "Select a valid recognition decision.") }); }
  catch (cause) { return fail(cause, "Recognition could not be reviewed."); }
  refresh(undefined, sessionId); return { status: "SUCCESS", message: "Recognition decision recorded." };
}
