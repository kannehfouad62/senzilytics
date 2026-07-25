"use server";

import type { FormActionState } from "@/core/actions/action-state";
import {
  getCurrentUserPermissions,
  requirePermission,
} from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  activateEmergencyResponseService,
  addEmergencyContactService,
  addEmergencyScenarioService,
  cancelEmergencyDrillService,
  completeEmergencyDrillService,
  createCapaFromEmergencyImprovementService,
  createEmergencyImprovementService,
  createEmergencyPlanRevisionService,
  createEmergencyPlanService,
  decideEmergencyPlanService,
  scheduleEmergencyDrillService,
  setEmergencyContactActiveService,
  setEmergencyScenarioActiveService,
  startEmergencyDrillService,
  submitEmergencyPlanService,
  transitionEmergencyActivationService,
  updateEmergencyActivationSituationService,
  updateEmergencyImprovementService,
  updateEmergencyPlanService,
} from "@/modules/emergency/emergency.service";
import { preparePublishedFormSubmissions } from "@/modules/forms/runtime-form.service";
import {
  ConfigurableFormModule,
  EmergencyActivationStatus,
  EmergencyContactType,
  EmergencyDrillRating,
  EmergencyDrillType,
  EmergencyImprovementStatus,
  EmergencyPlanStatus,
  EmergencyPlanType,
  EmergencyScenarioCategory,
  PermissionKey,
  RiskLevel,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const value = (data: FormData, key: string) =>
  String(data.get(key) ?? "").trim();

const required = (data: FormData, key: string) => {
  const result = value(data, key);
  if (!result) throw new Error(`${pretty(key)} is required.`);
  return result;
};

const optional = (data: FormData, key: string) => value(data, key) || null;

function enumValue<T extends Record<string, string>>(
  values: T,
  raw: string,
  message: string,
) {
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
  if (Number.isNaN(result.getTime())) {
    throw new Error(`${pretty(key)} must be a valid date.`);
  }
  return result;
}

function dateOnly(data: FormData, key: string, requiredValue = false) {
  const raw = optional(data, key);
  if (!raw) {
    if (requiredValue) throw new Error(`${pretty(key)} is required.`);
    return null;
  }
  const result = new Date(`${raw}T12:00:00.000Z`);
  if (Number.isNaN(result.getTime())) {
    throw new Error(`${pretty(key)} must be a valid date.`);
  }
  return result;
}

function integer(
  data: FormData,
  key: string,
  options?: { nullable?: false; fallback?: number },
): number;
function integer(
  data: FormData,
  key: string,
  options: { nullable: true; fallback?: number },
): number | null;
function integer(
  data: FormData,
  key: string,
  options: { nullable?: boolean; fallback?: number } = {},
): number | null {
  const raw = optional(data, key);
  if (!raw && options.nullable) return null;
  const result = Number(raw ?? options.fallback ?? 0);
  if (!Number.isInteger(result)) {
    throw new Error(`${pretty(key)} must be a whole number.`);
  }
  return result;
}

function failure(cause: unknown, fallback: string): FormActionState {
  return {
    status: "ERROR",
    message: cause instanceof Error ? cause.message : fallback,
  };
}

function success(message: string): FormActionState {
  return { status: "SUCCESS", message };
}

function revalidateEmergency(
  planId?: string,
  drillId?: string,
  activationId?: string,
) {
  revalidatePath("/emergency");
  revalidatePath("/dashboard");
  revalidatePath("/compliance/calendar");
  revalidatePath("/actions");
  revalidatePath("/capa");
  if (planId) revalidatePath(`/emergency/plans/${planId}`);
  if (drillId) revalidatePath(`/emergency/drills/${drillId}`);
  if (activationId) {
    revalidatePath(`/emergency/activations/${activationId}`);
  }
}

export async function createEmergencyPlan(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.MANAGE_EMERGENCY_PREPAREDNESS);
  const { organizationId, user } = await getCurrentUserTenant();
  let planId = "";
  try {
    const customSubmissions = await preparePublishedFormSubmissions({
      organizationId,
      module: ConfigurableFormModule.EMERGENCY_PREPAREDNESS,
      data,
    });
    const plan = await createEmergencyPlanService(
      {
        ...planInput(data, organizationId),
        customSubmissions,
      },
      user,
    );
    planId = plan.id;
  } catch (cause) {
    return failure(cause, "The emergency plan could not be created.");
  }
  redirect(`/emergency/plans/${planId}`);
}

