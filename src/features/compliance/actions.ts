"use server";

import type { FormActionState } from "@/core/actions/action-state";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  completeComplianceFormsService,
  createComplianceObligationService,
} from "@/modules/compliance/compliance.service";
import { nextComplianceDueDate } from "@/modules/compliance/compliance-recurrence";
import { preparePublishedFormSubmissions } from "@/modules/forms/runtime-form.service";
import {
  ComplianceObligationType,
  ComplianceRecurrence,
  ConfigurableFormModule,
  PermissionKey,
  PermitStatus,
  Status,
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

function enumValue<T extends Record<string, string>>(
  values: T,
  value: string,
  message: string
) {
  if (!Object.values(values).includes(value as T[keyof T])) {
    throw new Error(message);
  }

  return value as T[keyof T];
}

export async function createComplianceObligation(
  _previousState: FormActionState,
  data: FormData
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_COMPLIANCE);
  const { organizationId, user } = await getCurrentUserTenant();
  let itemId: string;

  try {
    const dueDate = optionalDate(data, "dueDate");

    if (!dueDate) {
      throw new Error("dueDate is required.");
    }

    const intervalValue = Number(required(data, "intervalValue"));
    const customSubmissions = await preparePublishedFormSubmissions({
      organizationId,
      module: ConfigurableFormModule.COMPLIANCE,
      data,
    });
    const item = await createComplianceObligationService({
      organizationId,
      userId: user.id,
      siteId: required(data, "siteId"),
      ownerId: optional(data, "ownerId"),
      title: required(data, "title"),
      description: optional(data, "description"),
      reference: optional(data, "reference"),
      obligationType: enumValue(
        ComplianceObligationType,
        required(data, "obligationType"),
        "Select a valid obligation type."
      ),
      authority: optional(data, "authority"),
      jurisdiction: optional(data, "jurisdiction"),
      legalReference: optional(data, "legalReference"),
      applicability: optional(data, "applicability"),
      recurrence: enumValue(
        ComplianceRecurrence,
        required(data, "recurrence"),
        "Select a valid recurrence."
      ),
      intervalValue,
      evidenceRequired: optional(data, "evidenceRequired"),
      dueDate,
      customSubmissions,
    });

    itemId = item.id;
  } catch (error) {
    return {
      status: "ERROR",
      message:
        error instanceof Error
          ? error.message
          : "The compliance obligation could not be created.",
    };
  }

  redirect(`/compliance/${itemId}`);
}

export async function completeComplianceForms(
  _previousState: FormActionState,
  data: FormData
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_COMPLIANCE);
  const { organizationId, user } = await getCurrentUserTenant();
  const complianceItemId = required(data, "complianceItemId");

  try {
    const submissions = await preparePublishedFormSubmissions({
      organizationId,
      module: ConfigurableFormModule.COMPLIANCE,
      data,
    });

    await completeComplianceFormsService({
      organizationId,
      userId: user.id,
      complianceItemId,
      submissions,
    });
  } catch (error) {
    return {
      status: "ERROR",
      message:
        error instanceof Error
          ? error.message
          : "The compliance forms could not be saved.",
    };
  }

  revalidatePath(`/compliance/${complianceItemId}`);

  return {
    status: "SUCCESS",
    message: "Compliance forms captured successfully.",
  };
}

export async function createPermit(data: FormData) {
  await requirePermission(PermissionKey.MANAGE_COMPLIANCE);
  const { organizationId } = await getCurrentUserTenant();
  const siteId = required(data, "siteId");
  const ownerId = optional(data, "ownerId");

  if (
    !(await prisma.site.findFirst({
      where: { id: siteId, organizationId },
    }))
  ) {
    throw new Error("Select a valid site.");
  }

  if (
    ownerId &&
    !(await prisma.user.findFirst({
      where: { id: ownerId, organizationId },
    }))
  ) {
    throw new Error("Select a valid owner.");
  }

  const status = enumValue(
    PermitStatus,
    required(data, "status"),
    "Select a valid permit status."
  );

  await prisma.permit.create({
    data: {
      organizationId,
      siteId,
      ownerId,
      number: required(data, "number"),
      name: required(data, "name"),
      description: optional(data, "description"),
      authority: optional(data, "authority"),
      permitType: optional(data, "permitType"),
      status,
      effectiveDate: optionalDate(data, "effectiveDate"),
      expirationDate: optionalDate(data, "expirationDate"),
      renewalDueDate: optionalDate(data, "renewalDueDate"),
      conditions: optional(data, "conditions"),
      limits: optional(data, "limits"),
      reportingRequirements: optional(data, "reportingRequirements"),
    },
  });

  redirect("/compliance/permits");
}

export async function evaluateComplianceObligation(data: FormData) {
  await requirePermission(PermissionKey.MANAGE_COMPLIANCE);
  const { organizationId, user } = await getCurrentUserTenant();
  const id = required(data, "id");
  const item = await prisma.complianceItem.findFirst({
    where: {
      id,
      site: { organizationId },
    },
  });

  if (!item) {
    throw new Error("Compliance obligation not found.");
  }

  const isCompliant = required(data, "result") === "COMPLIANT";
  const nextDueDate = isCompliant
    ? nextComplianceDueDate(
        item.dueDate,
        item.recurrence,
        item.intervalValue
      )
    : null;

  await prisma.$transaction([
    prisma.complianceEvaluation.create({
      data: {
        complianceItemId: id,
        evaluatedById: user.id,
        isCompliant,
        findings: optional(data, "findings"),
        evidenceSummary: optional(data, "evidenceSummary"),
        nextDueDate,
      },
    }),
    prisma.complianceItem.update({
      where: { id },
      data: {
        status: isCompliant
          ? nextDueDate
            ? Status.OPEN
            : Status.COMPLETED
          : Status.IN_PROGRESS,
        completedAt: isCompliant && !nextDueDate ? new Date() : null,
        lastEvaluatedAt: new Date(),
        evaluationNotes: optional(data, "findings"),
        dueDate: nextDueDate ?? item.dueDate,
        reminderSentAt: nextDueDate ? null : item.reminderSentAt,
        overdueNotifiedAt: nextDueDate ? null : item.overdueNotifiedAt,
      },
    }),
  ]);

  revalidatePath(`/compliance/${id}`);
  revalidatePath("/compliance");
}
