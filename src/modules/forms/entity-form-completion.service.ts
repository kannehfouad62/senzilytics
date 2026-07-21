import { prisma } from "@/lib/prisma";
import {
  createPreparedSubmissions,
  type PreparedSubmission,
} from "@/modules/forms/runtime-form.service";
import {
  ActivityAction,
  ConfigurableFormModule,
} from "@prisma/client";

export async function completeMissingEntityForms(input: {
  organizationId: string;
  userId: string;
  module: ConfigurableFormModule;
  entityId: string;
  activityEntityType: string;
  activityTitle: string;
  formLabel: string;
  submissions: PreparedSubmission[];
}) {
  const existing = await prisma.configurableFormSubmission.findMany({
    where: {
      organizationId: input.organizationId,
      entityType: input.module,
      entityId: input.entityId,
    },
    select: { definitionId: true },
  });
  const capturedDefinitionIds = new Set(
    existing.map((submission) => submission.definitionId)
  );
  const missing = input.submissions.filter(
    (submission) => !capturedDefinitionIds.has(submission.definitionId)
  );

  if (missing.length === 0) {
    throw new Error(
      `All published ${input.formLabel} forms have already been captured.`
    );
  }

  await prisma.$transaction(async (tx) => {
    await createPreparedSubmissions(tx, {
      organizationId: input.organizationId,
      userId: input.userId,
      module: input.module,
      entityId: input.entityId,
      submissions: missing,
    });

    await tx.activityLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        action: ActivityAction.UPDATE,
        entityType: input.activityEntityType,
        entityId: input.entityId,
        title: input.activityTitle,
        description: `${missing.length} tenant form${
          missing.length === 1 ? "" : "s"
        } completed.`,
        metadata: { formCount: missing.length },
      },
    });
  });
}
