"use server";

import type { FormActionState } from "@/core/actions/action-state";
import { getCurrentUserPermissions, requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  activateContinuityService,
  addContinuityDependencyService,
  cancelContinuityExerciseService,
  completeContinuityExerciseService,
  createCapaFromContinuityImprovementService,
  createContinuityImprovementService,
  createContinuityPlanRevisionService,
  createContinuityPlanService,
  decideContinuityPlanService,
  scheduleContinuityExerciseService,
  setBusinessImpactAnalysisActiveService,
  setContinuityDependencyActiveService,
  startContinuityExerciseService,
  submitContinuityPlanService,
  transitionContinuityActivationService,
  updateContinuityImprovementService,
  updateContinuityPlanService,
  updateContinuitySituationService,
  upsertBusinessImpactAnalysisService,
  type ContinuityPlanInput,
} from "@/modules/continuity/continuity.service";
import { preparePublishedFormSubmissions } from "@/modules/forms/runtime-form.service";
import {
  ConfigurableFormModule,
  ContinuityActivationStatus,
  ContinuityCriticality,
  ContinuityDependencyType,
  ContinuityDisruptionCategory,
  ContinuityExerciseResult,
  ContinuityExerciseType,
  ContinuityImprovementStatus,
  ContinuityPlanStatus,
  ContinuityPlanType,
  PermissionKey,
  RiskLevel,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const value = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const required = (data: FormData, key: string) => {
  const result = value(data, key);
  if (!result) throw new Error(`${pretty(key)} is required.`);
  return result;
};
const optional = (data: FormData, key: string) => value(data, key) || null;
const checked = (data: FormData, key: string) => data.get(key) === "on" || data.get(key) === "true";

function enumValue<T extends Record<string, string>>(values: T, raw: string, message: string) {
  if (!Object.values(values).includes(raw)) throw new Error(message);
  return raw as T[keyof T];
}

function dateValue(data: FormData, key: string, requiredValue = false) {
  const raw = optional(data, key);
  if (!raw) {
    if (requiredValue) throw new Error(`${pretty(key)} is required.`);
    return null;
  }
  const result = new Date(raw);
  if (Number.isNaN(result.getTime())) throw new Error(`${pretty(key)} must be a valid date.`);
  return result;
}

function dateOnly(data: FormData, key: string, requiredValue = false) {
  const raw = optional(data, key);
  if (!raw) {
    if (requiredValue) throw new Error(`${pretty(key)} is required.`);
    return null;
  }
  const result = new Date(`${raw}T12:00:00.000Z`);
  if (Number.isNaN(result.getTime())) throw new Error(`${pretty(key)} must be a valid date.`);
  return result;
}

function integer(data: FormData, key: string, nullable = false): number | null {
  const raw = optional(data, key);
  if (!raw && nullable) return null;
  const result = Number(raw ?? 0);
  if (!Number.isInteger(result)) throw new Error(`${pretty(key)} must be a whole number.`);
  return result;
}

function failure(cause: unknown, fallback: string): FormActionState {
  return { status: "ERROR", message: cause instanceof Error ? cause.message : fallback };
}

function success(message: string): FormActionState {
  return { status: "SUCCESS", message };
}

function revalidateContinuity(planId?: string, exerciseId?: string, activationId?: string) {
  revalidatePath("/business-continuity");
  revalidatePath("/dashboard");
  revalidatePath("/compliance/calendar");
  revalidatePath("/actions");
  revalidatePath("/capa");
  if (planId) revalidatePath(`/business-continuity/plans/${planId}`);
  if (exerciseId) revalidatePath(`/business-continuity/exercises/${exerciseId}`);
  if (activationId) revalidatePath(`/business-continuity/activations/${activationId}`);
}

export async function createContinuityPlan(_state: FormActionState, data: FormData): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.MANAGE_BUSINESS_CONTINUITY);
  const { organizationId, user } = await getCurrentUserTenant();
  let planId = "";
  try {
    const customSubmissions = await preparePublishedFormSubmissions({
      organizationId,
      module: ConfigurableFormModule.BUSINESS_CONTINUITY,
      data,
    });
    const plan = await createContinuityPlanService({
      ...planInput(data, organizationId),
      customSubmissions,
    }, user);
    planId = plan.id;
  } catch (cause) {
    return failure(cause, "The business continuity plan could not be created.");
  }
  redirect(`/business-continuity/plans/${planId}`);
}

