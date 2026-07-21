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
  return prisma.$transaction(async (tx) => {
    const notification = await tx.notification.create({ data: {
      organizationId: input.organizationId,
      userId: input.userId,
      type: input.type ?? NotificationType.INFO,
      title: input.title,
      message: input.message,
      link: input.link,
    } });
    if (planEntitlements[organization.subscriptionPlan].MOBILE_APPS) {
      const tokens = await tx.mobilePushToken.findMany({ where: { organizationId: input.organizationId, userId: input.userId, enabled: true, session: { status: "ACTIVE", expiresAt: { gt: new Date() } } }, select: { id: true } });
      if (tokens.length) await tx.mobilePushDelivery.createMany({ data: tokens.map((token) => ({ organizationId: input.organizationId, userId: input.userId, pushTokenId: token.id, notificationId: notification.id, payload: { notificationId: notification.id, link: input.link ?? "/notifications", type: input.type ?? NotificationType.INFO } })), skipDuplicates: true });
    }
    return notification;
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
