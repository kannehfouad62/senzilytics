import { MobilePlatform } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { exchangeMobileAuthorizationCodeService, MobileAuthError, refreshMobileSessionService } from "@/modules/mobile/mobile-auth.service";

const authorization = z.object({ grantType: z.literal("authorization_code"), code: z.string(), codeVerifier: z.string(), deviceId: z.string(), deviceName: z.string(), platform: z.nativeEnum(MobilePlatform) });
const refresh = z.object({ grantType: z.literal("refresh_token"), refreshToken: z.string() });
const schema = z.discriminatedUnion("grantType", [authorization, refresh]);

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new MobileAuthError("Mobile token request is invalid.", 400, "invalid_request");
    const result = parsed.data.grantType === "authorization_code" ? await exchangeMobileAuthorizationCodeService(parsed.data) : await refreshMobileSessionService(parsed.data.refreshToken);
    return NextResponse.json(result, { headers: { "cache-control": "no-store", pragma: "no-cache" } });
  } catch (error) { const status = error instanceof MobileAuthError ? error.status : 500; if (!(error instanceof MobileAuthError)) console.error("Mobile token exchange failed:", error); return NextResponse.json({ error: error instanceof MobileAuthError ? error.code : "internal_error", errorDescription: error instanceof MobileAuthError ? error.message : "Mobile token request could not be completed." }, { status, headers: { "cache-control": "no-store" } }); }
}