export async function updateContinuityPlan(_state: FormActionState, data: FormData): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.MANAGE_BUSINESS_CONTINUITY);
  const { organizationId, user } = await getCurrentUserTenant();
  const planId = required(data, "planId");
  try {
    await updateContinuityPlanService({ ...planInput(data, organizationId), planId }, user);
    revalidateContinuity(planId);
    return success("Business continuity plan updated.");
  } catch (cause) {
    return failure(cause, "The business continuity plan could not be updated.");
  }
}

export async function upsertBusinessImpactAnalysis(_state: FormActionState, data: FormData): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.MANAGE_BUSINESS_CONTINUITY);
  const { organizationId, user } = await getCurrentUserTenant();
  const planId = required(data, "planId");
  try {
    await upsertBusinessImpactAnalysisService({
      organizationId,
      planId,
      analysisId: optional(data, "analysisId"),
      ownerId: required(data, "ownerId"),
      reference: required(data, "reference"),
      processName: required(data, "processName"),
      criticality: enumValue(ContinuityCriticality, required(data, "criticality"), "Select valid process criticality."),
      description: required(data, "description"),
      maximumTolerableDowntimeHours: integer(data, "maximumTolerableDowntimeHours") ?? 0,
      recoveryTimeObjectiveHours: integer(data, "recoveryTimeObjectiveHours") ?? 0,
      recoveryPointObjectiveHours: integer(data, "recoveryPointObjectiveHours") ?? 0,
      minimumStaff: integer(data, "minimumStaff") ?? 0,
      peakPeriods: optional(data, "peakPeriods"),
      operationalImpact: required(data, "operationalImpact"),
      financialImpact: optional(data, "financialImpact"),
      legalRegulatoryImpact: optional(data, "legalRegulatoryImpact"),
      customerStakeholderImpact: optional(data, "customerStakeholderImpact"),
      minimumResources: required(data, "minimumResources"),
      vitalRecords: optional(data, "vitalRecords"),
      recoveryStrategy: required(data, "recoveryStrategy"),
      workaroundProcedure: required(data, "workaroundProcedure"),
      reviewDueAt: dateOnly(data, "reviewDueAt", true)!,
    }, user);
    revalidateContinuity(planId);
    return success("Business impact analysis saved.");
  } catch (cause) {
    return failure(cause, "The business impact analysis could not be saved.");
  }
}

export async function setBusinessImpactAnalysisActive(_state: FormActionState, data: FormData): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.MANAGE_BUSINESS_CONTINUITY);
  const { organizationId, user } = await getCurrentUserTenant();
  const planId = required(data, "planId");
  try {
    await setBusinessImpactAnalysisActiveService({
      organizationId,
      planId,
      analysisId: required(data, "analysisId"),
      active: required(data, "active") === "true",
    }, user);
    revalidateContinuity(planId);
    return success("Business impact analysis availability updated.");
  } catch (cause) {
    return failure(cause, "The business impact analysis could not be updated.");
  }
}

export async function addContinuityDependency(_state: FormActionState, data: FormData): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.MANAGE_BUSINESS_CONTINUITY);
  const { organizationId, user } = await getCurrentUserTenant();
  const planId = required(data, "planId");
  try {
    await addContinuityDependencyService({
      organizationId,
      planId,
      analysisId: required(data, "analysisId"),
      type: enumValue(ContinuityDependencyType, required(data, "type"), "Select a valid dependency type."),
      name: required(data, "name"),
      description: optional(data, "description"),
      provider: optional(data, "provider"),
      contactDetails: optional(data, "contactDetails"),
      recoveryLeadTimeHours: integer(data, "recoveryLeadTimeHours", true),
      fallbackArrangement: required(data, "fallbackArrangement"),
      isSinglePointFailure: checked(data, "isSinglePointFailure"),
    }, user);
    revalidateContinuity(planId);
    return success("Continuity dependency added.");
  } catch (cause) {
    return failure(cause, "The continuity dependency could not be added.");
  }
}

