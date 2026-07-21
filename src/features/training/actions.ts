"use server";

import type { FormActionState } from "@/core/actions/action-state";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { preparePublishedFormSubmissions } from "@/modules/forms/runtime-form.service";
import {
  assignTrainingService,
  completeTrainingRecordFormsService,
} from "@/modules/training/training-record.service";
import { completeTrainingWithCompetenciesService } from "@/modules/training/competency.service";
import {
  ConfigurableFormModule,
  PermissionKey,
  UserRole,
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

export async function createTrainingCourse(data: FormData) {
  await requirePermission(PermissionKey.MANAGE_TRAINING);
  const { organizationId, user } = await getCurrentUserTenant();
  const validity = optional(data, "validityMonths");

  await prisma.trainingCourse.create({
    data: {
      organizationId,
      createdById: user.id,
      code: required(data, "code").toUpperCase(),
      name: required(data, "name"),
      description: optional(data, "description"),
      provider: optional(data, "provider"),
      validityMonths: validity ? Number(validity) : null,
    },
  });

  redirect("/training/courses");
}

export async function assignTraining(
  _previousState: FormActionState,
  data: FormData
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_TRAINING);
  const { organizationId, user } = await getCurrentUserTenant();
  let recordId: string;

  try {
    const dueDate = new Date(required(data, "dueDate"));
    const customSubmissions = await preparePublishedFormSubmissions({
      organizationId,
      module: ConfigurableFormModule.TRAINING,
      data,
    });
    const record = await assignTrainingService({
      organizationId,
      userId: user.id,
      courseId: required(data, "courseId"),
      learnerId: required(data, "userId"),
      dueDate,
      customSubmissions,
    });

    recordId = record.id;
  } catch (error) {
    return {
      status: "ERROR",
      message:
        error instanceof Error
          ? error.message
          : "The training assignment could not be created.",
    };
  }

  redirect(`/training/${recordId}`);
}

export async function completeTrainingRecordForms(
  _previousState: FormActionState,
  data: FormData
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_TRAINING);
  const { organizationId, user } = await getCurrentUserTenant();
  const trainingRecordId = required(data, "trainingRecordId");

  try {
    const submissions = await preparePublishedFormSubmissions({
      organizationId,
      module: ConfigurableFormModule.TRAINING,
      data,
    });
    await completeTrainingRecordFormsService({
      organizationId,
      userId: user.id,
      trainingRecordId,
      submissions,
    });
  } catch (error) {
    return {
      status: "ERROR",
      message:
        error instanceof Error
          ? error.message
          : "The training forms could not be saved.",
    };
  }

  revalidatePath(`/training/${trainingRecordId}`);
  return {
    status: "SUCCESS",
    message: "Training forms captured successfully.",
  };
}

export async function completeTraining(
  _previousState: FormActionState,
  data: FormData
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_TRAINING);
  const { organizationId, user } = await getCurrentUserTenant();
  const id = required(data, "id");
  try {
    const rawScore = optional(data, "score");
    const completedAt = new Date(required(data, "completedAt"));
    if (Number.isNaN(completedAt.getTime())) throw new Error("Enter a valid completion date.");
    await completeTrainingWithCompetenciesService({ organizationId, userId: user.id, recordId: id, completedAt, certificateNumber: optional(data, "certificateNumber"), score: rawScore ? Number(rawScore) : null, notes: optional(data, "notes") });
  } catch (cause) {
    return { status: "ERROR", message: cause instanceof Error ? cause.message : "The training completion could not be recorded." };
  }

  revalidatePath("/training");
  revalidatePath(`/training/${id}`);
  revalidatePath("/training/competencies/matrix");
  revalidatePath("/training/dashboard");
  return { status: "SUCCESS", message: "Training completion and mapped competencies recorded." };
}

export async function createTrainingRequirement(data: FormData) {
  await requirePermission(PermissionKey.MANAGE_TRAINING);
  const { organizationId } = await getCurrentUserTenant();
  const courseId = required(data, "courseId");
  const role = optional(data, "role") as UserRole | null;
  const siteId = optional(data, "siteId");
  const departmentId = optional(data, "departmentId");
  const course = await prisma.trainingCourse.findFirst({
    where: { id: courseId, organizationId, isActive: true },
  });

  if (!course) {
    throw new Error("Select a valid course.");
  }

  if (role && !Object.values(UserRole).includes(role)) {
    throw new Error("Select a valid role.");
  }

  if (
    siteId &&
    !(await prisma.site.findFirst({ where: { id: siteId, organizationId } }))
  ) {
    throw new Error("Select a valid site.");
  }

  if (
    departmentId &&
    !(await prisma.department.findFirst({
      where: { id: departmentId, site: { organizationId } },
    }))
  ) {
    throw new Error("Select a valid department.");
  }

  await prisma.trainingRequirement.create({
    data: {
      organizationId,
      courseId,
      role,
      siteId,
      departmentId,
      dueWithinDays: Number(required(data, "dueWithinDays")),
      renewalLeadDays: Number(required(data, "renewalLeadDays")),
    },
  });

  redirect("/training/requirements");
}
