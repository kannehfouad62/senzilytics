import { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { planEntitlements } from "@/lib/subscription";

type CreateNotificationInput = {
  organizationId: string;
  userId: string;
  type?: NotificationType;
  title: string;
  message: string;
  link?: string | null;
};

export async function createNotification(input: CreateNotificationInput) {
  const organization = await prisma.organization.findUnique({ where: { id: input.organizationId }, select: { subscriptionPlan: true } });
  if (!organization || !planEntitlements[organization.subscriptionPlan].IN_APP_NOTIFICATIONS) return null;
  return prisma.notification.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      type: input.type ?? NotificationType.INFO,
      title: input.title,
      message: input.message,
      link: input.link,
    },
  });
}

export async function getUnreadNotificationCount(userId: string) {
  return prisma.notification.count({
    where: {
      userId,
      readAt: null,
    },
  });
}

export async function markNotificationAsRead(notificationId: string, userId: string) {
  return prisma.notification.updateMany({
    where: {
      id: notificationId,
      userId,
    },
    data: {
      readAt: new Date(),
    },
  });
}