export async function setContinuityDependencyActive(_state: FormActionState, data: FormData): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.MANAGE_BUSINESS_CONTINUITY);
  const { organizationId, user } = await getCurrentUserTenant();
  const planId = required(data, "planId");
  try {
    await setContinuityDependencyActiveService({
      organizationId,
      planId,
      dependencyId: required(data, "dependencyId"),
      active: required(data, "active") === "true",
    }, user);
    revalidateContinuity(planId);
    return success("Dependency availability updated.");
  } catch (cause) {
    return failure(cause, "The dependency could not be updated.");
  }
}

export async function submitContinuityPlan(_state: FormActionState, data: FormData): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.MANAGE_BUSINESS_CONTINUITY);
  const { organizationId, user } = await getCurrentUserTenant();
  const planId = required(data, "planId");
  try {
    await submitContinuityPlanService({ organizationId, planId, submissionNotes: required(data, "submissionNotes") }, user);
    revalidateContinuity(planId);
    return success("Plan submitted for approval.");
  } catch (cause) {
    return failure(cause, "The plan could not be submitted.");
  }
}

export async function decideContinuityPlan(_state: FormActionState, data: FormData): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.MANAGE_BUSINESS_CONTINUITY);
  const { organizationId, user } = await getCurrentUserTenant();
  const planId = required(data, "planId");
  try {
    await decideContinuityPlanService({
      organizationId,
      planId,
      decision: enumValue(ContinuityPlanStatus, required(data, "decision"), "Select approve or reject."),
      reviewNotes: required(data, "reviewNotes"),
    }, user);
    revalidateContinuity(planId);
    return success("Plan decision recorded.");
  } catch (cause) {
    return failure(cause, "The plan decision could not be recorded.");
  }
}

export async function createContinuityPlanRevision(_state: FormActionState, data: FormData): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.MANAGE_BUSINESS_CONTINUITY);
  const { organizationId, user } = await getCurrentUserTenant();
  let revisionId = "";
  try {
    const revision = await createContinuityPlanRevisionService({
      organizationId,
      planId: required(data, "planId"),
      reason: required(data, "reason"),
    }, user);
    revisionId = revision.id;
  } catch (cause) {
    return failure(cause, "The plan revision could not be created.");
  }
  redirect(`/business-continuity/plans/${revisionId}`);
}

export async function scheduleContinuityExercise(_state: FormActionState, data: FormData): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.MANAGE_BUSINESS_CONTINUITY);
  const { organizationId, user } = await getCurrentUserTenant();
  let exerciseId = "";
  try {
    const exercise = await scheduleContinuityExerciseService({
      organizationId,
      planId: required(data, "planId"),
      analysisId: optional(data, "analysisId"),
      leadId: required(data, "leadId"),
      reference: required(data, "reference"),
      type: enumValue(ContinuityExerciseType, required(data, "type"), "Select a valid exercise type."),
      scheduledAt: dateValue(data, "scheduledAt", true)!,
      objectives: required(data, "objectives"),
      scenario: required(data, "scenario"),
      expectedParticipants: integer(data, "expectedParticipants") ?? 0,
      targetRecoveryTimeHours: integer(data, "targetRecoveryTimeHours", true),
      targetRecoveryPointHours: integer(data, "targetRecoveryPointHours", true),
    }, user);
    exerciseId = exercise.id;
  } catch (cause) {
    return failure(cause, "The exercise could not be scheduled.");
  }
  redirect(`/business-continuity/exercises/${exerciseId}`);
}

export async function startContinuityExercise(_state: FormActionState, data: FormData): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.MANAGE_BUSINESS_CONTINUITY);
  const { organizationId, user } = await getCurrentUserTenant();
  const exerciseId = required(data, "exerciseId");
  try {
    await startContinuityExerciseService({ organizationId, exerciseId, note: required(data, "note") }, user);
    revalidateContinuity(undefined, exerciseId);
    return success("Continuity exercise started.");
  } catch (cause) {
    return failure(cause, "The exercise could not be started.");
  }
}