export async function updateEmergencyPlan(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.MANAGE_EMERGENCY_PREPAREDNESS);
  const { organizationId, user } = await getCurrentUserTenant();
  const planId = required(data, "planId");
  try {
    await updateEmergencyPlanService(
      {
        ...planInput(data, organizationId),
        planId,
      },
      user,
    );
    revalidateEmergency(planId);
    return success("Emergency plan updated.");
  } catch (cause) {
    return failure(cause, "The emergency plan could not be updated.");
  }
}

export async function addEmergencyScenario(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.MANAGE_EMERGENCY_PREPAREDNESS);
  const { organizationId, user } = await getCurrentUserTenant();
  const planId = required(data, "planId");
  try {
    await addEmergencyScenarioService(
      {
        organizationId,
        planId,
        category: enumValue(
          EmergencyScenarioCategory,
          required(data, "category"),
          "Select a valid scenario category.",
        ),
        riskLevel: enumValue(
          RiskLevel,
          required(data, "riskLevel"),
          "Select a valid scenario risk level.",
        ),
        title: required(data, "title"),
        triggerCriteria: required(data, "triggerCriteria"),
        immediateActions: required(data, "immediateActions"),
        protectiveActions: required(data, "protectiveActions"),
        evacuationAreas: optional(data, "evacuationAreas"),
        musterPoints: optional(data, "musterPoints"),
        shutdownSteps: optional(data, "shutdownSteps"),
        requiredEquipment: optional(data, "requiredEquipment"),
        specialAssistance: optional(data, "specialAssistance"),
        externalAgencies: optional(data, "externalAgencies"),
        evacuationRequired: data.get("evacuationRequired") === "on",
        shelterInPlace: data.get("shelterInPlace") === "on",
        sequence: integer(data, "sequence"),
      },
      user,
    );
    revalidateEmergency(planId);
    return success("Emergency scenario added.");
  } catch (cause) {
    return failure(cause, "The emergency scenario could not be added.");
  }
}

export async function setEmergencyScenarioActive(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.MANAGE_EMERGENCY_PREPAREDNESS);
  const { organizationId, user } = await getCurrentUserTenant();
  const planId = required(data, "planId");
  try {
    await setEmergencyScenarioActiveService(
      {
        organizationId,
        planId,
        scenarioId: required(data, "scenarioId"),
        isActive: required(data, "isActive") === "true",
        reason: required(data, "reason"),
      },
      user,
    );
    revalidateEmergency(planId);
    return success("Scenario availability updated.");
  } catch (cause) {
    return failure(cause, "The emergency scenario could not be updated.");
  }
}

export async function addEmergencyContact(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.MANAGE_EMERGENCY_PREPAREDNESS);
  const { organizationId, user } = await getCurrentUserTenant();
  const planId = required(data, "planId");
  try {
    await addEmergencyContactService(
      {
        organizationId,
        planId,
        type: enumValue(
          EmergencyContactType,
          required(data, "type"),
          "Select a valid contact type.",
        ),
        name: required(data, "name"),
        role: optional(data, "role"),
        organizationName: optional(data, "organizationName"),
        phone: required(data, "phone"),
        alternatePhone: optional(data, "alternatePhone"),
        email: optional(data, "email"),
        availability: optional(data, "availability"),
        priority: integer(data, "priority"),
      },
      user,
    );
    revalidateEmergency(planId);
    return success("Emergency contact added.");
  } catch (cause) {
    return failure(cause, "The emergency contact could not be added.");
  }
}

export async function setEmergencyContactActive(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.MANAGE_EMERGENCY_PREPAREDNESS);
  const { organizationId, user } = await getCurrentUserTenant();
  const planId = required(data, "planId");
  try {
    await setEmergencyContactActiveService(
      {
        organizationId,
        planId,
        contactId: required(data, "contactId"),
        isActive: required(data, "isActive") === "true",
        reason: required(data, "reason"),
      },
      user,
    );
    revalidateEmergency(planId);
    return success("Emergency contact availability updated.");
  } catch (cause) {
    return failure(cause, "The emergency contact could not be updated.");
  }
}

