"use server";

import type { FormActionState } from "@/core/actions/action-state";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  completeChemicalFormsService,
  createChemicalService,
} from "@/modules/chemicals/chemical-governance.service";
import { preparePublishedFormSubmissions } from "@/modules/forms/runtime-form.service";
import {
  ChemicalApprovalStatus,
  ChemicalSignalWord,
  ConfigurableFormModule,
  PermissionKey,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const required = (data: FormData, key: string) => {
  const value = String(data.get(key) || "").trim();

  if (!value) {
    throw new Error(`${key} is required.`);
  }

  return value;
};

const optional = (data: FormData, key: string) =>
  String(data.get(key) || "").trim() || null;

const optionalDate = (data: FormData, key: string) => {
  const raw = optional(data, key);

  if (!raw) {
    return null;
  }

  const value = new Date(raw);

  if (Number.isNaN(value.getTime())) {
    throw new Error(`Enter a valid ${key}.`);
  }

  return value;
};

export async function createChemical(
  _previousState: FormActionState,
  data: FormData
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_CHEMICALS);
  const { organizationId, user } = await getCurrentUserTenant();
  let chemicalId: string;

  try {
    const signalWord = required(data, "signalWord") as ChemicalSignalWord;

    if (!Object.values(ChemicalSignalWord).includes(signalWord)) {
      throw new Error("Select a valid signal word.");
    }

    const customSubmissions = await preparePublishedFormSubmissions({
      organizationId,
      module: ConfigurableFormModule.CHEMICAL,
      data,
    });
    const chemical = await createChemicalService({
      organizationId,
      userId: user.id,
      productName: required(data, "productName"),
      productCode: optional(data, "productCode"),
      manufacturer: optional(data, "manufacturer"),
      supplier: optional(data, "supplier"),
      casNumber: optional(data, "casNumber"),
      description: optional(data, "description"),
      signalWord,
      hazardClassifications: optional(data, "hazardClassifications"),
      pictograms: optional(data, "pictograms"),
      exposureLimits: optional(data, "exposureLimits"),
      requiredPpe: optional(data, "requiredPpe"),
      firstAidMeasures: optional(data, "firstAidMeasures"),
      spillResponse: optional(data, "spillResponse"),
      storageRequirements: optional(data, "storageRequirements"),
      incompatibilities: optional(data, "incompatibilities"),
      sdsRevisionDate: optionalDate(data, "sdsRevisionDate"),
      sdsReviewDueDate: optionalDate(data, "sdsReviewDueDate"),
      customSubmissions,
    });

    chemicalId = chemical.id;
  } catch (error) {
    return {
      status: "ERROR",
      message:
        error instanceof Error
          ? error.message
          : "The chemical product could not be created.",
    };
  }

  redirect(`/chemicals/${chemicalId}`);
}

export async function completeChemicalForms(
  _previousState: FormActionState,
  data: FormData
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_CHEMICALS);
  const { organizationId, user } = await getCurrentUserTenant();
  const chemicalId = required(data, "chemicalId");

  try {
    const submissions = await preparePublishedFormSubmissions({
      organizationId,
      module: ConfigurableFormModule.CHEMICAL,
      data,
    });
    await completeChemicalFormsService({
      organizationId,
      userId: user.id,
      chemicalId,
      submissions,
    });
  } catch (error) {
    return {
      status: "ERROR",
      message:
        error instanceof Error
          ? error.message
          : "The chemical forms could not be saved.",
    };
  }

  revalidatePath(`/chemicals/${chemicalId}`);
  return {
    status: "SUCCESS",
    message: "Chemical forms captured successfully.",
  };
}

export async function addChemicalInventory(data: FormData) {
  await requirePermission(PermissionKey.MANAGE_CHEMICALS);
  const { organizationId } = await getCurrentUserTenant();
  const chemicalId = required(data, "chemicalId");
  const siteId = required(data, "siteId");
  const [chemical, site] = await Promise.all([
    prisma.chemical.findFirst({ where: { id: chemicalId, organizationId } }),
    prisma.site.findFirst({ where: { id: siteId, organizationId } }),
  ]);

  if (!chemical || !site) {
    throw new Error("Select a valid chemical and site.");
  }

  const quantity = Number(required(data, "quantity"));
  const rawMaximum = optional(data, "maximumAllowed");
  const maximumAllowed = rawMaximum ? Number(rawMaximum) : null;

  if (
    !Number.isFinite(quantity) ||
    (maximumAllowed !== null && !Number.isFinite(maximumAllowed))
  ) {
    throw new Error("Enter valid inventory quantities.");
  }

  const storageLocation = required(data, "storageLocation");
  await prisma.chemicalInventory.upsert({
    where: {
      chemicalId_siteId_storageLocation: {
        chemicalId,
        siteId,
        storageLocation,
      },
    },
    update: {
      quantity,
      unit: required(data, "unit"),
      maximumAllowed,
      containerType: optional(data, "containerType"),
      storageNotes: optional(data, "storageNotes"),
      inventoriedAt: new Date(),
    },
    create: {
      chemicalId,
      siteId,
      storageLocation,
      quantity,
      unit: required(data, "unit"),
      maximumAllowed,
      containerType: optional(data, "containerType"),
      storageNotes: optional(data, "storageNotes"),
    },
  });

  revalidatePath(`/chemicals/${chemicalId}`);
}

export async function reviewChemical(data: FormData) {
  await requirePermission(PermissionKey.MANAGE_CHEMICALS);
  const { organizationId, user } = await getCurrentUserTenant();
  const id = required(data, "id");
  const status = required(data, "status") as ChemicalApprovalStatus;

  if (!Object.values(ChemicalApprovalStatus).includes(status)) {
    throw new Error("Select a valid approval status.");
  }

  const result = await prisma.chemical.updateMany({
    where: { id, organizationId },
    data: { status, reviewedById: user.id, reviewedAt: new Date() },
  });

  if (!result.count) {
    throw new Error("Chemical not found.");
  }

  revalidatePath(`/chemicals/${id}`);
}