export async function completeContinuityExercise(_state: FormActionState, data: FormData): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.MANAGE_BUSINESS_CONTINUITY);
  const { organizationId, user } = await getCurrentUserTenant();
  const exerciseId = required(data, "exerciseId");
  try {
    await completeContinuityExerciseService({
      organizationId,
      exerciseId,
      actualParticipants: integer(data, "actualParticipants") ?? 0,
      actualRecoveryTimeHours: integer(data, "actualRecoveryTimeHours", true),
      actualRecoveryPointHours: integer(data, "actualRecoveryPointHours", true),
      result: enumValue(ContinuityExerciseResult, required(data, "result"), "Select a valid exercise result."),
      strengths: required(data, "strengths"),
      gaps: required(data, "gaps"),
      afterActionSummary: required(data, "afterActionSummary"),
    }, user);
    revalidateContinuity(undefined, exerciseId);
    return success("Continuity exercise completed.");
  } catch (cause) {
    return failure(cause, "The exercise could not be completed.");
  }
}

export async function cancelContinuityExercise(_state: FormActionState, data: FormData): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.MANAGE_BUSINESS_CONTINUITY);
  const { organizationId, user } = await getCurrentUserTenant();
  const exerciseId = required(data, "exerciseId");
  try {
    await cancelContinuityExerciseService({ organizationId, exerciseId, reason: required(data, "reason") }, user);
    revalidateContinuity(undefined, exerciseId);
    return success("Continuity exercise cancelled.");
  } catch (cause) {
    return failure(cause, "The exercise could not be cancelled.");
  }
}

export async function activateContinuity(_state: FormActionState, data: FormData): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.RECORD_CONTINUITY_EVENT);
  const { organizationId, user } = await getCurrentUserTenant();
  let activationId = "";
  try {
    const activation = await activateContinuityService({
      organizationId,
      planId: required(data, "planId"),
      emergencyActivationId: optional(data, "emergencyActivationId"),
      coordinatorId: required(data, "coordinatorId"),
      reference: required(data, "reference"),
      category: enumValue(ContinuityDisruptionCategory, required(data, "category"), "Select a valid disruption category."),
      severity: enumValue(RiskLevel, required(data, "severity"), "Select a valid severity."),
      title: required(data, "title"),
      location: optional(data, "location"),
      disruptionSummary: required(data, "disruptionSummary"),
      impactedProcesses: required(data, "impactedProcesses"),
      activationRationale: required(data, "activationRationale"),
      recoveryActions: required(data, "recoveryActions"),
      stakeholderCommunication: required(data, "stakeholderCommunication"),
      workaroundStatus: optional(data, "workaroundStatus"),
      declaredAt: dateValue(data, "declaredAt", true)!,
      expectedRecoveryAt: dateValue(data, "expectedRecoveryAt", true)!,
      afterActionDueAt: dateValue(data, "afterActionDueAt", true)!,
      estimatedDowntimeHours: integer(data, "estimatedDowntimeHours", true),
    }, user);
    activationId = activation.id;
  } catch (cause) {
    return failure(cause, "The continuity activation could not be recorded.");
  }
  redirect(`/business-continuity/activations/${activationId}`);
}

export async function updateContinuitySituation(_state: FormActionState, data: FormData): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.RECORD_CONTINUITY_EVENT);
  const { organizationId, user } = await getCurrentUserTenant();
  const activationId = required(data, "activationId");
  try {
    await updateContinuitySituationService({
      organizationId,
      activationId,
      disruptionSummary: required(data, "disruptionSummary"),
      impactedProcesses: required(data, "impactedProcesses"),
      recoveryActions: required(data, "recoveryActions"),
      stakeholderCommunication: required(data, "stakeholderCommunication"),
      workaroundStatus: optional(data, "workaroundStatus"),
      expectedRecoveryAt: dateValue(data, "expectedRecoveryAt", true)!,
      estimatedDowntimeHours: integer(data, "estimatedDowntimeHours", true),
    }, user);
    revalidateContinuity(undefined, undefined, activationId);
    return success("Recovery situation updated.");
  } catch (cause) {
    return failure(cause, "The recovery situation could not be updated.");
  }
}