export async function submitEmergencyPlan(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.MANAGE_EMERGENCY_PREPAREDNESS);
  const { organizationId, user } = await getCurrentUserTenant();
  const planId = required(data, "planId");
  try {
    await submitEmergencyPlanService(
      {
        organizationId,
        planId,
        submissionNotes: required(data, "submissionNotes"),
      },
      user,
    );
    revalidateEmergency(planId);
    return success("Emergency plan submitted for approval.");
  } catch (cause) {
    return failure(cause, "The emergency plan could not be submitted.");
  }
}

export async function decideEmergencyPlan(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.MANAGE_EMERGENCY_PREPAREDNESS);
  const { organizationId, user } = await getCurrentUserTenant();
  const planId = required(data, "planId");
  try {
    const rawDecision = required(data, "decision");
    if (
      rawDecision !== EmergencyPlanStatus.ACTIVE &&
      rawDecision !== EmergencyPlanStatus.REJECTED
    ) {
      throw new Error("Select approve or reject.");
    }
    await decideEmergencyPlanService(
      {
        organizationId,
        planId,
        decision: rawDecision,
        reviewNotes: required(data, "reviewNotes"),
      },
      user,
    );
    revalidateEmergency(planId);
    return success(
      `Emergency plan ${rawDecision === EmergencyPlanStatus.ACTIVE ? "approved" : "rejected"}.`,
    );
  } catch (cause) {
    return failure(cause, "The emergency plan decision could not be recorded.");
  }
}

export async function createEmergencyPlanRevision(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.MANAGE_EMERGENCY_PREPAREDNESS);
  const { organizationId, user } = await getCurrentUserTenant();
  let revisionId = "";
  try {
    const revision = await createEmergencyPlanRevisionService(
      {
        organizationId,
        planId: required(data, "planId"),
        reason: required(data, "reason"),
      },
      user,
    );
    revisionId = revision.id;
  } catch (cause) {
    return failure(cause, "The emergency plan revision could not be created.");
  }
  redirect(`/emergency/plans/${revisionId}`);
}

export async function scheduleEmergencyDrill(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.MANAGE_EMERGENCY_PREPAREDNESS);
  const { organizationId, user } = await getCurrentUserTenant();
  let drillId = "";
  try {
    const drill = await scheduleEmergencyDrillService(
      {
        organizationId,
        planId: required(data, "planId"),
        scenarioId: optional(data, "scenarioId"),
        leadId: required(data, "leadId"),
        reference: required(data, "reference"),
        type: enumValue(
          EmergencyDrillType,
          required(data, "type"),
          "Select a valid drill type.",
        ),
        scheduledAt: dateValue(data, "scheduledAt", true)!,
        objectives: required(data, "objectives"),
        scope: optional(data, "scope"),
        expectedParticipants: integer(data, "expectedParticipants"),
      },
      user,
    );
    drillId = drill.id;
  } catch (cause) {
    return failure(cause, "The emergency drill could not be scheduled.");
  }
  redirect(`/emergency/drills/${drillId}`);
}

export async function startEmergencyDrill(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.MANAGE_EMERGENCY_PREPAREDNESS);
  const { organizationId, user } = await getCurrentUserTenant();
  const drillId = required(data, "drillId");
  try {
    await startEmergencyDrillService(
      {
        organizationId,
        drillId,
        note: required(data, "note"),
      },
      user,
    );
    revalidateEmergency(undefined, drillId);
    return success("Emergency drill started.");
  } catch (cause) {
    return failure(cause, "The emergency drill could not be started.");
  }
}

