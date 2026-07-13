import { processWorkflowSlaNotifications } from "@/core/workflow/workflow-sla.service";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorizedCronRequest(
  request: NextRequest
) {
  const cronSecret =
    process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    console.error(
      "CRON_SECRET is missing."
    );

    return false;
  }

  const authorization =
    request.headers.get("authorization");

  return authorization ===
    `Bearer ${cronSecret}`;
}

export async function GET(
  request: NextRequest
) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json(
      {
        error: "Unauthorized.",
      },
      {
        status: 401,
      }
    );
  }

  try {
    const result =
      await processWorkflowSlaNotifications();

    return NextResponse.json({
      success: true,
      processedAt: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error(
      "Workflow SLA Cron failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Workflow SLA processing failed.",
      },
      {
        status: 500,
      }
    );
  }
}