import { NextResponse } from "next/server";
import {
  authenticateMobileRequest,
  MobileAuthError,
} from "@/modules/mobile/mobile-auth.service";
import {
  executeMobileComplianceDocumentAction,
  mobileComplianceDocumentActionSchema,
  MobileComplianceDocumentError,
} from "@/modules/mobile/mobile-compliance-documents.service";
import { getMobileAssignedPermissions } from "@/modules/mobile/mobile-executive.service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { user, organization } = await authenticateMobileRequest(request);
    const parsed = mobileComplianceDocumentActionSchema.safeParse(
      await request.json().catch(() => null)
    );

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "invalid_request",
          errorDescription:
            "The compliance or document action request is invalid.",
        },
        {
          status: 400,
          headers: { "cache-control": "no-store" },
        }
      );
    }

    const result = await executeMobileComplianceDocumentAction({
      organizationId: organization.id,
      userId: user.id,
      permissions: await getMobileAssignedPermissions(user.role),
      subscriptionPlan: organization.subscriptionPlan,
      payload: parsed.data,
    });

    return NextResponse.json(result, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return complianceDocumentErrorResponse(error);
  }
}

function complianceDocumentErrorResponse(error: unknown) {
  const known =
    error instanceof MobileAuthError ||
    error instanceof MobileComplianceDocumentError;
  const serviceError = classifyServiceError(error);

  if (!known && !serviceError) {
    console.error("Mobile compliance/document action failed:", error);
  }

  return NextResponse.json(
    {
      error: known
        ? error.code
        : (serviceError?.code ?? "internal_error"),
      errorDescription: known
        ? error.message
        : (serviceError?.message ??
          "The compliance or document action could not be completed."),
    },
    {
      status: known ? error.status : (serviceError?.status ?? 500),
      headers: { "cache-control": "no-store" },
    }
  );
}

function classifyServiceError(error: unknown) {
  if (!(error instanceof Error)) return null;
  const rules = [
    {
      prefix: "Compliance obligation not found",
      status: 404,
      code: "not_found",
    },
    {
      prefix: "Document not found.",
      status: 404,
      code: "not_found",
    },
    {
      prefix: "Only archived documents can be restored.",
      status: 409,
      code: "invalid_status",
    },
  ];
  const rule = rules.find((candidate) =>
    error.message.startsWith(candidate.prefix)
  );
  return rule ? { ...rule, message: error.message } : null;
}
