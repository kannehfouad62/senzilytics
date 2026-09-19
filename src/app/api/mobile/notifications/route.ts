import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticateMobileRequest, MobileAuthError } from "@/modules/mobile/mobile-auth.service";
import { getMobileAssignedPermissions } from "@/modules/mobile/mobile-executive.service";
import { canOpenMobileNotificationDestination } from "@/modules/mobile/mobile-notification-destination.service";

const notificationIdSchema = z.string().min(1).max(100);

export async function GET(request: Request) {
  try {
    const { user, organization } = await authenticateMobileRequest(request);
    const notificationId = new URL(request.url).searchParams.get("notificationId");
    if (notificationId !== null) {
      const parsed = notificationIdSchema.safeParse(notificationId);
      if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
      const notification = await prisma.notification.findFirst({
        where: { id: parsed.data, organizationId: organization.id, userId: user.id },
        select: { id: true, type: true, title: true, message: true, link: true, readAt: true, createdAt: true },
      });
      if (!notification) return NextResponse.json({ error: "notification_unavailable", errorDescription: "This notification is no longer available for this account." }, { status: 404, headers: { "cache-control": "no-store" } });
      const permissions = await getMobileAssignedPermissions(user.role);
      const destinationAvailable = await canOpenMobileNotificationDestination({
        link: notification.link,
        organizationId: organization.id,
        userId: user.id,
        permissions,
      });
      if (!destinationAvailable) return NextResponse.json({ error: "notification_destination_unavailable", errorDescription: "This record is no longer available or you no longer have permission to open it." }, { status: 404, headers: { "cache-control": "no-store" } });
      return NextResponse.json({ notification }, { headers: { "cache-control": "no-store" } });
    }
    const notifications = await prisma.notification.findMany({ where: { organizationId: organization.id, userId: user.id }, select: { id: true, type: true, title: true, message: true, link: true, readAt: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 100 });
    return NextResponse.json({ notifications }, { headers: { "cache-control": "no-store" } });
  } catch (error) { return authError(error); }
}

export async function PATCH(request: Request) {
  try { const { user, organization } = await authenticateMobileRequest(request); const parsed = z.object({ notificationId: notificationIdSchema }).safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 }); const updated = await prisma.notification.updateMany({ where: { id: parsed.data.notificationId, organizationId: organization.id, userId: user.id }, data: { readAt: new Date() } }); return NextResponse.json({ success: updated.count === 1 }); }
  catch (error) { return authError(error); }
}

function authError(error: unknown) { if (!(error instanceof MobileAuthError)) console.error("Mobile notification request failed:", error); return NextResponse.json({ error: error instanceof MobileAuthError ? error.code : "internal_error", errorDescription: error instanceof MobileAuthError ? error.message : "Notification request failed." }, { status: error instanceof MobileAuthError ? error.status : 500, headers: { "cache-control": "no-store" } }); }