export async function completeEmergencyDrill(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.MANAGE_EMERGENCY_PREPAREDNESS);
  const { organizationId, user } = await getCurrentUserTenant();
  const drillId = required(data, "drillId");
  try {
    await completeEmergencyDrillService(
      {
        organizationId,
        drillId,
        actualParticipants: integer(data, "actualParticipants"),
        notificationMethod: optional(data, "notificationMethod"),
        alarmActivationSeconds: integer(data, "alarmActivationSeconds", {
          nullable: true,
        }),
        evacuationSeconds: integer(data, "evacuationSeconds", {
          nullable: true,
        }),
        accountabilitySeconds: integer(data, "accountabilitySeconds", {
          nullable: true,
        }),
        rating: enumValue(
          EmergencyDrillRating,
          required(data, "rating"),
          "Select a valid drill rating.",
        ),
        strengths: required(data, "strengths"),
        gaps: required(data, "gaps"),
        observerNotes: optional(data, "observerNotes"),
        afterActionSummary: required(data, "afterActionSummary"),
      },
      user,
    );
    revalidateEmergency(undefined, drillId);
    return success("Emergency drill completed and reviewed.");
  } catch (cause) {
    return failure(cause, "The emergency drill could not be completed.");
  }
}

export async function cancelEmergencyDrill(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.MANAGE_EMERGENCY_PREPAREDNESS);
  const { organizationId, user } = await getCurrentUserTenant();
  const drillId = required(data, "drillId");
  try {
    await cancelEmergencyDrillService(
      {
        organizationId,
        drillId,
        reason: required(data, "reason"),
      },
      user,
    );
    revalidateEmergency(undefined, drillId);
    return success("Emergency drill cancelled.");
  } catch (cause) {
    return failure(cause, "The emergency drill could not be cancelled.");
  }
}

export async function activateEmergencyResponse(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.RECORD_EMERGENCY_RESPONSE);
  const { organizationId, user } = await getCurrentUserTenant();
  let activationId = "";
  try {
    const activation = await activateEmergencyResponseService(
      {
        organizationId,
        planId: required(data, "planId"),
        scenarioId: optional(data, "scenarioId"),
        incidentCommanderId: required(data, "incidentCommanderId"),
        reference: required(data, "reference"),
        severity: enumValue(
          RiskLevel,
          required(data, "severity"),
          "Select a valid response severity.",
        ),
        location: required(data, "location"),
        summary: required(data, "summary"),
        declaredAt: dateValue(data, "declaredAt", true)!,
        notificationMethod: required(data, "notificationMethod"),
        protectiveActions: required(data, "protectiveActions"),
        externalAgenciesNotified: optional(
          data,
          "externalAgenciesNotified",
        ),
        peopleAtRisk: integer(data, "peopleAtRisk"),
        injuriesReported: integer(data, "injuriesReported"),
        missingPersons: integer(data, "missingPersons"),
        afterActionDueAt: dateOnly(data, "afterActionDueAt", true)!,
      },
      user,
    );
    activationId = activation.id;
  } catch (cause) {
    return failure(cause, "The emergency response record could not be activated.");
  }
  redirect(`/emergency/activations/${activationId}`);
}

export async function updateEmergencyActivationSituation(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.RECORD_EMERGENCY_RESPONSE);
  const { organizationId, user } = await getCurrentUserTenant();
  const activationId = required(data, "activationId");
  try {
    await updateEmergencyActivationSituationService(
      {
        organizationId,
        activationId,
        summary: required(data, "summary"),
        notificationMethod: required(data, "notificationMethod"),
        protectiveActions: required(data, "protectiveActions"),
        externalAgenciesNotified: optional(
          data,
          "externalAgenciesNotified",
        ),
        peopleAtRisk: integer(data, "peopleAtRisk"),
        injuriesReported: integer(data, "injuriesReported"),
        missingPersons: integer(data, "missingPersons"),
      },
      user,
    );
    revalidateEmergency(undefined, undefined, activationId);
    return success("Emergency situation record updated.");
  } catch (cause) {
    return failure(cause, "The emergency situation could not be updated.");
  }
}

export async function transitionEmergencyActivation(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.RECORD_EMERGENCY_RESPONSE);
  const { organizationId, user } = await getCurrentUserTenant();
  const activationId = required(data, "activationId");
  try {
    await transitionEmergencyActivationService(
      {
        organizationId,
        activationId,
        status: enumValue(
          EmergencyActivationStatus,
          required(data, "status"),
          "Select a valid response status.",
        ),
        note: required(data, "note"),
        afterActionSummary: optional(data, "afterActionSummary"),
        lessonsLearned: optional(data, "lessonsLearned"),
      },
      user,
    );
    revalidateEmergency(undefined, undefined, activationId);
    return success("Emergency response lifecycle updated.");
  } catch (cause) {
    return failure(cause, "The emergency response status could not be updated.");
  }
}

