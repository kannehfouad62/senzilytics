"use server";

import type { FormActionState } from "@/core/actions/action-state";
import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  addContractorSiteService,
  addContractorWorkerService,
  completeContractorFormsService,
  createContractorService,
  updateContractorStatusService,
} from "@/modules/contractors/contractor.service";
import { preparePublishedFormSubmissions } from "@/modules/forms/runtime-form.service";
import {
  ConfigurableFormModule,
  ContractorStatus,
  ContractorWorkerStatus,
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
    throw new Error(`${key} must be a valid date.`);
  }

  return value;
};

const errorState = (error: unknown, fallback: string): FormActionState => ({
  status: "ERROR",
  message: error instanceof Error ? error.message : fallback,
});

export async function createContractor(
  _state: FormActionState,
  data: FormData
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_CONTRACTORS);
  const { organizationId, user } = await getCurrentUserTenant();
  let contractorId: string;

  try {
    const rawRating = optional(data, "safetyRating");
    const customSubmissions = await preparePublishedFormSubmissions({
      organizationId,
      module: ConfigurableFormModule.CONTRACTOR,
      data,
    });
    const contractor = await createContractorService({
      organizationId,
      userId: user.id,
      name: required(data, "name"),
      legalName: optional(data, "legalName"),
      registrationNumber: optional(data, "registrationNumber"),
      taxIdentifier: optional(data, "taxIdentifier"),
      primaryContactName: optional(data, "primaryContactName"),
      primaryContactEmail: optional(data, "primaryContactEmail"),
      primaryContactPhone: optional(data, "primaryContactPhone"),
      services: optional(data, "services"),
      safetyProgramSummary: optional(data, "safetyProgramSummary"),
      insuranceProvider: optional(data, "insuranceProvider"),
      insurancePolicyNumber: optional(data, "insurancePolicyNumber"),
      insuranceExpiresAt: optionalDate(data, "insuranceExpiresAt"),
      safetyRating: rawRating ? Number(rawRating) : null,
      notes: optional(data, "notes"),
      siteIds: data.getAll("siteIds").map(String).filter(Boolean),
      customSubmissions,
    });
    contractorId = contractor.id;
  } catch (error) {
    return errorState(error, "The contractor could not be registered.");
  }

  redirect(`/contractors/${contractorId}`);
}

export async function updateContractorStatus(
  _state: FormActionState,
  data: FormData
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_CONTRACTORS);
  const { organizationId, user } = await getCurrentUserTenant();
  const contractorId = required(data, "contractorId");

  try {
    const status = required(data, "status") as ContractorStatus;

    if (!Object.values(ContractorStatus).includes(status)) {
      throw new Error("Select a valid contractor status.");
    }

    await updateContractorStatusService({
      organizationId,
      userId: user.id,
      contractorId,
      status,
      reason: optional(data, "reason"),
    });
  } catch (error) {
    return errorState(error, "The contractor status could not be updated.");
  }

  revalidatePath(`/contractors/${contractorId}`);
  revalidatePath("/contractors");
  return { status: "SUCCESS", message: "Contractor status updated." };
}

export async function addContractorSite(
  _state: FormActionState,
  data: FormData
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_CONTRACTORS);
  const { organizationId, user } = await getCurrentUserTenant();
  const contractorId = required(data, "contractorId");

  try {
    await addContractorSiteService({
      organizationId,
      userId: user.id,
      contractorId,
      siteId: required(data, "siteId"),
      expiresAt: optionalDate(data, "expiresAt"),
      notes: optional(data, "notes"),
    });
  } catch (error) {
    return errorState(error, "The site authorization could not be saved.");
  }

  revalidatePath(`/contractors/${contractorId}`);
  return { status: "SUCCESS", message: "Site authorization saved." };
}

export async function addContractorWorker(
  _state: FormActionState,
  data: FormData
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_CONTRACTORS);
  const { organizationId, user } = await getCurrentUserTenant();
  const contractorId = required(data, "contractorId");

  try {
    const status = required(data, "status") as ContractorWorkerStatus;

    if (!Object.values(ContractorWorkerStatus).includes(status)) {
      throw new Error("Select a valid worker status.");
    }

    await addContractorWorkerService({
      organizationId,
      userId: user.id,
      contractorId,
      firstName: required(data, "firstName"),
      lastName: required(data, "lastName"),
      employeeNumber: optional(data, "employeeNumber"),
      email: optional(data, "email"),
      phone: optional(data, "phone"),
      jobTitle: optional(data, "jobTitle"),
      status,
      inductionCompletedAt: optionalDate(data, "inductionCompletedAt"),
      inductionExpiresAt: optionalDate(data, "inductionExpiresAt"),
      medicalExpiresAt: optionalDate(data, "medicalExpiresAt"),
      competencySummary: optional(data, "competencySummary"),
      notes: optional(data, "notes"),
    });
  } catch (error) {
    return errorState(error, "The contractor worker could not be added.");
  }

  revalidatePath(`/contractors/${contractorId}`);
  return { status: "SUCCESS", message: "Contractor worker added." };
}

export async function completeContractorForms(
  _state: FormActionState,
  data: FormData
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_CONTRACTORS);
  const { organizationId, user } = await getCurrentUserTenant();
  const contractorId = required(data, "contractorId");

  try {
    const submissions = await preparePublishedFormSubmissions({
      organizationId,
      module: ConfigurableFormModule.CONTRACTOR,
      data,
    });
    await completeContractorFormsService({
      organizationId,
      userId: user.id,
      contractorId,
      submissions,
    });
  } catch (error) {
    return errorState(error, "The contractor forms could not be saved.");
  }

  revalidatePath(`/contractors/${contractorId}`);
  return { status: "SUCCESS", message: "Contractor forms captured." };
}
