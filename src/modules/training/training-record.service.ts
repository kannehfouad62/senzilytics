import { createNotification } from "@/core/notifications/notifications.service";
import { prisma } from "@/lib/prisma";
import { completeMissingEntityForms } from "@/modules/forms/entity-form-completion.service";
import {
  createPreparedSubmissions,
  type PreparedSubmission,
} from "@/modules/forms/runtime-form.service";
import {
  ActivityAction,
  ConfigurableFormModule,
  NotificationType,
} from "@prisma/client";

export async function assignTrainingService(input: {
  organizationId: string;
  userId: string;
  courseId: string;
  learnerId: string;
  dueDate: Date;
  customSubmissions?: PreparedSubmission[];
}) {
  const [course, learner, assigner] = await Promise.all([
    prisma.trainingCourse.findFirst({
      where: {
        id: input.courseId,
        organizationId: input.organizationId,
        isActive: true,
      },
    }),
    prisma.user.findFirst({
      where: {
        id: input.learnerId,
        organizationId: input.organizationId,
        isActive: true,
      },
    }),
    prisma.user.findFirst({
      where: {
        id: input.userId,
        organizationId: input.organizationId,
      },
    }),
  ]);

  if (!course || !learner || !assigner) {
    throw new Error("Select a valid active course and employee.");
  }

  if (Number.isNaN(input.dueDate.getTime())) {
    throw new Error("Enter a valid due date.");
  }

  const record = await prisma.$transaction(async (tx) => {
    const record = await tx.trainingRecord.create({
      data: {
        courseId: course.id,
        userId: learner.id,
        assignedById: assigner.id,
        courseName: course.name,
        dueDate: input.dueDate,
        provider: course.provider,
      },
    });

    await createPreparedSubmissions(tx, {
      organizationId: input.organizationId,
      userId: input.userId,
      module: ConfigurableFormModule.TRAINING,
      entityId: record.id,
      submissions: input.customSubmissions ?? [],
    });

    await tx.activityLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        action: ActivityAction.ASSIGN,
        entityType: "TrainingRecord",
        entityId: record.id,
        title: "Training assigned",
        description: `${course.name} assigned to ${learner.name}.`,
        metadata: {
          courseId: course.id,
          learnerId: learner.id,
          dueDate: input.dueDate.toISOString(),
          customFormCount: input.customSubmissions?.length ?? 0,
        },
      },
    });

    return record;
  });
  await createNotification({ organizationId: input.organizationId, userId: learner.id, type: NotificationType.ASSIGNMENT, title: "Training assigned", message: `${course.name} is due ${input.dueDate.toLocaleDateString("en-US")}.`, link: `/training/${record.id}` }).catch(() => undefined);
  return record;
}

export async function completeTrainingRecordFormsService(input: {
  organizationId: string;
  userId: string;
  trainingRecordId: string;
  submissions: PreparedSubmission[];
}) {
  const record = await prisma.trainingRecord.findFirst({
    where: {
      id: input.trainingRecordId,
      user: { organizationId: input.organizationId },
    },
    select: { id: true },
  });

  if (!record) {
    throw new Error("Training assignment not found in this organization.");
  }

  await completeMissingEntityForms({
    organizationId: input.organizationId,
    userId: input.userId,
    module: ConfigurableFormModule.TRAINING,
    entityId: record.id,
    activityEntityType: "TrainingRecord",
    activityTitle: "Training forms captured",
    formLabel: "training",
    submissions: input.submissions,
  });
}
