"use server";

import type { FormActionState } from "@/core/actions/action-state";
import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  addDraftField,
  createDraftRevision,
  createFormDefinition,
  deleteDraftField,
  deleteFormDefinition,
  parseOptionList,
  publishFormVersion,
  setFormDefinitionAssignment,
  updateFormDefinitionSettings,
} from "@/modules/forms/configurable-form.service";
import {
  ConfigurableFieldType,
  ConfigurableFormModule,
  PermissionKey,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const text = (data: FormData, key: string) =>
  String(data.get(key) || "").trim();

const required = (data: FormData, key: string) => {
  const value = text(data, key);
  if (!value) throw new Error(`${key} is required.`);
  return value;
};

const message = (cause: unknown) =>
  cause instanceof Error
    ? cause.message
    : "The form configuration could not be saved.";

const failure = (cause: unknown): FormActionState => ({
  status: "ERROR",
  message: message(cause),
});

function revalidateFormStudio(definitionId?: string) {
  revalidatePath("/form-studio");
  if (definitionId) revalidatePath(`/form-studio/${definitionId}`);
}

export async function createConfigurableForm(data: FormData) {
  await requirePermission(PermissionKey.MANAGE_ORGANIZATION);
  const { organizationId, user } = await getCurrentUserTenant();
  let id = "";
  try {
    const formModule = required(data, "module") as ConfigurableFormModule;
    if (!Object.values(ConfigurableFormModule).includes(formModule)) {
      throw new Error("Select a valid module.");
    }
    const form = await createFormDefinition({
      organizationId,
      userId: user.id,
      name: required(data, "name"),
      description: text(data, "description") || null,
      module: formModule,
    });
    id = form.id;
  } catch (cause) {
    redirect(`/form-studio/new?error=${encodeURIComponent(message(cause))}`);
  }
  redirect(`/form-studio/${id}`);
}

export async function addConfigurableField(data: FormData) {
  await requirePermission(PermissionKey.MANAGE_ORGANIZATION);
  const { organizationId } = await getCurrentUserTenant();
  const definitionId = required(data, "definitionId");
  try {
    const fieldType = required(data, "fieldType") as ConfigurableFieldType;
    if (!Object.values(ConfigurableFieldType).includes(fieldType)) {
      throw new Error("Select a valid field type.");
    }
    await addDraftField({
      organizationId,
      versionId: required(data, "versionId"),
      label: required(data, "label"),
      key: text(data, "key"),
      fieldType,
      description: text(data, "description") || null,
      placeholder: text(data, "placeholder") || null,
      required: data.get("isRequired") === "on",
      options: parseOptionList(text(data, "options")),
      visibilityField: text(data, "visibilityField") || null,
      visibilityValue: text(data, "visibilityValue") || null,
    });
    revalidatePath(`/form-studio/${definitionId}`);
  } catch (cause) {
    redirect(
      `/form-studio/${definitionId}?error=${encodeURIComponent(message(cause))}`,
    );
  }
}

export async function removeConfigurableField(data: FormData) {
  await requirePermission(PermissionKey.MANAGE_ORGANIZATION);
  const { organizationId } = await getCurrentUserTenant();
  const definitionId = required(data, "definitionId");
  try {
    await deleteDraftField({
      organizationId,
      fieldId: required(data, "fieldId"),
    });
    revalidatePath(`/form-studio/${definitionId}`);
  } catch (cause) {
    redirect(
      `/form-studio/${definitionId}?error=${encodeURIComponent(message(cause))}`,
    );
  }
}

export async function publishConfigurableForm(data: FormData) {
  await requirePermission(PermissionKey.MANAGE_ORGANIZATION);
  const { organizationId, user } = await getCurrentUserTenant();
  const definitionId = required(data, "definitionId");
  try {
    await publishFormVersion({
      organizationId,
      versionId: required(data, "versionId"),
      userId: user.id,
    });
    revalidatePath(`/form-studio/${definitionId}`);
  } catch (cause) {
    redirect(
      `/form-studio/${definitionId}?error=${encodeURIComponent(message(cause))}`,
    );
  }
}

export async function reviseConfigurableForm(data: FormData) {
  await requirePermission(PermissionKey.MANAGE_ORGANIZATION);
  const { organizationId, user } = await getCurrentUserTenant();
  const definitionId = required(data, "definitionId");
  try {
    await createDraftRevision({
      organizationId,
      definitionId,
      userId: user.id,
    });
    revalidatePath(`/form-studio/${definitionId}`);
  } catch (cause) {
    redirect(
      `/form-studio/${definitionId}?error=${encodeURIComponent(message(cause))}`,
    );
  }
}

export async function updateConfigurableFormSettings(
  state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void state;
  await requirePermission(PermissionKey.MANAGE_ORGANIZATION);
  const { organizationId, user } = await getCurrentUserTenant();
  const definitionId = text(data, "definitionId");
  try {
    if (!definitionId) throw new Error("Form is required.");
    const formModule = required(data, "module") as ConfigurableFormModule;
    if (!Object.values(ConfigurableFormModule).includes(formModule)) {
      throw new Error("Select a valid module assignment.");
    }
    await updateFormDefinitionSettings({
      organizationId,
      definitionId,
      userId: user.id,
      name: required(data, "name"),
      description: text(data, "description") || null,
      module: formModule,
    });
    revalidateFormStudio(definitionId);
    return { status: "SUCCESS", message: "Form settings updated." };
  } catch (cause) {
    return failure(cause);
  }
}

export async function changeConfigurableFormAssignment(
  state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void state;
  await requirePermission(PermissionKey.MANAGE_ORGANIZATION);
  const { organizationId, user } = await getCurrentUserTenant();
  const definitionId = text(data, "definitionId");
  try {
    if (!definitionId) throw new Error("Form is required.");
    const assignment = required(data, "assignment");
    if (!["ASSIGNED", "UNASSIGNED"].includes(assignment)) {
      throw new Error("Select a valid assignment state.");
    }
    const assigned = assignment === "ASSIGNED";
    await setFormDefinitionAssignment({
      organizationId,
      definitionId,
      userId: user.id,
      assigned,
    });
    revalidateFormStudio(definitionId);
    return {
      status: "SUCCESS",
      message: assigned
        ? "Form assigned to its selected module."
        : "Form unassigned. Historical submissions were preserved.",
    };
  } catch (cause) {
    return failure(cause);
  }
}

export async function deleteConfigurableForm(
  state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  void state;
  await requirePermission(PermissionKey.MANAGE_ORGANIZATION);
  const { organizationId, user } = await getCurrentUserTenant();
  const definitionId = text(data, "definitionId");
  try {
    if (!definitionId) throw new Error("Form is required.");
    await deleteFormDefinition({
      organizationId,
      definitionId,
      userId: user.id,
      confirmation: required(data, "confirmation"),
    });
  } catch (cause) {
    return failure(cause);
  }
  revalidateFormStudio();
  redirect("/form-studio?message=Form%20deleted.");
}
