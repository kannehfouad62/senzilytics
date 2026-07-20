"use server";

import type { FormActionState } from "@/core/actions/action-state";
import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  completeCapaFormsService,
  createStandaloneCapaService,
  updateCapaStatusService,
} from "@/modules/capa/capa.service";
import { preparePublishedFormSubmissions } from "@/modules/forms/runtime-form.service";
import {
  ConfigurableFormModule,
  PermissionKey,
  RiskLevel,
  Status,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function required(
  data: FormData,
  key: string
) {
  const value = String(
    data.get(key) || ""
  ).trim();

  if (!value) {
    throw new Error(
      `${key} is required.`
    );
  }

  return value;
}

function optional(
  data: FormData,
  key: string
) {
  return (
    String(
      data.get(key) || ""
    ).trim() || null
  );
}

function requiredDate(
  data: FormData,
  key: string
) {
  const value = new Date(
    required(data, key)
  );

  if (
    Number.isNaN(
      value.getTime()
    )
  ) {
    throw new Error(
      `${key} must be a valid date.`
    );
  }

  return value;
}

function enumValue<
  T extends Record<string, string>,
>(
  values: T,
  value: string,
  message: string
) {
  if (
    !Object.values(values).includes(
      value as T[keyof T]
    )
  ) {
    throw new Error(message);
  }

  return value as T[keyof T];
}

export async function createStandaloneCapa(
  _previousState: FormActionState,
  data: FormData
): Promise<FormActionState> {
  await requirePermission(
    PermissionKey.CREATE_CAPA
  );

  const { organizationId, user } =
    await getCurrentUserTenant();

  let actionId: string;

  try {
    const customSubmissions =
      await preparePublishedFormSubmissions({
        organizationId,
        module:
          ConfigurableFormModule.CAPA,
        data,
      });

    const action =
      await createStandaloneCapaService({
        organizationId,
        userId: user.id,
        title: required(
          data,
          "title"
        ),
        description: optional(
          data,
          "description"
        ),
        riskLevel: enumValue(
          RiskLevel,
          required(
            data,
            "riskLevel"
          ),
          "Select a valid risk level."
        ),
        dueDate: requiredDate(
          data,
          "dueDate"
        ),
        assignedToId: required(
          data,
          "assignedToId"
        ),
        customSubmissions,
      });

    actionId = action.id;
  } catch (error) {
    return {
      status: "ERROR",
      message:
        error instanceof Error
          ? error.message
          : "The corrective action could not be created.",
    };
  }

  redirect(`/actions/${actionId}`);
}

export async function updateCapaStatus(
  _previousState: FormActionState,
  data: FormData
): Promise<FormActionState> {
  const status = enumValue(
    Status,
    required(data, "status"),
    "Select a valid status."
  );

  await requirePermission(
    status === Status.COMPLETED ||
      status === Status.CLOSED
      ? PermissionKey.CLOSE_CAPA
      : PermissionKey.UPDATE_CAPA
  );

  const { organizationId, user } =
    await getCurrentUserTenant();
  const actionId = required(
    data,
    "actionId"
  );

  try {
    await updateCapaStatusService({
      organizationId,
      userId: user.id,
      actionId,
      status,
    });
  } catch (error) {
    return {
      status: "ERROR",
      message:
        error instanceof Error
          ? error.message
          : "The corrective-action status could not be updated.",
    };
  }

  revalidatePath(
    `/actions/${actionId}`
  );
  revalidatePath("/actions");
  revalidatePath("/capa");

  return {
    status: "SUCCESS",
    message:
      "Corrective-action status updated.",
  };
}

export async function completeCapaForms(
  _previousState: FormActionState,
  data: FormData
): Promise<FormActionState> {
  await requirePermission(
    PermissionKey.UPDATE_CAPA
  );

  const { organizationId, user } =
    await getCurrentUserTenant();
  const actionId = required(
    data,
    "actionId"
  );

  try {
    const submissions =
      await preparePublishedFormSubmissions({
        organizationId,
        module:
          ConfigurableFormModule.CAPA,
        data,
      });

    await completeCapaFormsService({
      organizationId,
      userId: user.id,
      actionId,
      submissions,
    });
  } catch (error) {
    return {
      status: "ERROR",
      message:
        error instanceof Error
          ? error.message
          : "The CAPA forms could not be saved.",
    };
  }

  revalidatePath(
    `/actions/${actionId}`
  );

  return {
    status: "SUCCESS",
    message:
      "CAPA forms captured successfully.",
  };
}
