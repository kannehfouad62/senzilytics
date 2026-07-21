import { MobilePlatform } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateMobileRequest, MobileAuthError } from "@/modules/mobile/mobile-auth.service";
import { disableMobilePushTokenService, registerMobilePushTokenService } from "@/modules/mobile/mobile-push.service";

const schema = z.object({ token: z.string().max(200).regex(/^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/), platform: z.nativeEnum(MobilePlatform) });

export async function POST(request: Request) {
  try { const principal = await authenticateMobileRequest(request); const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success || parsed.data.platform !== principal.session.platform) return NextResponse.json({ error: "invalid_request" }, { status: 400 }); await registerMobilePushTokenService({ organizationId: principal.organization.id, userId: principal.user.id, sessionId: principal.session.id, sessionPlatform: principal.session.platform, ...parsed.data }); return NextResponse.json({ success: true }); }
  catch (error) { return response(error); }
}

export async function DELETE(request: Request) {
  try { const principal = await authenticateMobileRequest(request); await disableMobilePushTokenService({ organizationId: principal.organization.id, userId: principal.user.id, sessionId: principal.session.id }); return NextResponse.json({ success: true }); }
  catch (error) { return response(error); }
}

function response(error: unknown) { if (!(error instanceof MobileAuthError)) console.error("Mobile push-token request failed:", error); return NextResponse.json({ error: error instanceof MobileAuthError ? error.code : "internal_error", errorDescription: error instanceof MobileAuthError ? error.message : "Push registration failed." }, { status: error instanceof MobileAuthError ? error.status : 500, headers: { "cache-control": "no-store" } }); }
