import { NextResponse } from "next/server";
import { authenticateMobileRequest, MobileAuthError } from "@/modules/mobile/mobile-auth.service";
import { syncOfflineSubmissionsService } from "@/modules/mobile/offline-sync.service";

export async function POST(request: Request) {
  try {
    const { user, organization } = await authenticateMobileRequest(request);
    const result = await syncOfflineSubmissionsService({ organizationId: organization.id, userId: user.id, departmentId: user.departmentId, role: user.role, request: await request.json().catch(() => null) });
    return NextResponse.json(result.body, { status: result.status, headers: { "cache-control": "no-store" } });
  } catch (error) { if (!(error instanceof MobileAuthError)) console.error("Mobile synchronization failed:", error); return NextResponse.json({ error: error instanceof MobileAuthError ? error.code : "internal_error", errorDescription: error instanceof MobileAuthError ? error.message : "Synchronization failed." }, { status: error instanceof MobileAuthError ? error.status : 500, headers: { "cache-control": "no-store" } }); }
}