export async function createEmergencyImprovement(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.RECORD_EMERGENCY_RESPONSE);
  const { organizationId, user } = await getCurrentUserTenant();
  const planId = required(data, "planId");
  const drillId = optional(data, "drillId");
  const activationId = optional(data, "activationId");
  try {
    await createEmergencyImprovementService(
      {
        organizationId,
        planId,
        drillId,
        activationId,
        ownerId: required(data, "ownerId"),
        title: required(data, "title"),
        description: required(data, "description"),
        priority: enumValue(
          RiskLevel,
          required(data, "priority"),
          "Select a valid improvement priority.",
        ),
        dueAt: dateOnly(data, "dueAt", true)!,
      },
      user,
    );
    revalidateEmergency(planId, drillId ?? undefined, activationId ?? undefined);
    return success("After-action improvement created.");
  } catch (cause) {
    return failure(cause, "The emergency improvement could not be created.");
  }
}

export async function updateEmergencyImprovement(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.RECORD_EMERGENCY_RESPONSE);
  const [{ organizationId, user }, permissions] = await Promise.all([
    getCurrentUserTenant(),
    getCurrentUserPermissions(),
  ]);
  try {
    await updateEmergencyImprovementService({
      organizationId,
      improvementId: required(data, "improvementId"),
      userId: user.id,
      canManage: permissions.includes(
        PermissionKey.MANAGE_EMERGENCY_PREPAREDNESS,
      ),
      status: enumValue(
        EmergencyImprovementStatus,
        required(data, "status"),
        "Select a valid improvement status.",
      ),
      completionEvidence: optional(data, "completionEvidence"),
      verificationNotes: optional(data, "verificationNotes"),
    });
    revalidateEmergency(
      optional(data, "planId") ?? undefined,
      optional(data, "drillId") ?? undefined,
      optional(data, "activationId") ?? undefined,
    );
    return success("Emergency improvement updated.");
  } catch (cause) {
    return failure(cause, "The emergency improvement could not be updated.");
  }
}

export async function createCapaFromEmergencyImprovement(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void _state;
  await requirePermission(PermissionKey.MANAGE_EMERGENCY_PREPAREDNESS);
  await requirePermission(PermissionKey.CREATE_CAPA);
  const { organizationId, user } = await getCurrentUserTenant();
  try {
    await createCapaFromEmergencyImprovementService(
      {
        organizationId,
        improvementId: required(data, "improvementId"),
        title: required(data, "title"),
        description: optional(data, "description"),
        assignedToId: required(data, "assignedToId"),
        dueDate: dateOnly(data, "dueDate", true)!,
      },
      user,
    );
    revalidateEmergency(
      optional(data, "planId") ?? undefined,
      optional(data, "drillId") ?? undefined,
      optional(data, "activationId") ?? undefined,
    );
    return success("Corrective action created and linked.");
  } catch (cause) {
    return failure(cause, "The corrective action could not be created.");
  }
}

function planInput(data: FormData, organizationId: string) {
  return {
    organizationId,
    siteId: required(data, "siteId"),
    departmentId: optional(data, "departmentId"),
    ownerId: required(data, "ownerId"),
    reference: required(data, "reference"),
    title: required(data, "title"),
    type: enumValue(
      EmergencyPlanType,
      required(data, "type"),
      "Select a valid emergency plan type.",
    ),
    scope: required(data, "scope"),
    purpose: optional(data, "purpose"),
    hazardProfile: required(data, "hazardProfile"),
    commandStructure: required(data, "commandStructure"),
    communicationProcedure: required(data, "communicationProcedure"),
    evacuationProcedure: required(data, "evacuationProcedure"),
    shelterProcedure: optional(data, "shelterProcedure"),
    accountabilityProcedure: required(data, "accountabilityProcedure"),
    medicalProcedure: optional(data, "medicalProcedure"),
    externalCoordination: optional(data, "externalCoordination"),
    recoveryCriteria: required(data, "recoveryCriteria"),
    reviewDueAt: dateOnly(data, "reviewDueAt", true)!,
  };
}

function pretty(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();
}
