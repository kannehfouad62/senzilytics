"use server";

import type { FormActionState } from "@/core/actions/action-state";
import { requirePermission } from "@/lib/permissions";
import { requirePlatformAdministrator } from "@/lib/platform-admin";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  initializeTenantOnboardingPlan,
  updateTenantOnboardingPlanMetadata,
  updateTenantOnboardingStep,
} from "@/modules/platform/tenant-onboarding.service";
import {
  PermissionKey,
  TenantOnboardingStepKey,
  TenantOnboardingStepStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

const field = (data: FormData, key: string) =>
  String(data.get(key) || "").trim();

const failure = (cause: unknown, fallback: string): FormActionState => ({
  status: "ERROR",
  message: cause instanceof Error ? cause.message : fallback,
});

function dateField(data: FormData, key: string) {
  const raw = field(data, key);
  if (!raw) return null;
  const date = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(date.getTime())) throw new Error(`${key} is not a valid date.`);
  return date;
}

function optional(data: FormData, key: string) {
  return field(data, key) || null;
}

function stepInput(data: FormData, organizationId: string) {
  const key = field(data, "key") as TenantOnboardingStepKey;
  const status = field(data, "status") as TenantOnboardingStepStatus;
  if (!Object.values(TenantOnboardingStepKey).includes(key)) {
    throw new Error("Select a valid implementation step.");
  }
  if (!Object.values(TenantOnboardingStepStatus).includes(status)) {
    throw new Error("Select a valid step status.");
  }
  return {
    organizationId,
    key,
    status,
    ownerId: optional(data, "ownerId"),
    dueAt: dateField(data, "dueAt"),
    tenantNotes: optional(data, "tenantNotes"),
    blocker: optional(data, "blocker"),
  };
}

function revalidateOnboarding(organizationId: string) {
  revalidatePath("/implementation");
  revalidatePath("/platform/tenants");
  revalidatePath(`/platform/tenants/${organizationId}`);
  revalidatePath("/platform/operations");
}

export async function startTenantOnboarding(
  _state: FormActionState,
  _data: FormData,
): Promise<FormActionState> {
  void _state;
  void _data;
  await requirePermission(PermissionKey.MANAGE_ORGANIZATION);
  const { organizationId, user } = await getCurrentUserTenant();
  try {
    await initializeTenantOnboardingPlan(organizationId, {
      id: user.id,
      isPlatformAdministrator: false,
    });
    revalidateOnboarding(organizationId);
    return { status: "SUCCESS", message: "Implementation plan initialized." };
  } catch (cause) {
    return failure(cause, "The implementation plan could not be initialized.");
  }
}

export async function startPlatformTenantOnboarding(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  const user = await requirePlatformAdministrator();
  const organizationId = field(data, "organizationId");
  try {
    if (!organizationId) throw new Error("Select a tenant.");
    await initializeTenantOnboardingPlan(organizationId, {
      id: user.id,
      isPlatformAdministrator: true,
    });
    revalidateOnboarding(organizationId);
    return { status: "SUCCESS", message: "Implementation plan initialized." };
  } catch (cause) {
    return failure(cause, "The implementation plan could not be initialized.");
  }
}

export async function updateTenantOnboardingMetadata(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_ORGANIZATION);
  const { organizationId, user } = await getCurrentUserTenant();
  try {
    await updateTenantOnboardingPlanMetadata(
      {
        organizationId,
        targetGoLiveAt: dateField(data, "targetGoLiveAt"),
        customerOwnerId: optional(data, "customerOwnerId"),
        tenantVisibleNotes: optional(data, "tenantVisibleNotes"),
      },
      { id: user.id, isPlatformAdministrator: false },
    );
    revalidateOnboarding(organizationId);
    return { status: "SUCCESS", message: "Implementation plan updated." };
  } catch (cause) {
    return failure(cause, "The implementation plan could not be updated.");
  }
}

export async function updatePlatformTenantOnboardingMetadata(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  const user = await requirePlatformAdministrator();
  const organizationId = field(data, "organizationId");
  try {
    if (!organizationId) throw new Error("Select a tenant.");
    await updateTenantOnboardingPlanMetadata(
      {
        organizationId,
        targetGoLiveAt: dateField(data, "targetGoLiveAt"),
        customerOwnerId: optional(data, "customerOwnerId"),
        tenantVisibleNotes: optional(data, "tenantVisibleNotes"),
        platformOwnerName: optional(data, "platformOwnerName"),
        platformOwnerEmail: optional(data, "platformOwnerEmail"),
        internalNotes: optional(data, "internalNotes"),
      },
      { id: user.id, isPlatformAdministrator: true },
    );
    revalidateOnboarding(organizationId);
    return { status: "SUCCESS", message: "Implementation plan updated." };
  } catch (cause) {
    return failure(cause, "The implementation plan could not be updated.");
  }
}

export async function updateTenantOnboardingStepAction(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_ORGANIZATION);
  const { organizationId, user } = await getCurrentUserTenant();
  try {
    await updateTenantOnboardingStep(stepInput(data, organizationId), {
      id: user.id,
      isPlatformAdministrator: false,
    });
    revalidateOnboarding(organizationId);
    return { status: "SUCCESS", message: "Implementation step updated." };
  } catch (cause) {
    return failure(cause, "The implementation step could not be updated.");
  }
}

export async function updatePlatformTenantOnboardingStepAction(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  const user = await requirePlatformAdministrator();
  const organizationId = field(data, "organizationId");
  try {
    if (!organizationId) throw new Error("Select a tenant.");
    await updateTenantOnboardingStep(stepInput(data, organizationId), {
      id: user.id,
      isPlatformAdministrator: true,
    });
    revalidateOnboarding(organizationId);
    return { status: "SUCCESS", message: "Implementation step updated." };
  } catch (cause) {
    return failure(cause, "The implementation step could not be updated.");
  }
}
