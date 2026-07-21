import { NextResponse } from "next/server";
import { authenticateMobileRequest, MobileAuthError, revokeMobileSessionService } from "@/modules/mobile/mobile-auth.service";

export async function POST(request: Request) {
  try { const principal = await authenticateMobileRequest(request); await revokeMobileSessionService(principal.session.id, principal.user.id, principal.organization.id); return NextResponse.json({ success: true }); }
  catch (error) { return NextResponse.json({ error: error instanceof MobileAuthError ? error.code : "internal_error" }, { status: error instanceof MobileAuthError ? error.status : 500 }); }
}
