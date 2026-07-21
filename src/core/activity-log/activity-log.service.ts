import { ActivityAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { enqueueActivityWebhooks } from "@/modules/integrations/webhook-delivery.service";

type LogActivityInput = {
  organizationId: string;
  userId?: string | null;
  action: ActivityAction;
  entityType: string;
  entityId?: string | null;
  title: string;
  description?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export async function logActivity(input: LogActivityInput) {
  const activity = await prisma.activityLog.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      title: input.title,
      description: input.description,
      metadata: input.metadata ?? Prisma.JsonNull,
    },
  });

  try {
    await enqueueActivityWebhooks(activity);
  } catch (error) {
    console.error("Webhook enqueue failed:", error);
  }

  return activity;
}
