import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticateMobileRequest, MobileAuthError } from "@/modules/mobile/mobile-auth.service";

export async function GET(request: Request) {
  try { const { user, organization } = await authenticateMobileRequest(request); const notifications = await prisma.notification.findMany({ where: { organizationId: organization.id, userId: user.id }, select: { id: true, type: true, title: true, message: true, link: true, readAt: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 100 }); return NextResponse.json({ notifications }, { headers: { "cache-control": "no-store" } }); }
  catch (error) { return authError(error); }
}

export async function PATCH(request: Request) {
  try { const { user, organization } = await authenticateMobileRequest(request); const parsed = z.object({ notificationId: z.string().min(1).max(100) }).safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 }); const updated = await prisma.notification.updateMany({ where: { id: parsed.data.notificationId, organizationId: organization.id, userId: user.id }, data: { readAt: new Date() } }); return NextResponse.json({ success: updated.count === 1 }); }
  catch (error) { return authError(error); }
}

function authError(error: unknown) { if (!(error instanceof MobileAuthError)) console.error("Mobile notification request failed:", error); return NextResponse.json({ error: error instanceof MobileAuthError ? error.code : "internal_error", errorDescription: error instanceof MobileAuthError ? error.message : "Notification request failed." }, { status: error instanceof MobileAuthError ? error.status : 500, headers: { "cache-control": "no-store" } }); }
