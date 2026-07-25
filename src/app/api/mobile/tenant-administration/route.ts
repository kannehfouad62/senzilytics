import { NextResponse } from "next/server";
import {
  authenticateMobileRequest,
  MobileAuthError,
} from "@/modules/mobile/mobile-auth.service";
import {
  executeMobileTenantAdministrationAction,
  getMobileTenantAdministrationWorkspace,
  mobileTenantAdministrationActionSchema,
  MobileTenantAdministrationError,
} from "@/modules/mobile/mobile-tenant-administration.service";
import { getMobileAssignedPermissions } from "@/modules/mobile/mobile-executive.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { user, organization } = await authenticateMobileRequest(request);
    const workspace = await getMobileTenantAdministrationWorkspace({
      organizationId: organization.id,
      permissions: await getMobileAssignedPermissions(user.role),
    });

    return NextResponse.json(workspace, {
      headers: { "cache-control": "private, no-store" },
    });
  } catch (error) {
    return tenantAdministrationErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { session, user, organization } =
      await authenticateMobileRequest(request);
    const parsed = mobileTenantAdministrationActionSchema.safeParse(
      await request.json().catch(() => null)
    );
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "invalid_request",
          errorDescription: "The tenant administration request is invalid.",
        },
        {
          status: 400,
          headers: { "cache-control": "private, no-store" },
        }
      );
    }

    const result = await executeMobileTenantAdministrationAction({
      organizationId: organization.id,
      actorId: user.id,
      currentSessionId: session.id,
      permissions: await getMobileAssignedPermissions(user.role),
      payload: parsed.data,
    });
    return NextResponse.json(result, {
      headers: { "cache-control": "private, no-store" },
    });
  } catch (error) {
    return tenantAdministrationErrorResponse(error);
  }
}

function tenantAdministrationErrorResponse(error: unknown) {
  const known =
    error instanceof MobileAuthError ||
    error instanceof MobileTenantAdministrationError;
  if (!known) {
    console.error("Mobile tenant administration request failed:", error);
  }

  return NextResponse.json(
    {
      error: known ? error.code : "internal_error",
      errorDescription: known
        ? error.message
        : "The tenant administration request could not be completed.",
    },
    {
      status: known ? error.status : 500,
      headers: { "cache-control": "private, no-store" },
    }
  );
}
