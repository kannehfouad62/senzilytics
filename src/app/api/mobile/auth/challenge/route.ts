import { NextResponse } from "next/server";
import { z } from "zod";
import { createMobileChallengeService, MobileAuthError } from "@/modules/mobile/mobile-auth.service";

const schema = z.object({ codeChallenge: z.string(), state: z.string(), redirectUri: z.string() });

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new MobileAuthError("Mobile authorization request is invalid.", 400, "invalid_request");
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const userAgent = request.headers.get("user-agent")?.slice(0, 300) || "unknown";
    const result = await createMobileChallengeService({ ...parsed.data, requestFingerprint: `${forwarded}|${userAgent}` });
    return NextResponse.json({ ...result, authorizeUrl: new URL(result.authorizeUrl, request.url).toString() }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) { return mobileAuthError(error); }
}

function mobileAuthError(error: unknown) { const status = error instanceof MobileAuthError ? error.status : 500; if (!(error instanceof MobileAuthError)) console.error("Mobile challenge failed:", error); return NextResponse.json({ error: error instanceof MobileAuthError ? error.code : "internal_error", errorDescription: error instanceof MobileAuthError ? error.message : "Mobile authorization could not be started." }, { status, headers: { "cache-control": "no-store" } }); }