export async function transitionContinuityActivation(_state: FormActionState, data: FormData): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.RECORD_CONTINUITY_EVENT);
  const { organizationId, user } = await getCurrentUserTenant();
  const activationId = required(data, "activationId");
  try {
    await transitionContinuityActivationService({
      organizationId,
      activationId,
      status: enumValue(ContinuityActivationStatus, required(data, "status"), "Select a valid activation status."),
      note: required(data, "note"),
      restorationEvidence: optional(data, "restorationEvidence"),
      actualDowntimeHours: integer(data, "actualDowntimeHours", true),
      closureSummary: optional(data, "closureSummary"),
      lessonsLearned: optional(data, "lessonsLearned"),
    }, user);
    revalidateContinuity(undefined, undefined, activationId);
    return success("Continuity activation status updated.");
  } catch (cause) {
    return failure(cause, "The activation status could not be updated.");
  }
}

export async function createContinuityImprovement(_state: FormActionState, data: FormData): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.RECORD_CONTINUITY_EVENT);
  const { organizationId, user } = await getCurrentUserTenant();
  const planId = required(data, "planId");
  try {
    await createContinuityImprovementService({
      organizationId,
      planId,
      exerciseId: optional(data, "exerciseId"),
      activationId: optional(data, "activationId"),
      ownerId: required(data, "ownerId"),
      title: required(data, "title"),
      description: required(data, "description"),
      priority: enumValue(RiskLevel, required(data, "priority"), "Select a valid priority."),
      dueAt: dateOnly(data, "dueAt", true)!,
    }, user);
    revalidateContinuity(planId);
    return success("Continuity improvement created.");
  } catch (cause) {
    return failure(cause, "The continuity improvement could not be created.");
  }
}

export async function updateContinuityImprovement(_state: FormActionState, data: FormData): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.RECORD_CONTINUITY_EVENT);
  const [{ organizationId, user }, permissions] = await Promise.all([
    getCurrentUserTenant(),
    getCurrentUserPermissions(),
  ]);
  const planId = required(data, "planId");
  try {
    await updateContinuityImprovementService({
      organizationId,
      improvementId: required(data, "improvementId"),
      userId: user.id,
      canManage: permissions.includes(PermissionKey.MANAGE_BUSINESS_CONTINUITY),
      status: enumValue(ContinuityImprovementStatus, required(data, "status"), "Select a valid improvement status."),
      completionEvidence: optional(data, "completionEvidence"),
      verificationNotes: optional(data, "verificationNotes"),
    });
    revalidateContinuity(planId);
    return success("Continuity improvement updated.");
  } catch (cause) {
    return failure(cause, "The continuity improvement could not be updated.");
  }
}

export async function createCapaFromContinuityImprovement(_state: FormActionState, data: FormData): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.MANAGE_BUSINESS_CONTINUITY);
  await requirePermission(PermissionKey.CREATE_CAPA);
  const { organizationId, user } = await getCurrentUserTenant();
  const planId = required(data, "planId");
  try {
    await createCapaFromContinuityImprovementService({
      organizationId,
      improvementId: required(data, "improvementId"),
      title: required(data, "title"),
      description: optional(data, "description"),
      assignedToId: required(data, "assignedToId"),
      dueDate: dateOnly(data, "dueDate", true)!,
    }, user);
    revalidateContinuity(planId);
    return success("Corrective action created and linked.");
  } catch (cause) {
    return failure(cause, "The corrective action could not be created.");
  }
}

function planInput(data: FormData, organizationId: string): ContinuityPlanInput {
  return {
    organizationId,
    siteId: optional(data, "siteId"),
    departmentId: optional(data, "departmentId"),
    ownerId: required(data, "ownerId"),
    reference: required(data, "reference"),
    title: required(data, "title"),
    type: enumValue(ContinuityPlanType, required(data, "type"), "Select a valid plan type."),
    scope: required(data, "scope"),
    criticalActivitiesSummary: required(data, "criticalActivitiesSummary"),
    activationCriteria: required(data, "activationCriteria"),
    governanceStructure: required(data, "governanceStructure"),
    communicationStrategy: required(data, "communicationStrategy"),
    alternateWorkStrategy: required(data, "alternateWorkStrategy"),
    technologyRecoveryStrategy: required(data, "technologyRecoveryStrategy"),
    supplierContinuityStrategy: optional(data, "supplierContinuityStrategy"),
    manualWorkarounds: required(data, "manualWorkarounds"),
    recoveryPriorities: required(data, "recoveryPriorities"),
    reviewDueAt: dateOnly(data, "reviewDueAt", true)!,
  };
}

function pretty(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}
