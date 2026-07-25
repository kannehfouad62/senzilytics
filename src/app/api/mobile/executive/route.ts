import { NextResponse } from "next/server";
import {
  authenticateMobileRequest,
  MobileAuthError,
} from "@/modules/mobile/mobile-auth.service";
import {
  executeMobileExecutiveAction,
  getMobileAssignedPermissions,
  getMobileExecutiveWorkspace,
  mobileExecutiveActionSchema,
  MobileExecutiveActionError,
} from "@/modules/mobile/mobile-executive.service";

export async function GET(request: Request) {
  try {
    const { user, organization } = await authenticateMobileRequest(request);
    const workspace = await getMobileExecutiveWorkspace({
      organizationId: organization.id,
      userId: user.id,
      permissions: await getMobileAssignedPermissions(user.role),
    });

    return NextResponse.json(
      {
        executiveGeneratedAt: workspace.generatedAt,
        executiveCapabilities: workspace.capabilities,
        executiveDashboard: workspace.dashboard,
        executivePortfolio: workspace.portfolio,
        operationalAssurance: workspace.assurance,
        executiveReport: workspace.report,
        executiveAiAnalyses: workspace.aiAnalyses,
        executiveAiMetrics: workspace.aiMetrics,
      },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    return executiveErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user, organization } = await authenticateMobileRequest(request);
    const parsed = mobileExecutiveActionSchema.safeParse(
      await request.json().catch(() => null)
    );

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "invalid_request",
          errorDescription: "The executive action request is invalid.",
        },
        {
          status: 400,
          headers: { "cache-control": "no-store" },
        }
      );
    }

    const result = await executeMobileExecutiveAction({
      organizationId: organization.id,
      userId: user.id,
      permissions: await getMobileAssignedPermissions(user.role),
      payload: parsed.data,
    });

    return NextResponse.json(result, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return executiveErrorResponse(error);
  }
}

function executiveErrorResponse(error: unknown) {
  const serviceError = classifyExecutiveServiceError(error);
  if (
    !(error instanceof MobileAuthError) &&
    !(error instanceof MobileExecutiveActionError) &&
    !serviceError
  ) {
    console.error("Mobile executive request failed:", error);
  }

  const known =
    error instanceof MobileAuthError ||
    error instanceof MobileExecutiveActionError;

  return NextResponse.json(
    {
      error: known
        ? error.code
        : (serviceError?.code ?? "internal_error"),
      errorDescription: known
        ? error.message
        : (serviceError?.message ??
          "The executive request could not be completed."),
    },
    {
      status: known ? error.status : (serviceError?.status ?? 500),
      headers: { "cache-control": "no-store" },
    }
  );
}

function classifyExecutiveServiceError(error: unknown) {
  if (!(error instanceof Error)) return null;
  const rules = [
    {
      prefix: "The hourly intelligence analysis limit has been reached.",
      status: 429,
      code: "rate_limit_exceeded",
    },
    {
      prefix: "No tenant-authorized intelligence sources are available",
      status: 409,
      code: "sources_unavailable",
    },
    {
      prefix: "Intelligence analysis not found.",
      status: 404,
      code: "not_found",
    },
    {
      prefix:
        "This intelligence analysis already has a final review decision.",
      status: 409,
      code: "decision_final",
    },
    {
      prefix: "Enter a specific management question",
      status: 400,
      code: "invalid_request",
    },
    {
      prefix: "The intelligence question cannot exceed",
      status: 400,
      code: "invalid_request",
    },
    {
      prefix: "Select approve or reject",
      status: 400,
      code: "invalid_request",
    },
    {
      prefix: "Explain why the analysis is being rejected.",
      status: 400,
      code: "invalid_request",
    },
  ];
  const rule = rules.find((candidate) =>
    error.message.startsWith(candidate.prefix)
  );

  return rule ? { ...rule, message: error.message } : null;
}
