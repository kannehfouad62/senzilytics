"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { redirect } from "next/navigation";

export async function markNotificationRead(formData: FormData) {
  const { user } = await getCurrentUserTenant();

  const notificationId = String(formData.get("notificationId"));
  const link = String(formData.get("link") || "/notifications");

  await prisma.notification.updateMany({
    where: {
      id: notificationId,
      userId: user.id,
    },
    data: {
      readAt: new Date(),
    },
  });

  redirect(link);
}